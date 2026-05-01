// /assets/js/audio_reactor.js
// Réacteur audio : extrait un "bass level" lissé pour animer la scène.
// API :
//   const ar = createAudioReactor({ fftSize, smoothing, bassLowHz, bassHighHz });
//   await ar.attachToMediaElement(audioEl)  // OU  await ar.attachToMic()
//   ar.levels() -> { bass, bassEased, rms, peak }
//   ar.resume(), ar.suspend(), ar.destroy()

export function createAudioReactor(cfg = {}) {
    const FFT      = cfg.fftSize    ?? 2048;
    const SMOOTH   = cfg.smoothing  ?? 0.86;  // AnalyserNode smoothing
    const LOW_HZ   = cfg.bassLowHz  ?? 30;
    const HIGH_HZ  = cfg.bassHighHz ?? 160;
  
    // État
    let ac = null, src = null;
    let lowpass = null, highpass = null, analyser = null;
    let freq = null, time = null;
  
    // enveloppe lissée (attack/decay)
    let easedBass = 0;
    const ATTACK = cfg.attack ?? 0.25;   // 0..1  (monte vite)
    const DECAY  = cfg.decay  ?? 0.06;   // 0..1  (redescend lentement)
  
    const log = (...a) => console.log('%c[AudioReactor]', 'background:#111;color:#5ff;padding:2px 5px;border-radius:3px', ...a);
  
    function ensureCtx() {
      if (ac) return;
      ac = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive',
      });
      analyser = ac.createAnalyser();
      analyser.fftSize = FFT;
      analyser.smoothingTimeConstant = SMOOTH;
  
      lowpass  = ac.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = HIGH_HZ;
  
      highpass = ac.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = LOW_HZ;
  
      // source -> highpass -> lowpass -> analyser   (pas de sortie audible)
      highpass.connect(lowpass);
      lowpass.connect(analyser);
  
      const bins = analyser.frequencyBinCount;
      freq = new Uint8Array(bins);
      time = new Float32Array(analyser.fftSize);
      log('AudioContext prêt (fft=%d, smooth=%.2f, bass=%d-%dHz)', FFT, SMOOTH, LOW_HZ, HIGH_HZ);
  
      // Sécurité batterie/onglet
      document.addEventListener('visibilitychange', () => {
        if (!ac) return;
        if (document.visibilityState === 'hidden') ac.suspend().catch(()=>{});
        else ac.resume().catch(()=>{});
      });
    }
  
    function resume() {
      try { ensureCtx(); return ac.resume(); } catch { return Promise.resolve(); }
    }
    function suspend() {
      try { return ac?.suspend() ?? Promise.resolve(); } catch { return Promise.resolve(); }
    }
  
    async function attachToMediaElement(audioEl) {
      ensureCtx();
      if (!audioEl) throw new Error('audio element manquant');
      try { audioEl.crossOrigin = audioEl.crossOrigin || 'anonymous'; } catch {}
      // Branche WebAudio parallèle (n’altère pas le volume du lecteur)
      src = ac.createMediaElementSource(audioEl);
      src.connect(highpass);
      log('Branche sur <audio id="%s">', audioEl.id || audioEl.className || 'anonymous');
      // Débloque sur 1er geste utilisateur (autoplay policies)
      const unlock = () => { resume(); window.removeEventListener('pointerdown', unlock); };
      window.addEventListener('pointerdown', unlock, { once: true });
    }
  
    async function attachToMic(constraints = { audio: { echoCancellation: true } }) {
      ensureCtx();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      src = ac.createMediaStreamSource(stream);
      src.connect(highpass);
      log('Branche sur microphone (getUserMedia OK)');
      const unlock = () => { resume(); window.removeEventListener('pointerdown', unlock); };
      window.addEventListener('pointerdown', unlock, { once: true });
    }
  
    function levels() {
      if (!analyser) return { bass: 0, bassEased: 0, rms: 0, peak: 0 };
      analyser.getByteFrequencyData(freq);
      analyser.getFloatTimeDomainData(time);
  
      // énergie basses (moyenne pondérée 30–160 Hz)
      const nyquist = ac.sampleRate / 2;
      const binHz   = nyquist / freq.length;
      let sum = 0, wsum = 0, peak = 0, sumSq = 0;
  
      for (let i = 0; i < freq.length; i++) {
        const hz = i * binHz;
        const v  = freq[i] / 255;            // 0..1
        if (hz >= LOW_HZ && hz <= HIGH_HZ) {
          const w = 1 - Math.abs((hz - (LOW_HZ+HIGH_HZ)/2) / ((HIGH_HZ-LOW_HZ)/2)); // triangle
          sum  += v * Math.max(0, w);
          wsum += Math.max(0, w);
        }
      }
      const bass = (wsum > 0 ? sum / wsum : 0);
  
      // RMS global (timbre/énergie)
      for (let i = 0; i < time.length; i++) {
        const x = time[i];
        sumSq += x*x;
        const ax = Math.abs(x);
        if (ax > peak) peak = ax;
      }
      const rms = Math.sqrt(sumSq / time.length);
  
      // enveloppe lissée
      const target = Math.min(1, Math.max(0, bass));
      const a = (target > easedBass) ? ATTACK : DECAY;
      easedBass = easedBass + (target - easedBass) * a;
  
      return { bass: target, bassEased: easedBass, rms, peak };
    }
  
    function destroy() {
      try {
        if (src) { try { src.disconnect(); } catch {} src = null; }
        if (highpass) { try { highpass.disconnect(); } catch {} highpass = null; }
        if (lowpass)  { try { lowpass.disconnect(); }  catch {} lowpass = null; }
        if (analyser) { try { analyser.disconnect(); } catch {} analyser = null; }
        if (ac) { try { ac.close(); } catch {} ac = null; }
        log('destroy()');
      } catch {}
    }
  
    return { attachToMediaElement, attachToMic, resume, suspend, levels, destroy };
  }
  