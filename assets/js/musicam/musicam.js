// assets/js/musicam/musicam.js
// MusiCam — Vision rapide & audio lisse (2025 refactor, stable+responsive)
// - Séquence d’origine conservée: setVideoResolution(...), init/config/resize du worker
// - Ajouts robustes: cover/contain auto + bouton, switch caméra, miroir auto par facing
// - Overlay 1:1: push d’un paquet 'fit' vers le worker (fallback main-thread OK)
// - Auto-résolution lo/mid/hi (hystérèse + cooldown), hooks perf/runtime, MIDI optionnel
// - Modèle par défaut = 'lite' (+ auto-switch full⇄lite selon perf)

import {
  ensureAudioRunning, setFX, setInstrument, setOutputMode,
  setSynthParams, setTempoBPM, start as startAudio, stopAllVoices,
} from './modules/audio.js';

import {
  DEFAULTS, DRAW_STYLES,
  SKELETON_FLAT as SKELETON_FLAT_MAYBE,
  SKELETON as SKELETON_PAIRS,
} from './modules/config.js';

import {
  assertGlobalsOrDie, createFaceModel, createPoseDetector, safeDispose,
} from './modules/detector.js';

import * as loop from './modules/loop.js';
import { initMIDI } from './modules/midi.js';
import { profilesAPI } from './modules/profiles.js';
import { flushAllNotes, state } from './modules/state.js';
import * as ui from './modules/ui.js';

// ———————————————————————————————————————————————————————————
// Runtime + DOM refs
let webcam = null, canvas = null, videoWrap = null;
let poseDetector = null, faceModel = null, drawWorker = null, overlayRO = null;
let _stream = null;

// Score min pour KP
state.minKpScore = (typeof state.minKpScore === 'number') ? state.minKpScore : 0.30;

// ———————————————————————————————————————————————————————————
// Responsive/facing/fit state
let _facing = 'user';     // 'user' | 'environment'
let _fit = 'cover';       // 'cover' | 'contain'
let _manualFit = false;
let _screenAngle = 0;

// Si le worker gère le mapping via 'fit', on évite d’appliquer un transform CSS au <canvas>
let _workerFitActive = false;

// Utils
const nowMs = () => performance.now();
const isPortrait = () => (window.innerHeight || 0) >= (window.innerWidth || 0);

// ———————————————————————————————————————————————————————————
// Mirroring util (compat avec ta version initiale)
function isMirroredRecursive(el) {
  let e = el, sign = 1;
  while (e && e !== document.body) {
    const tr = getComputedStyle(e).transform;
    if (tr && tr !== 'none') {
      let a = 1;
      const m = tr.match(/matrix\(([-\d\.e]+),/);
      if (m) a = parseFloat(m[1]);
      else {
        const m3 = tr.match(/matrix3d\(([-\d\.e]+)/);
        if (m3) a = parseFloat(m3[1]);
      }
      if (a < 0) sign *= -1;
    }
    e = e.parentElement;
  }
  return sign < 0;
}

// ———————————————————————————————————————————————————————————
// Caméra — presets & auto-switch
const RES_PRESETS = {
  hi : { width:{ ideal:1280 }, height:{ ideal:720  }, frameRate:{ ideal:30 } },
  mid: { width:{ ideal: 960 }, height:{ ideal:540  }, frameRate:{ ideal:30 } },
  lo : { width:{ ideal: 640 }, height:{ ideal:360  }, frameRate:{ ideal:30 } },
};

let _resBucket = 'mid';
let _resTarget = 'mid';
let _resUpStreak = 0, _resDownStreak = 0;
let _resCooldownT = 0;
const RES_UP_NEED = 45, RES_DOWN_NEED = 45, RES_COOLDOWN_MS = 2500;

let _resSwitching = false;
let _pendingSwitch = null;

// Cas spécial “asked hi but actual mid”
let _hiAskStreak = 0; const HI_ASK_NEED = 60; const HI_ASK_FPS = 28;

function _setResSwitchingFlag(on){
  _resSwitching = !!on;
  try { window.__mc_resSwitching = !!on; } catch {}
}

function bucketFromDims(w, h) {
  const a = (w|0) * (h|0);
  if (w>=1200 || h>=680 || a>=1280*640) return 'hi';
  if (w>=900  || h>=500 || a>=960*500)  return 'mid';
  return 'lo';
}

async function attachStreamToVideo(videoEl, stream){
  _setResSwitchingFlag(true);
  videoEl.srcObject = stream;
  videoEl.setAttribute('playsinline','');
  videoEl.muted = true;
  try { await videoEl.play(); } catch {}
  const t0 = nowMs();
  while ((videoEl.videoWidth|0) === 0 && nowMs() - t0 < 1500) {
    await new Promise(r => setTimeout(r, 50));
  }
  if ((videoEl.videoWidth|0) > 0 && (videoEl.videoHeight|0) > 0) {
    videoEl.width  = videoEl.videoWidth;   // info only
    videoEl.height = videoEl.videoHeight;
  }
  // Miroir AUTO par facing
  applyMirrorByFacing();
  // Pousse la géométrie au worker (ou fallback)
  postFitToWorker();
  return (videoEl.videoWidth|0) > 0;
}

async function setVideoResolution(level, { videoEl } = {}){
  if (_pendingSwitch) return false;
  if (!RES_PRESETS[level]) level = 'mid';
  if (level === _resBucket && (videoEl?.videoWidth|0) > 0) return true;

  _resTarget = level;
  _pendingSwitch = (async () => {
    _setResSwitchingFlag(true);
    try {
      const constraints = { video: RES_PRESETS[level], audio: false };
      if (!_stream) {
        _stream = await navigator.mediaDevices.getUserMedia(constraints);
      } else {
        const track = _stream.getVideoTracks()[0];
        try { await track.applyConstraints(RES_PRESETS[level]); }
        catch (e) {
          console.warn('[MusiCam] applyConstraints a échoué → fallback getUserMedia()', e);
          try { _stream.getTracks().forEach(t => t.stop()); } catch {}
          _stream = await navigator.mediaDevices.getUserMedia(constraints);
        }
      }
      try { window.__mc_stream = _stream; } catch {}

      if (videoEl) {
        await attachStreamToVideo(videoEl, _stream);
        const real = bucketFromDims(videoEl.videoWidth, videoEl.videoHeight);
        _resBucket = real;
        console.info(`[MusiCam] applyConstraints OK → ${level} ${videoEl.videoWidth}×${videoEl.videoHeight} (actual=${real})`);
        const infoEl = document.getElementById('videoInfo');
        if (infoEl) infoEl.textContent = `Caméra: ${videoEl.videoWidth}×${videoEl.videoHeight} (${_resBucket})`;
      }
      return true;
    } finally {
      _resCooldownT = nowMs();
      _setResSwitchingFlag(false);
      _pendingSwitch = null;
      _resUpStreak = 0; _resDownStreak = 0; _hiAskStreak = 0;
    }
  })();

  try { await _pendingSwitch; } catch {}
  return true;
}

function autoResolutionFromPerf(fpsEMA){
  const dt = nowMs() - _resCooldownT; if (dt < RES_COOLDOWN_MS) return;
  const fps = +fpsEMA || 0, GOOD_UP = 31, BAD_DN = 17;

  if (fps > GOOD_UP) { _resUpStreak++;  _resDownStreak = 0; }
  else if (fps < BAD_DN) { _resDownStreak++; _resUpStreak = 0; }
  else { _resUpStreak = 0; _resDownStreak = 0; }

  if (state._desiredLevel === 'hi' && _resBucket === 'mid') {
    if (fps > HI_ASK_FPS) _hiAskStreak++; else _hiAskStreak = 0;
    if (_hiAskStreak >= HI_ASK_NEED && !_resSwitching && webcam) {
      _hiAskStreak = 0; setVideoResolution('hi', { videoEl: webcam }); return;
    }
  } else { _hiAskStreak = 0; }

  if (_resUpStreak >= RES_UP_NEED){
    const next = (_resBucket === 'lo') ? 'mid' : (_resBucket === 'mid' ? 'hi' : 'hi');
    if (next !== _resBucket && next !== _resTarget && !_resSwitching && webcam) {
      setVideoResolution(next, { videoEl: webcam }); return;
    }
  }
  if (_resDownStreak >= RES_DOWN_NEED){
    const next = (_resBucket === 'hi') ? 'mid' : (_resBucket === 'mid' ? 'lo' : 'lo');
    if (next !== _resBucket && next !== _resTarget && !_resSwitching && webcam) {
      setVideoResolution(next, { videoEl: webcam });
    }
  }
}

function onPerfHint({ fpsEMA, inferEvery, lastInferMs }) {
  ui.perfAudit?.({ fpsEMA, inferEvery, lastInferMs, resolution: _resBucket });
  autoResolutionFromPerf(fpsEMA);
}

// ———————————————————————————————————————————————————————————
// (NEW) Auto-switch de modèle selon perf + upgrade résolution si à l’aise
function onPerfHintRuntime(h) {
  if (!h) return;

  // — Bascule du modèle si le runtime le suggère (anti-oscillation via switchingDetector)
  if (!switchingDetector) {
    const curr = state.tuning?.modelType || 'lite';
    if (h.prefer === 'lite' && curr !== 'lite') {
      state.tuning = { ...(state.tuning||{}), modelType: 'lite' };
      recreateDetector('lite'); // léger = gros gain CPU
    } else if (h.prefer === 'full' && curr !== 'full') {
      state.tuning = { ...(state.tuning||{}), modelType: 'full' };
      recreateDetector('full'); // meilleur tracking si la machine est à l’aise
    }
  }

  // — Upgrade de résolution quand ça va bien (comme avant)
  if (h.prefer === 'full' && _resBucket === 'mid' && !_resSwitching && webcam) {
    setVideoResolution('hi', { videoEl: webcam });
  }
}

// ———————————————————————————————————————————————————————————
// Facing & miroir auto
function getFacingFromTrack() {
  try { return _stream?.getVideoTracks?.()[0]?.getSettings?.().facingMode || _facing; }
  catch { return _facing; }
}

function syncCanvasTransformFromVideo(){
  if (!canvas) return;
  if (_workerFitActive) {
    // Le worker applique déjà le mapping (et miroir) → on neutralise tout CSS sur le canvas
    canvas.style.transform = '';
    canvas.style.transformOrigin = '';
    return;
  }
  // Fallback/legacy: on clone le transform du <video> vers le <canvas>
  try {
    const cs = getComputedStyle(webcam);
    canvas.style.transform       = (cs.transform && cs.transform !== 'none') ? cs.transform : '';
    canvas.style.transformOrigin = cs.transformOrigin || '0 0';
  } catch {}
}

function applyMirrorByFacing() {
  const facing = getFacingFromTrack();
  _facing = facing || _facing;
  const needMirror = (_facing === 'user');
  videoWrap?.classList.toggle('mirror', !!needMirror);
  state.videoMirrored = !!needMirror;
  syncCanvasTransformFromVideo();
}

// ———————————————————————————————————————————————————————————
// Fit cover/contain + mapping overlay 1:1 (worker-friendly)
function autoFit() { return isPortrait() ? 'contain' : 'cover'; }
function applyFit(mode) {
  _fit = (mode === 'contain') ? 'contain' : 'cover';
  if (videoWrap) {
    videoWrap.classList.toggle('contain', _fit === 'contain');
    videoWrap.classList.toggle('cover',   _fit === 'cover');
  }
  const lbl = document.getElementById('fitLabel'); if (lbl) lbl.textContent = _fit;
  postFitToWorker();
}

function computeFitMapping() {
  if (!webcam || !canvas) return null;
  const host = videoWrap || canvas;
  const cssW = canvas.clientWidth  || host.clientWidth  || canvas.width  || 1;
  const cssH = canvas.clientHeight || host.clientHeight || canvas.height || 1;
  const vidW = webcam.videoWidth  || 1;
  const vidH = webcam.videoHeight || 1;
  const sw = cssW / vidW, sh = cssH / vidH;
  let scale, dx, dy;
  if (_fit === 'contain') {
    scale = Math.min(sw, sh);
    const dw = vidW * scale, dh = vidH * scale;
    dx = (cssW - dw) * 0.5; dy = (cssH - dh) * 0.5;
  } else {
    scale = Math.max(sw, sh);
    const dw = vidW * scale, dh = vidH * scale;
    dx = (cssW - dw) * 0.5; dy = (cssH - dh) * 0.5;
  }
  return { cssW, cssH, vidW, vidH, scale, dx, dy, mode:_fit };
}

function postFitToWorker() {
  try {
    const m = computeFitMapping(); if (!m) return;
    if (drawWorker) {
      _workerFitActive = true;
      drawWorker.postMessage({ type: 'fit', ...m, mirrored: !!state.videoMirrored });
      // Si le worker gère le fit, on neutralise tout transform CSS sur le canvas
      canvas.style.transform = '';
      canvas.style.transformOrigin = '';
    } else {
      _workerFitActive = false;
    }
    // Fallback main-thread possible
    try { window.__mc_fit = { ...m, mirrored: !!state.videoMirrored }; } catch {}
  } catch {}
}

// ———————————————————————————————————————————————————————————
function updateScreenAngle(){
  try { _screenAngle = screen.orientation?.angle ?? (window.orientation|0) ?? 0; }
  catch { _screenAngle = 0; }
}
function handleViewportChange(){
  updateScreenAngle();
  if (!_manualFit) applyFit(autoFit()); else postFitToWorker();
  if (!_workerFitActive) syncCanvasTransformFromVideo();
}
const debouncedViewport = (() => {
  let t = 0;
  return () => { clearTimeout(t); t = setTimeout(handleViewportChange, 60); };
})();

// ———————————————————————————————————————————————————————————
// Cycle de vie
async function start(){
  if (state._running) return;
  state._running = true;
  console.info('[MusiCam] start()');
  assertGlobalsOrDie();

  webcam   = document.getElementById('webcam');
  canvas   = document.getElementById('overlay');
  videoWrap= document.getElementById('videoWrap'); // optionnel
  if (!webcam || !canvas) {
    alert('DOM incomplet : #webcam ou #overlay introuvable.');
    state._running = false; return;
  }

  // Mapping moderne par défaut
  if (!state.mappingMode) state.mappingMode = 'y-pitch';

  // Audio (prépare Worklet/graph)
  await ensureAudioRunning();

  // Fit initial (auto)
  applyFit(autoFit());

  // Caméra: séquence d’origine (setVideoResolution → attachStreamToVideo)
  const desired = state._desiredLevel || 'mid';
  try {
    await setVideoResolution(desired, { videoEl: webcam });
  } catch (e) {
    const httpsMsg = (location.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(location.hostname))
      ? '\n\n⚠️ HTTPS requis pour la caméra sur le Web. Utilise https://…'
      : '';
    alert("Impossible d'accéder à la webcam.\n" + e.message + httpsMsg);
    state._running = false; throw e;
  }

  // Compat: si worker-fit pas encore actif, copie le transform CSS du <video> vers le <canvas>
  syncCanvasTransformFromVideo();

  const infoEl = document.getElementById('videoInfo');
  if (infoEl) infoEl.textContent = `Caméra: ${webcam.videoWidth}×${webcam.videoHeight} (${_resBucket})`;
  console.info(`[MusiCam] Camera ready: ${webcam.videoWidth}×${webcam.videoHeight} (${_resBucket})`);

  // MIDI (non bloquant)
  let midiInfo = { enabled:false };
  try { midiInfo = await initMIDI(); }
  catch (e) { console.warn('[MusiCam] MIDI init failed → fallback synth', e); midiInfo = { enabled:false, reason:String(e) }; }
  finally { ui.setBadge('midiStatus', midiInfo?.enabled ? 'MIDI: ON' : 'MIDI: —'); }

  // Détecteur (BlazePose) — **défaut = 'lite'**
  const modelType = state.tuning?.modelType || 'lite';
  poseDetector = await createPoseDetector(modelType);

  // Face OFF par défaut (perfs)
  faceModel = null; state.faceEnabled = false;

  // OffscreenCanvas → Worker (CSS + DPR + resize)
  drawWorker = null; if (overlayRO) { try { overlayRO.disconnect(); } catch {} overlayRO = null; }
  try {
    if (canvas.transferControlToOffscreen && 'OffscreenCanvas' in window) {
      const dpr  = Math.max(1, window.devicePixelRatio || 1);
      const cssW = canvas.clientWidth  || webcam.videoWidth  || 960;
      const cssH = canvas.clientHeight || webcam.videoHeight || 540;

      const off = canvas.transferControlToOffscreen();
      const workerURL = new URL('./workers/draw.worker.js', import.meta.url);
      drawWorker = new Worker(workerURL, { type:'module' });

      drawWorker.postMessage({ type: 'init', canvas: off, cssW, cssH, dpr }, [off]);

      const skeletonFlat = buildSkeletonFlat();
      drawWorker.postMessage({
        type: 'config',
        skeleton: skeletonFlat && skeletonFlat.length ? new Uint16Array(skeletonFlat) : null,
        styles: DRAW_STYLES
      });

      const pumpResize = () => {
        try {
          drawWorker?.postMessage({
            type: 'resize',
            cssW: canvas.clientWidth  || cssW,
            cssH: canvas.clientHeight || cssH,
            dpr:  window.devicePixelRatio || dpr
          });
          postFitToWorker(); // calage précis après resize
        } catch {}
      };
      overlayRO = new ResizeObserver(pumpResize);
      overlayRO.observe(canvas);

      drawWorker.onmessage = (e) => {
        const d = e?.data || {};
        if (d.type === 'configOk') { try { window.__mc_lastSkeletonLen = d.len|0; } catch {} }
        if (d.type === 'stats')    { try { window.__mc_lastDraw = { kLen:d.kLen||0, fLen:d.fLen||0, stride:d.stride||3 }; } catch {} }
      };

      console.info('[MusiCam] OffscreenCanvas worker: ON');
      postFitToWorker(); // 1er fit → active _workerFitActive & neutralise le transform CSS du canvas
    } else {
      console.info('[MusiCam] OffscreenCanvas non supporté → dessin main thread.');
      _workerFitActive = false;
      postFitToWorker(); // publie quand même le mapping (fallback)
    }
  } catch (e) {
    console.warn('[MusiCam] OffscreenCanvas worker init failed → dessin local.', e);
    drawWorker = null;
    _workerFitActive = false;
    if (overlayRO) { try { overlayRO.disconnect(); } catch {} overlayRO = null; }
  }

  // Reprise audio + preset par défaut + TEMPO
  try { await startAudio(); } catch {}
  try {
    if (!state.synth) {
      state.synth = {
        adsr: { a:0.008, d:0.10, s:0.05, r:0.14 },
        wave1:'sawtooth', wave2:'sine', morph:0.2, harmonics:0,
        cutoffHz: 2000, resonanceQ: 8, filterType:'lowpass', filterPoles:2,
        fmRate:0, fmDepth:0, drive:0.08, width:0.25,
        lfoRate:0, lfoDepth:0, lfoTarget:'freq',
        glide:0, playMode:'poly', pitchBend:0
      };
    }
    if (typeof state.tempoBPM !== 'number') state.tempoBPM = 100;
    setSynthParams(state.synth);
    setFX(state.fx || { master:0.9, delay:0.2, delayFB:0.35, reverb:0.15 });
    setTempoBPM(state.tempoBPM);
  } catch(e) { console.warn('[MusiCam] re-apply synth/FX/tempo failed', e); }

  ui.setButtons({ running:true });

  // Boucle principale
  loop.start({
    videoEl: webcam, canvasEl: canvas,
    pose: poseDetector, face: faceModel, worker: drawWorker,
    onPerf: (p) => onPerfHint({
      fpsEMA: p.fpsEMA,
      lastInferMs: (typeof p.lastInferMs === 'number') ? p.lastInferMs : (p.inferMs ?? 0),
      inferEvery: loop.getInferEvery?.() || 1,
    }),
    onPerfHintRuntime: (h) => onPerfHintRuntime(h),
    minKpScore: state.minKpScore,
  });

  // Boutons optionnels (si présents dans le HTML)
  document.getElementById('switchCamBtn')?.addEventListener('click', async () => {
    try {
      _facing = (_facing === 'user') ? 'environment' : 'user';
      try { _stream?.getTracks?.().forEach(t => t.stop()); } catch {}
      _stream = await navigator.mediaDevices.getUserMedia({
        video: { ...(RES_PRESETS[_resTarget||'mid'] || RES_PRESETS.mid), facingMode: { ideal: _facing } },
        audio: false
      });
      await attachStreamToVideo(webcam, _stream);
      postFitToWorker();
    } catch (e) { alert('Changement de caméra impossible : '+e.message); }
  });

  document.getElementById('fitToggleBtn')?.addEventListener('click', () => {
    _manualFit = true;
    applyFit(_fit === 'cover' ? 'contain' : 'cover');
  });

  document.addEventListener('visibilitychange', () => {
    const hidden = document.hidden;
    try { drawWorker?.postMessage({ type:'visibility', hidden: !!hidden }); } catch {}
    if (!hidden) postFitToWorker();
  });

  try { window.MusiCam.webcam = () => webcam; } catch {}
}

function stop(){
  console.info('[MusiCam] stop()');
  loop.stop();
  if (webcam?.srcObject) {
    try { webcam.srcObject.getTracks().forEach(t => t.stop()); } catch {}
    webcam.srcObject = null;
  }
  if (overlayRO) { try { overlayRO.disconnect(); } catch {} overlayRO = null; }
  if (drawWorker) { try { drawWorker.terminate(); } catch {} drawWorker = null; }
  flushAllNotes((m)=>{});
  stopAllVoices();
  ui.setButtons({ running:false });
  state._running = false;
}

// ———————————————————————————————————————————————————————————
// (Re)création du détecteur (full|lite)
let switchingDetector = false;
async function recreateDetector(modelType){
  if (switchingDetector) return;
  switchingDetector = true;
  const prev = poseDetector;
  try {
    const fresh = await createPoseDetector(modelType);
    poseDetector = fresh;
    loop.setDetectors?.({ pose: fresh });
    await safeDispose(prev);
    console.info('[MusiCam] Detector switched to', modelType);
  } catch (e) {
    console.warn('[MusiCam] recreateDetector échoué pour', modelType, e);
  } finally { switchingDetector = false; }
}

// ———————————————————————————————————————————————————————————
// Face toggle (optionnel)
async function enableFace(){
  if (state.faceEnabled) return true;
  const m = await createFaceModel();
  faceModel = m || null;
  state.faceEnabled = !!faceModel;
  loop.setDetectors?.({ face: faceModel });
  return state.faceEnabled;
}
function disableFace(){
  state.faceEnabled = false;
  faceModel = null;
  loop.setDetectors?.({ face: null });
}

// ———————————————————————————————————————————————————————————
// UI mount
function mountUI(){
  ui.bindUI({
    onStart: () => start().catch(console.error),
    onStop : () => stop(),
    onCalibrate: () => calibrate().catch(console.error),
  });

  profilesAPI.tryLoadFromURL?.();

  setInstrument(state.instrument || DEFAULTS.instrument);
  setOutputMode(state.outputMode || DEFAULTS.outputMode);

  if (!state.synth) {
    state.synth = {
      adsr: { a:0.008, d:0.10, s:0.05, r:0.14 },
      wave1:'sawtooth', wave2:'sine', morph:0.2, harmonics:0,
      cutoffHz: 2000, resonanceQ: 8, filterType:'lowpass', filterPoles:2,
      fmRate:0, fmDepth:0, drive:0.08, width:0.25,
      lfoRate:0, lfoDepth:0, lfoTarget:'freq',
      glide:0, playMode:'poly', pitchBend:0
    };
  }
  try {
    setSynthParams(state.synth);
    setFX(state.fx || { master:0.9, delay:0.2, delayFB:0.35, reverb:0.15 });
    setTempoBPM(state.tempoBPM || 100);
  } catch (e) { console.warn('[MusiCam] set default synth/FX/tempo failed', e); }

  ui.syncControlsFromState?.();

  // Fit auto initial + orientation listeners
  updateScreenAngle();
  applyFit(autoFit());
  window.addEventListener('resize', debouncedViewport);
  try { screen.orientation?.addEventListener('change', debouncedViewport); } catch {}

  console.info('[MusiCam] UI bound.');
}
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', mountUI, { once:true });
} else {
  mountUI();
}

// ———————————————————————————————————————————————————————————
window.addEventListener('mc:audio', (e) => {
  if (e?.detail?.running) {
    try {
      window.audio?.setSynthParams?.(state.synth || {});
      window.audio?.setFX?.(state.fx || {});
      window.audio?.setTempoBPM?.(state.tempoBPM || 100);
    } catch {}
  }
}, { once:true });

async function calibrate(){
  if (!state.calibration) state.calibration = { wristOffsetY: 0, deadZone: 0.02 };
  alert('Calibration simple: offset Y=0, dead-zone=0.02 (placeholder).');
}

// ———————————————————————————————————————————————————————————
// Squelette "flat"
function buildSkeletonFlat() {
  if (Array.isArray(SKELETON_FLAT_MAYBE) && SKELETON_FLAT_MAYBE.length) return SKELETON_FLAT_MAYBE;
  if (Array.isArray(SKELETON_PAIRS) && SKELETON_PAIRS.length) {
    return (Array.isArray(SKELETON_PAIRS[0]))
      ? SKELETON_PAIRS.reduce((acc, p) => { acc.push(p[0]|0, p[1]|0); return acc; }, [])
      : SKELETON_PAIRS;
  }
  return [];
}

// ———————————————————————————————————————————————————————————
// API publique
(function exposeAPI(){
  const api = {
    start: () => start().catch(console.error),
    stop,
    setModelType: async (t='lite') => { await recreateDetector(t); return t; }, // défaut lite
    setResolution: (lvl='mid') => setVideoResolution(lvl, { videoEl: webcam }),
    getInferEvery: () => loop.getInferEvery?.(),
    setInferEvery: (n) => loop.setInferEvery?.(n),
    calibrate, enableFace, disableFace,
    state,
    webcam: () => webcam,
    videoInfo: () => ({ vw: webcam?.videoWidth||0, vh: webcam?.videoHeight||0, level:_resBucket }),
    hasWorker: () => !!drawWorker,
    profiles: profilesAPI,
    syncUI: ui.syncControlsFromState || (()=>{}),
    panic: () => { try { stopAllVoices(); } catch {} try { state.activeNotes?.clear?.(); } catch {} },

    // Ajouts exposés (optionnels)
    switchCamera: async () => {
      _facing = (_facing === 'user') ? 'environment' : 'user';
      try { _stream?.getTracks?.().forEach(t => t.stop()); } catch {}
      _stream = await navigator.mediaDevices.getUserMedia({
        video: { ...(RES_PRESETS[_resTarget||'mid'] || RES_PRESETS.mid), facingMode: { ideal: _facing } },
        audio: false
      });
      await attachStreamToVideo(webcam, _stream);
      postFitToWorker();
    },
    setFit: (m='cover') => { _manualFit = true; applyFit(m); },
  };
  window.MusiCam = Object.assign(window.MusiCam || {}, api);
})();
