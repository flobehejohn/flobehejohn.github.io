import {
  initAudio,
  getAudioContext,
  ampEnvGain,
  operators,
} from "./audio/initAudio.js";
import { updateAllParams } from "./audio/updateAllParams.js";
import { startSequence, stopSequence } from "./sequencer/playSequence.js";

const activeNotes = new Map();

function noteOn(noteId, freq = 440) {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") {
    console.warn("❌ AudioContext non disponible.");
    return;
  }

  if (operators[0]?.osc) {
    operators[0].osc.frequency.setValueAtTime(freq, ctx.currentTime);
  }

  const now = ctx.currentTime;
  ampEnvGain.gain.cancelScheduledValues(now);
  ampEnvGain.gain.setValueAtTime(0, now);
  ampEnvGain.gain.linearRampToValueAtTime(1, now + 0.05);
  ampEnvGain.gain.linearRampToValueAtTime(0, now + 1.2);

  activeNotes.set(noteId, { type: "modular" });
}

function noteOff(noteId) {
  activeNotes.delete(noteId);
  // Pas nécessaire de couper manuellement ampEnv ici car déjà programmé
}

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
    "filterTypeA",
    "filterCutoffA",
    "filterQA",
    "filterEnvDepthA",
    "filterTypeB",
    "filterCutoffB",
    "filterQB",
    "filterEnvDepthB",
    "filtersRouting",
    "noiseType",
    "noiseGain",
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
    "lfoWave",
    "lfoTarget",
    "voiceCount",
    "chordSelect",
    "pitchTranspose",
    "polyModeSelect",
    "octaveRange",
    "stereoSpread",
  ];

  paramIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateAllParams);
  });

  document.getElementById("startBtn").addEventListener("click", async () => {
    initAudio();
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
      console.log("🔊 AudioContext relancé !");
    }
    updateAllParams();
    document.getElementById("startBtn").textContent = "Stop Audio";
  });

  document.getElementById("testNoteBtn").addEventListener("click", () => {
    noteOn("TEST", 220);
    setTimeout(() => noteOff("TEST"), 1200);
  });

  document.getElementById("seqPlayBtn").addEventListener("click", () => {
    const btn = document.getElementById("seqPlayBtn");
    if (btn.textContent.includes("Lire")) {
      startSequence();
      btn.textContent = "Stop Séquence";
    } else {
      stopSequence();
      btn.textContent = "Lire Séquence";
    }
  });

  window.addEventListener("keydown", (e) => {
    const key = e.key.toUpperCase();
    if (/^[A-Z]$/.test(key) && !activeNotes.has(key)) {
      const baseFreq = 220;
      const offset = key.charCodeAt(0) - 65;
      const freq = baseFreq * Math.pow(2, offset / 12);
      noteOn(key, freq);
    }
  });

  window.addEventListener("keyup", (e) => {
    const key = e.key.toUpperCase();
    noteOff(key);
  });
});
