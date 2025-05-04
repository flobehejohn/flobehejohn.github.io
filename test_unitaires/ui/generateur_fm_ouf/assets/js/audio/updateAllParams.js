import {
  audioCtx,
  masterGain,
  filterNode,
  filterEnvGain,
  distortionNode,
  delayNode,
  feedbackGain,
  reverbConvolver,
  reverbWetGain,
  panNode,
  ampEnvGain,
  partialMixGain,
  lfoOsc,
  lfoGain,
  operators,
} from "./initAudio.js";

import {
  getWaveDataForType,
  morphWaves,
  createPeriodicWaveFromArrays,
} from "./morphingUtils.js";

import { makeDistortionCurve } from "./distortionUtils.js";
import { connectLfoTarget } from "./lfoUtils.js";
import { A, D, S, R, filterEnvDepth } from "./envelopes.js";

export let voiceCount = 1;
export let chordSelected = "C";
export let pitchTranspose = 0;

export function updateAllParams() {
  if (!audioCtx) return;

  // Master Volume
  const mv = parseFloat(document.getElementById("masterVol").value) || 0.7;
  masterGain.gain.setTargetAtTime(mv, audioCtx.currentTime, 0.02);

  // FM Operators
  const fmOps = parseInt(document.getElementById("fmOpsRange").value) || 1;
  for (let i = 1; i < operators.length; i++) {
    if (i < fmOps) {
      const fmRate = parseFloat(document.getElementById("fmRate").value) || 2;
      const fmDepth =
        parseFloat(document.getElementById("fmDepth").value) || 80;
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

  // Morphing / Waveforms
  const w1 = document.getElementById("waveform1Select")?.value;
  const w2 = document.getElementById("waveform2Select")?.value;
  const morphVal = parseFloat(
    document.getElementById("morphRange")?.value || "0",
  );

  const wa = getWaveDataForType(w1);
  const wb = getWaveDataForType(w2);

  if (!wa && !wb) {
    operators[0].osc.type = w1;
  } else if (wa && !wb) {
    operators[0].osc.setPeriodicWave(
      createPeriodicWaveFromArrays(wa.real, wa.imag),
    );
  } else if (!wa && wb) {
    operators[0].osc.type = w1;
  } else {
    const wave = morphWaves(wa, wb, morphVal);
    if (wave) operators[0].osc.setPeriodicWave(wave);
  }

  // Additive Harmonics
  const harmVal =
    parseFloat(document.getElementById("harmonicsRange").value) || 0.5;
  partialMixGain.gain.setTargetAtTime(harmVal, audioCtx.currentTime, 0.02);

  // Filter
  filterNode.type = document.getElementById("filterType").value;
  const cutoff =
    parseFloat(document.getElementById("filterCutoff").value) || 800;
  filterNode.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, 0.02);
  const qVal = parseFloat(document.getElementById("filterQ").value) || 1;
  filterNode.Q.setTargetAtTime(qVal, audioCtx.currentTime, 0.02);

  // Distortion
  const distAmt = parseFloat(document.getElementById("distAmount").value) || 0;
  distortionNode.curve = makeDistortionCurve(distAmt * 600);

  // Delay / Reverb
  const dVal = parseFloat(document.getElementById("delayRange").value) || 0.2;
  delayNode.delayTime.setTargetAtTime(
    0.05 + dVal * 0.4,
    audioCtx.currentTime,
    0.02,
  );
  feedbackGain.gain.setTargetAtTime(dVal, audioCtx.currentTime, 0.02);

  const rvDec = parseFloat(document.getElementById("reverbDecay").value) || 2;
  // Note : le buffer est suppos� mis � jour dans initAudio � l�appel de createReverbImpulse()
  // ici, on ne red�finit pas le buffer si le sampleRate est d�j� OK
  // TODO : tu peux cr�er une version dynamique de impulse si besoin.

  const rvWet = parseFloat(document.getElementById("reverbWet").value) || 0;
  reverbWetGain.gain.setTargetAtTime(rvWet, audioCtx.currentTime, 0.02);

  // Panning
  const pVal = parseFloat(document.getElementById("panRange").value) || 0;
  panNode.pan.setTargetAtTime(pVal, audioCtx.currentTime, 0.02);

  // LFO
  const rateVal = parseFloat(document.getElementById("lfoRate")?.value || "2");
  const depthVal = parseFloat(
    document.getElementById("lfoDepth")?.value || "50",
  );
  lfoOsc.frequency.setTargetAtTime(rateVal, audioCtx.currentTime, 0.02);
  lfoGain.gain.setTargetAtTime(depthVal, audioCtx.currentTime, 0.02);
  const targetSel = document.getElementById("lfoTarget")?.value || "none";
  connectLfoTarget(targetSel);

  // Polyphonie / Transposition
  voiceCount = parseInt(document.getElementById("voiceCount")?.value || "1");
  chordSelected = document.getElementById("chordSelect")?.value || "C";
  pitchTranspose = parseInt(
    document.getElementById("pitchTranspose")?.value || "0",
  );
}
