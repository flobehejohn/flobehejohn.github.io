// /assets/js/synth_fm/floMo-voice-bank.js
// floMo-voice-bank.js – v4.2 (fix spreads, LFO par échantillon, gardes robustes)
// - Corrige tout usage potentiellement invalide de spreads (ex: "{ ...m, ... }").
// - LFO incrémenté à chaque sample (précision temporelle correcte).
// - setParams protégé si m.params est absent.
// - Compatible avec AudioWorkletNode('flomo-voice-bank', { outputChannelCount:[2] }).

const TP = Math.PI * 2;
const RES_MAX = 1.35; // sécurité numérique pour Q/SVF

function filterProcess(x, buf, cutoff, res, type, poles) {
  // cutoff en "coefficient" discret (≈ 0..0.2 recommandé)
  cutoff = Math.max(0, Math.min(cutoff, 0.2));
  const q = Math.max(0, Math.min(res, RES_MAX));

  let y = x - q * buf[poles - 1];
  let last = y;
  for (let i = 0; i < poles; ++i) {
    buf[i] += cutoff * (last - buf[i]);
    last = buf[i];
  }
  const lp = buf[poles - 1];
  if (type === 'lowpass')  return lp;
  if (type === 'highpass') return y - lp;
  if (type === 'bandpass') return buf[0] - lp;
  return lp;
}

function oscWave(type, ph) {
  switch (type) {
    case 'sine':      return Math.sin(TP * ph);
    case 'square':    return (ph % 1) < 0.5 ? 1 : -1;
    case 'sawtooth':  return (ph % 1) * 2 - 1;
    case 'triangle':  return 2 * Math.abs(2 * (ph % 1) - 1) - 1;
    case 'pulse50':   return (ph % 1) < 0.5 ? 1 : -1;
    case 'pulse25':   return (ph % 1) < 0.25 ? 1 : -1;
    case 'customA':   return Math.sin(TP * ph) * Math.abs(Math.sin(3 * TP * ph));
    case 'customB':   return Math.sin(TP * ph) * Math.cos(5 * TP * ph);
    default:          return (ph % 1) * 2 - 1;
  }
}

class Voice {
  constructor(sr, idx, total) {
    this.sr = sr; this.index = idx; this.N = total;
    this.reset();
  }
  reset() {
    this.active = false; this.state = 'off';
    this.phase = 0; this.env = 0;
    this.freq = this.f0 = 220; // courant & cible (pour glide)
    this.glideTC = 1;

    this.adsr = { a: 0.3, d: 0.5, s: 0.7, r: 1.0 };
    this.vel = 1;

    this.wave = 'saw'; this.wave2 = 'sine';
    this.morph = 0; this.harmonics = 0;

    this.cut = 0.99; this.resonance = 0.5;
    this.filterType = 'lowpass'; this.filterPoles = 2;
    this.filterBuf = new Array(8).fill(0);

    this.fmq = 0; this.fmIdx = 0;
    this.drive = 0;

    this.pan = 0;     // -1..+1 après application du width au noteOn
    this.playMode = 'poly';

    this.lfoRate = 0; this.lfoDepth = 0; this.lfoTarget = 'freq';
  }

  noteOn(p) {
    const {
      freq, adsr, vel, wave, wave2, morph, harmonics, cutoff, resonance, fmq, fmDepth,
      glide, drive, width, filterType, filterPoles, playMode,
      lfoRate, lfoDepth, lfoTarget
    } = p || {};

    if (!this.active) this.phase = 0;

    this.active = true; this.state = 'attack'; this.env = 0;

    // Cible de glide
    this.f0 = (typeof freq === 'number' ? freq : this.f0);

    // ADSR
    this.adsr = adsr ? { ...adsr } : this.adsr;

    // Divers oscillateurs / mix
    this.vel   = (typeof vel   === 'number') ? vel   : this.vel;
    this.wave  = wave  || this.wave;
    this.wave2 = wave2 || this.wave2 || this.wave;
    this.morph = (typeof morph === 'number') ? morph : this.morph;
    this.harmonics = (typeof harmonics === 'number') ? harmonics : this.harmonics;

    // Filtre
    this.cut       = (typeof cutoff    === 'number') ? cutoff    : this.cut;
    this.resonance = (typeof resonance === 'number') ? resonance : this.resonance;
    this.filterType  = filterType || 'lowpass';
    this.filterPoles = Math.max(1, Math.min(8, (filterPoles || 2) | 0));

    // FM / drive
    this.fmq   = (typeof fmq     === 'number') ? fmq     : this.fmq;
    this.fmIdx = (typeof fmDepth === 'number') ? fmDepth : this.fmIdx;
    this.drive = (typeof drive   === 'number') ? drive   : this.drive;

    // Mode / LFO
    this.playMode = playMode || 'poly';
    this.lfoRate   = (typeof lfoRate   === 'number') ? lfoRate   : this.lfoRate;
    this.lfoDepth  = (typeof lfoDepth  === 'number') ? lfoDepth  : this.lfoDepth;
    this.lfoTarget = lfoTarget || this.lfoTarget;

    // Glide (ms → coeff discret)
    this.glideTC = (typeof glide === 'number' && glide > 0)
      ? Math.exp(-1 / (glide * this.sr * 0.001))
      : 1;

    // Pan étalé sur les voix (stéréo), width ∈ [0..1] recommandé
    const w = (typeof width === 'number') ? width : 0;
    this.pan = ((this.index / (this.N - 1)) - 0.5) * w; // -0.5..+0.5 si w=1

    // Réinitialise l’état du filtre pour éviter “pop” cross-voix
    this.filterBuf.fill(0);
  }

  setParams(p = {}) {
    if ('wave' in p)      this.wave = p.wave;
    if ('wave2' in p)     this.wave2 = p.wave2 || this.wave;
    if ('morph' in p)     this.morph = p.morph;
    if ('harmonics' in p) this.harmonics = p.harmonics;

    if ('cutoff' in p)    this.cut = p.cutoff;
    if ('resonance' in p) this.resonance = p.resonance;

    if ('fmq' in p)       this.fmq = p.fmq;
    if ('fmDepth' in p)   this.fmIdx = p.fmDepth;

    if ('drive' in p)     this.drive = p.drive;

    if ('width' in p)     this.pan = ((this.index / (this.N - 1)) - 0.5) * p.width;

    if ('filterType' in p)   this.filterType = p.filterType;
    if ('filterPoles' in p)  this.filterPoles = Math.max(1, Math.min(8, (p.filterPoles | 0)));

    if ('playMode' in p)     this.playMode = p.playMode;

    if ('lfoRate' in p)      this.lfoRate = p.lfoRate;
    if ('lfoDepth' in p)     this.lfoDepth = p.lfoDepth;
    if ('lfoTarget' in p)    this.lfoTarget = p.lfoTarget;

    if (p.adsr) this.adsr = { ...p.adsr };
  }

  noteOff() {
    if (this.state !== 'release' && this.state !== 'off') this.state = 'release';
  }

  render(lfo, lfoTarget, paraFreq = null) {
    if (!this.active) return [0, 0];

    // Paraphonie : fréquence globale pilotée par la banque
    if (this.playMode === 'paraph' && typeof paraFreq === 'number') {
      this.f0 = paraFreq;
    }

    // ADSR discrète
    const { a, d, s, r } = this.adsr;
    if (this.state === 'attack') {
      this.env += 1 / (Math.max(0.005, a) * this.sr);
      if (this.env >= 1) { this.env = 1; this.state = 'decay'; }
    } else if (this.state === 'decay') {
      this.env -= (1 - s) / (Math.max(0.005, d) * this.sr);
      if (this.env <= s) { this.env = s; this.state = 'sustain'; }
    } else if (this.state === 'release') {
      this.env -= this.env / (Math.max(0.005, r) * this.sr);
      if (this.env <= 0) { this.env = 0; this.state = 'off'; this.active = false; }
    }

    // Glide → approche de f0
    this.freq += (this.f0 - this.freq) * (1 - this.glideTC);

    // Modulations LFO
    let freq = this.freq;
    let cut  = this.cut;
    let pan  = this.pan;
    let morph = this.morph;
    let ampMod = 1;
    let fmMod  = 0;

    switch (lfoTarget) {
      case 'freq':     freq += lfo * 50; break;
      case 'cutoff':   cut  += lfo * 1.5; break;
      case 'pan':      pan  += lfo * 1.2; break;
      case 'morph':    morph = Math.max(0, Math.min(1, morph + lfo * 0.8)); break;
      case 'am':       ampMod = 1 + lfo; break;
      case 'fmDepth':  fmMod = lfo * 50; break;
    }

    // FM simple (phase mod)
    const pre = this.phase;
    const fm = ((this.fmIdx + fmMod) > 0 && this.fmq > 0)
      ? Math.sin(TP * pre * this.fmq) * (this.fmIdx + fmMod) * freq / this.sr * 10
      : 0;

    const ph  = pre + fm;
    const osc1 = oscWave(this.wave,  ph);
    const osc2 = oscWave(this.wave2, ph);

    let osc = osc1 * (1 - morph) + osc2 * morph;

    // Ajout d’harmoniques simples
    if (this.harmonics > 0) {
      for (let h = 2; h <= 5; ++h) {
        osc += Math.sin(TP * ph * h) * (this.harmonics / h);
      }
      osc /= (1 + this.harmonics * 2);
    }

    // Filtre + drive
    const filtered = filterProcess(osc, this.filterBuf, cut, this.resonance, this.filterType, this.filterPoles);
    const drv = this.drive * 12;
    const sig = drv ? Math.tanh(filtered * (1 + drv)) : filtered;

    // Phase osc
    this.phase += freq / this.sr;
    if (this.phase >= 1) this.phase -= 1;

    // Amplitude + pan (stéréo simple)
    const amp = sig * this.env * this.vel * 0.12 * ampMod;
    const L = amp * (1 - pan);
    const R = amp * (1 + pan);
    return [L, R];
  }
}

class Bank extends AudioWorkletProcessor {
  static get parameterDescriptors() { return []; }

  constructor() {
    super();

    this.voices = Array.from({ length: 16 }, (_, i) => new Voice(sampleRate, i, 16));
    this.rr = 0;

    // État global
    this.glob = {
      adsr: { a: 0.3, d: 0.5, s: 0.7, r: 1.0 },
      wave: 'saw', wave2: 'sine', morph: 0,
      cutoff: 0.99, resonance: 0.5, harmonics: 0,
      fmq: 0, fmDepth: 0, drive: 0, width: 0,
      lfoRate: 0, lfoDepth: 0, lfoTarget: 'freq',
      filterType: 'lowpass', filterPoles: 2, playMode: 'poly'
    };

    // LFO global (pilotage “banque” ; les voix lisent ses valeurs)
    this.lfoPhase = 0;
    this.lfoRate  = 0;
    this.lfoDepth = 0; // déjà normalisé 0..1 depuis setParams
    this.lfoTarget= 'freq';

    // Paraphonie
    this.filterType = 'lowpass';
    this.filterPoles= 2;
    this.playMode   = 'poly';
    this.lastParaFreq = 220;

    this.port.onmessage = (e) => this.msg(e.data);
  }

  msg(m = {}) {
    const mode = (typeof m.playMode === 'string') ? m.playMode : this.glob.playMode;

    if (m.type === 'noteOn') {
      if (mode === 'mono') {
        // ✅ Spread correct : on étend m puis on force playMode
        this.voices[0].noteOn({ ...m, playMode: 'mono' });
        for (let i = 1; i < 16; ++i) this.voices[i].noteOff();
      } else if (mode === 'paraph') {
        const actives = this.voices.filter(v => v.active);
        if (actives.length === 0) {
          this.voices[0].noteOn({ ...m, playMode: 'paraph' });
        } else {
          actives.forEach(v => v.noteOn({ ...m, playMode: 'paraph' }));
        }
        if (typeof m.freq === 'number') this.lastParaFreq = m.freq;
      } else {
        this.voices[this.rr++ % 16].noteOn({ ...m, playMode: 'poly' });
      }
    }
    else if (m.type === 'noteOff') {
      if (mode === 'mono') {
        this.voices[0].noteOff();
      } else if (mode === 'paraph') {
        this.voices.forEach(v => v.noteOff());
      } else {
        const i = (typeof m.voice === 'number') ? m.voice : -1;
        if (i >= 0 && i < this.voices.length) this.voices[i].noteOff();
        else this.voices.forEach(v => v.noteOff()); // faute de voice id, on libère tout
      }
    }
    else if (m.type === 'setParams' && m.params && typeof m.params === 'object') {
      Object.assign(this.glob, m.params);

      if ('lfoRate'   in m.params) this.lfoRate   = m.params.lfoRate;
      if ('lfoDepth'  in m.params) this.lfoDepth  = (m.params.lfoDepth * 0.01) || 0; // 0..1
      if ('lfoTarget' in m.params) this.lfoTarget = m.params.lfoTarget;

      if ('filterType'  in m.params) this.filterType  = m.params.filterType;
      if ('filterPoles' in m.params) this.filterPoles = m.params.filterPoles | 0;
      if ('playMode'    in m.params) this.playMode    = m.params.playMode;

      // Applique aux voix actives (hot-update)
      const p = m.params;
      this.voices.forEach(v => { if (v.active) v.setParams(p); });
    }
  }

  process(_, outputs) {
    const out = outputs[0];
    const left  = out[0];
    const right = out[1] || out[0]; // si mono fourni par l’hôte, on duplique

    // LFO par échantillon (correctif)
    const inc = this.lfoRate / sampleRate;

    for (let i = 0; i < left.length; ++i) {
      // Valeur LFO instantanée
      const lfo = Math.sin(TP * this.lfoPhase) * this.lfoDepth;

      // Somme des voix actives
      let sumL = 0, sumR = 0;
      const paraF = (this.playMode === 'paraph') ? this.lastParaFreq : null;

      for (let v = 0; v < this.voices.length; ++v) {
        const voice = this.voices[v];
        if (voice.active) {
          const [vl, vr] = voice.render(lfo, this.lfoTarget, paraF);
          sumL += vl; sumR += vr;
        }
      }

      left[i]  = sumL;
      right[i] = sumR;

      // Avance LFO à chaque sample
      this.lfoPhase += inc;
      if (this.lfoPhase >= 1) this.lfoPhase -= 1;
    }
    return true;
  }
}

registerProcessor('flomo-voice-bank', Bank);
