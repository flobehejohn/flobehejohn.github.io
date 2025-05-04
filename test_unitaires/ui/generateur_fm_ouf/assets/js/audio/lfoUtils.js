import { lfoGain, operators, panNode, filterNode } from "./initAudio.js";

export function connectLfoTarget(target) {
  try {
    lfoGain.disconnect();
  } catch (e) {}

  if (target === "none") return;

  if (target === "filterCutoff") {
    lfoGain.connect(filterNode.frequency);
  } else if (target === "fmDepth") {
    if (operators[1]) lfoGain.connect(operators[1].gainNode.gain);
  } else if (target === "pan") {
    lfoGain.connect(panNode.pan);
  } else if (target === "pitch") {
    lfoGain.connect(operators[0].osc.frequency);
  }
}
