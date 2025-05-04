// distortionUtils.js

export function makeDistortionCurve(amount = 0.5, drive = 1) {
  // amount in [0..1], drive in [1..50]
  const n = 44100;
  const curve = new Float32Array(n);
  const k = amount * 200;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    let y = (x * (1 + k)) / (1 + k * Math.abs(x));
    // multiply by drive
    curve[i] = y * drive;
  }
  return curve;
}
