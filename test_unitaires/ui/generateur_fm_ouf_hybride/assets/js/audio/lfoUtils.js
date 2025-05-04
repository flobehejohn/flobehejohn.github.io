// lfoUtils.js
// G�rer un LFO global + routing

import { audioCtx } from "./initAudio.js";

export let lfoOsc, lfoGain;
export let lfoTarget = "none";

export function initGlobalLFO() {
  if (!audioCtx) return;
  if (!lfoOsc) {
    lfoOsc = audioCtx.createOscillator();
    lfoGain = audioCtx.createGain();
    lfoOsc.connect(lfoGain);
    lfoOsc.start();
  }
}

export function setLfoParams(rate, depth, wave, target) {
  if (!lfoOsc || !lfoGain) return;
  lfoOsc.frequency.setTargetAtTime(rate, audioCtx.currentTime, 0.02);
  lfoGain.gain.setTargetAtTime(depth, audioCtx.currentTime, 0.02);
  lfoOsc.type = wave;
  lfoTarget = target;
}

// On fera la modulation �manuellement� dans un updateAllParams ou un animate()
// (ex. en modifiant param selon la valeur instantan�e du LFO via getCurrentLfoValue())
