// main.js
import { initAudio, audioCtx } from "./audio/initAudio.js";
import { updateAllParams } from "./audio/updateAllParams.js";
import { startSequence, stopSequence } from "./sequencer/playSequence.js";

window.addEventListener("DOMContentLoaded", () => {
  const paramIds = [
    "masterVol",
    "bpmInput",
    "loopSelect",
    "waveform1Select",
    "waveform2Select",
    "morphRange",
    "fmOpsRange",
    "fmRate",
    "fmDepth",
    "harmonicsRange",
    "filterType",
    "filterCutoff",
    "filterQ",
    "filterEnvDepth",
    "distAmount",
    "delayRange",
    "reverbDecay",
    "reverbWet",
    "panRange",
    "attackTime",
    "decayTime",
    "sustainLevel",
    "releaseTime",
    "lfoRate",
    "lfoDepth",
    "lfoTarget",
    "voiceCount",
    "chordSelect",
    "pitchTranspose",
  ];

  paramIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateAllParams);
  });

  document.getElementById("startBtn").addEventListener("click", () => {
    if (!window.audioCtx || audioCtx.state === "closed") {
      initAudio();
    }

    // Redemander le contexte si suspendu
    audioCtx.resume().then(() => {
      updateAllParams();
      document.getElementById("startBtn").textContent = "Stop Audio";
    });

    if (audioCtx.state === "running") {
      audioCtx.suspend();
      document.getElementById("startBtn").textContent = "D�marrer";
    }
  });

  document.getElementById("seqPlayBtn").addEventListener("click", () => {
    const btn = document.getElementById("seqPlayBtn");
    if (btn.textContent === "Lire S�quence") {
      startSequence();
    } else {
      stopSequence();
    }
  });
});
