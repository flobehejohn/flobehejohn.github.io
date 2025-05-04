// envelopes.js
// Gestion des enveloppes amplitude & filtres
// On d�finit des variables globales, ou on exporte de quoi stocker

export let A = 0.5,
  D = 0.5,
  S = 0.7,
  R = 1.0;
export let filterEnvDepthA = 1000;
export let filterEnvDepthB = 0;

export function setAmpEnvelope(a, d, s, r) {
  A = a;
  D = d;
  S = s;
  R = r;
}

export function setFilterEnvDepthA(dep) {
  filterEnvDepthA = dep;
}
export function setFilterEnvDepthB(dep) {
  filterEnvDepthB = dep;
}

// Exemple de fonction pour d�clencher l'env
// (Ici c�est un code �monophonique�. Si poly => adapter par voix.)
export function triggerAmpEnv(ampGainNode, audioCtx) {
  const now = audioCtx.currentTime;
  ampGainNode.gain.cancelScheduledValues(now);
  // Attack
  ampGainNode.gain.setValueAtTime(0, now);
  ampGainNode.gain.linearRampToValueAtTime(1, now + A);
  // Decay
  ampGainNode.gain.linearRampToValueAtTime(S, now + A + D);
}

export function releaseAmpEnv(ampGainNode, audioCtx) {
  const now = audioCtx.currentTime;
  ampGainNode.gain.cancelScheduledValues(now);
  const currentVal = ampGainNode.gain.value;
  ampGainNode.gain.setValueAtTime(currentVal, now);
  ampGainNode.gain.linearRampToValueAtTime(0, now + R);
}

export function triggerFilterEnv(filterEnvGain, audioCtx, depth) {
  const now = audioCtx.currentTime;
  filterEnvGain.gain.cancelScheduledValues(now);
  filterEnvGain.gain.setValueAtTime(0, now);
  filterEnvGain.gain.linearRampToValueAtTime(depth, now + A);
  filterEnvGain.gain.linearRampToValueAtTime(0, now + A + D);
}
