export const BINAURAL_DRONE_STATE_VERSION = 'BINAURAL_DRONE_STATE_V1';

export const DEFAULT_BINAURAL_DRONE_STATE = Object.freeze({
  enabled: false,
  renderer: 'binaural',
  rootMidi: 45,
  scale: 'minor-pentatonic',
  intervals: [0, 7, 12, 19, 24],
  detuneCents: 4,
  azimuthDeg: 0,
  elevationDeg: 0,
  distance: 1.2,
  spreadDeg: 55,
  lfoRateHz: 0.08,
  textureSeed: 'audio-ci-lab-default',
  gain: 0.35,
});

export function clamp(value, min, max, fallback = min) {
  const parsed = Number.parseFloat(String(value));

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

export function normalizeRenderer(value) {
  return value === 'stereo' || value === 'binaural' ? value : DEFAULT_BINAURAL_DRONE_STATE.renderer;
}

export function normalizeIntervals(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_BINAURAL_DRONE_STATE.intervals.slice();
  }

  const next = value
    .map((item) => Number.parseInt(String(item), 10))
    .filter((item) => Number.isFinite(item))
    .slice(0, 12);

  return next.length > 0 ? next : DEFAULT_BINAURAL_DRONE_STATE.intervals.slice();
}

export function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function normalizeBinauralDroneState(input = {}) {
  return {
    version: BINAURAL_DRONE_STATE_VERSION,
    enabled: Boolean(input.enabled ?? DEFAULT_BINAURAL_DRONE_STATE.enabled),
    renderer: normalizeRenderer(input.renderer),
    rootMidi: clamp(input.rootMidi, 24, 96, DEFAULT_BINAURAL_DRONE_STATE.rootMidi),
    scale: String(input.scale || DEFAULT_BINAURAL_DRONE_STATE.scale),
    intervals: normalizeIntervals(input.intervals),
    detuneCents: clamp(input.detuneCents, -50, 50, DEFAULT_BINAURAL_DRONE_STATE.detuneCents),
    azimuthDeg: clamp(input.azimuthDeg, -180, 180, DEFAULT_BINAURAL_DRONE_STATE.azimuthDeg),
    elevationDeg: clamp(input.elevationDeg, -90, 90, DEFAULT_BINAURAL_DRONE_STATE.elevationDeg),
    distance: clamp(input.distance, 0.1, 20, DEFAULT_BINAURAL_DRONE_STATE.distance),
    spreadDeg: clamp(input.spreadDeg, 0, 180, DEFAULT_BINAURAL_DRONE_STATE.spreadDeg),
    lfoRateHz: clamp(input.lfoRateHz, 0.01, 20, DEFAULT_BINAURAL_DRONE_STATE.lfoRateHz),
    textureSeed: String(input.textureSeed || DEFAULT_BINAURAL_DRONE_STATE.textureSeed),
    gain: clamp(input.gain, 0, 1, DEFAULT_BINAURAL_DRONE_STATE.gain),
  };
}

export function createDroneVoicePlan(input = {}) {
  const state = normalizeBinauralDroneState(input);

  return state.intervals.map((interval, index) => {
    const midi = state.rootMidi + interval;
    const spreadRatio = state.intervals.length <= 1
      ? 0
      : index / (state.intervals.length - 1);

    return {
      index,
      midi,
      frequencyHz: Number(midiToHz(midi).toFixed(3)),
      detuneCents: Number((state.detuneCents * (index % 2 === 0 ? 1 : -1)).toFixed(3)),
      azimuthDeg: Number((state.azimuthDeg + (spreadRatio - 0.5) * state.spreadDeg).toFixed(3)),
      elevationDeg: state.elevationDeg,
      distance: state.distance,
      gain: Number((state.gain / Math.max(1, state.intervals.length)).toFixed(5)),
    };
  });
}

export function serializeBinauralDroneState(input = {}) {
  const state = normalizeBinauralDroneState(input);

  return JSON.stringify({
    version: state.version,
    renderer: state.renderer,
    rootMidi: state.rootMidi,
    scale: state.scale,
    intervals: state.intervals,
    detuneCents: state.detuneCents,
    azimuthDeg: state.azimuthDeg,
    elevationDeg: state.elevationDeg,
    distance: state.distance,
    spreadDeg: state.spreadDeg,
    lfoRateHz: state.lfoRateHz,
    textureSeed: state.textureSeed,
    gain: state.gain,
    enabled: state.enabled,
  });
}
