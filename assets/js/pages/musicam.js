// /assets/js/pages/musicam.js
// Module de page MusiCam — compatible PJAX (init/destroy), idempotent et très journalisé.
// Rôle : connecter l’UI de la page (boutons/inputs) au moteur applicatif MusiCam
//        (/assets/js/musicam/musicam.js), gérer l’état, les événements et les logs.
//
// Conception :
// - Exporte { init, destroy } pour que page-hub.js puisse piloter le cycle de vie.
// - Idempotence totale : init() et destroy() peuvent être appelés plusieurs fois sans effets indésirables.
// - Import dynamique du moteur (fallback-safe), avec "feature detection" des méthodes.
// - Journalisation lisible (console) + audit optionnel : window.MusiCamAudit().
//
// Dépendances attendues dans la page HTML :
// - Les éléments DOM identifiés par #webcam, #overlay, #cam, #videoWrap et tous les contrôles.
// - Les vendors MediaPipe/TFJS si nécessaires (déjà chargés dans la page).
//
// API moteur (détectée dynamiquement, toutes optionnelles) :
//   engine.init(opts), engine.destroy()
//   engine.start(), engine.stop(), engine.calibrate(), engine.enableAudio()
//   engine.setInstrument(v), engine.setMappingMode(v), engine.setScale(v)
//   engine.setSensitivity(n), engine.setNoteOffMs(ms)
//   engine.setOutputMode('auto'|'synth'|'midi')
//   engine.setFaceEnabled(bool), engine.toggleFace?()
//   engine.switchCamera()
//   engine.setParam(name, val), engine.setFx(name, val)
//   engine.onStatus(cb: (partialStatus) => void)
//   engine.onFPS(cb: (fps) => void)
//   engine.getStatus?(): { poseOk, faceOk, audio, midi, fps, cameraLabel, ... }
//
// Tout est protégé : si une méthode est absente, on loggue et on évite l’erreur.

export { destroy, init };

/* ========================================================================== */
/* LOGGING                                                                    */
/* ========================================================================== */
const TAG = '%c[MusiCamPage]';
const CSS = 'background:#0b1f2a;color:#8bf0ff;font-weight:700;padding:2px 6px;border-radius:3px';
const OK  = 'background:#0c2a1a;color:#77ffcc;font-weight:700;padding:2px 6px;border-radius:3px';
const BAD = 'background:#2b1d1d;color:#ffb3b3;font-weight:700;padding:2px 6px;border-radius:3px';

const log  = (...a) => console.log(TAG, CSS, ...a);
const info = (...a) => console.info(TAG, CSS, ...a);
const warn = (...a) => console.warn(TAG, CSS, ...a);
const err  = (...a) => console.error(TAG, CSS, ...a);
const dbg  = (...a) => console.debug(TAG, CSS, ...a);

/* ========================================================================== */
/* ÉTAT MODULE                                                                */
/* ========================================================================== */
let state = null;

function ensureState() {
  if (state) return state;
  state = {
    mounted: false,
    destroyed: false,
    root: null,
    engine: null,
    engineModule: null,
    // Réfs DOM
    el: {
      videoWrap: null,
      cam: null,
      webcam: null,
      overlay: null,
      // Actions
      startBtn: null,
      stopBtn: null,
      calibrateBtn: null,
      enableAudioBtn: null,
      switchCamBtn: null,
      fitToggleBtn: null,
      fitLabel: null,
      toggleFaceBtn: null,
      // Selects
      instrument: null,
      mappingMode: null,
      scale: null,
      audioOut: null,
      // Inputs
      sensitivity: null,
      noteOffMs: null,
      tempoBPM: null,
      // Badges
      poseStatus: null,
      faceStatus: null,
      audioStatus: null,
      midiStatus: null,
      fpsBadge: null,
      // Infos
      energyWrap: null,
      energyBar: null,
      energyVal: null,
      videoInfo: null,
      // Groupe avancé
      advDetails: null,
      advSynth: null,
    },
    // Gestionnaires à débrancher au destroy()
    listeners: [],
    // Observer (optionnel)
    resizeObserver: null,
    // FPS
    fps: {
      lastTs: performance.now(),
      frames: 0,
      timer: null,
    },
    // UI
    fitMode: 'cover', // autre valeur: 'contain'
    faceEnabled: false,
    // Hook engine → page
    unsubEngineStatus: null,
    unsubEngineFPS: null,
  };
  return state;
}

/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */
const qs  = (root, sel) => (root || document).querySelector(sel);
const qsa = (root, sel) => Array.from((root || document).querySelectorAll(sel));

function on(el, ev, fn, opts) {
  if (!el) return () => {};
  el.addEventListener(ev, fn, opts);
  return () => { try { el.removeEventListener(ev, fn, opts); } catch {} };
}

function callIf(fn, ctx, ...args) {
  if (fn && typeof fn === 'function') {
    try { return fn.apply(ctx || null, args); } catch (e) { err('Erreur appel méthode moteur', e); }
  } else {
    dbg('Méthode manquante (ignorer)', fn);
  }
  return undefined;
}

async function loadEngineOnce() {
  const s = ensureState();
  if (s.engineModule) return s.engineModule;

  const candidates = [
    '/assets/js/musicam/musicam.js',                 // moteur principal attendu
    '/assets/js/musicam/index.js',                   // fallback possible
  ];

  let lastError = null;
  for (const url of candidates) {
    try {
      info('Import moteur →', url);
      // Important : import() relatif à la racine (chemin absolu)
      const mod = await import(url);
      s.engineModule = mod;
      s.engine = mod?.default || mod;
      if (!s.engine || typeof s.engine !== 'object') {
        throw new Error('Module importé mais export inattendu (pas d’object/defaut).');
      }
      info('Moteur chargé', OK, s.engine);
      return s.engineModule;
    } catch (e) {
      lastError = e;
      warn('Échec import moteur', url, e);
    }
  }
  throw lastError || new Error('Impossible de charger le moteur MusiCam.');
}

/* ========================================================================== */
/* LIAISON UI → MOTEUR                                                        */
/* ========================================================================== */
function bindUI() {
  const s = ensureState();
  const el = s.el;

  // --- Boutons de base ---
  s.listeners.push(on(el.startBtn, 'click', () => {
    info('UI: Démarrer');
    callIf(s.engine?.start, s.engine);
  }));
  s.listeners.push(on(el.stopBtn, 'click', () => {
    info('UI: Arrêter');
    callIf(s.engine?.stop, s.engine);
  }));
  s.listeners.push(on(el.calibrateBtn, 'click', () => {
    info('UI: Calibrer');
    callIf(s.engine?.calibrate, s.engine);
  }));
  s.listeners.push(on(el.enableAudioBtn, 'click', () => {
    info('UI: Geste init audio');
    // Plusieurs moteurs utilisent enableAudio() / resume() / unlockAudio()
    callIf(s.engine?.enableAudio, s.engine);
    callIf(s.engine?.resume, s.engine);
    callIf(s.engine?.unlockAudio, s.engine);
  }));

  // --- Caméra / affichage ---
  s.listeners.push(on(el.switchCamBtn, 'click', async () => {
    info('UI: Switch caméra');
    const r = await callIf(s.engine?.switchCamera, s.engine);
    if (r && typeof r === 'string' && el.videoInfo) el.videoInfo.textContent = `Caméra: ${r}`;
  }));

  s.listeners.push(on(el.fitToggleBtn, 'click', () => {
    s.fitMode = (s.fitMode === 'cover') ? 'contain' : 'cover';
    if (el.videoWrap) {
      el.videoWrap.classList.remove('cover', 'contain');
      el.videoWrap.classList.add(s.fitMode);
    }
    if (el.fitLabel) el.fitLabel.textContent = s.fitMode;
    info('UI: Fit vidéo →', s.fitMode);
  }));

  s.listeners.push(on(el.toggleFaceBtn, 'click', () => {
    s.faceEnabled = !s.faceEnabled;
    if (el.toggleFaceBtn) el.toggleFaceBtn.setAttribute('aria-pressed', String(s.faceEnabled));
    info('UI: FaceMesh →', s.faceEnabled ? 'ON' : 'OFF');
    // Selon moteur : setFaceEnabled(bool) ou toggleFace()
    if (typeof s.engine?.setFaceEnabled === 'function') {
      s.engine.setFaceEnabled(s.faceEnabled);
    } else {
      callIf(s.engine?.toggleFace, s.engine);
    }
  }));

  // --- Selects principaux ---
  s.listeners.push(on(el.instrument, 'change', (e) => {
    const v = e.target.value;
    info('UI: Instrument →', v);
    callIf(s.engine?.setInstrument, s.engine, v);
  }));
  s.listeners.push(on(el.mappingMode, 'change', (e) => {
    const v = e.target.value;
    info('UI: Mapping →', v);
    callIf(s.engine?.setMappingMode, s.engine, v);
  }));
  s.listeners.push(on(el.scale, 'change', (e) => {
    const v = e.target.value;
    info('UI: Gamme →', v);
    callIf(s.engine?.setScale, s.engine, v);
  }));
  s.listeners.push(on(el.audioOut, 'change', (e) => {
    const v = e.target.value;
    info('UI: Sortie audio →', v);
    callIf(s.engine?.setOutputMode, s.engine, v);
  }));

  // --- Inputs simples ---
  s.listeners.push(on(el.sensitivity, 'input', (e) => {
    const v = parseFloat(e.target.value);
    info('UI: Sensibilité mouvement →', v);
    callIf(s.engine?.setSensitivity, s.engine, v);
  }));
  s.listeners.push(on(el.noteOffMs, 'input', (e) => {
    const v = parseInt(e.target.value, 10);
    info('UI: Note-off (ms) →', v);
    callIf(s.engine?.setNoteOffMs, s.engine, v);
  }));
  s.listeners.push(on(el.tempoBPM, 'input', (e) => {
    const v = parseInt(e.target.value, 10);
    info('UI: Tempo BPM →', v);
    callIf(s.engine?.setParam, s.engine, 'tempoBPM', v);
  }));

  // --- Synthé avancé : data-audio-param / data-audio-fx ---
  const paramInputs = qsa(s.root, '[data-audio-param]');
  for (const input of paramInputs) {
    const name = input.getAttribute('data-audio-param');
    const handler = (e) => {
      const val = (input.type === 'number') ? parseFloat(e.target.value) : parseFloat(e.target.value);
      info('UI: Param', name, '→', val);
      callIf(s.engine?.setParam, s.engine, name, val);
    };
    s.listeners.push(on(input, 'input', handler));
    s.listeners.push(on(input, 'change', handler));
  }

  const fxInputs = qsa(s.root, '[data-audio-fx]');
  for (const input of fxInputs) {
    const name = input.getAttribute('data-audio-fx');
    const handler = (e) => {
      const val = parseFloat(e.target.value);
      info('UI: FX', name, '→', val);
      callIf(s.engine?.setFx, s.engine, name, val);
    };
    s.listeners.push(on(input, 'input', handler));
    s.listeners.push(on(input, 'change', handler));
  }

  info('UI câblée', OK);
}

/* ========================================================================== */
/* MAPPAGE DES ÉLÉMENTS DOM                                                   */
/* ========================================================================== */
function mapElements() {
  const s = ensureState();
  const root = s.root;

  s.el.videoWrap      = qs(root, '#videoWrap');
  s.el.cam            = qs(root, '#cam');
  s.el.webcam         = qs(root, '#webcam');
  s.el.overlay        = qs(root, '#overlay');

  s.el.startBtn       = qs(root, '#startBtn');
  s.el.stopBtn        = qs(root, '#stopBtn');
  s.el.calibrateBtn   = qs(root, '#calibrateBtn');
  s.el.enableAudioBtn = qs(root, '#enableAudio');

  s.el.switchCamBtn   = qs(root, '#switchCamBtn');
  s.el.fitToggleBtn   = qs(root, '#fitToggleBtn');
  s.el.fitLabel       = qs(root, '#fitLabel');
  s.el.toggleFaceBtn  = qs(root, '#toggleFace');

  s.el.instrument     = qs(root, '#instrument');
  s.el.mappingMode    = qs(root, '#mappingMode');
  s.el.scale          = qs(root, '#scale');
  s.el.audioOut       = qs(root, '#audioOut');

  s.el.sensitivity    = qs(root, '#sensitivity');
  s.el.noteOffMs      = qs(root, '#noteOffMs');
  s.el.tempoBPM       = qs(root, '#tempoBPM');

  s.el.poseStatus     = qs(root, '#poseStatus');
  s.el.faceStatus     = qs(root, '#faceStatus');
  s.el.audioStatus    = qs(root, '#audioStatus');
  s.el.midiStatus     = qs(root, '#midiStatus');
  s.el.fpsBadge       = qs(root, '#fpsBadge');

  s.el.energyWrap     = qs(root, '#energyWrap');
  s.el.energyBar      = qs(root, '#energyBar');
  s.el.energyVal      = qs(root, '#energyVal');
  s.el.videoInfo      = qs(root, '#videoInfo');

  s.el.advDetails     = qs(root, '#advancedDetails');
  s.el.advSynth       = qs(root, '#advancedSynth');

  // Vérifs minimales :
  const missing = [];
  ['webcam','overlay','startBtn','stopBtn','calibrateBtn'].forEach(id => {
    if (!s.el[id]) missing.push(`#${id}`);
  });
  if (missing.length) {
    warn('Éléments essentiels manquants', BAD, missing.join(', '));
  } else {
    info('Éléments DOM mappés', OK);
  }
}

/* ========================================================================== */
/* STATUTS / FPS                                                              */
/* ========================================================================== */
function setBadge(el, label, ok) {
  if (!el) return;
  el.textContent = `${label}: ${ok === true ? 'OK' : ok === false ? '—' : ok ?? '—'}`;
  el.classList.remove('text-bg-secondary','text-bg-success','text-bg-danger','text-bg-warning');
  if (ok === true) el.classList.add('text-bg-success');
  else if (ok === false) el.classList.add('text-bg-warning');
  else el.classList.add('text-bg-secondary');
}

function updateStatus(partial) {
  // Appelé par le moteur (si onStatus() dispo) avec { poseOk, faceOk, audio, midi, fps, cameraLabel, energy, ... }
  const s = ensureState();
  const E = s.el;
  if (!partial || typeof partial !== 'object') return;

  if ('poseOk' in partial)  setBadge(E.poseStatus, 'Pose', !!partial.poseOk);
  if ('faceOk' in partial)  setBadge(E.faceStatus, 'Face', !!partial.faceOk);
  if ('audio' in partial)   setBadge(E.audioStatus, 'Audio', partial.audio);
  if ('midi' in partial)    setBadge(E.midiStatus, 'MIDI', partial.midi);
  if ('fps' in partial && E.fpsBadge) E.fpsBadge.textContent = `FPS: ${Math.round(partial.fps)}`;
  if ('cameraLabel' in partial && E.videoInfo) E.videoInfo.textContent = `Caméra: ${partial.cameraLabel}`;
  if ('energy' in partial && E.energyBar && E.energyVal) {
    const v = Math.max(0, Math.min(1, Number(partial.energy) || 0));
    E.energyBar.style.width = `${(v*100).toFixed(1)}%`;
    E.energyVal.textContent = v.toFixed(2);
  }
}

function wireEngineCallbacks() {
  const s = ensureState();
  if (typeof s.engine?.onStatus === 'function') {
    info('Abonnement statut moteur');
    s.unsubEngineStatus = s.engine.onStatus((st) => {
      dbg('Status@engine →', st);
      updateStatus(st);
    });
  }
  if (typeof s.engine?.onFPS === 'function') {
    info('Abonnement FPS moteur');
    s.unsubEngineFPS = s.engine.onFPS((fps) => {
      const E = s.el;
      if (E.fpsBadge) E.fpsBadge.textContent = `FPS: ${Math.round(fps)}`;
    });
  }
}

/* ========================================================================== */
/* INIT / DESTROY                                                             */
/* ========================================================================== */
function init() {
  const s = ensureState();
  if (s.mounted) { dbg('init() ignoré (déjà monté)'); return; }

  s.root = (document.querySelector('main[data-page="musicam"]') || document);
  s.destroyed = false;

  info('Init page MusiCam…');
  envDiag();
  mapElements();
  bindUI();

  // Pause polie du lecteur audio global si présent (meta audio-policy = pause).
  try { window.dispatchEvent(new CustomEvent('player:pause-request')); } catch {}

  // Import moteur et initialisation
  (async () => {
    try {
      await loadEngineOnce();

      // Options passées au moteur (tolère l’absence)
      const opts = {
        videoEl: s.el.webcam,
        hiddenVideoEl: s.el.cam,
        overlayEl: s.el.overlay,
        videoWrapEl: s.el.videoWrap,
        onStatus: updateStatus,
      };

      if (typeof s.engine?.init === 'function') {
        info('Appel engine.init(opts)…');
        await s.engine.init(opts);
      } else {
        warn('engine.init() absent, on suppose une auto-init basée sur le DOM.');
      }

      wireEngineCallbacks();

      // Propager les valeurs initiales (évite le "premier lacet" silencieux)
      if (s.el.instrument)  callIf(s.engine?.setInstrument,  s.engine, s.el.instrument.value);
      if (s.el.mappingMode) callIf(s.engine?.setMappingMode, s.engine, s.el.mappingMode.value);
      if (s.el.scale)       callIf(s.engine?.setScale,       s.engine, s.el.scale.value);
      if (s.el.audioOut)    callIf(s.engine?.setOutputMode,  s.engine, s.el.audioOut.value);
      if (s.el.sensitivity) callIf(s.engine?.setSensitivity, s.engine, parseFloat(s.el.sensitivity.value));
      if (s.el.noteOffMs)   callIf(s.engine?.setNoteOffMs,   s.engine, parseInt(s.el.noteOffMs.value,10));

      // Lire un statut initial si dispo
      const initial = callIf(s.engine?.getStatus, s.engine);
      if (initial) updateStatus(initial);

      // Ajuster le mode d’affichage vidéo
      if (s.el.videoWrap) {
        s.el.videoWrap.classList.remove('cover','contain');
        s.el.videoWrap.classList.add(s.fitMode);
        if (s.el.fitLabel) s.el.fitLabel.textContent = s.fitMode;
      }

      s.mounted = true;
      info('MusiCam prêt', OK);
    } catch (e) {
      err('Échec initialisation MusiCam', e);
    }
  })();
}

function destroy() {
  const s = ensureState();
  if (!s.mounted && s.destroyed) { dbg('destroy() ignoré (déjà détruit)'); return; }
  info('Destroy page MusiCam…');

  // Désabonnements UI
  for (const off of s.listeners.splice(0)) {
    try { off(); } catch {}
  }

  // Désabonnements moteur
  if (typeof s.unsubEngineStatus === 'function') {
    try { s.unsubEngineStatus(); } catch {}
  }
  if (typeof s.unsubEngineFPS === 'function') {
    try { s.unsubEngineFPS(); } catch {}
  }
  s.unsubEngineStatus = null;
  s.unsubEngineFPS = null;

  // Appel destroy du moteur si dispo
  if (s.engine && typeof s.engine.destroy === 'function') {
    try { s.engine.destroy(); info('engine.destroy() → OK'); }
    catch (e) { warn('engine.destroy() a échoué', e); }
  }

  // Observer
  if (s.resizeObserver) {
    try { s.resizeObserver.disconnect(); } catch {}
    s.resizeObserver = null;
  }

  s.mounted = false;
  s.destroyed = true;
  info('Destroy terminé', OK);
}

/* ========================================================================== */
/* DIAGNOSTIC ENVIRONNEMENT                                                   */
/* ========================================================================== */
function envDiag() {
  const https   = location.protocol === 'https:';
  const gUM     = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const camEnum = !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices);
  const ofc     = (typeof OffscreenCanvas !== 'undefined');
  const tfjs    = !!window.tf;
  const mpPose  = typeof window.Pose !== 'undefined' || typeof window.mpPose !== 'undefined';
  const mpFace  = typeof window.FaceMesh !== 'undefined' || typeof window.mpFaceMesh !== 'undefined';

  info('Diagnostics :');
  log('HTTPS ?', https ? OK : BAD, https);
  log('getUserMedia ?', gUM ? OK : BAD, gUM);
  log('enumerateDevices ?', camEnum ? OK : BAD, camEnum);
  log('OffscreenCanvas ?', ofc ? OK : BAD, ofc);
  log('TFJS chargé ?', tfjs ? OK : BAD, tfjs);
  log('MediaPipe Pose ?', mpPose ? OK : BAD, mpPose);
  log('MediaPipe FaceMesh ?', mpFace ? OK : BAD, mpFace);

  if (!https) warn('Astuce: GitHub Pages exige HTTPS pour la caméra.');
}

/* ========================================================================== */
/* AUDIT PROFOND (à lancer depuis la console)                                 */
/* ========================================================================== */
window.MusiCamAudit = async function MusiCamAudit() {
  const s = ensureState();
  console.groupCollapsed('%c[MusiCamAudit] Audit profond', 'background:#222;color:#fff;padding:2px 6px;border-radius:3px');
  try {
    envDiag();

    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      const auds = devices.filter(d => d.kind === 'audioinput');
      console.table(cams.map((d,i) => ({ '#': i, label: d.label || '(permission requise)', deviceId: d.deviceId })));
      console.table(auds.map((d,i) => ({ '#': i, label: d.label || '(permission requise)', deviceId: d.deviceId })));
    } else {
      warn('enumerateDevices indisponible (permission non accordée ?)');
    }

    if (s.engine) {
      const st = callIf(s.engine.getStatus, s.engine);
      info('Status moteur courant →', st ?? '(non fourni)');
      info('Méthodes moteur dispo →', Object.keys(s.engine).filter(k => typeof s.engine[k] === 'function'));
    } else {
      warn('Moteur non encore chargé. Lance init() puis Démarrer.');
    }
  } catch (e) {
    err('Erreur pendant l’audit', e);
  } finally {
    console.groupEnd();
  }
};

/* ========================================================================== */
/* GARDE DE SÉCURITÉ : AUTO-INIT LORS D’UN CHARGEMENT DIRECT                  */
/* (Certains routeurs appellent init() explicitement. Si ce fichier est chargé
   directement hors page-hub, on peut choisir d’auto-init — ici on NE le fait
   pas, pour laisser le contrôle total au hub.)                                */
/* ========================================================================== */
// (pas d’auto-init)
