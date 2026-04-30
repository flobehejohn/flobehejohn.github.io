// assets/js/musicam/modules/utils.js
export const clamp01 = x => Math.max(0, Math.min(1, x));
export const yToMidi = (y, h) => Math.round(48 + (72 - 48) * (1 - clamp01(y / h))); // 48..72 ≈ C3..C5
export const dist = (a, b) => (!a || !b) ? 0 : Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (v, w, h) => v / Math.max(1, Math.hypot(w, h));

export function quantizeToScale(n, sc, SCALES) {
  const rootByScale = { C_major_pentatonic: 60, C_minor_pentatonic: 60, D_dorian: 62, G_mixolydian: 67 };
  const root = rootByScale[sc] || 60;
  const pat  = SCALES[sc] || SCALES.C_major_pentatonic;
  const d    = n - root, oct = Math.floor(d / 12), inOct = d - oct * 12;
  let best = pat[0], dm = 99;
  for (const p of pat) {
    const dd = Math.abs(p - inOct);
    if (dd < dm) { best = p; dm = dd; }
  }
  return root + best + 12 * oct;
}

export const midiToFreq = (n) => 440 * Math.pow(2, (n - 69) / 12);
