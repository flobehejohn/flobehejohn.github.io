// assets/js/musicam/modules/ui.js
// Wiring UI : audio badge & boutons, énergie/FPS, profils, contrôles synthé avancés.
// + Throttling rAF des sliders (évite le spam du Worklet) + dropdown modes enrichi.

import * as audio from './audio.js';
import { state } from './state.js';

const $  = (id) => document.getElementById(id);
const on = (el, evt, fn, opts = {}) => { if (el) el.addEventListener(evt, fn, opts); };

// ———————————————————————————————————————————————————————————
// Constantes / utilitaires
// ———————————————————————————————————————————————————————————
const UI_THROTTLE_MS = 55;     // sliders synth (mini-interval)
const UI_THROTTLE_FX = 70;     // sliders FX (mini-interval)
const MAPPING_MODES = [
  { value:'fixed',           label:'Notes fixes (poignets/coudes)' },
  { value:'y-pitch',         label:'Hauteur = Y (quantifiée)' },
  { value:'drum-limbs',      label:'Batterie par membres' },
  { value:'x-y-theremin',    label:'Theremin X/Y (pitch à droite, filtre à gauche)' },
  { value:'head-bend',       label:'Vibrato/bend par la tête' },
  { value:'tap-tempo-head',  label:'Tap tempo (hochements de tête)' },
];

// Throttle rAF par élément (coalesce la dernière valeur, respect d’un min-interval)
function rafThrottle(fn, minIntervalMs = 0) {
  let lastT = 0;
  let pending = false;
  let lastArgs = null;

  const flush = () => {
    pending = false;
    const now = performance.now();
    if (now - lastT >= minIntervalMs) {
      lastT = now;
      try { fn(...(lastArgs || [])); } finally { lastArgs = null; }
    } else {
      pending = true;
      requestAnimationFrame(flush);
    }
  };

  return (...args) => {
    lastArgs = args;
    if (!pending) {
      pending = true;
      requestAnimationFrame(flush);
    }
  };
}

// EMA util (pour lisser les seuils cibles → pas d’à-coups dans la boucle)
function ema(prev, next, a = 0.22) { return (prev == null) ? next : (prev + a * (next - prev)); }

// Clamp util
function clamp01(x){ return Math.max(0, Math.min(1, x)); }

// ———————————————————————————————————————————————————————————
// Helpers overlay (superpose le squelette au-dessus de la vidéo)
// ———————————————————————————————————————————————————————————
function fitOverlayToVideo() {
  const video = $('webcam');
  const cvs   = $('overlay');
  if (!video || !cvs) return;

  const host = (typeof cvs.closest === 'function' ? cvs.closest('.video-wrap') : null) || video.parentElement;
  const stage = host?.parentElement || null;
  const hostRect  = host && typeof host.getBoundingClientRect === 'function' ? host.getBoundingClientRect()  : null;
  const stageRect = stage && typeof stage.getBoundingClientRect === 'function' ? stage.getBoundingClientRect() : null;
  const targetRatio = 16 / 9;

  const widthCandidates = [
    stageRect?.width,
    stage?.clientWidth,
    stage?.offsetWidth,
    hostRect?.width,
    host?.clientWidth,
    host?.offsetWidth,
    video.clientWidth,
    video.offsetWidth,
    video.videoWidth,
    cvs.clientWidth,
    cvs.offsetWidth,
  ].map(v => (typeof v === 'number' ? v : Number(v) || 0));

  const cssW = widthCandidates.find(v => v > 1) || 0;
  if (!cssW) {
    delete cvs.dataset.overlayWidth;
    delete cvs.dataset.overlayHeight;
    if (host) {
      host.style.removeProperty('height');
      host.style.removeProperty('--video-wrap-height');
      host.style.removeProperty('width');
    }
    return;
  }

  const widthPx = Math.round(cssW);
  const cssH = Math.max(1, Math.round(widthPx / targetRatio));

  if (host) {
    host.style.removeProperty('width');
    host.style.removeProperty('--video-wrap-height');
    host.style.removeProperty('height');
  }

  // ⚠️ OffscreenCanvas : ne PAS toucher cvs.width/height (géré côté worker)
  // On ajuste seulement le rendu CSS pour la superposition 1:1.
  cvs.style.position = 'absolute';
  cvs.style.inset = '0';
  cvs.style.width = '100%';
  cvs.style.height = '100%';
  cvs.style.pointerEvents = 'none';
  cvs.style.zIndex = '10';

  cvs.dataset.overlayWidth  = String(widthPx);
  cvs.dataset.overlayHeight = String(cssH);
}


function startOverlaySyncLoop() {
  let t = 0;
  const pump = () => {
    fitOverlayToVideo();
    if (t++ < 60) requestAnimationFrame(pump); // ~1s de rattrapage au chargement
  };
  pump();

  window.addEventListener('resize', fitOverlayToVideo);
  const v = $('webcam');
  if (v) {
    on(v, 'loadedmetadata', fitOverlayToVideo);
    on(v, 'resize',         fitOverlayToVideo);
  }
}

// ———————————————————————————————————————————————————————————
// Badges/affichages runtime
// ———————————————————————————————————————————————————————————
export function setBadge(id, text, bg = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  if (bg) el.style.background = bg;
}

// --- UI: badge FPS anti-clignote (≤4 Hz) + arrondi .0/.5 + no-op si identique
let __fps_lastT = 0;
let __fps_lastRounded = NaN;
const __FPS_MIN_INTERVAL_MS = 250;           // 1000 / 4 Hz
const __round05 = n => Math.round((+n || 0) * 2) / 2;

function __writeFPSBadge(val05){
  const el = $('fpsBadge');
  if (!el) return;
  // force 1 décimale (0.0 ou 0.5)
  el.textContent = `FPS: ${val05.toFixed(1)}`;
}

/**
 * setFPS : point d’écriture unique (throttlé) du badge FPS.
 * - ≤ 4 Hz (intervalle min 250 ms)
 * - arrondi par pas de 0.5 pour une lecture stable
 * - évite les écritures inutiles si la valeur arrondie n’a pas changé
 */
export function setFPS(fps){
  const t = performance.now();
  const r = __round05(fps);
  if (t - __fps_lastT < __FPS_MIN_INTERVAL_MS && r === __fps_lastRounded) return;
  __fps_lastT = t; __fps_lastRounded = r;
  __writeFPSBadge(r);
}

/**
 * perfAudit : hook d’audit côté loop → délègue à setFPS (throttlé)
 */
export function perfAudit({ fpsEMA /*, inferEvery, resolution, lastInferMs*/ }){
  setFPS(fpsEMA);
}

/**
 * setEnergy : met à jour la jauge et le texte d’énergie
 * + micro-sécurité : applique une transition si le CSS n’est pas chargé
 */
export function setEnergy(percent, raw = 0) {
  const bar = $('energyBar'), val = $('energyVal');
  if (bar) {
    // Transition JS de secours (si la CSS n’est pas présente)
    const cs = getComputedStyle(bar);
    if (!/width/i.test(cs.transitionProperty || '')) {
      bar.style.transition = 'width .12s linear';
    }
    bar.style.width = `${Math.max(0, Math.min(100, percent)).toFixed(1)}%`;
  }
  if (val) val.textContent = raw.toFixed(3);
}

export function setButtons({ running }) {
  const s = $('startBtn'), t = $('stopBtn');
  if (s) s.disabled = !!running;
  if (t) t.disabled = !running;
}

// ———————————————————————————————————————————————————————————
// Audio badge & boutons
// ———————————————————————————————————————————————————————————
function wireAudioBadge() {
  const badge = $('audioStatus');
  if (badge) { badge.textContent = 'Audio: —'; badge.style.opacity = '0.6'; }
  window.addEventListener('mc:audio', (e) => {
    const running = !!e.detail?.running;
    if (!badge) return;
    badge.textContent = running ? 'Audio: ON' : 'Audio: —';
    badge.style.opacity = running ? '1' : '0.6';
  });

  // (optionnel) debug Worklet → met à jour de petits badges si présents
  window.addEventListener('mc:workletDebug', (e) => {
    const d = e.detail || {};
    const vb = $('voicesBadge');
    if (vb && typeof d.voicesActive === 'number') vb.textContent = `Voices: ${d.voicesActive}`;
  });
}

function wireAudioButtons() {
  const btnEnable = $('enableAudio');
  on(btnEnable, 'click', async (e) => {
    e.preventDefault();
    try { await audio.start(); } catch {}
  }, { passive: false });

  const btnStop = $('btn-audio-stop');
  on(btnStop, 'click', async (e) => {
    e.preventDefault();
    try { await audio.suspend(); } catch {}
  }, { passive: false });
}

// ———————————————————————————————————————————————————————————
// Dropdowns / listes (modes de mapping)
// ———————————————————————————————————————————————————————————
function populateMappingModesIfEmpty() {
  const sel = $('mappingMode');
  if (!sel) return;
  if (sel.options && sel.options.length > 0) return; // déjà fourni par le HTML

  for (const m of MAPPING_MODES) {
    const opt = document.createElement('option');
    opt.value = m.value;
    opt.textContent = m.label;
    sel.appendChild(opt);
  }
  // valeur par défaut
  sel.value = state.mappingMode || 'y-pitch';
}

// ———————————————————————————————————————————————————————————
/**
 * Contrôles synthé/FX/tempo
 * - input : throttlé par rAF + min-interval
 * - change : envoi immédiat
 */
function wireAdvancedSynthControls() {
  // Synth params
  document.querySelectorAll('[data-audio-param]').forEach(el => {
    const key = el.getAttribute('data-audio-param');
    const msAttr = parseInt(el.getAttribute('data-throttle') || '', 10);
    const minGap = Number.isFinite(msAttr) ? Math.max(16, msAttr) : UI_THROTTLE_MS;

    const send = () => {
      const raw = (el.type === 'range' || el.type === 'number') ? +el.value : el.value;
      const val = Number.isNaN(raw) ? el.value : raw;
      audio.setSynthParams({ [key]: val });
      state.synth = { ...(state.synth || {}), [key]: val };
      try { window.__mc_lastSynthParams = { ...(window.__mc_lastSynthParams||{}), [key]: val }; } catch {}
    };

    const onInput  = rafThrottle(send, minGap);
    const onChange = () => send();

    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
  });

  // FX
  document.querySelectorAll('[data-audio-fx]').forEach(el => {
    const key = el.getAttribute('data-audio-fx');
    const msAttr = parseInt(el.getAttribute('data-throttle') || '', 10);
    const minGap = Number.isFinite(msAttr) ? Math.max(16, msAttr) : UI_THROTTLE_FX;

    const send = () => {
      const v = +el.value;
      audio.setFX({ [key]: Number.isFinite(v) ? v : 0 });
    };

    const onInput  = rafThrottle(send, minGap);
    const onChange = () => send();

    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
  });

  // Tempo BPM
  const tempo = $('tempoBPM');
  if (tempo) {
    const send = () => audio.setTempoBPM(+tempo.value || 120);
    const onInput = rafThrottle(send, 90);
    tempo.addEventListener('input', onInput);
    tempo.addEventListener('change', send);
  }
}

// ———————————————————————————————————————————————————————————
// Bind UI global
// ———————————————————————————————————————————————————————————
export function bindUI({ onStart, onStop, onCalibrate } = {}) {
  wireAudioBadge();
  wireAudioButtons();
  wireAdvancedSynthControls();
  populateMappingModesIfEmpty();

  // Overlay sizing → rend le squelette visible au-dessus de la vidéo
  startOverlaySyncLoop();

  on($('startBtn'),     'click', (e) => { e.preventDefault(); onStart?.();     }, { passive:false });
  on($('stopBtn'),      'click', (e) => { e.preventDefault(); onStop?.();      }, { passive:false });
  on($('calibrateBtn'), 'click', (e) => { e.preventDefault(); onCalibrate?.(); }, { passive:false });

  // Sélecteurs simples
  on($('instrument'),  'change', (e) => { state.instrument   = e.target.value; });
  on($('mappingMode'), 'change', (e) => { state.mappingMode  = e.target.value; });
  on($('scale'),       'change', (e) => { state.currentScale = e.target.value; });
  on($('audioOut'),    'change', (e) => { state.outputMode   = e.target.value; });

  // ————————————————————————————————————————————————
  // “Sensibilité mouvement” → lisse thresholds.motion (EMA)
  // ————————————————————————————————————————————————
  const sensEl = $('sensitivity');
  if (sensEl) {
    const onSens = rafThrottle((e) => {
      const sRaw = parseFloat(e.target.value);
      if (Number.isNaN(sRaw)) return;

      // mémorise la valeur UI
      state.movementThreshold = sRaw;

      // normalise 0..1 à partir des bornes de l’input (robuste aux min/max ≠ [0,1])
      const min = Number.isFinite(+sensEl.min) ? +sensEl.min : 0;
      const max = Number.isFinite(+sensEl.max) ? +sensEl.max : 1;
      const sn  = clamp01((sRaw - min) / Math.max(0.000001, (max - min)));

      // grand = plus sensible → seuils plus bas
      const f = 1 - sn * 0.65; // 1 → +dur, 0.35 → +sensible

      const base       = { on: 0.018, off: 0.012 };
      const targetDef  = { on: base.on  * f,  off: base.off  * f  };
      const targetNose = { on: targetDef.on * 1.22, off: targetDef.off * 1.22 };

      const cur = state.thresholds?.motion || { default: base, nose: { on: 0.022, off: 0.015 } };
      const smooth = {
        default: { on: ema(cur.default.on, targetDef.on),   off: ema(cur.default.off, targetDef.off) },
        nose:    { on: ema(cur.nose.on,    targetNose.on),  off: ema(cur.nose.off,    targetNose.off) },
      };

      state.thresholds = { ...(state.thresholds || {}), motion: smooth };
      try { setBadge('poseStatus', `Pose: OK · sens=${sRaw.toFixed(2)}`, '#b9fbc0'); } catch {}
    }, 90);

    on(sensEl, 'input',  onSens);
    on(sensEl, 'change', onSens);
  }

  // Note-off hold depuis l’UI (borné)
  on($('noteOffMs'), 'input',  (e) => {
    const v = parseInt(e.target.value, 10);
    if (!Number.isNaN(v)) state.noteOffHoldMs = Math.max(40, v);
  });

  const audioBadge = !!$('audioStatus');
  console.info('[UI] bindUI ok :',
    !!$('startBtn'), !!$('stopBtn'), !!$('calibrateBtn'),
    !!('instrument' in (document.getElementById('instrument') || {})),
    !!('mappingMode' in (document.getElementById('mappingMode') || {})),
    !!('scale' in (document.getElementById('scale') || {})),
    !!$('sensitivity'),
    !!$('noteOffMs'), !!$('audioOut'), 'audioBadge:', audioBadge);
}

// Synchronise les contrôles depuis state (utile si tu recharges des presets)
export function syncControlsFromState() {
  const setIf = (id, v) => { const el = $(id); if (el != null && v != null) el.value = v; };

  // Sélecteurs
  setIf('mappingMode',  state.mappingMode);
  setIf('scale',        state.currentScale);
  setIf('instrument',   state.instrument);
  setIf('audioOut',     state.outputMode);

  // Sliders FX
  if (state.fx) {
    const { master, delay, delayFB, reverb } = state.fx;
    setIf('fxMaster',  master);
    setIf('fxDelay',   delay);
    setIf('fxDelayFB', delayFB);
    setIf('fxReverb',  reverb);
  }

  // Synth (précharge les <input> portant data-audio-param)
  if (state.synth) {
    document.querySelectorAll('[data-audio-param]').forEach(el => {
      const key = el.getAttribute('data-audio-param');
      const val = state.synth[key];
      if (val != null) {
        if (el.type === 'range' || el.type === 'number') el.value = +val;
        else el.value = String(val);
      }
    });
  }

  // Sensibilité (si on veut afficher la dernière valeur)
  if (typeof state.movementThreshold === 'number') {
    setIf('sensitivity', state.movementThreshold);
  }
}


