// initAudio.js
import { createReverbImpulse } from "./reverbHelper.js";
import { connectLfoTarget } from "./lfoUtils.js";
import { initSequencerUI } from "../sequencer/initSequencerUI.js";

export let audioCtx = null;
export let masterGain, filterNode, filterEnvGain, distortionNode;
export let delayNode, feedbackGain, reverbConvolver, reverbWetGain;
export let panNode, ampEnvGain, partialOscs, partialMixGain;
export let lfoOsc, lfoGain, operators;

const MAX_OPERATORS = 4;

export function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // === Master & Routing ===
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.7;

  panNode = audioCtx.createStereoPanner();
  panNode.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  filterNode = audioCtx.createBiquadFilter();
  filterNode.type = "lowpass";
  filterNode.frequency.value = 800;
  filterNode.Q.value = 1;

  filterEnvGain = audioCtx.createGain();
  filterEnvGain.gain.value = 0;
  filterEnvGain.connect(filterNode.frequency);

  distortionNode = audioCtx.createWaveShaper();
  distortionNode.oversample = "4x";

  delayNode = audioCtx.createDelay(5.0);
  delayNode.delayTime.value = 0.3;
  feedbackGain = audioCtx.createGain();
  feedbackGain.gain.value = 0.3;
  delayNode.connect(feedbackGain).connect(delayNode);
  const delayMix = audioCtx.createGain();
  delayMix.gain.value = 0.3;
  delayNode.connect(delayMix);

  reverbConvolver = audioCtx.createConvolver();
  reverbConvolver.buffer = createReverbImpulse(2, audioCtx); // <-- correction ici
  reverbWetGain = audioCtx.createGain();
  reverbWetGain.gain.value = 0;
  reverbConvolver.connect(reverbWetGain);

  const cleanBus = audioCtx.createGain();
  const sumBus = audioCtx.createGain();
  sumBus.connect(distortionNode);
  distortionNode.connect(filterNode);
  filterNode.connect(panNode);

  cleanBus.connect(sumBus);
  delayMix.connect(sumBus);
  reverbWetGain.connect(sumBus);

  // === FM Operators ===
  operators = [];
  for (let i = 0; i < MAX_OPERATORS; i++) {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    const g = audioCtx.createGain();
    g.gain.value = 0;
    osc.connect(g);
    operators.push({ osc, gainNode: g });
    osc.start();
  }

  // === Additive Oscillators ===
  partialOscs = [];
  partialMixGain = audioCtx.createGain();
  partialMixGain.gain.value = 0.5;
  [1, 2, 3, 4].forEach(() => {
    const o = audioCtx.createOscillator();
    o.type = "sine";
    o.start();
    o.connect(partialMixGain);
    partialOscs.push(o);
  });

  ampEnvGain = audioCtx.createGain();
  ampEnvGain.gain.value = 0;

  const sumOsc = audioCtx.createGain();
  sumOsc.connect(ampEnvGain).connect(cleanBus);

  partialMixGain.connect(sumOsc);
  operators[0].gainNode.connect(sumOsc);

  // === LFO ===
  lfoOsc = audioCtx.createOscillator();
  lfoOsc.type = "sine";
  lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 0;
  lfoOsc.connect(lfoGain);
  lfoOsc.start();

  // Interface sequencer
  initSequencerUI();
}
