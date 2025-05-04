// initSequencerUI.js
export const seqStepsData = [];

export function initSequencerUI() {
  const container = document.getElementById("seqStepsContainer");
  container.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    seqStepsData.push({ semitone: 0, dur: 1, active: true });
    const stepDiv = document.createElement("div");
    stepDiv.className = "step";
    stepDiv.innerHTML = `
          <label>Step ${i + 1}</label>
          <input type="checkbox" data-type="active" data-idx="${i}" checked />
          <input type="number" data-type="semi" data-idx="${i}" value="0" />
          <input type="number" data-type="dur" data-idx="${i}" value="1"/>
        `;
    container.appendChild(stepDiv);
  }
  container.addEventListener("input", (e) => {
    const t = e.target;
    const idx = parseInt(t.getAttribute("data-idx"));
    if (Number.isNaN(idx)) return;
    const typ = t.getAttribute("data-type");
    if (typ === "active") {
      seqStepsData[idx].active = t.checked;
    } else if (typ === "semi") {
      seqStepsData[idx].semitone = parseFloat(t.value) || 0;
    } else if (typ === "dur") {
      seqStepsData[idx].dur = parseFloat(t.value) || 1;
    }
  });
}
