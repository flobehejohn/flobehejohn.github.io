// assets/js/audio/reverbHelper.js

/**
 * Cr�e une impulsion de r�verb�ration align�e avec le sampleRate du contexte.
 * @param {number} seconds - Dur�e de l'impulsion.
 * @param {AudioContext|null} context - Contexte Audio optionnel.
 * @returns {AudioBuffer} Impulsion st�r�o.
 */
export function createReverbImpulse(seconds = 2, context = null) {
  const ctx =
    context || new (window.AudioContext || window.webkitAudioContext)();
  const rate = ctx.sampleRate;
  const length = rate * seconds;
  const impulse = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2);
    }
  }

  return impulse;
}
