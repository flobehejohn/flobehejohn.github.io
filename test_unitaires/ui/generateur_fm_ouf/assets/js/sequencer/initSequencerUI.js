export const seqStepsData = [];

export function initSequencerUI(stepCount = 8) {
  const container = document.getElementById("seqStepsContainer");
  container.innerHTML = "";
  seqStepsData.length = 0;

  for (let i = 0; i < stepCount; i++) {
    const stepData = { semitone: 0, dur: 1, active: true };
    seqStepsData.push(stepData);

    const stepDiv = document.createElement("div");
    stepDiv.className = "step";
    stepDiv.innerHTML = `
            <label>Step ${i + 1}</label>
            <input type="checkbox" data-type="active" data-idx="${i}" checked />
            <input type="number" data-type="semi" data-idx="${i}" value="${stepData.semitone}" />
            <input type="number" data-type="dur" data-idx="${i}" value="${stepData.dur}" min="0.1" step="0.1" />
        `;
    container.appendChild(stepDiv);
  }

  container.addEventListener("input", (e) => {
    const t = e.target;
    const idx = parseInt(t.getAttribute("data-idx"));
    const typ = t.getAttribute("data-type");
    if (typ === "active") {
      seqStepsData[idx].active = t.checked;
    } else if (typ === "semi") {
      seqStepsData[idx].semitone = parseFloat(t.value);
    } else if (typ === "dur") {
      seqStepsData[idx].dur = Math.max(0.1, parseFloat(t.value));
    }
  });
}
