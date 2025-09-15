// assets/js/musicam/modules/loop.js
// Boucle principale : EMA positions/vitesses (normalisées), hystérésis, réfractaire,
// hold dynamique, modes mapping (fixed / y-pitch / drum-limbs / x-y-theremin / head-bend / tap-tempo-head).
// Offscreen + frame skipping adaptatif. Détection miroir CSS & mapping cohérent.
// NB: flipHorizontal:false côté détecteur (les corrections miroir se font ici/rendu).

import { noteOff, noteOn, setSynthParams, setTempoBPM, stopAllVoices } from './audio.js';
import { KEYPOINT_NAMES, SKELETON, quantizeToScale, yToMidi } from './config.js';
import { sendPitchBendSemitones } from './midi.js';
import { state } from './state.js';
import * as ui from './ui.js';

// ———————————————————————————————————————————————————————————
// rVFC si dispo (timing caméra), sinon rAF
let rafId = null;
let webcam = null, canvas = null, ctx = null;
let poseDetector = null, faceModel = null;
let useRVFC = false;

// ⚠️ On n'utilise pas mediaTime pour la logique (audit only)
let _rvfcAudit = { lastPerfNow: 0, lastMediaTime: 0 };
const schedule = (cb) => {
  if (useRVFC && webcam && typeof webcam.requestVideoFrameCallback === 'function') {
    webcam.requestVideoFrameCallback((now, meta) => {
      try {
        _rvfcAudit.lastPerfNow  = performance.now();
        _rvfcAudit.lastMediaTime = meta?.mediaTime || 0;
        window.__mc_rvfcAudit = { ..._rvfcAudit };
      } catch {}
      cb();
    });
  } else {
    rafId = requestAnimationFrame(cb);
  }
};

// Worker de dessin (zero-copy)
let drawWorker = null, useWorker = false;

// Import unique de draw.js (fallback dessin main thread)
const _drawModPromise = import('./draw.js');

// — Cache one-shot des noms KP (évite Object.keys() par frame)
const KP_NAMES = Object.keys(KEYPOINT_NAMES);

// Échantillonnage visage allégé (Face Mesh coûteux)
const FACE_EVERY = 2; // 1 = chaque frame, 2 = une frame sur 2, 3 = 1/3 ...

// ———————————————————————————————————————————————————————————
// Anti-ping-pong inferEvery (hystérésis + cooldown)
let _inferEvery = 1;
let _ieUpStreak = 0, _ieDownStreak = 0;
let _ieCooldownT = 0;
let _lastInferEveryLogT = 0;

// Fenêtres & limites
const IE_UP_NEED     = 45;   // ~1.5s @30fps avant d'AUGMENTER (1→2→3)
const IE_DOWN_NEED   = 90;   // ~3s   stables avant de REDESCENDRE (3→2→1)
const IE_COOLDOWN_MS = 2500; // délai minimal entre changements
const IE_MIN = 1, IE_MAX = 3;

export function getInferEvery(){ return _inferEvery; }
export function setInferEvery(n){
  const v = Math.max(IE_MIN, Math.min(IE_MAX, n|0));
  if (v === _inferEvery) return _inferEvery;
  const now = performance.now();
  // petit debounce pour éviter double logs consécutifs
  if (now - _ieCooldownT < 250) return _inferEvery;

  const prev = _inferEvery;
  _inferEvery = v;
  _ieCooldownT = now;
  _ieUpStreak = 0; _ieDownStreak = 0;

  if (now - _lastInferEveryLogT > 500) {
    console.info(`[loop] inferEvery ${prev} → ${_inferEvery}`);
    _lastInferEveryLogT = now;
  }
  return _inferEvery;
}
try {
  window.__mc_setInferEvery = setInferEvery;
  window.__mc_getInferEvery = getInferEvery;
} catch {}

// Adaptation stable selon perf (appeler dans la boucle)
function maybeAdaptInferEvery(fpsEMA, lastInferMs){
  const now = performance.now();
  if (now - _ieCooldownT < IE_COOLDOWN_MS) return;

  // Geler pendant un switch caméra ou si l’onglet est caché
  if ((typeof window !== 'undefined' && window.__mc_resSwitching) ||
      (typeof document !== 'undefined' && document.hidden)) {
    return;
  }

  const fps = +fpsEMA || 0;
  const inferMs = +lastInferMs || 0;

  // Monter (IE++) si FPS bas ou inférence lourde
  if (fps < 18 || inferMs > 25) { _ieUpStreak++; _ieDownStreak = 0; }
  // Redescendre (IE--) si FPS confortables et inf légère
  else if (fps > 29 && inferMs < 16) { _ieDownStreak++; _ieUpStreak = 0; }
  else { _ieUpStreak = 0; _ieDownStreak = 0; }

  if (_ieUpStreak >= IE_UP_NEED && _inferEvery < IE_MAX){
    setInferEvery(_inferEvery + 1);
    _ieCooldownT = now;
    return;
  }
  if (_ieDownStreak >= IE_DOWN_NEED && _inferEvery > IE_MIN){
    setInferEvery(_inferEvery - 1);
    _ieCooldownT = now;
  }
}

// ———————————————————————————————————————————————————————————
let smoothKps = null;
// ⬆️ EMA position lue dynamiquement (par défaut relevée via state.smoothing ci-dessous)
const EMA_ALPHA_POS = () => (state.smoothing?.emaAlphaPos ?? 0.33);

function emaKeypoints(curr){
  if (!curr) return null;
  if (!smoothKps || smoothKps.length !== curr.length) {
    smoothKps = curr.map(k => ({ x:k.x, y:k.y, score:k.score, name:k.name }));
    return smoothKps;
  }
  const a = EMA_ALPHA_POS();
  const minScore = state.minKpScore ?? 0.30;
  for (let i=0;i<curr.length;i++){
    const c = curr[i], s = smoothKps[i];
    if (c && c.score > minScore) {
      s.x = s.x + a * (c.x - s.x);
      s.y = s.y + a * (c.y - s.y);
      s.score = c.score;
      s.name = c.name || s.name;
    } else {
      s.score = 0;
    }
  }
  return smoothKps;
}

// Mémoires inter-frame
let lastInferKps = null;

// Hooks perf (fournis par musicam.js → onPerf / onPerfHintRuntime)
let hooks = null;

// ———————————————————————————————————————————————————————————
// Motion : vitesse EMA (normalisée), hystérésis, réfractaire
const velEMA = new Map();   // key -> { v }
const isOn   = new Map();   // key -> boolean
const lastTrig = new Map(); // key -> tMillis

const DEFAULT_THRESHOLDS = {
  motion: {
    default: { on: 0.018, off: 0.012 },
    nose:    { on: 0.022, off: 0.015 }
  },
  refractoryMs: 70
};
const DEFAULT_HOLD = { baseMs: 110, byVel: 380 }; // hold ∝ vitesse

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function speedYNorm(key, y, tNow, vw, vh){
  // vitesse normalisée ≈ (|dy| / hypot(vw,vh)) * (1000/dt)
  const prev = velEMA.get(key) || { y, t:tNow, v:0 };
  const dt = Math.max(1, tNow - prev.t);
  const diag = Math.max(1, Math.hypot(vw||1, vh||1));
  const vyNorm = Math.abs(y - prev.y) / diag * (1000 / dt);
  // ⬆️ EMA vitesse lue dynamiquement (par défaut relevée via state.smoothing ci-dessous)
  const a = state.smoothing?.emaAlphaVel ?? 0.43;
  const v = prev.v + a * (vyNorm - prev.v);
  velEMA.set(key, { y, t:tNow, v });
  return v;
}

function gate(key, speed, kind='default'){
  const th = (state.thresholds?.motion?.[kind]) || DEFAULT_THRESHOLDS.motion[kind] || DEFAULT_THRESHOLDS.motion.default;
  const st = isOn.get(key) || false;
  let on = st;
  if (!st && speed > th.on) on = true;
  if (st && speed < th.off) on = false;
  isOn.set(key, on);
  return on;
}

function refractoryOk(key, tNow){
  const last = lastTrig.get(key) || 0;
  const ms = (state.thresholds?.refractoryMs ?? DEFAULT_THRESHOLDS.refractoryMs);
  if (tNow - last < ms) return false;
  lastTrig.set(key, tNow);
  return true;
}

// ———————————————————————————————————————————————————————————
// Throttle utilitaires
const _throttleT = new Map();
function throttleDo(name, ms, fn){
  const now = performance.now();
  const t0 = _throttleT.get(name) || 0;
  if (now - t0 >= ms) { _throttleT.set(name, now); try{ fn(); }catch{} }
}

// Throttle spécialisé pour setSynthParams (33–60 ms)
let _lastParamT = 0;
function setSynthParamsThrottled(params, ms = 33){
  const t = performance.now();
  if (t - _lastParamT >= ms) { _lastParamT = t; try { setSynthParams(params); } catch {} }
}

// ———————————————————————————————————————————————————————————
// Pitch-bend util (MIDI 14 bits si sortie MIDI, sinon param synth interne)
const BEND_RANGE_SEMITONES = 2;
function applyPitchBend(bendSemitones, range = BEND_RANGE_SEMITONES, ms = 45) {
  throttleDo('pitchBend', ms, () => {
    if (state.outputMode === 'midi' && window.__MIDI?.enabled) {
      try { sendPitchBendSemitones(bendSemitones, range); } catch {}
    } else {
      setSynthParams({ pitchBend: bendSemitones });
    }
  });
}
function centerPitchBend(ms = 120) { applyPitchBend(0, BEND_RANGE_SEMITONES, ms); }
function resetPitchBendImmediate() {
  try {
    if (state.outputMode === 'midi' && window.__MIDI?.enabled) {
      sendPitchBendSemitones(0, BEND_RANGE_SEMITONES);
    } else {
      setSynthParams({ pitchBend: 0 });
    }
  } catch {}
}

// ———————————————————————————————————————————————————————————
// Mapping & Note-hold
let activeHeld = new Map(); // midi -> { on:true, t0, ms }
let lastNote = null;

// tap-tempo (timestamps “nods”)
let _taps = []; // ms timestamps

function noteHold(midi, vel, tNow){
  const base = state.hold?.baseMs ?? DEFAULT_HOLD.baseMs;
  const byV  = state.hold?.byVel  ?? DEFAULT_HOLD.byVel;
  const ms = base + byV * clamp(vel, 0, 0.06);
  activeHeld.set(midi, { on:true, t0:tNow, ms });
}

function maybeNoteOffSweep(tNow){
  for (const [m, info] of activeHeld.entries()){
    if (info.on && (tNow - info.t0) > info.ms) {
      noteOff(m);
      info.on = false;
      activeHeld.delete(m);
    }
  }
}

function doMapping(kps, vw, vh){
  const tNow = performance.now();

  // Mirroring pour le MAPPING (perspective utilisateur)
  const mirrorMap = !!state.videoMirrored;

  const idx = KEYPOINT_NAMES;
  const RW = kps[idx.right_wrist], LW = kps[idx.left_wrist];
  const RE = kps[idx.right_elbow], LE = kps[idx.left_elbow];
  const NO = kps[idx.nose];

  const minScore = state.minKpScore ?? 0.30;
  if (!RW || !LW || RW.score < minScore || LW.score < minScore) return 0;

  const Rx = mirrorMap ? (vw - RW.x) : RW.x;
  const Lx = mirrorMap ? (vw - LW.x) : LW.x;
  const Nx = (NO && NO.score >= minScore) ? (mirrorMap ? (vw - NO.x) : NO.x) : null;

  const yOff = (state.calibration?.yOffsetPx ?? state.calibration?.wristOffsetY ?? 0);
  const Ry = clamp(RW.y - yOff, 0, vh);
  const Ly = clamp(LW.y - yOff, 0, vh);

  const vRy = speedYNorm('RW', Ry, tNow, vw, vh);
  const vLy = speedYNorm('LW', Ly, tNow, vw, vh);
  const vNo = (NO && NO.score >= minScore) ? speedYNorm('NOSE', NO.y, tNow, vw, vh) : 0;

  let energy = 0;

  switch (state.mappingMode) {
    case 'fixed': {
      centerPitchBend();
      const play = (key, yVal, midi) => {
        const v = speedYNorm(key, yVal, tNow, vw, vh);
        energy += Math.abs(v);
        if (gate(key, v) && refractoryOk(key, tNow)) {
          const vel = clamp(Math.abs(v) * 6, 0.1, 1);
          noteOn(midi, vel);
          noteHold(midi, vel, tNow);
          lastNote = midi;
        }
      };
      play('RWf', Ry, 60);
      play('LWf', Ly, 64);
      if (RE && RE.score >= minScore) play('REf', RE.y, 67);
      if (LE && LE.score >= minScore) play('LEf', LE.y, 72);
      break;
    }

    case 'y-pitch': {
      centerPitchBend();
      const wasOn = !!isOn.get('RWy');
      const nowOn = gate('RWy', vRy);
      energy += Math.abs(vRy);

      let midi = yToMidi(Ry, vh, 52, 76);
      midi = quantizeToScale(midi, state.currentScale);
      const vel = clamp(Math.abs(vRy) * 6, 0.1, 1);

      if (!wasOn && nowOn && refractoryOk('RWy', tNow)) {
        if (lastNote !== null && midi !== lastNote) { noteOff(lastNote); activeHeld.delete(lastNote); }
        noteOn(midi, vel);
        noteHold(midi, vel, tNow);
        lastNote = midi;
        break;
      }

      if (nowOn && lastNote !== null && midi !== lastNote) {
        noteOff(lastNote); activeHeld.delete(lastNote);
        noteOn(midi, Math.max(0.12, vel * 0.9));
        noteHold(midi, vel, tNow);
        lastNote = midi;
      }
      break;
    }

    case 'x-y-theremin': {
      centerPitchBend();
      // main droite → pitch (X), main gauche → filtre (X)
      const pitch = Math.round(52 + clamp((Rx / vw), 0, 1) * (76 - 52));
      const qPitch = quantizeToScale(pitch, state.currentScale);
      const cutoffHz = 80 + clamp((Lx / vw), 0, 1) * (15000 - 80);
      setSynthParamsThrottled({ cutoffHz }, 33);

      if (qPitch !== lastNote) {
        if (lastNote !== null) { noteOff(lastNote); activeHeld.delete(lastNote); }
        noteOn(qPitch, 0.75);
        noteHold(qPitch, 0.05, tNow);
        lastNote = qPitch;
      }
      break;
    }

    case 'drum-limbs': {
      centerPitchBend();
      const hit = (key, yVal, midi) => {
        const v = speedYNorm(key, yVal, tNow, vw, vh);
        energy += Math.abs(v);
        if (gate(key, v) && refractoryOk(key, tNow)) {
          const vel = clamp(Math.abs(v) * 6.5, 0.1, 1);
          noteOn(midi, vel);
          noteHold(midi, vel, tNow);
        }
      };
      hit('RWd', Ry, 36); // kick
      hit('LWd', Ly, 38); // snare
      if (RE && RE.score >= minScore) hit('REd', RE.y, 42); // hihat
      if (LE && LE.score >= minScore) hit('LEd', LE.y, 46); // open hat
      break;
    }

    case 'head-bend': {
      const lfoDepth = clamp(Math.abs(vNo) * 18, 0, 0.25);
      setSynthParamsThrottled({ lfoDepth, lfoTarget:'freq', lfoRate: 5 + lfoDepth*10 }, 33);
      energy += Math.abs(vNo);

      if (Nx != null) {
        const bend = clamp(((Nx / vw) * 2 - 1) * BEND_RANGE_SEMITONES, -BEND_RANGE_SEMITONES, BEND_RANGE_SEMITONES);
        applyPitchBend(bend, BEND_RANGE_SEMITONES, 45);
      }

      const wasNod = !!isOn.get('NOD');
      const nowNod = gate('NOD', vNo, 'nose');
      if (!wasNod && nowNod && refractoryOk('NOD', tNow)) {
        _taps.push(tNow);
        if (_taps.length > 5) _taps.shift();
        if (_taps.length >= 3) {
          const dts = [];
          for (let i=1;i<_taps.length;i++) dts.push(_taps[i] - _taps[i-1]);
          dts.sort((a,b)=>a-b);
          const mid = dts[Math.floor(dts.length/2)] || dts[dts.length-1];
          const bpm = clamp(60000 / Math.max(200, mid), 50, 200);
          throttleDo('tapTempo', 140, () => setTempoBPM(bpm));
          try {
            const el = document.getElementById('tempoBPM');
            if (el) el.value = (bpm|0);
            ui.setBadge?.('tempo', `BPM: ${bpm|0}`, '#c7f9cc');
          } catch {}
        }
      }

      if (gate('RWbend', vRy) && refractoryOk('RWbend', tNow)) {
        let midi = yToMidi(Ry, vh, 52, 76);
        midi = quantizeToScale(midi, state.currentScale);
        if (lastNote !== null && midi !== lastNote) { noteOff(lastNote); activeHeld.delete(lastNote); }
        noteOn(midi, 0.8);
        noteHold(midi, 0.04, tNow);
        lastNote = midi;
      }
      break;
    }

    case 'tap-tempo-head': {
      centerPitchBend();
      const wasOn = !!isOn.get('NOD');
      const nowOn = gate('NOD', vNo, 'nose');
      energy += Math.abs(vNo);

      if (!wasOn && nowOn && refractoryOk('NOD', tNow)) {
        _taps.push(tNow);
        if (_taps.length > 5) _taps.shift();
        if (_taps.length >= 3) {
          const dts = [];
          for (let i=1;i<_taps.length;i++) dts.push(_taps[i] - _taps[i-1]);
          dts.sort((a,b)=>a-b);
          const mid = dts[Math.floor(dts.length/2)] || dts[dts.length-1];
          const bpm = clamp(60000 / Math.max(200, mid), 50, 200);
          throttleDo('tapTempo', 140, () => setTempoBPM(bpm));
          try {
            const el = document.getElementById('tempoBPM');
            if (el) el.value = (bpm|0);
          } catch {}
        }
      }
      break;
    }
  }

  maybeNoteOffSweep(tNow);
  return energy;
}

// ———————————————————————————————————————————————————————————
// MIRRORING : détection CSS + choix rendu/mapping cohérent
function _cssScaleX(el){
  try {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 1;
    if (t.startsWith('matrix3d(')) {
      const v = t.slice(9, -1).split(',').map(parseFloat);
      return v[0]; // scaleX
    } else if (t.startsWith('matrix(')) {
      const v = t.slice(7, -1).split(',').map(parseFloat);
      return v[0]; // scaleX
    }
  } catch {}
  return 1;
}
function _isCSSMirrored(el){ return _cssScaleX(el) < 0; }
function _workerMirroredFlag(){
  // mirroring_worker = mirror(videoCSS) XOR mirror(canvasCSS)
  const vcss = !!state._cssMirror?.video;
  const ccss = !!state._cssMirror?.canvas;
  return vcss ^ ccss;
}

// ———————————————————————————————————————————————————————————
// TICK
let skipFrames = 0;
// Back-pressure : éviter d'empiler des estimatePoses si la précédente n'est pas finie
let _poseBusy = false;
// Cache dimensions envoyées au worker pour ne redimensionner que si nécessaire
let __wW = 0, __wH = 0;

// FPS bas persistant → coupe Face + IE=2
let lowFpsStreak = 0;
const LOW_FPS_CUTOFF = 24;
const LOW_FPS_PERSIST_FRAMES = 72; // ≈ 2–3 s suivant FPS

async function tick(){
  if (window.__mc_resSwitching === true) skipFrames = Math.max(skipFrames, 3);
  if (skipFrames > 0) {
    skipFrames--;
    if (hooks?.onPerf) hooks.onPerf({ fpsEMA: state.fpsEMA, inferEvery: _inferEvery });
    schedule(tick);
    return;
  }

  if (!webcam || !poseDetector) { schedule(tick); return; }

  const vw = webcam.videoWidth|0, vh = webcam.videoHeight|0;
  if (!vw || !vh) { schedule(tick); return; }

  if (!useWorker && canvas && (canvas.width !== vw || canvas.height !== vh)) {
    canvas.width = vw; canvas.height = vh;
  }

  const frameId = (state._frame = (state._frame|0) + 1);
  let inferStart = 0, kps = null;

  if (frameId % _inferEvery === 0) {
    if (_poseBusy) {
      // backlog → on marque "lourd" et on saute 1 frame de plus pour respirer
      skipFrames = Math.max(skipFrames, 1);
    } else {
      _poseBusy = true;
      inferStart = performance.now();
      try {
        const poses = await poseDetector.estimatePoses(webcam, { flipHorizontal:false });
        const raw = poses?.[0]?.keypoints || [];
        kps = raw.map((k, i) => ({ x:k.x, y:k.y, score:(k.score ?? 0), name: KP_NAMES[i] || String(i) }));
        kps = emaKeypoints(kps);
        lastInferKps = kps;
        ui.setBadge('poseStatus', kps?.length ? `Pose: OK (${kps.length} kp)` : 'Pose: —', kps?.length ? '#b9fbc0' : '#fca5a5');
        try { window.__mc_lastKps = { kps, vw, vh }; } catch {}
      } catch(e) {
        console.warn('estimatePoses error', e);
        ui.setBadge('poseStatus', 'Pose: —', '#fca5a5');
      } finally {
        _poseBusy = false;
      }
    }
  } else {
    kps = lastInferKps;
  }

  // Mapping + Draw
  let energy = 0;
  const mirrorForWorker = _workerMirroredFlag();
  if (kps && kps.length) {
    energy = doMapping(kps, vw, vh);

    if (useWorker) {
      // Resize explicite si dimensions vidéo changent
      if (__wW !== vw || __wH !== vh) {
        __wW = vw; __wH = vh;
        drawWorker.postMessage({ type:'resize', width: vw, height: vh });
      }
      try { window.__mc_lastDraw = { kLen:kps.length, fLen:0, stride:3 }; } catch {}
      drawWorker.postMessage({
        type: 'pose',
        vw, vh,
        mirrored: mirrorForWorker,
        kps,
        face: null
      });
    } else {
      if (!ctx) ctx = canvas.getContext('2d');
      const drawMod = await _drawModPromise; // import résolu une fois
      const kpsDraw = mirrorForWorker ? kps.map(p => ({ ...p, x: vw - p.x })) : kps;
      drawMod.drawSkeleton(ctx, kpsDraw, SKELETON);
    }
  } else if (useWorker) {
    if (__wW !== vw || __wH !== vh) {
      __wW = vw; __wH = vh;
      drawWorker.postMessage({ type:'resize', width: vw, height: vh });
    }
    drawWorker.postMessage({ type:'pose', vw, vh, mirrored: mirrorForWorker, kps: [], face: null });
    try { window.__mc_lastDraw = { kLen:0, fLen:0, stride:3 }; } catch {}
  }

  // Face (optionnel) — estimée 1/N frames pour soulager le CPU
  if (state.faceEnabled && faceModel && (frameId % FACE_EVERY === 0)) {
    try {
      const faces = await faceModel.estimateFaces({ input:webcam, flipHorizontal:false });
      const f = faces?.[0] || null;
      const pts = f ? (f.scaledMesh || f.keypoints) : null;

      if (useWorker) {
        if (__wW !== vw || __wH !== vh) {
          __wW = vw; __wH = vh;
          drawWorker.postMessage({ type:'resize', width: vw, height: vh });
        }
        drawWorker.postMessage({
          type:'pose',
          vw, vh,
          mirrored: mirrorForWorker,
          kps: kps || [],
          face: pts || null
        });
        try { window.__mc_lastDraw = { kLen:(kps?.length||0), fLen:(pts?.length||0), stride:3 }; } catch {}
      }
      else if (pts) {
        if (!ctx) ctx = canvas.getContext('2d');
        const drawMod = await _drawModPromise;
        const ptsDraw = mirrorForWorker
          ? pts.map(p => Array.isArray(p) ? [vw - (p[0]||0), p[1]||0] : ({ x: vw - (p.x||0), y: p.y||0 }))
          : pts;
        drawMod.drawFace(ctx, ptsDraw);
      }

      ui.setBadge('faceStatus', pts ? `Face: OK (${pts.length} pts)` : 'Face: —', pts ? '#ffb347' : '#fca5a5');
    } catch(e) {
      console.warn('estimateFaces error', e);
      ui.setBadge('faceStatus', 'Face: —', '#fca5a5');
    }
  } else {
    ui.setBadge('faceStatus','Face: —','#fca5a5');
  }

  // PERF
  const nowT = performance.now();
  const dt = nowT - (state.lastT || nowT);
  const fps = 1000 / Math.max(1, dt);
  state.fpsEMA = state.fpsEMA ? (state.fpsEMA*0.88 + fps*0.12) : fps;
  state.lastT  = nowT;

  // UI route unique (≤4 Hz + arrondi .0/.5)
  if (typeof ui.perfAudit === 'function') ui.perfAudit({ fpsEMA: state.fpsEMA });
  else if (typeof ui.setFPS === 'function') ui.setFPS(state.fpsEMA);
  ui.setEnergy(Math.min(100, energy*600), energy);

  if (inferStart) {
    const lastInferMs = performance.now() - inferStart;

    // ——— Nouvelle adaptation stable (anti-oscillation)
    maybeAdaptInferEvery(state.fpsEMA, lastInferMs);

    // Callback UI / perf
    if (hooks?.onPerf) hooks.onPerf({ fpsEMA: state.fpsEMA, lastInferMs, inferEvery: _inferEvery });

    // Hints de changement de runtime (conservé)
    if (hooks?.onPerfHintRuntime) {
      if (lastInferMs > 45 + 10 && state.fpsEMA < 30 - 6) {
        hooks.onPerfHintRuntime({ prefer:'lite' });
      } else if (state.fpsEMA > 30 + 8 && _inferEvery === 1) {
        hooks.onPerfHintRuntime({ prefer:'full' });
      }
    }
  } else {
    if (hooks?.onPerf) hooks.onPerf({ fpsEMA: state.fpsEMA, inferEvery: _inferEvery });
  }

  // ——— Coupure “Face + IE=2” si FPS bas persistant (<24)
  if ((state.fpsEMA || 0) < LOW_FPS_CUTOFF) lowFpsStreak++; else lowFpsStreak = 0;
  if (lowFpsStreak >= LOW_FPS_PERSIST_FRAMES) {
    // Désactive Face si actif
    if (state.faceEnabled || faceModel) {
      try {
        state.faceEnabled = false;
        faceModel = null;
        ui.setBadge('faceStatus','Face: — (auto OFF perfs)','#fca5a5');
        console.info('[loop] Face OFF (FPS bas persistant).');
      } catch {}
    }
    // Force inferEvery=2 (anti-jitter & latence perçue)
    if (_inferEvery !== 2) {
      setInferEvery(2);
      console.info('[loop] inferEvery forcé à 2 (FPS bas persistant).');
    }
    // on repart le compteur pour éviter de spammer
    lowFpsStreak = 0;
  }

  state.prevKps = kps || state.prevKps;
  schedule(tick);
}

// ———————————————————————————————————————————————————————————
// Worker config/dessin
function sendConfigToWorker() {
  if (!drawWorker) return;
  const flat = new Uint16Array(SKELETON.flat());
  try { window.__mc_lastSkeletonLen = flat.length; } catch {}
  drawWorker.postMessage({ type:'config', skeleton: flat }, [flat.buffer]);
}

// ———————————————————————————————————————————————————————————
// API publique
export function start({ videoEl, canvasEl, pose, face, onPerf, worker, onPerfHintRuntime }){
  webcam = videoEl;
  canvas = canvasEl;
  poseDetector = pose;
  faceModel = face || null;

  drawWorker = worker || null;
  useWorker  = !!drawWorker;
  if (drawWorker) {
    try {
      drawWorker.onmessage = (e) => {
        const d = e?.data || {};
        if (d.type === 'stats')    { window.__mc_lastDraw = { kLen:d.kLen||0, fLen:d.fLen||0, stride:d.stride||3 }; }
        if (d.type === 'configOk') { window.__mc_lastSkeletonLen = d.len|0; }
      };
    } catch {}
    sendConfigToWorker();
  }

  ctx = drawWorker ? null : canvas.getContext('2d');
  useRVFC = !!webcam.requestVideoFrameCallback;
  hooks = { onPerf, onPerfHintRuntime };

  // Détecte mirroring CSS sur <video> et <canvas>
  const videoCSSMir  = _isCSSMirrored(webcam);
  const canvasCSSMir = canvas ? _isCSSMirrored(canvas) : false;
  state._cssMirror = { video: videoCSSMir, canvas: canvasCSSMir };

  // valeurs par défaut sûres (⬆️ alphas relevés)
  state.mappingMode    = state.mappingMode    || 'y-pitch';
  state.currentScale   = state.currentScale   || 'C_major_pentatonic';
  state.smoothing      = state.smoothing      || { emaAlphaVel: 0.43, emaAlphaPos: 0.33 };
  state.thresholds     = state.thresholds     || DEFAULT_THRESHOLDS;
  state.minKpScore     = (typeof state.minKpScore === 'number') ? state.minKpScore : 0.30;

  // Mapping : par défaut suit l’apparence visuelle de la vidéo (miroir selfie fréquent)
  if (state.videoMirrored === undefined) state.videoMirrored = videoCSSMir;

  if (!rafId) schedule(tick);
}

export function stop(){
  if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
  state.activeNotes?.clear?.();
  smoothKps = null;
  velEMA.clear();
  isOn.clear();
  lastTrig.clear();
  lastNote = null;
  activeHeld.clear();
  _taps = [];
  stopAllVoices();
  resetPitchBendImmediate(); // recentre immédiatement le bend
  ui.setBadge('poseStatus','Pose: —','#fca5a5');
  ui.setBadge('faceStatus','Face: —','#fca5a5');
}

export function setDetectors({ pose, face } = {}){
  if (pose) poseDetector = pose;
  if (face !== undefined) faceModel = face;
}
