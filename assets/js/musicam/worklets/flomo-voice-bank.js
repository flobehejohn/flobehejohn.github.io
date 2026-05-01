// assets/js/musicam/worklets/flomo-voice-bank.js
// 16 voix – ADSR, LFO, FM, filtres, paraphonie + smoothing un-pôle global.
// • Changement de pitch fiable (retune + glide). Poly "smart legato" (fenêtre courte).
// • Paramètres avancés + alias tolérants (wave1→wave, resonanceQ→resonance, fmRate→fmq, cutoffHz→cutoff(log)).

const TP = Math.PI * 2;
const RES_MAX = 1.35;

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

// ----- cutoff : Hz <-> norm (log)
function logHzToNorm(hz, lo=80, hi=15000){
  const h = Math.max(lo, Math.min(hi, +hz||2000));
  return Math.max(0, Math.min(1, Math.log(h/lo) / Math.log(hi/lo)));
}
function normToHz(n, lo=80, hi=15000){
  const t = Math.max(0, Math.min(1, +n||0));
  return lo * Math.pow(hi/lo, t);
}

// ---------- FILTRE & OSC ----------
function filterProcess(x, buf, cutoff, res, type, poles) {
  // "cutoff" ici est un coef (≈ 0..0.2), pas des Hz
  const cut = Math.max(0, Math.min(cutoff, 0.2));
  const q   = Math.max(0, Math.min(res, RES_MAX));
  let y = x - q * buf[poles - 1];
  let last = y;
  for (let i = 0; i < poles; ++i) { buf[i] += cut * (last - buf[i]); last = buf[i]; }
  const lp = buf[poles - 1];
  if (type === 'highpass') return y - lp;
  if (type === 'bandpass') return buf[0] - lp;
  return lp; // lowpass
}
function oscWave(type, ph) {
  switch (type) {
    case 'sine':     return Math.sin(TP * ph);
    case 'square':   return (ph % 1) < .5 ? 1 : -1;
    case 'sawtooth': return (ph % 1) * 2 - 1;
    case 'triangle': return 2 * Math.abs(2 * (ph % 1) - 1) - 1;
    case 'pulse25':  return (ph % 1) < .25 ? 1 : -1;
    default:         return (ph % 1) * 2 - 1;
  }
}

// ---------- VOIX ----------
class Voice {
  constructor(sr, idx, total) { this.sr = sr; this.index = idx; this.N = total; this.reset(); }
  reset() {
    this.active = false; this.state = 'off'; this.phase = 0; this.env = 0;
    this.freq = this.f0 = 220; this.glideTC = 0; // 0 = instantané
    this.adsr = { a:.008, d:.09, s:.05, r:.12 };
    this.vel = 1; this.wave = 'sawtooth'; this.wave2 = 'sine';
    this.morph = 0; this.harmonics = 0; this.cut = .12; this.resonance = 0.5;
    this.fmq = 0; this.fmIdx = 0; this.drive = 0; this.pan = 0;
    this.filterType = 'lowpass'; this.filterPoles = 2;
    this.filterBuf = new Array(8).fill(0);
    this.lfoRate = 0; this.lfoDepth = 0; this.lfoTarget = 'freq';
    this.playMode = 'poly';
    this.noteId = null;
  }

  setFreq(freq, glideMs = 0) {
    this.f0 = (freq != null) ? +freq : this.f0;
    if (glideMs > 0) {
      // 1-pôle par sample vers f0 (glide "musical")
      this.glideTC = Math.exp(-1 / (glideMs * this.sr * 0.001));
    } else {
      this.glideTC = 0;    // instantané
      this.freq = this.f0; // saute direct
    }
  }
  setVelocity(v) { if (v != null) this.vel = +v; }

  noteOn(p) {
    // alias tolérants
    const ali = { ...p };
    if (ali.wave1 && !ali.wave) ali.wave = ali.wave1;
    if (ali.resonanceQ != null && ali.resonance == null) ali.resonance = +ali.resonanceQ;
    if (ali.fmRate != null && ali.fmq == null) ali.fmq = +ali.fmRate;
    if (ali.cutoffHz != null && ali.cutoff == null) ali.cutoff = logHzToNorm(+ali.cutoffHz);

    const { freq, adsr, vel, wave, wave2, morph, harmonics, cutoff, resonance, fmq, fmDepth,
            glide, drive, width, filterType, filterPoles, playMode, lfoRate, lfoDepth, lfoTarget, midi } = ali;

    if (!this.active) this.phase = 0;
    this.active = true; this.state = 'attack'; this.env = 0;
    this.noteId = (typeof midi === 'number') ? midi : null;

    // snapshot paramètres
    if (adsr) this.adsr = { ...adsr };
    if (wave  != null) this.wave  = wave;
    if (wave2 != null) this.wave2 = wave2 || this.wave;
    if (morph != null) this.morph = +morph;
    if (harmonics != null) this.harmonics = +harmonics;
    if (cutoff != null) this.cut = +cutoff;
    if (resonance != null) this.resonance = +resonance;
    if (fmq    != null) this.fmq = +fmq;
    if (fmDepth!= null) this.fmIdx = +fmDepth;
    if (drive  != null) this.drive = +drive;
    if (filterType  != null) this.filterType = String(filterType);
    if (filterPoles != null) this.filterPoles = Math.max(1, Math.min(8, +filterPoles));
    if (playMode    != null) this.playMode = String(playMode);
    if (lfoRate     != null) this.lfoRate = +lfoRate;
    if (lfoDepth    != null) this.lfoDepth = +lfoDepth;      // UI 0..1 → direct
    if (lfoTarget   != null) this.lfoTarget = String(lfoTarget);

    this.pan = ((this.index / (this.N - 1 || 1)) - 0.5) * (width ?? 0);
    this.filterBuf.fill(0);

    this.setVelocity(vel);
    this.setFreq(freq, glide ?? 0); // ← FIX : glide==0 ⇒ retune immédiat
  }

  noteOff() { if (this.state !== 'release' && this.state !== 'off') this.state = 'release'; }

  render(lfo, lfoTarget, paraFreq = null, smoothParams = null) {
    if (!this.active) return [0, 0];

    // Paraphonie : suit la fréquence maître (même glide)
    if (this.playMode === 'paraph' && paraFreq) {
      if (this.glideTC === 0) { this.f0 = paraFreq; this.freq = paraFreq; }
      else { this.f0 = paraFreq; }
    }

    // ADSR
    const { a, d, s, r } = this.adsr;
    if      (this.state === 'attack')  { this.env += 1 / (Math.max(.005, a) * this.sr); if (this.env >= 1) { this.env = 1; this.state = 'decay'; } }
    else if (this.state === 'decay')   { this.env -= (1 - s) / (Math.max(.005, d) * this.sr); if (this.env <= s) { this.env = s; this.state = 'sustain'; } }
    else if (this.state === 'release') { this.env -= this.env / (Math.max(.005, r) * this.sr); if (this.env <= 0) { this.env = 0; this.state = 'off'; this.active = false; } }

    // Glide per-sample (instant si glideTC==0)
    if (this.glideTC === 0) this.freq = this.f0;
    else this.freq += (this.f0 - this.freq) * (1 - this.glideTC);

    const sp = smoothParams || {};
    const bendRatio = Math.pow(2, (sp.pitchBend || 0) / 12);

    let freq = this.freq * bendRatio;
    let cut  = (sp.cutoff ?? this.cut);
    let pan  = this.pan * (sp.width ?? 1);
    let morph= this.morph;
    let ampMod = 1, fmMod = 0;

    // LFO (profondeur interne * profondeur globale lissée)
    const LFO = lfo * (sp.lfoDepth != null ? sp.lfoDepth : this.lfoDepth);
    switch (lfoTarget) {
      case 'freq':    freq += LFO * 50; break;
      case 'cutoff':  cut  += LFO * 1.5; break;
      case 'pan':     pan  += LFO * 1.2; break;
      case 'morph':   morph = clamp01(morph + LFO * 0.8); break;
      case 'am':      ampMod = 1 + LFO; break;
      case 'fmDepth': fmMod = LFO * 50; break;
    }

    // FM simple
    const pre = this.phase;
    const fm = (this.fmIdx + fmMod > 0 && this.fmq > 0)
      ? Math.sin(TP * pre * this.fmq) * (this.fmIdx + fmMod) * freq / this.sr * 10
      : 0;
    const ph = pre + fm;

    // Osc mix + harmoniques
    const o1 = oscWave(this.wave, ph), o2 = oscWave(this.wave2, ph);
    let osc = o1 * (1 - morph) + o2 * morph;
    if (this.harmonics > 0) {
      for (let h = 2; h <= 5; ++h) osc += Math.sin(TP * ph * h) * (this.harmonics / h);
      osc /= (1 + this.harmonics * 2);
    }

    // Filtre + drive
    const f = filterProcess(osc, this.filterBuf, cut, this.resonance, this.filterType, this.filterPoles);
    const drv = this.drive * 12;
    const sig = drv ? Math.tanh(f * (1 + drv)) : f;

    this.phase += freq / this.sr; if (this.phase >= 1) this.phase -= 1;

    const gain = (sp.gain ?? 0.9);
    const amp  = sig * this.env * this.vel * 0.12 * gain * ampMod;
    return [amp * (1 - pan), amp * (1 + pan)];
  }
}

// ====== LISSAGE GLOBAL (un-pôle) ======
const paramTargets = { cutoff: .12, fmDepth: 0, width: 0, gain: 0.9, pitchBend: 0, lfoDepth: 0 };
const paramCurrent = { ...paramTargets };
let glideSeconds = 0.008;
function rampParams(blockSize, sr) {
  const coeff = 1 - Math.exp(-(blockSize / sr) / glideSeconds);
  for (const k in paramTargets) paramCurrent[k] = paramCurrent[k] + coeff * (paramTargets[k] - paramCurrent[k]);
}

// ---------- BANK ----------
class Bank extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = Array.from({ length: 16 }, (_, i) => new Voice(sampleRate, i, 16));
    this.rr = 0;
    this.glob = {
      adsr: { a:.008, d:.09, s:.05, r:.12 }, wave:'sawtooth', wave2:'sine', morph:0,
      cutoff:.12, resonance:.5, harmonics:0, fmq:0, fmDepth:0, drive:0, width:0,
      lfoRate:0, lfoDepth:0, lfoTarget:'freq', filterType:'lowpass', filterPoles:2,
      playMode:'poly', glide:0, pitchBend:0
    };
    this.lfoPhase = 0; this.lfoRate = 0; this.lfoDepth = 0; this.lfoTarget = 'freq';
    this.playMode = 'poly'; this.lastParaFreq = 220;

    // "smart legato" poly : si 2 noteOn < 60ms → retune la même voix
    this.legatoWin = 0.060;   // secondes
    this.lastOnT   = 0;
    this.lastVIdx  = 0;

    this.port.onmessage = (e) => this.msg(e.data);
  }
  static get parameterDescriptors() { return []; }

  _applyAliases(p) {
    const a = { ...(p||{}) };
    if (a.wave1 && !a.wave) a.wave = a.wave1;
    if (a.resonanceQ != null && a.resonance == null) a.resonance = +a.resonanceQ;
    if (a.fmRate != null && a.fmq == null) a.fmq = +a.fmRate;
    if (a.cutoffHz != null && a.cutoff == null) a.cutoff = logHzToNorm(+a.cutoffHz);
    return a;
  }

  msg(m) {
    const mode = m.playMode ?? this.glob.playMode;

    if (m.type === 'setParams') {
      const p = this._applyAliases(m.params);
      Object.assign(this.glob, p);

      if ('lfoRate'    in p) this.lfoRate   = +p.lfoRate;
      if ('lfoDepth'   in p) this.lfoDepth  = +p.lfoDepth;      // UI 0..1
      if ('lfoTarget'  in p) this.lfoTarget = String(p.lfoTarget);
      if ('filterType' in p) this.glob.filterType   = String(p.filterType);
      if ('filterPoles'in p) this.glob.filterPoles  = Math.max(1, Math.min(8, +p.filterPoles));
      if ('playMode'   in p) this.playMode = String(p.playMode);

      // cibles lissées
      if ('cutoff'     in p) paramTargets.cutoff    = +p.cutoff;
      if ('fmDepth'    in p) paramTargets.fmDepth   = +p.fmDepth;
      if ('width'      in p) paramTargets.width     = +p.width;
      if ('gain'       in p) paramTargets.gain      = +p.gain;
      if ('pitchBend'  in p) paramTargets.pitchBend = +p.pitchBend;
      if ('lfoDepth'   in p) paramTargets.lfoDepth  = +p.lfoDepth;

      if ('glide'      in p) {
        const ms = Math.max(0, +p.glide);
        glideSeconds = Math.max(0.001, ms / 1000);
      }

      // hot-update sans tuer l’ADSR (legato-like)
      this.voices.forEach(v => { if (v.active) v.noteOn({ ...this.glob, midi:v.noteId, freq:v.f0, vel:v.vel }); });
      return;
    }

    if (m.type === 'noteOn') {
      const msg = this._applyAliases(m);
      const freq = +msg.freq || 440;
      const nowS = currentTime;
      this.lastParaFreq = freq;

      if (mode === 'mono') {
        this.voices[0].noteOn({ ...this.glob, ...msg, playMode:'mono' });
        for (let i=1;i<this.voices.length;i++) this.voices[i].noteOff();

      } else if (mode === 'paraph') {
        const act = this.voices.filter(v => v.active);
        if (act.length === 0) this.voices[0].noteOn({ ...this.glob, ...msg, playMode:'paraph' });
        else act.forEach(v => v.noteOn({ ...this.glob, ...msg, playMode:'paraph' }));

      } else {
        // POLY "smart legato": si très proche dans le temps, retune la même voix
        let vIdx;
        if ((nowS - this.lastOnT) <= this.legatoWin) {
          vIdx = this.lastVIdx;
        } else {
          vIdx = this.rr++ % this.voices.length;
        }
        this.lastVIdx = vIdx; this.lastOnT = nowS;
        this.voices[vIdx].noteOn({ ...this.glob, ...msg, playMode:'poly' });
      }
      return;
    }

    if (m.type === 'noteOff') {
      if (mode === 'mono') { this.voices[0].noteOff(); return; }
      if (mode === 'paraph') { this.voices.forEach(v => v.noteOff()); return; }
      if (typeof m.midi === 'number') {
        this.voices.forEach(v => { if (v.active && v.noteId === m.midi) v.noteOff(); });
      } else {
        this.voices.forEach(v => v.noteOff());
      }
      return;
    }

    // Retune continu (pour mappings continus éventuels)
    if (m.type === 'retune') {
      const f = +m.freq || 0;
      const glideSec = (m.glideSec != null) ? +m.glideSec : glideSeconds;
      const ms = Math.max(0, glideSec * 1000);
      if (f > 0) this.lastParaFreq = f;
      this.voices.forEach(v => { if (v.active) v.setFreq(f || v.f0, ms); });
      return;
    }

    if (m.type === 'params') { // compat minimal
      const payload = this._applyAliases(m.payload || {});
      if ('glideMs' in payload) glideSeconds = Math.max(0.001, (+payload.glideMs)/1000);
      for (const k in paramTargets) if (k in payload) paramTargets[k] = +payload[k];
      return;
    }

    if (m.type === 'debug') {
      const act = this.voices.filter(v => v.active);
      const avgEnv = act.length ? act.reduce((a,v)=>a+v.env,0)/act.length : 0;
      this.port.postMessage({
        type:'debug',
        voicesActive: act.length,
        notes: act.map(v => v.noteId).filter(n => n!=null),
        avgEnv: +avgEnv.toFixed(3),
        lfoRate: this.lfoRate, lfoDepth: this.lfoDepth, playMode: this.playMode
      });
      return;
    }
  }

  process(_, outputs) {
    const L = outputs[0][0], R = outputs[0][1] || outputs[0][0];

    // Lissage global par bloc
    rampParams(L.length, sampleRate);

    // Osc LFO (par bloc)
    const lfo = Math.sin(TP * this.lfoPhase) * (paramCurrent.lfoDepth || this.lfoDepth);
    for (let i = 0; i < L.length; ++i) {
      let sl=0, sr=0;
      const paraFreq = this.playMode === 'paraph' ? this.lastParaFreq : null;
      for (let v of this.voices) if (v.active) {
        const [l,r] = v.render(lfo, this.lfoTarget, paraFreq, paramCurrent);
        sl += l; sr += r;
      }
      L[i] = sl; R[i] = sr;
      if (i === 0) { this.lfoPhase += this.lfoRate / sampleRate; if (this.lfoPhase > 1) this.lfoPhase -= 1; }
    }
    return true;
  }
}
registerProcessor('flomo-voice-bank', Bank);
