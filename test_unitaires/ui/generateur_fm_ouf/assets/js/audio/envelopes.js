import { audioCtx, ampEnvGain, filterEnvGain } from "./initAudio.js";

export let A = 0.5,
  D = 0.5,
  S = 0.7,
  R = 1.0;
export let filterEnvDepth = 1000;

export function triggerAmpEnv() {
  const now = audioCtx.currentTime;
  ampEnvGain.gain.cancelScheduledValues(now);
  const val = ampEnvGain.gain.value;
  ampEnvGain.gain.setValueAtTime(val, now);
  ampEnvGain.gain.linearRampToValueAtTime(1, now + A);
  ampEnvGain.gain.linearRampToValueAtTime(S, now + A + D);
}

export function triggerFilterEnv() {
  const now = audioCtx.currentTime;
  filterEnvGain.gain.cancelScheduledValues(now);
  filterEnvGain.gain.setValueAtTime(0, now);
  filterEnvGain.gain.linearRampToValueAtTime(filterEnvDepth, now + A);
  filterEnvGain.gain.linearRampToValueAtTime(0, now + A + D);
}
