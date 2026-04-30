// assets/js/musicam/modules/state.js
// État unifié : compat historique + nouvelles structures perf/mapping/audio.

import { DEFAULTS } from './config.js';

// ====== Maps runtime (non sérialisées) ======
const _activeNotes = new Map(); // midi -> { on?:boolean, source?:string, tOn?:number, vel?:number }
const _velEMA      = new Map(); // kpIndex -> v_ema
const _isOn        = new Map(); // kpIndex -> boolean (hystérésis)
const _lastTrig    = new Map(); // midi -> last trigger time (ms)

// ====== Helpers ======
function clamp01(x){ return Math.min(1, Math.max(0, x)); }

// ====== État global ======
export const state = {
  // ---------- Compat / préférences ----------
  instrument:        (DEFAULTS?.instrument ?? 'piano'),
  outputMode:        (DEFAULTS?.outputMode ?? 'auto'), // 'auto'|'synth'|'midi'
  movementThreshold: (DEFAULTS?.movementThreshold ?? 0.028),
  noteOffHoldMs:     (DEFAULTS?.noteOffHoldMs ?? 160),
  currentScale:      (DEFAULTS?.currentScale ?? 'C_major_pentatonic'),
  mappingMode:       (DEFAULTS?.mappingMode ?? 'y-pitch'),
  autoResolution: (DEFAULTS?.autoResolution ?? false),
  _desiredLevel: (DEFAULTS?.videoLevel ?? 'mid'),

  // Ancien suivi FPS (gardé pour compat de badges externes)
  fpsEMA: 0,
  lastT:  0,

  calibration: {
    wristOffsetY: (DEFAULTS?.calibration?.wristOffsetY ?? 0),
    deadZone:     (DEFAULTS?.calibration?.deadZone ?? 0)
  },

  tuning: { modelType: (DEFAULTS?.tuning?.modelType ?? DEFAULTS?.modelType ?? 'full') },

  // Contrainte vidéo legacy (fallback)
  videoConstraints: {
    video: {
      facingMode: (DEFAULTS?.videoConstraints?.video?.facingMode ?? 'user'),
      width:  { ideal: (DEFAULTS?.videoConstraints?.video?.width?.ideal  ?? 1280) },
      height: { ideal: (DEFAULTS?.videoConstraints?.video?.height?.ideal ?? 720)  }
    },
    audio: false
  },

  faceEnabled: !!DEFAULTS?.faceEnabled,

  // Audio FX + Synth (conservés et enrichissables)
  tempoBPM: (DEFAULTS?.tempoBPM ?? 120),
  fx: {
    master:  (DEFAULTS?.fx?.master  ?? 0.9),
    delay:   (DEFAULTS?.fx?.delay   ?? 0.2),
    delayFB: (DEFAULTS?.fx?.delayFB ?? 0.35),
    reverb:  (DEFAULTS?.fx?.reverb  ?? 0.15),
  },
  synth: {
    // Osc & mix
    wave: (DEFAULTS?.synth?.wave ?? 'sawtooth'),
    wave2:(DEFAULTS?.synth?.wave2 ?? 'sine'),
    morph:(DEFAULTS?.synth?.morph ?? 0),
    harmonics:(DEFAULTS?.synth?.harmonics ?? 0),

    // Enveloppe
    adsr: {
      a: DEFAULTS?.synth?.adsr?.a ?? 0.008,
      d: DEFAULTS?.synth?.adsr?.d ?? 0.09,
      s: DEFAULTS?.synth?.adsr?.s ?? 0.05,
      r: DEFAULTS?.synth?.adsr?.r ?? 0.12,
    },

    // Filtre
    cutoff:      (DEFAULTS?.synth?.cutoff      ?? 0.12),
    resonance:   (DEFAULTS?.synth?.resonance   ?? 0.5),
    filterType:  (DEFAULTS?.synth?.filterType  ?? 'lowpass'),
    filterPoles: (DEFAULTS?.synth?.filterPoles ?? 2),

    // FM & Mod
    fmq:       (DEFAULTS?.synth?.fmq       ?? 0),
    fmDepth:   (DEFAULTS?.synth?.fmDepth   ?? 0),
    lfoRate:   (DEFAULTS?.synth?.lfoRate   ?? 0),
    lfoDepth:  (DEFAULTS?.synth?.lfoDepth  ?? 0),
    lfoTarget: (DEFAULTS?.synth?.lfoTarget ?? 'freq'),

    // Jeu
    glide:   (DEFAULTS?.synth?.glide   ?? 0),
    width:   (DEFAULTS?.synth?.width   ?? 0),
    drive:   (DEFAULTS?.synth?.drive   ?? 0),
    playMode:(DEFAULTS?.synth?.playMode?? 'poly')
  },

  // Notes actives (Map runtime)
  activeNotes: _activeNotes,

  // ---------- Vision / Perf ----------
  perf: {
    fpsEMA: 0,            // FPS lissé (nouvelle référence interne)
    lastInferMs: 0,       // coût de l’inférence (ms)
    inferEvery: 1,        // frame skipping dynamique (1 = chaque frame)
    resolution: 'mid',    // 'lo' | 'mid' | 'hi'
  },
  camera: {
    width:  960,
    height: 540,
    frameRate: 30
  },
  smoothing: {
    emaAlphaPos: 0.45,    // lissage positions (utilisé par loop.js → EMA_ALPHA_POS)
    emaAlphaVel: 0.35,    // lissage vitesses (déclencheur)
    minConfidence: 0.3
  },
  thresholds: {
    motion: {
      default: { on: 0.018, off: 0.012 },
      nose:    { on: 0.022, off: 0.015 }
    },
    refractoryMs: (DEFAULTS?.refractoryMs ?? 70)
  },

  // ---------- Mapping / Musique ----------
  noteOffBaseMs:  (DEFAULTS?.noteOffBaseMs  ?? 110),
  noteOffRangeMs: (DEFAULTS?.noteOffRangeMs ?? 130),

  // ---------- Caches dynamiques Vision ----------
  prevKps: null,
  velEMA:  _velEMA,
  isOn:    _isOn,
  lastTrig:_lastTrig,
  noseNeutralY: null,

  // ---------- Diagnostics UI ----------
  audits: {
    energy: 0,
    faceOn: false,
  },

  // ---------- Paramètres Worklet (auxiliaires) ----------
  worklet: {
    glideMs: (DEFAULTS?.worklet?.glideMs ?? 8)
  }
};

// ====== Fonctions utilitaires ======

/** Réinitialise les compteurs runtime (utilisé lors des (re)démarrages). */
export function resetRuntime() {
  // Compat historique
  state.fpsEMA = 0;
  state.lastT  = 0;

  // Nouveau pipeline
  state.perf.fpsEMA      = 0;
  state.perf.lastInferMs = 0;
  state.perf.inferEvery  = 1;

  state.prevKps = null;
  state.velEMA.clear();
  state.isOn.clear();
  state.lastTrig.clear();
  flushAllNotes(); // vide aussi les notes actives
  state.noseNeutralY = null;
}

/** Éteint toutes les notes actives proprement. */
export function flushAllNotes(noteOffCb) {
  for (const [n, info] of state.activeNotes.entries()) {
    if (info?.on && typeof noteOffCb === 'function') {
      try { noteOffCb(n); } catch(_) {}
    }
  }
  state.activeNotes.clear();
}

/** Délai de relâchement basé sur la vélocité normalisée (0..1). */
export function getDynamicHoldMs(vel01) {
  const v = Number.isFinite(vel01) ? clamp01(vel01) : null;
  if (v == null) return state.noteOffHoldMs; // compat ancien comportement
  return Math.round(state.noteOffBaseMs + v * state.noteOffRangeMs);
}

/** Met à jour la caméra (utilisé par l’init / auto-résolution). */
export function setCameraInfo({ width, height, frameRate, resolution }) {
  if (Number.isFinite(width))     state.camera.width  = width;
  if (Number.isFinite(height))    state.camera.height = height;
  if (Number.isFinite(frameRate)) state.camera.frameRate = frameRate;
  if (resolution)                 state.perf.resolution = resolution;
}

/** Met à jour le pivot du head-bend (calibration douce). */
export function setNoseNeutralY(y) { state.noseNeutralY = y; }

/** Bascule proprement le mode de mapping. */
export function setMappingMode(mode) { state.mappingMode = mode || 'fixed'; }

/** Définit l’échelle courante. */
export function setScale(name) { state.currentScale = name || state.currentScale; }
