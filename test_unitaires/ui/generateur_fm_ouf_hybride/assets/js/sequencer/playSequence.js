// playSequence.js
import { audioCtx, operators, partialOscs } from "../audio/initAudio.js";
import {
  triggerAmpEnv,
  releaseAmpEnv,
  triggerFilterEnv,
  filterEnvDepthA,
  filterEnvDepthB,
} from "../audio/envelopes.js";
import { seqStepsData } from "./initSequencerUI.js";
import {
  voiceCount,
  chordSelected,
  pitchTranspose,
  polyMode,
  octaveShift,
} from "../audio/updateAllParams.js";

const chordsMap = {
  C: [0, 4, 7],
  Cm: [0, 3, 7],
  G: [7, 11, 14],
  F: [5, 9, 12],
  Am: [9, 12, 16],
};

let seqPlaying = false;
let seqTimeout = null;
let stepDir = 1; // pour reverse/bounce
let bounceState = "forward"; // dans le mode bounce

export function startSequence() {
  seqPlaying = true;
  stepDir = 1;
  bounceState = "forward";
  playSeqStep(0);
  document.getElementById("seqPlayBtn").textContent = "Stop S�quence";
}

export function stopSequence() {
  seqPlaying = false;
  if (seqTimeout) clearTimeout(seqTimeout);
  document.getElementById("seqPlayBtn").textContent = "Lire S�quence";
}

function getNextStepIndex(current, mode, total) {
  if (mode === "once") {
    if (current >= total) return -1; // stop
    return current + 1;
  } else if (mode === "loop") {
    if (current >= total) return 0;
    return current + 1;
  } else if (mode === "reverse") {
    // on part 0->(total-1)->0->(total-1) ...
    if (stepDir > 0 && current >= total) stepDir = -1;
    if (stepDir < 0 && current < 0) stepDir = 1;
    return current + stepDir;
  } else if (mode === "bounce") {
    // 0..total..0.. etc
    if (bounceState === "forward" && current >= total) {
      bounceState = "backward";
      return total - 1;
    }
    if (bounceState === "backward" && current <= 0) {
      bounceState = "forward";
      return 0;
    }
    return bounceState === "forward" ? current + 1 : current - 1;
  }
  // fallback
  return current + 1;
}

export function playSeqStep(stepIndex) {
  if (!seqPlaying) return;
  const total = seqStepsData.length - 1;
  if (stepIndex < 0 || stepIndex > total) {
    // out of range => stop
    seqPlaying = false;
    return;
  }

  const step = seqStepsData[stepIndex];
  if (step.active) {
    const intervals = chordsMap[chordSelected] || [0];
    for (let v = 0; v < voiceCount; v++) {
      const interval = intervals[v % intervals.length];
      const semitone =
        step.semitone + interval + pitchTranspose + octaveShift * 12;
      const freq = 220 * Math.pow(2, semitone / 12);

      // On applique la freq => carrier
      operators[0].osc.frequency.setTargetAtTime(
        freq,
        audioCtx.currentTime,
        0.02,
      );
      // partials
      partialOscs.forEach((o, i) => {
        o.frequency.setTargetAtTime(freq * (i + 1), audioCtx.currentTime, 0.02);
      });

      // Envelope
      triggerAmpEnv(operators[0].gainNode, audioCtx);
      triggerFilterEnv(operators[0].gainNode, audioCtx, filterEnvDepthA); // ici c'est un code simplifi�,
      // ou alors filterEnvGainA ?

      // TODO : si poly => il faudrait avoir un �voice[v]�
      // Simplification : code �monophonique / paraphonique�
    }
  }

  let bpm = parseFloat(document.getElementById("bpmInput").value) || 120;
  if (bpm < 1) bpm = 1;
  const beatSec = 60 / bpm;
  const one16 = beatSec / 4;
  let stepDurSec = step.dur * one16;
  if (stepDurSec < 0.01) stepDurSec = 0.01;

  seqTimeout = setTimeout(() => {
    const mode = document.getElementById("loopSelect").value;
    const nextIdx = getNextStepIndex(stepIndex, mode, total);
    if (nextIdx < 0) {
      // fin
      seqPlaying = false;
      document.getElementById("seqPlayBtn").textContent = "Lire S�quence";
    } else {
      playSeqStep(nextIdx);
    }
  }, stepDurSec * 1000);
}
