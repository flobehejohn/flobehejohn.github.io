import { audioCtx, operators, partialOscs } from "../audio/initAudio.js";
import { triggerAmpEnv, triggerFilterEnv } from "../audio/envelopes.js";
import { seqStepsData } from "./initSequencerUI.js";
import {
  voiceCount,
  chordSelected,
  pitchTranspose,
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
let bounceForward = true;

export function startSequence() {
  seqPlaying = true;
  bounceForward = true;
  playSeqStep(0);
  document.getElementById("seqPlayBtn").textContent = "Stop S�quence";
}

export function stopSequence() {
  seqPlaying = false;
  if (seqTimeout) clearTimeout(seqTimeout);
  document.getElementById("seqPlayBtn").textContent = "Lire S�quence";
}

export function playSeqStep(index) {
  if (!seqPlaying) return;

  const total = seqStepsData.length;
  const mode = document.getElementById("loopSelect").value;

  const step = seqStepsData[index];
  if (step && step.active) {
    const intervals = chordsMap[chordSelected] || [0];
    for (let v = 0; v < voiceCount; v++) {
      const interval = intervals[v % intervals.length];
      const semitone = step.semitone + interval + pitchTranspose;
      const freq = 220 * Math.pow(2, semitone / 12);

      operators[0].osc.frequency.setTargetAtTime(
        freq,
        audioCtx.currentTime,
        0.02,
      );
      partialOscs.forEach((o, i) => {
        o.frequency.setTargetAtTime(freq * (i + 1), audioCtx.currentTime, 0.02);
      });
    }

    triggerAmpEnv();
    triggerFilterEnv();
  }

  const bpm = parseFloat(document.getElementById("bpmInput").value) || 120;
  const beatSec = 60 / Math.max(1, bpm);
  const one16 = beatSec / 4;
  const stepDurSec = Math.max(0.01, step?.dur * one16);

  let nextIndex = index + 1;

  if (mode === "reverse") {
    nextIndex = index - 1;
    if (nextIndex < 0) nextIndex = total - 1;
  } else if (mode === "bounce") {
    if (bounceForward && index >= total - 1) {
      bounceForward = false;
      nextIndex = index - 1;
    } else if (!bounceForward && index <= 0) {
      bounceForward = true;
      nextIndex = index + 1;
    } else {
      nextIndex = bounceForward ? index + 1 : index - 1;
    }
  } else if (mode !== "loop" && index >= total - 1) {
    seqPlaying = false;
    return;
  }

  seqTimeout = setTimeout(
    () => playSeqStep(nextIndex % total),
    stepDurSec * 1000,
  );
}
