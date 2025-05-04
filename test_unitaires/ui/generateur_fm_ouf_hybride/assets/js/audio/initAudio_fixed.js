// initAudio.js
import { createReverbImpulse } from "./reverbHelper.js";
import { makeDistortionCurve } from "./distortionUtils.js";
import { initSequencerUI } from "../sequencer/initSequencerUI.js";

// On exporte toutes les variables / nodes qu'on veut réutiliser
export let audioCtx = null;

export let masterGain, panNode;
export let filterNodeA, filterEnvGainA;
export let filterNodeB, filterEnvGainB;
export let distortionNode;
export let delayNode, feedbackGain;
export let reverbConvolver, reverbWetGain;
export let noiseGainNode;
export let mainOutputGain; // un bus final ?

// FM operators
export const MAX_OPERATORS = 4;
export const operators = [];

// Additive partials
export let partialOscs = [];
export let partialMixGain;

// amplitude envelope
export let ampEnvGain;

// Pour le bruit
export let noiseSource = null;

// Fonction pour exposer le contexte
export function getAudioContext() {
  return audioCtx;
}

// Appelé une fois
export function initAudio() {
  if (audioCtx) return; // déjà créé ?

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  window.audioCtx = audioCtx; // accessible pour debug

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.7;
  panNode = audioCtx.createStereoPanner();
  panNode.pan.value = 0;
  masterGain.connect(audioCtx.destination);
  panNode.connect(masterGain);

  // Filtre A
  filterNodeA = audioCtx.createBiquadFilter();
  filterNodeA.type = "lowpass";
  filterNodeA.frequency.value = 800;
  filterNodeA.Q.value = 1;
  filterEnvGainA = audioCtx.createGain();
  filterEnvGainA.gain.value = 0;
  filterEnvGainA.connect(filterNodeA.frequency);

  // Filtre B
  filterNodeB = audioCtx.createBiquadFilter();
  filterNodeB.type = "highpass";
  filterNodeB.frequency.value = 2000;
  filterNodeB.Q.value = 0.5;
  filterEnvGainB = audioCtx.createGain();
  filterEnvGainB.gain.value = 0;
  filterEnvGainB.connect(filterNodeB.frequency);

  // Distorsion
  distortionNode = audioCtx.createWaveShaper();
  distortionNode.oversample = "4x";

  // Delay
  delayNode = audioCtx.createDelay(6.0);
  delayNode.delayTime.value = 0.2;
  feedbackGain = audioCtx.createGain();
  feedbackGain.gain.value = 0.3;
  delayNode.connect(feedbackGain).connect(delayNode);
  const delayMix = audioCtx.createGain();
  delayMix.gain.value = 0.3;
  delayNode.connect(delayMix);

  // Reverb
  reverbConvolver = audioCtx.createConvolver();
  reverbConvolver.buffer = createReverbImpulse(2, audioCtx);
  reverbWetGain = audioCtx.createGain();
  reverbWetGain.gain.value = 0;
  reverbConvolver.connect(reverbWetGain);

  // Noise
  noiseGainNode = audioCtx.createGain();
  noiseGainNode.gain.value = 0;

  // Summation bus
  const cleanBus = audioCtx.createGain();
  cleanBus.gain.value = 1.0;
  const sumBus = audioCtx.createGain();
  sumBus.gain.value = 1.0;

  // Routing final
  cleanBus.connect(distortionNode);
  delayMix.connect(distortionNode);
  reverbWetGain.connect(distortionNode);
  noiseGainNode.connect(distortionNode);

  distortionNode.connect(filterNodeA);
  filterNodeA.connect(filterNodeB);
  filterNodeB.connect(panNode);

  // Additive partials
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

  // FM operators
  for (let i = 0; i < MAX_OPERATORS; i++) {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    const g = audioCtx.createGain();
    g.gain.value = 0;
    osc.connect(g);
    operators.push({ osc, gainNode: g });
    osc.start();
  }

  // Amp Envelope
  ampEnvGain = audioCtx.createGain();
  ampEnvGain.gain.value = 0;
  const sumOsc = audioCtx.createGain();
  sumOsc.connect(ampEnvGain).connect(cleanBus);
  partialMixGain.connect(sumOsc);
  operators[0].gainNode.connect(sumOsc);

  // Lancer interface séquenceur
  initSequencerUI();
}
