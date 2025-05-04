// morphingUtils.js
import { audioCtx } from "./initAudio.js";

// renvoie { real, imag } ou null
export function getWaveDataForType(type) {
  if (!type) return null;
  if (["sine", "square", "sawtooth", "triangle"].includes(type)) {
    return null; // On utilisera osc.type = ...
  }

  // ex. pulses
  const size = 16;
  const real = new Float32Array(size);
  const imag = new Float32Array(size);

  if (type === "pulse50") {
    for (let i = 1; i < size; i += 2) {
      imag[i] = 4 / (Math.PI * i);
    }
  } else if (type === "pulse25") {
    for (let i = 1; i < size; i += 2) {
      imag[i] = 2 / (Math.PI * i);
    }
  } else if (type === "customA") {
    const r = [0, 1, 0.5, 0.3, 0.1];
    const im = [0, 0, 0, 0, 0];
    return { real: new Float32Array(r), imag: new Float32Array(im) };
  } else if (type === "customB") {
    const r = [0, 1, 1, 0.8, 0.6, 0.4, 0.2];
    const im = [0, 0, 0, 0, 0, 0, 0];
    return { real: new Float32Array(r), imag: new Float32Array(im) };
  } else {
    // ...
  }
  return { real, imag };
}

export function createPeriodicWaveFromArrays(real, imag) {
  return audioCtx.createPeriodicWave(real, imag, {
    disableNormalization: false,
  });
}

export function morphWaves(wa, wb, t) {
  const N = Math.min(wa.real.length, wb.real.length);
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    real[i] = wa.real[i] * (1 - t) + wb.real[i] * t;
    imag[i] = wa.imag[i] * (1 - t) + wb.imag[i] * t;
  }
  return createPeriodicWaveFromArrays(real, imag);
}
