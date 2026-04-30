// assets/js/musicam/modules/config.js
// -------------------------------------------------------------
// Configuration centrale MusiCam (indices BlazePose, squelette,
// presets caméra, gammes & quantification, seuils/hystérésis).
// -------------------------------------------------------------

// ————————————————————————————————————————————————
// 1) Caméra : trois niveaux
// ————————————————————————————————————————————————
export const CAMERA_PRESETS = {
  hi : { width:{ ideal:1280 }, height:{ ideal:720  }, frameRate:{ ideal:30 } },
  mid: { width:{ ideal:960  }, height:{ ideal:540  }, frameRate:{ ideal:30 } },
  lo : { width:{ ideal:640  }, height:{ ideal:360  }, frameRate:{ ideal:30 } },
};

// ————————————————————————————————————————————————
// 2) Indices BlazePose (Full) normalisés
// ————————————————————————————————————————————————
export const BLAZE = {
  NOSE:0,
  LEFT_EYE_INNER:1, LEFT_EYE:2, LEFT_EYE_OUTER:3,
  RIGHT_EYE_INNER:4, RIGHT_EYE:5, RIGHT_EYE_OUTER:6,
  LEFT_EAR:7, RIGHT_EAR:8,
  LEFT_MOUTH:9, RIGHT_MOUTH:10,
  LEFT_SHOULDER:11, RIGHT_SHOULDER:12,
  LEFT_ELBOW:13, RIGHT_ELBOW:14,
  LEFT_WRIST:15, RIGHT_WRIST:16,
  LEFT_PINKY:17, RIGHT_PINKY:18,
  LEFT_INDEX:19, RIGHT_INDEX:20,
  LEFT_THUMB:21, RIGHT_THUMB:22,
  LEFT_HIP:23, RIGHT_HIP:24,
  LEFT_KNEE:25, RIGHT_KNEE:26,
  LEFT_ANKLE:27, RIGHT_ANKLE:28,
  LEFT_HEEL:29, RIGHT_HEEL:30,
  LEFT_FOOT_INDEX:31, RIGHT_FOOT_INDEX:32
};

// Squelette (liste de segments [a,b]) pour l’overlay.
export const SKELETON = [
  [11,12],
  [11,13],[13,15],
  [12,14],[14,16],
  [11,23],[12,24],[23,24],
  [23,25],[25,27],[27,29],[29,31],
  [24,26],[26,28],[28,30],[30,32]
];

// Noms “courts” utilisés partout (loop/mapping).
export const KEYPOINT_NAMES = {
  nose:            BLAZE.NOSE,
  head:            BLAZE.NOSE,          // alias historique
  left_wrist:      BLAZE.LEFT_WRIST,
  right_wrist:     BLAZE.RIGHT_WRIST,
  left_elbow:      BLAZE.LEFT_ELBOW,
  right_elbow:     BLAZE.RIGHT_ELBOW,
  left_shoulder:   BLAZE.LEFT_SHOULDER,
  right_shoulder:  BLAZE.RIGHT_SHOULDER,
  left_ankle:      BLAZE.LEFT_ANKLE,
  right_ankle:     BLAZE.RIGHT_ANKLE,
  left_hip:        BLAZE.LEFT_HIP,
  right_hip:       BLAZE.RIGHT_HIP
};

// ————————————————————————————————————————————————
// 3) Mapping “notes fixes” (mode simple / rétro-compat)
// (utilisé par d’anciens mappings ; le mode fixed actuel code ses notes directement)
// ————————————————————————————————————————————————
export const NOTE_MAP_FIXED = {
  right_wrist: 60,  // C4
  left_wrist:  64,  // E4
  right_elbow: 67,  // G4
  left_elbow:  72,  // C5
  head:        65   // F4
};

// ————————————————————————————————————————————————
// 4) Gammes et quantification
// ————————————————————————————————————————————————
export const SCALES = {
  // Pentatoniques historiques + modes demandés
  C_major_pentatonic: [0,2,4,7,9],
  C_minor_pentatonic: [0,3,5,7,10],
  D_dorian:           [0,2,3,5,7,9,10],
  G_mixolydian:       [0,2,4,5,7,9,10],
  // Modes génériques
  ionian:     [0,2,4,5,7,9,11],
  aeolian:    [0,2,3,5,7,8,10],
  dorian:     [0,2,3,5,7,9,10],
  mixolydian: [0,2,4,5,7,9,10],
  lydian:     [0,2,4,6,7,9,11],
  phrygian:   [0,1,3,5,7,8,10],
  locrian:    [0,1,3,5,6,8,10]
};

// Quantification d’une hauteur MIDI vers la gamme choisie (note la plus proche).
export function quantizeToScale(midi, scaleName = 'ionian') {
  const scale = SCALES[scaleName] || SCALES.ionian;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const base = Math.floor(midi / 12) * 12;
  let best = midi, dmin = 1e9;
  for (let o = -1; o <= 1; o++) {
    for (const d of scale) {
      const cand = base + d + o * 12;
      const err = Math.abs(cand - midi);
      if (err < dmin) { dmin = err; best = cand; }
    }
  }
  return clamp(Math.round(best), 24, 108);
}

// Helpers musicaux communs aux modes “Y→pitch”, theremin, etc.
export function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
export function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// Conversion Y (pixels) → MIDI sur une plage (y=0 haut = aigu).
export function yToMidi(y, viewportH, low = 48, high = 84) {
  if (!viewportH || viewportH <= 0) return low;
  const t = clamp01(1 - (y / viewportH)); // inverser: haut = 1
  return low + t * (high - low);
}

// ————————————————————————————————————————————————
// 5) Seuils & hystérésis de mouvement
// ————————————————————————————————————————————————
export const MOVEMENT_THRESH_GLOBAL = 0.028;

export const MOTION_HYSTERESIS = {
  default: { on: 0.018, off: 0.012 },
  nose:    { on: 0.022, off: 0.015 },
  wrist:   { on: 0.018, off: 0.012 },
  elbow:   { on: 0.019, off: 0.013 },
  ankle:   { on: 0.020, off: 0.014 }
};

export const THRESHOLDS_DEFAULT = {
  motion: {
    default: MOTION_HYSTERESIS.default,
    nose:    MOTION_HYSTERESIS.nose
  },
  refractoryMs: 70
};

// ————————————————————————————————————————————————
// 6) Valeurs par défaut (défauts “musicals” sûrs)
// ————————————————————————————————————————————————
export const DEFAULTS = {
  autoResolution: false,
  instrument: 'piano',
  outputMode: 'auto',                  // 'auto' | 'synth' | 'midi'
  movementThreshold: MOVEMENT_THRESH_GLOBAL,
  noteOffHoldMs: 160,
  currentScale: 'C_major_pentatonic',

  mappingMode: 'y-pitch',
  videoLevel: 'mid',                   // 'hi' | 'mid' | 'lo'
  modelType: 'full',
  faceEnabled: false,
  refractoryMs: 70,

  // Smoothing “safe”
  smoothing: {
    emaAlphaVel: 0.35,
    emaAlphaPos: 0.45
  },

  // Hold dynamique (API moderne)
  noteOffBaseMs : 110,
  noteOffRangeMs: 130,

  // Seuils centralisés
  thresholds: THRESHOLDS_DEFAULT
};

// ————————————————————————————————————————————————
// 7) Sélecteur d’hystérésis par articulation
// ————————————————————————————————————————————————
export function hysteresisForKeypointIndex(kpIndex) {
  switch (kpIndex) {
    case BLAZE.NOSE: return MOTION_HYSTERESIS.nose;
    case BLAZE.LEFT_WRIST:
    case BLAZE.RIGHT_WRIST: return MOTION_HYSTERESIS.wrist;
    case BLAZE.LEFT_ELBOW:
    case BLAZE.RIGHT_ELBOW: return MOTION_HYSTERESIS.elbow;
    case BLAZE.LEFT_ANKLE:
    case BLAZE.RIGHT_ANKLE: return MOTION_HYSTERESIS.ankle;
    default: return MOTION_HYSTERESIS.default;
  }
}

// ————————————————————————————————————————————————
// 8) Exports utilitaires overlay & debug
// ————————————————————————————————————————————————
export const DRAW_STYLES = {
  kpMinScore: 0.3,
  kpRadius: 5,
  skeletonOpacity: 0.9
};

// Version "flat" du squelette utile côté worker.
export const SKELETON_FLAT = (() => {
  const out = new Uint16Array(SKELETON.length * 2);
  for (let i = 0; i < SKELETON.length; i++) {
    out[i * 2] = SKELETON[i][0];
    out[i * 2 + 1] = SKELETON[i][1];
  }
  return out;
})();
