// assets/js/audio/initAudio.js
import { createReverbImpulse } from "./reverbHelper.js";
import { makeDistortionCurve } from "./distortionUtils.js";
import { initSequencerUI } from "../sequencer/initSequencerUI.js";

export let audioCtx = null;

export let masterGain, panNode;
export let filterNodeA, filterEnvGainA;
export let filterNodeB, filterEnvGainB;
export let distortionNode;
export let delayNode, feedbackGain;
export let reverbConvolver, reverbWetGain;
export let noiseGainNode;
export let mainOutputGain;

export const MAX_OPERATORS = 4;
export const operators = [];

export let partialOscs = [];
export let partialMixGain;
export let ampEnvGain;
export let noiseSource = null;

export function getAudioContext() {
  return audioCtx;
}

export function initAudio() {
  if (audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  window.audioCtx = audioCtx;

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.7;

  panNode = audioCtx.createStereoPanner();
  panNode.pan.value = 0;

  // Connexion finale vers sortie
  panNode.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  // === Filtres ===
  filterNodeA = audioCtx.createBiquadFilter();
  filterNodeA.type = "lowpass";
  filterNodeA.frequency.value = 800;
  filterNodeA.Q.value = 1;
  filterEnvGainA = audioCtx.createGain();
  filterEnvGainA.gain.value = 0;
  filterEnvGainA.connect(filterNodeA.frequency);

  filterNodeB = audioCtx.createBiquadFilter();
  filterNodeB.type = "highpass";
  filterNodeB.frequency.value = 2000;
  filterNodeB.Q.value = 0.5;
  filterEnvGainB = audioCtx.createGain();
  filterEnvGainB.gain.value = 0;
  filterEnvGainB.connect(filterNodeB.frequency);

  // === Distorsion ===
  distortionNode = audioCtx.createWaveShaper();
  distortionNode.oversample = "4x";

  // === Delay ===
  delayNode = audioCtx.createDelay(6.0);
  delayNode.delayTime.value = 0.2;
  feedbackGain = audioCtx.createGain();
  feedbackGain.gain.value = 0.3;
  delayNode.connect(feedbackGain).connect(delayNode);
  const delayMix = audioCtx.createGain();
  delayMix.gain.value = 0.3;
  delayNode.connect(delayMix);

  // === Reverb ===
  reverbConvolver = audioCtx.createConvolver();
  reverbConvolver.buffer = createReverbImpulse(2, audioCtx);
  reverbWetGain = audioCtx.createGain();
  reverbWetGain.gain.value = 0;
  reverbConvolver.connect(reverbWetGain);

  // === Bruit ===
  noiseGainNode = audioCtx.createGain();
  noiseGainNode.gain.value = 0;

  // === Bus clean + sum
  const cleanBus = audioCtx.createGain();
  cleanBus.gain.value = 1.0;

  cleanBus.connect(distortionNode);
  delayMix.connect(distortionNode);
  reverbWetGain.connect(distortionNode);
  noiseGainNode.connect(distortionNode);

  distortionNode.connect(filterNodeA);
  filterNodeA.connect(filterNodeB);
  filterNodeB.connect(panNode);

  // === Additive partials ===
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

  // === FM Operators ===
  for (let i = 0; i < MAX_OPERATORS; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    osc.type = "sine";
    osc.connect(gain);
    operators.push({ osc, gainNode: gain });
    osc.start();
  }

  // === Amplitude Envelope ===
  ampEnvGain = audioCtx.createGain();
  ampEnvGain.gain.value = 0;

  const sumOsc = audioCtx.createGain();
  partialMixGain.connect(sumOsc);
  operators[0].gainNode.connect(sumOsc);
  sumOsc.connect(ampEnvGain).connect(cleanBus);

  // UI
  initSequencerUI();
}
