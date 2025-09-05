/**
 * /assets/js/nuage_magique/test.js
 * Scène unique (nuage + texte), PJAX-friendly, stage-fit dynamique, AUDIO-reactif
 * v2025-08-31 — patch "interactive ↔ background", réacteur audio, logs détaillés, teardown sûr
 *
 * Journalisation :
 *   - Préfixe : [NuageScene]
 *   - Active par défaut ; pour couper : window.__NUAGE_DEBUG__ = false
 *   - Trace : init / applyCanvasMode / PJAX / destroy / UI / Audio
 */

import THREE from './bootstrap.js';
import { createCloudScene } from './nuage.js';

/* ----------------------------- Logging utils ------------------------------ */
const NS = '[NuageScene]';
const DEBUG = (typeof window !== 'undefined')
  ? (window.__NUAGE_DEBUG__ ?? true)
  : true;
function log(...a){ if (DEBUG) console.log(NS, ...a); }
function info(...a){ if (DEBUG) console.info(NS, ...a); }
function warn(...a){ if (DEBUG) console.warn(NS, ...a); }
function err(...a){ if (DEBUG) console.error(NS, ...a); }
function group(label){ if (DEBUG) console.group(NS + ' ' + label); }
function groupEnd(){ if (DEBUG) console.groupEnd(); }

/* ----------------------------- State (scene) ------------------------------ */
let renderer, camera, scene, mainCloud;
let animateCloud, addText, setTextMode, toggleText, burstText, fitTextToView, fitTextToRect, getTextMetrics, setExternalDrive;
const clock = new THREE.Clock();

let lastRawText = '';
let resizeTimer = null;
let rafId = null;

// Guards
let started = false;
let listenersBound = false;
let lastHadContainer = false;

// Police (chargée par text_particles)
const FONT_URL = '/assets/js/nuage_magique/fonts/Noto%20Sans_Regular.json';

/* ------------------------------------------------------------------------- */
/*                         AUDIO REACTOR (robuste)                           */
/* ------------------------------------------------------------------------- */
/**
 * Objectif : lire un <audio> HTMLMediaElement et publier un drive {bass, high, rms} (0..1).
 * - Idempotent : n'attache qu'une fois par élément (sinon DOMException).
 * - Auto-resume AudioContext sur interaction utilisateur.
 * - FFT large (4096) + smoothing. Basses : 20–140 Hz ; Aigus : 2.5–8 kHz (calc dynamique).
 * - PJAX-safe : contexte singleton global, connexion player persistante.
 */
class NuageAudioReactor {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.freqData = null;
    this.timeData = null;
    this.fftSize = 4096;
    this.smoothing = 0.8;
    this.drive = { bass: 0, high: 0, rms: 0 };
    this._bassSmooth = 0;
    this._hiSmooth = 0;
    this._rmsSmooth = 0;
    this._attachedEl = null;
    this._source = null;
    this._split = null;
    this._binsLow = { i0: 0, i1: 0 };
    this._binsHi  = { i0: 0, i1: 0 };
    this._resumeHookBound = false;
  }

  get ready() { return !!(this.ctx && this.analyser); }

  _ensureContext() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { warn('AudioContext non supporté.'); return; }
    this.ctx = new AC();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = this.smoothing;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
    this._computeBands();
    info('AudioContext créé. sampleRate=%dHz, fftSize=%d', this.ctx.sampleRate, this.fftSize);
    this._bindResumeOnGesture();
  }

  _bindResumeOnGesture() {
    if (this._resumeHookBound) return;
    const resume = async () => {
      try {
        if (this.ctx && this.ctx.state !== 'running') {
          await this.ctx.resume();
          info('AudioContext resume() → running');
        }
      } catch (e) { warn('AudioContext resume a échoué:', e); }
    };
    ['pointerdown','keydown','touchstart'].forEach(ev =>
      window.addEventListener(ev, resume, { once:true, capture:true }));
    this._resumeHookBound = true;
  }

  _computeBands() {
    if (!this.ctx || !this.analyser) return;
    const nyquist = this.ctx.sampleRate / 2;
    const hzPerBin = nyquist / this.analyser.frequencyBinCount;

    // Basses : 20–140 Hz
    const b0 = 20, b1 = 140;
    const i0L = Math.max(0, Math.floor(b0 / hzPerBin));
    const i1L = Math.min(this.analyser.frequencyBinCount - 1, Math.ceil(b1 / hzPerBin));
    this._binsLow = { i0: i0L, i1: i1L };

    // Aigus : 2.5 kHz – 8 kHz (impact chh/snares)
    const h0 = 2500, h1 = 8000;
    const i0H = Math.max(0, Math.floor(h0 / hzPerBin));
    const i1H = Math.min(this.analyser.frequencyBinCount - 1, Math.ceil(h1 / hzPerBin));
    this._binsHi = { i0: i0H, i1: i1H };

    info('Bandes → bass %d..%d (~%d..%d Hz), high %d..%d (~%d..%d Hz), bin=%.1fHz',
      i0L, i1L, Math.round(i0L*hzPerBin), Math.round(i1L*hzPerBin),
      i0H, i1H, Math.round(i0H*hzPerBin), Math.round(i1H*hzPerBin),
      hzPerBin
    );
  }

  _findAudioElement(scope = document) {
    const s = (scope instanceof Element ? scope : document);
    return (
      s.querySelector('audio[data-react="nuage"]') ||
      s.querySelector('audio[data-nuage-audio]')  ||
      s.getElementById?.('player') ||
      s.getElementById?.('audio') ||
      s.getElementById?.('global-audio') ||
      s.querySelector('audio')
    );
  }

  attach(scope = document) {
    try {
      const el = this._findAudioElement(scope) || this._findAudioElement(document);
      if (!el) { warn('Aucun <audio> trouvé → drive inactif (ok).'); return; }
      if (this._attachedEl === el && this.ready) { info('Audio déjà attaché sur ce <audio>.'); return; }

      this._ensureContext();
      if (!this.ctx || !this.analyser) return;

      if (!el.__nuageMediaSource) {
        el.crossOrigin = el.crossOrigin || 'anonymous';
        el.__nuageMediaSource = this.ctx.createMediaElementSource(el);
        info('MediaElementSource créé pour <audio>.');
      } else {
        info('Réutilisation du MediaElementSource existant sur <audio>.');
      }

      if (!el.__nuageSplitGain) {
        el.__nuageSplitGain = this.ctx.createGain();
        el.__nuageMediaSource.connect(el.__nuageSplitGain);
        info('Split gain node créé.');
      }

      if (!el.__nuageConnected) {
        el.__nuageSplitGain.connect(this.analyser);
        el.__nuageSplitGain.connect(this.ctx.destination);
        el.__nuageConnected = true;
        info('Chaînage audio connecté (source → split → analyser & destination).');
      }

      this._attachedEl = el;
      this._source = el.__nuageMediaSource;
      this._split  = el.__nuageSplitGain;

      this._computeBands();
      el.addEventListener('play', () => { try { this.ctx?.resume(); } catch {} }, { passive:true });

      info('Audio attaché sur <%s%s>.', el.tagName.toLowerCase(), el.id ? `#${el.id}` : '');
    } catch (e) {
      err('attach() audio a échoué :', e);
    }
  }

  detach(hard = false) {
    if (!this._attachedEl) return;
    if (hard) {
      try {
        if (this._split) this._split.disconnect();
        if (this.analyser) this.analyser.disconnect();
        if (this._source) this._source.disconnect();
      } catch {}
      info('Audio détaché (hard).');
    } else {
      info('Audio laissé connecté (safe).');
    }
    this._attachedEl = null;
  }

  update() {
    if (!this.ready) return this.drive;

    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);

    // Bass band
    const { i0: i0L, i1: i1L } = this._binsLow;
    let sumL = 0, nL = 0;
    for (let i = i0L; i <= i1L; i++) { sumL += this.freqData[i]; nL++; }
    const bassRaw = nL ? (sumL / (nL * 255)) : 0;
    const bassComp = Math.pow(bassRaw, 0.75);

    // High band
    const { i0: i0H, i1: i1H } = this._binsHi;
    let sumH = 0, nH = 0;
    for (let i = i0H; i <= i1H; i++) { sumH += this.freqData[i]; nH++; }
    const hiRaw = nH ? (sumH / (nH * 255)) : 0;
    const hiComp = Math.pow(hiRaw, 0.9);

    // RMS from time domain
    let acc = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128;
      acc += v * v;
    }
    const rmsRaw = Math.sqrt(acc / this.timeData.length);
    const rmsNorm = Math.min(1, rmsRaw * 1.6);
    const rmsComp = Math.pow(rmsNorm, 0.8);

    // Smoothing
    this._bassSmooth = this._bassSmooth + (bassComp - this._bassSmooth) * 0.35;
    this._hiSmooth   = this._hiSmooth   + (hiComp   - this._hiSmooth)   * 0.45;
    this._rmsSmooth  = this._rmsSmooth  + (rmsComp  - this._rmsSmooth)  * 0.25;

    this.drive.bass = Math.max(0, Math.min(1, this._bassSmooth));
    this.drive.high = Math.max(0, Math.min(1, this._hiSmooth));
    this.drive.rms  = Math.max(0, Math.min(1, this._rmsSmooth));

    return this.drive;
  }

  getDrive() { return { ...this.drive }; }
}

// Singleton (persistant entre inits PJAX)
window.__NUAGE_AUDIO_REACTOR__ = window.__NUAGE_AUDIO_REACTOR__ || new NuageAudioReactor();
const reactor = window.__NUAGE_AUDIO_REACTOR__;

/* --------------------------- Page detection (PJAX) ------------------------ */
function getCurrentPageId() {
  const main = document.querySelector('main[data-pjax-root]');
  return (main && main.getAttribute('data-page')) || '';
}

/**
 * Bascule le canvas entre :
 *  - mode "interactif" (uniquement sur data-page="nuage_magique")
 *  - mode "background sûr" (toutes les autres pages)
 */
function applyCanvasMode(origin = 'unknown') {
  const container = document.getElementById('cloud-bg');
  if (!container || !renderer) { warn('applyCanvasMode:', origin, '→ container/renderer absent'); return; }

  const isNuage = getCurrentPageId() === 'nuage_magique';
  group(`applyCanvasMode @${origin} → isNuage=${isNuage}`);

  try {
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '0';
    container.style.pointerEvents = 'none';
    container.style.contain = 'layout paint size';
  } catch (e) { err('container style failed', e); }

  try {
    if (isNuage) {
      renderer.setClearAlpha?.(1);
      try { if (scene) scene.background = scene.background || null; } catch {}
      renderer.domElement.style.zIndex = '5';
      renderer.domElement.style.pointerEvents = 'auto';
      info('mode=INTERACTIF (nuage_magique)');
    } else {
      renderer.setClearAlpha?.(0);
      try { if (scene) scene.background = null; } catch {}
      renderer.domElement.style.zIndex = '0';
      renderer.domElement.style.pointerEvents = 'none';
      info('mode=BACKGROUND (pages normales)');
    }
  } catch (e) { err('applyCanvasMode failed', e); }

  groupEnd();
}

/* ------------------------------- Text helpers ----------------------------- */
function wrapText(raw, maxCharsPerLine) {
  const txt = (raw || '').replace(/\s+/g, ' ').trim();
  if (!txt) return '';
  const words = txt.split(' ');
  const lines = [];
  let line = '';
  const pushLine = () => { if (line.trim()) lines.push(line.trim()); line = ''; };

  for (let w of words) {
    if (w.length > maxCharsPerLine) {
      for (let i = 0; i < w.length; i += maxCharsPerLine) {
        const chunk = w.slice(i, i + maxCharsPerLine);
        if (!line.length) line = chunk; else { pushLine(); line = chunk; }
      }
      continue;
    }
    const candidate = (line.length ? line + ' ' : '') + w;
    if (candidate.length <= maxCharsPerLine) line = candidate;
    else { pushLine(); line = w; }
  }
  pushLine();
  return lines.join('\n');
}

/* ----------------------------- Pointer / UI ------------------------------- */
function canvasRect() {
  return renderer?.domElement?.getBoundingClientRect() || { left:0, top:0, width:1, height:1 };
}
function toNDCFromClientXY(clientX, clientY) {
  const rect = canvasRect();
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1
  };
}
function isOutsideStage(clientX, clientY) {
  const stage = document.getElementById('cloud-stage');
  if (!stage) return false;
  const r = stage.getBoundingClientRect();
  return (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom);
}
function isOnUI(eOrNode) {
  if (eOrNode && typeof eOrNode.clientX === 'number') {
    if (isOutsideStage(eOrNode.clientX, eOrNode.clientY)) return true;
    const el = document.elementFromPoint(eOrNode.clientX, eOrNode.clientY);
    if (el && (
      el.closest('#text-cloud-controls') ||
      el.closest('.page-hint') ||
      el.closest('#masthead') ||
      el.closest('#footer')
    )) return true;
  }
  const el2 = eOrNode?.target || eOrNode;
  if (el2 && el2.closest) {
    return Boolean(
      el2.closest('#text-cloud-controls') ||
      el2.closest('.page-hint') ||
      el2.closest('#masthead') ||
      el2.closest('#footer')
    );
  }
  return false;
}

/* ------------------ Options responsives + gardes de complexité ------------ */
function getResponsiveTextOptions() {
  const w = window.innerWidth;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let size;
  if (w <= 400)       size = 2.2;
  else if (w <= 480)  size = 2.6;
  else if (w <= 768)  size = 3.2;
  else if (w <= 1200) size = 4.0;
  else                size = 4.6;

  const pointSize     = Math.max(0.18, Math.min(0.34, 0.24 * (w / 1280) * (1.0 + (dpr-1)*0.4)));
  const fillDensity   = w <= 600 ? 0.70 : 0.88;
  const contourPoints = w <= 480 ? 260   : (w <= 768 ? 320 : 420);
  const holePoints    = w <= 480 ? 120   : (w <= 768 ? 150 : 180);
  const maxPoints     = w <= 600 ? 38000 : 60000;

  const isPortrait = window.innerHeight > window.innerWidth;
  const maxCharsPerLine = isPortrait
    ? (w <= 360 ? 9 : w <= 480 ? 11 : 14)
    : (w <= 768 ? 14 : 20);

  return {
    size, pointSize,
    contourPoints, holePoints, fillDensity, maxPoints,
    color: 0xFFFFFF, glowColor: 0x123A6F, outlineColor: 0x000000,
    additive: true, opacity: 1.0,
    pulseAmp: 0.12, pulseFreq: 0.12, lumAmp: 0.28,  lumFreq: 0.12, swarmAmp: 0.02,
    waveAmp: 0.006, waveSpeed: 0.45, waveFreq: 0.12,
    strokeEnabled: true, strokeSizeMul: 0.85, strokeContourMul: 1.5, strokeHoleMul: 1.2,
    maxCharsPerLine, lineSpacing: 1.35, jitter: 0.006,
    fontUrl: FONT_URL
  };
}

function softenOptionsForLength(opts, wrapped) {
  const cc    = (wrapped || '').replace(/\s/g, '').length;
  const lines = (wrapped || '').split('\n').length;
  const out = { ...opts };

  if (cc > 120) {
    out.fillDensity   = Math.max(0.30, opts.fillDensity * 0.45);
    out.contourPoints = Math.max(180, Math.round(opts.contourPoints * 0.60));
    out.holePoints    = Math.max(120, Math.round(opts.holePoints    * 0.60));
    out.maxPoints     = Math.min(opts.maxPoints, 38000);
  } else if (cc > 60) {
    out.fillDensity   = Math.max(0.45, opts.fillDensity * 0.70);
    out.contourPoints = Math.max(200, Math.round(opts.contourPoints * 0.75));
    out.holePoints    = Math.max(130, Math.round(opts.holePoints    * 0.75));
    out.maxPoints     = Math.min(opts.maxPoints, 50000);
  }
  if (lines >= 5) out.lineSpacing = Math.max(1.25, opts.lineSpacing * 1.08);
  return out;
}

/* ------------------------------- Global listeners ------------------------- */
let onPointerDown, onPointerMove, onDblClick, onResize;

function bindGlobalListenersOnce() {
  if (listenersBound) return;

  onPointerDown = (event) => {
    if (!started || isOnUI(event)) return;
    const ndc = toNDCFromClientXY(event.clientX, event.clientY);
    if (mainCloud?.userData?.onPointer) mainCloud.userData.onPointer(ndc, camera, renderer.domElement);
    if (typeof burstText === 'function') burstText(ndc, camera);
    try { reactor.ctx?.resume(); } catch {}
  };
  onPointerMove = (event) => {
    if (!started || !event.buttons || isOnUI(event)) return;
    const ndc = toNDCFromClientXY(event.clientX, event.clientY);
    if (mainCloud?.userData?.onPointer) mainCloud.userData.onPointer(ndc, camera, renderer.domElement);
  };
  onDblClick = () => {
    if (!started) return;
    if (typeof toggleText === 'function') toggleText();
  };
  onResize = () => {
    if (!started) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.lookAt(0, 0, 0);
    stageFit();

    if (!lastRawText) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const base = getResponsiveTextOptions();
      const wrapped = wrapText(lastRawText, base.maxCharsPerLine);
      setStageHeightFromLines(wrapped.split('\n').length);
      const opts = softenOptionsForLength(base, wrapped);

      addText(wrapped, opts)
        .then(() => {
          const stage = document.getElementById('cloud-stage');
          if (stage && typeof fitTextToRect === 'function') {
            const r = stage.getBoundingClientRect();
            if (r.width > 40 && r.height > 40) {
              fitTextToRect(camera, r, renderer, 0.92);
            } else if (typeof fitTextToView === 'function') {
              fitTextToView(camera);
            }
          } else if (typeof fitTextToView === 'function') {
            fitTextToView(camera);
          }
          setTextMode && setTextMode('assemble');
        })
        .catch(e => err('[test.js] addText on resize error:', e));
    }, 120);
  };

  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointermove', onPointerMove, true);
  window.addEventListener('dblclick', onDblClick, true);
  window.addEventListener('resize', onResize, true);

  document.addEventListener('nuage:css-ready', () => { stageFit(); });

  listenersBound = true;
  info('Global listeners bound (once).');
}

/* --------------------------- UI (bind / unbind) --------------------------- */
let ui = { input: null, btn: null, onClick: null, onKey: null };

function bindUI(containerScope = document) {
  try {
    if (ui.input && ui.onKey) ui.input.removeEventListener('keydown', ui.onKey);
    if (ui.btn && ui.onClick) ui.btn.removeEventListener('click', ui.onClick);
  } catch {}

  const scope = (containerScope instanceof Element ? containerScope : document);
  const input = scope.querySelector('#textInputCloud');
  const btn   = scope.querySelector('#btnTextCloud');

  if (!input || !btn) {
    ui = { input: null, btn: null, onClick: null, onKey: null };
    info('UI controls not found in scope (ok on pages hors nuage).');
    return;
  }

  const submit = () => {
    const raw = (input.value || '').trim();
    if (!raw) return;

    const base = getResponsiveTextOptions();
    const wrapped = wrapText(raw, base.maxCharsPerLine);
    lastRawText = raw;

    setStageHeightFromLines(wrapped.split('\n').length);
    const opts = softenOptionsForLength(base, wrapped);

    Promise
      .resolve(typeof addText === 'function' ? addText(wrapped, opts) : Promise.reject(new Error('addText non prêt')))
      .then(() => {
        const stage = document.getElementById('cloud-stage');
        if (stage && typeof fitTextToRect === 'function') {
          const r = stage.getBoundingClientRect();
          if (r.width > 40 && r.height > 40) {
            fitTextToRect(camera, r, renderer, 0.92);
          } else if (typeof fitTextToView === 'function') {
            fitTextToView(camera);
          }
        } else if (typeof fitTextToView === 'function') {
          fitTextToView(camera);
        }
        setTextMode && setTextMode('assemble');
      })
      .catch(e => warn('[test.js] submit avant scène prête :', e));
  };

  const onKey = (e) => { if (e.key === 'Enter') submit(); };
  btn.addEventListener('click', submit);
  input.addEventListener('keydown', onKey);

  ui = { input, btn, onClick: submit, onKey };
  info('UI controls bound.');
}

function unbindUI() {
  try {
    if (ui.input && ui.onKey) ui.input.removeEventListener('keydown', ui.onKey);
    if (ui.btn && ui.onClick) ui.btn.removeEventListener('click', ui.onClick);
  } catch {}
  ui = { input: null, btn: null, onClick: null, onKey: null };
  info('UI controls unbound.');
}

/* --------------------------- Stage fit & observers ------------------------ */
let stageRO = null;

function setStageHeightFromLines(lines = 1) {
  const stage = document.getElementById('cloud-stage');
  if (!stage) return;
  const base = 36;  // vh
  const per  = 7;   // vh par ligne
  const target = Math.max(28, Math.min(82, base + per * (Math.max(1, lines) - 1)));
  stage.style.setProperty('--stage-vh', String(target));
}

function stageFit() {
  if (!renderer || !camera || !fitTextToRect) return;
  const stage = document.getElementById('cloud-stage');
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  if (r.height <= 2) return;
  const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  try { fitTextToRect(camera, rect, renderer, 0.92); } catch (e) { warn('stageFit failed', e); }
}

function watchStage() {
  if (stageRO) { try { stageRO.disconnect(); } catch {} }
  const stage = document.getElementById('cloud-stage');
  if (!stage) return;
  stageRO = new ResizeObserver(() => { stageFit(); });
  stageRO.observe(stage);
  info('Stage ResizeObserver active.');
}

/* ------------------------------- Loop & Render ---------------------------- */
function startLoop() {
  if (rafId) return;
  const loop = () => {
    rafId = requestAnimationFrame(loop);

    // 1) Audio → met à jour les buffers & drive
    if (reactor) {
      reactor.update();
      if (typeof setExternalDrive === 'function') {
        const d = reactor.getDrive();
        setExternalDrive(d); // { bass, high, rms } 0..1
      }
    }

    // 2) Scène
    if (typeof animateCloud === 'function') animateCloud(clock, camera);
    renderer?.render(scene, camera);
  };
  rafId = requestAnimationFrame(loop);
  info('RAF loop started.');
}
function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  info('RAF loop stopped.');
}

/* --------------------------------- Init ----------------------------------- */
function init(containerScope = document) {
  group('init');
  const container = (containerScope instanceof Element ? containerScope : document)
    .querySelector('#cloud-bg') || document.getElementById('cloud-bg');

  lastHadContainer = !!container;
  if (!container) { warn('init: #cloud-bg introuvable → skip init'); groupEnd(); return; }

  bindUI(containerScope);

  if (started) {
    info('init: already started → stageFit + watchStage + applyCanvasMode');
    stageFit();
    watchStage();
    applyCanvasMode('init(already-started)');
    try { reactor.attach(document); } catch {}
    groupEnd();
    return;
  }

  container.innerHTML = '';

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.zIndex = '5';
  renderer.domElement.style.pointerEvents = 'auto';
  container.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 25);
  camera.lookAt(0, 0, 0);

  // Scène
  const api = createCloudScene();
  scene            = api.scene;
  mainCloud        = api.cloud;
  animateCloud     = api.animateCloud;
  addText          = api.addText;
  setTextMode      = api.setTextMode;
  toggleText       = api.toggleText;
  burstText        = api.burstText;
  fitTextToView    = api.fitTextToView;
  fitTextToRect    = api.fitTextToRect;
  getTextMetrics   = api.getTextMetrics;
  setExternalDrive = api.setExternalDrive;

  bindUI(containerScope);
  bindGlobalListenersOnce();

  // Audio : attache sur un player existant (idempotent)
  try { reactor.attach(document); } catch {}

  startLoop();
  started = true;

  stageFit();
  watchStage();

  applyCanvasMode('init');

  info('init: done.');
  groupEnd();
}

/* -------------------------------- Destroy --------------------------------- */
function destroy() {
  group('destroy');

  try {
    const c = document.getElementById('cloud-bg');
    if (c) {
      c.style.pointerEvents = 'none';
      c.style.zIndex = '0';
    }
    if (renderer?.domElement) {
      renderer.setClearAlpha?.(0);
      renderer.domElement.style.pointerEvents = 'none';
      renderer.domElement.style.zIndex = '0';
    }
  } catch (e) { warn('destroy: filet background failed', e); }

  // reactor.detach(true); // optionnel si tu veux couper le son en quittant

  if (!lastHadContainer) { unbindUI(); info('destroy: no container previously → UI only'); groupEnd(); return; }

  stopLoop();

  try { renderer?.dispose?.(); } catch (e) { warn('renderer.dispose failed', e); }
  try {
    scene?.traverse?.((obj) => {
      if (obj.geometry) obj.geometry.dispose?.();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
        else obj.material.dispose?.();
      }
    });
  } catch (e) { warn('scene traverse dispose failed', e); }

  const container = document.getElementById('cloud-bg');
  if (container && renderer?.domElement?.parentNode === container) {
    try { container.removeChild(renderer.domElement); } catch (e) { warn('removeChild failed', e); }
  }

  renderer = camera = scene = mainCloud =
  animateCloud = addText = setTextMode = toggleText =
  burstText = fitTextToView = fitTextToRect = getTextMetrics = setExternalDrive = null;

  if (stageRO) { try { stageRO.disconnect(); } catch {} stageRO = null; }

  started = false;
  unbindUI();

  info('destroy: done.');
  groupEnd();
}

/* ------------------------------- PJAX hooks ------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  info('DOMContentLoaded');
  init(document);
});

document.addEventListener('pjax:before', () => {
  info('pjax:before');
  try { setTextMode && setTextMode('dissolve'); } catch {}
  try {
    const c = document.getElementById('cloud-bg');
    if (c) {
      c.style.pointerEvents = 'none';
      c.style.zIndex = '0';
    }
    if (renderer?.domElement) {
      renderer.setClearAlpha?.(0);
      renderer.domElement.style.pointerEvents = 'none';
      renderer.domElement.style.zIndex = '0';
    }
  } catch {}
  unbindUI();
  destroy();
});

document.addEventListener('pjax:ready', (e) => {
  info('pjax:ready');
  const container = e.detail?.container || document;
  init(container);
  try { applyCanvasMode('pjax:ready'); } catch {}
  try { reactor.attach(container); } catch {}
});

/* ------------------------------ Public API -------------------------------- */
window.NuageCloud = window.NuageCloud || { init, destroy };
Object.assign(window.NuageCloud, {
  setTextMode: (mode) => { try { setTextMode && setTextMode(mode); } catch {} },
  toggleText:  () => { try { toggleText && toggleText(); } catch {} },
  getAudioDrive: () => reactor?.getDrive?.() || { bass:0, high:0, rms:0 }
});
