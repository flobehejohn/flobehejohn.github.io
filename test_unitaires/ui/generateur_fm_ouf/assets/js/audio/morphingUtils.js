import { audioCtx } from "./initAudio.js";

/**
 * Renvoie un objet { real, imag } correspondant � une forme d'onde personnalis�e.
 * Utilise des harmoniques sp�cifiques pour g�n�rer des variations de type pulse ou custom.
 */
export function getWaveDataForType(type) {
  if (!type || !audioCtx) return null;

  const size = 64;
  const real = new Float32Array(size);
  const imag = new Float32Array(size);

  switch (type) {
    case "sine":
    case "square":
    case "sawtooth":
    case "triangle":
      return null; // Ces formes sont natives, pas besoin de tableau personnalis�.

    case "pulse50":
      for (let i = 1; i < size; i += 2) {
        imag[i] = 4 / (Math.PI * i); // Carr� 50%
      }
      break;

    case "pulse25":
      for (let i = 1; i < size; i += 2) {
        imag[i] = 2 / (Math.PI * i); // Carr� 25%
      }
      break;

    case "customA": {
      const values = [1, 0.6, 0.3, 0.1, 0.05];
      values.forEach((val, i) => (real[i + 1] = val));
      break;
    }

    case "customB": {
      const values = [1, 1, 0.8, 0.6, 0.4, 0.2];
      values.forEach((val, i) => (real[i + 1] = val));
      break;
    }

    default:
      console.warn(`Forme d'onde non reconnue : ${type}`);
      return null;
  }

  return { real, imag };
}

/**
 * Interpole lin�airement deux formes d�onde (entre 0 et 1) pour cr�er un morphing fluide.
 * @param {Object} wa - { real, imag }
 * @param {Object} wb - { real, imag }
 * @param {number} t - Valeur entre 0 et 1 pour le morph
 * @returns {PeriodicWave}
 */
export function morphWaves(wa, wb, t = 0.5) {
  if (!wa || !wb || !audioCtx) return null;

  const N = Math.min(wa.real.length, wb.real.length);
  const real = new Float32Array(N);
  const imag = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    real[i] = (1 - t) * wa.real[i] + t * wb.real[i];
    imag[i] = (1 - t) * wa.imag[i] + t * wb.imag[i];
  }

  return audioCtx.createPeriodicWave(real, imag, {
    disableNormalization: false,
  });
}

/**
 * Cr�e un PeriodicWave directement � partir de deux tableaux.
 * @param {Float32Array} real
 * @param {Float32Array} imag
 * @returns {PeriodicWave}
 */
export function createPeriodicWaveFromArrays(real, imag) {
  return audioCtx.createPeriodicWave(real, imag, {
    disableNormalization: false,
  });
}
