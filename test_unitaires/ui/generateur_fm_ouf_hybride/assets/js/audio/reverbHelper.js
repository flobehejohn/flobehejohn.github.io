// reverbHelper.js
// G�n�re une impulsion de reverb

export function createReverbImpulse(seconds = 2, context = null) {
  if (!context) {
    context = new (window.AudioContext || window.webkitAudioContext)();
  }
  const rate = context.sampleRate;
  const length = rate * seconds;
  const impulse = context.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2);
    }
  }
  return impulse;
}
