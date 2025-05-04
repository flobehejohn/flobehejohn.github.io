export function makeDistortionCurve(amount) {
  const len = 44100;
  const curve = new Float32Array(len);
  const deg = Math.PI / 180;
  for (let i = 0; i < len; i++) {
    const x = (i * 2) / len - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}
