// updateAllParams.js
import {
  audioCtx,
  masterGain,
  panNode,
  filterNodeA,
  filterEnvGainA,
  filterNodeB,
  filterEnvGainB,
  distortionNode,
  delayNode,
  feedbackGain,
  reverbConvolver,
  reverbWetGain,
  noiseGainNode,
  partialMixGain,
  operators,
  noiseSource,
} from "./initAudio.js";

import { createReverbImpulse } from "./reverbHelper.js";
import { makeDistortionCurve } from "./distortionUtils.js";
import {
  getWaveDataForType,
  createPeriodicWaveFromArrays,
  morphWaves,
} from "./morphingUtils.js";

import {
  A,
  D,
  S,
  R,
  setAmpEnvelope,
  filterEnvDepthA,
  filterEnvDepthB,
  setFilterEnvDepthA,
  setFilterEnvDepthB,
} from "./envelopes.js";

import { initGlobalLFO, setLfoParams, lfoTarget } from "./lfoUtils.js";

export let voiceCount = 1;
export let chordSelected = "C";
export let pitchTranspose = 0;
export let polyMode = "para";
export let currentNoiseType = "off";
export let octaveShift = 0;
export let stereoSpread = 0;

export function updateAllParams() {
  if (!audioCtx) return;

  // Master volume
  const mv = parseFloat(document.getElementById("masterVol").value) || 0.7;
  masterGain.gain.setTargetAtTime(mv, audioCtx.currentTime, 0.02);

  // Pan
  const pVal = parseFloat(document.getElementById("panRange").value) || 0;
  panNode.pan.setTargetAtTime(pVal, audioCtx.currentTime, 0.02);

  // Delay / Reverb
  const dVal = parseFloat(document.getElementById("delayRange").value) || 0.2;
  feedbackGain.gain.setTargetAtTime(dVal, audioCtx.currentTime, 0.02);

  const rvDec = parseFloat(document.getElementById("reverbDecay").value) || 2;
  reverbConvolver.buffer = createReverbImpulse(rvDec, audioCtx);

  const rvWet = parseFloat(document.getElementById("reverbWet").value) || 0;
  reverbWetGain.gain.setTargetAtTime(rvWet, audioCtx.currentTime, 0.02);

  // Distorsion
  const distA = parseFloat(document.getElementById("distAmount").value) || 0;
  distortionNode.curve = makeDistortionCurve(distA, 1.0);

  // Filtre A
  const ftA = document.getElementById("filterTypeA").value;
  filterNodeA.type = ftA === "notch" ? "notch" : ftA;
  const cutoffA =
    parseFloat(document.getElementById("filterCutoffA").value) || 800;
  filterNodeA.frequency.setTargetAtTime(cutoffA, audioCtx.currentTime, 0.02);
  const qA = parseFloat(document.getElementById("filterQA").value) || 1;
  filterNodeA.Q.setTargetAtTime(qA, audioCtx.currentTime, 0.02);
  const envA =
    parseFloat(document.getElementById("filterEnvDepthA").value) || 1000;
  setFilterEnvDepthA(envA);

  // Filtre B
  const ftB = document.getElementById("filterTypeB").value;
  if (ftB === "off") {
    filterNodeB.frequency.setTargetAtTime(20000, audioCtx.currentTime, 0.02);
    // ou disconnect
  } else {
    filterNodeB.type = ftB === "notch" ? "notch" : ftB;
    const cutoffB =
      parseFloat(document.getElementById("filterCutoffB").value) || 2000;
    filterNodeB.frequency.setTargetAtTime(cutoffB, audioCtx.currentTime, 0.02);
    const qB = parseFloat(document.getElementById("filterQB").value) || 0.5;
    filterNodeB.Q.setTargetAtTime(qB, audioCtx.currentTime, 0.02);
    const envB =
      parseFloat(document.getElementById("filterEnvDepthB").value) || 0;
    setFilterEnvDepthB(envB);
  }

  // Noise
  const nType = document.getElementById("noiseType").value;
  currentNoiseType = nType;
  const nGain = parseFloat(document.getElementById("noiseGain").value) || 0;
  noiseGainNode.gain.setTargetAtTime(nGain, audioCtx.currentTime, 0.02);
  // TODO : si type change, recr�er la noise (non impl�ment� ici)

  // FM
  const fmOps = parseInt(document.getElementById("fmOpsRange").value) || 1;
  const fmRate = parseFloat(document.getElementById("fmRate").value) || 2;
  const fmDepth = parseFloat(document.getElementById("fmDepth").value) || 80;
  for (let i = 1; i < operators.length; i++) {
    if (i < fmOps) {
      operators[i].osc.frequency.setTargetAtTime(
        fmRate * i,
        audioCtx.currentTime,
        0.02,
      );
      operators[i].gainNode.gain.setTargetAtTime(
        fmDepth / (1.5 * i),
        audioCtx.currentTime,
        0.02,
      );
    } else {
      operators[i].gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
    }
  }

  // wave1 / wave2 => morph
  const w1 = document.getElementById("waveform1Select").value;
  const w2 = document.getElementById("waveform2Select").value;
  const morphVal = parseFloat(document.getElementById("morphRange").value) || 0;
  const wa = getWaveDataForType(w1);
  const wb = getWaveDataForType(w2);
  if (!wa && !wb) {
    // => operators[0].osc.type = w1
    operators[0].osc.type = w1;
  } else if (wa && !wb) {
    operators[0].osc.setPeriodicWave(
      createPeriodicWaveFromArrays(wa.real, wa.imag),
    );
  } else if (!wa && wb) {
    operators[0].osc.type = w1;
  } else {
    const finalWave = morphWaves(wa, wb, morphVal);
    if (finalWave) {
      operators[0].osc.setPeriodicWave(finalWave);
    }
  }

  // Additive
  const harmVal =
    parseFloat(document.getElementById("harmonicsRange").value) || 0.5;
  partialMixGain.gain.setTargetAtTime(harmVal, audioCtx.currentTime, 0.02);

  // ADSR
  const a = parseFloat(document.getElementById("attackTime").value) || 0.5;
  const d = parseFloat(document.getElementById("decayTime").value) || 0.5;
  const s = parseFloat(document.getElementById("sustainLevel").value) || 0.7;
  const r = parseFloat(document.getElementById("releaseTime").value) || 1.0;
  setAmpEnvelope(a, d, s, r);

  // LFO
  initGlobalLFO();
  const lfoRate = parseFloat(document.getElementById("lfoRate").value) || 2;
  const lfoDepth = parseFloat(document.getElementById("lfoDepth").value) || 50;
  const lfoWave = document.getElementById("lfoWave").value;
  const lfoTarg = document.getElementById("lfoTarget").value || "none";
  setLfoParams(lfoRate, lfoDepth, lfoWave, lfoTarg);

  // Poly / chord
  voiceCount = parseInt(document.getElementById("voiceCount").value) || 1;
  chordSelected = document.getElementById("chordSelect").value || "C";
  pitchTranspose =
    parseInt(document.getElementById("pitchTranspose").value) || 0;

  polyMode = document.getElementById("polyModeSelect").value || "para";
  octaveShift = parseInt(document.getElementById("octaveRange").value) || 0;
  stereoSpread = parseFloat(document.getElementById("stereoSpread").value) || 0;

  // => On appliquera tout �a dans le s�quenceur ou le code de jeu
}
