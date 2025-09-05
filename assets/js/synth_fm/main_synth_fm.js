/* ==================================================================
   Synth FloMo-Dulator – Script principal v5 (PJAX-ready, init/destroy)
   ================================================================== */

   export { destroy, init };

   /* ------------------------------ Constantes ------------------------------ */
   
   const STEPS = 16, ROWS = 24;
   const LFO_DIVS   = [1,2,4,8,16,32,64,128,256];
   const LFO_LABELS = ['1/1','1/2','1/4','1/8','1/16','1/32','1/64','1/128','1/256'];
   const RES_MAX = 1.35;
   
   const NOTE_TO_INDEX = { C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11 };
   
   /* ------------------------------ État module ----------------------------- */
   
   let container, q;                 // helpers DOM scopés à la page
   let seqMatrix;                    // [col][row] = bool
   
   let audioCtx = null, workletNode = null;
   let gain, delayNode, feedback, delayWet, reverbNode, reverbWet;
   
   let seqPlaying = false, seqStep = 0;
   let rafId = null, uiDirty = false;
   
   let audioStarted = false;         // bouton audio “safe”
   let el = {};                      // références DOM (toutes)
   let pjaxBeforeOnce;               // handlers de sécurité
   let pageHideOnce;
   
   /* --------------------------------- Utils -------------------------------- */
   
   function $$ (sel) { return container?.querySelectorAll(sel) ?? []; }
   function $  (sel) { return container?.querySelector(sel)    ?? null; }
   
   /* ---------------------------- Music helpers ----------------------------- */
   
   function indexToFreq(i) {
     const rootName = el.rootSelect ? el.rootSelect.value : 'A';
     const root = NOTE_TO_INDEX[rootName] ?? NOTE_TO_INDEX['A'];
     return 220 * Math.pow(2, ((i - 12 + root - 9) / 12));
   }
   
   function getLfoHz() {
     const bpm = +(el.tempo?.value ?? 120);
     const div = LFO_DIVS[+(el.lfoDiv?.value ?? 3)];
     return (bpm / 60) * div;
   }
   
   function getCutoffCoeff() {
     const v = Math.max(80, +(el.cutoff?.value ?? 1000));
     return (Math.log(v / 80) / Math.log(15000 / 80)) * 0.19 + 0.01;
   }
   function getResonanceQ() {
     return (+(el.resonance?.value ?? 1) / 20) * RES_MAX;
   }
   
   /* ------------------------------ FX chain -------------------------------- */
   
   function setupEffects(){
     gain = audioCtx.createGain();
     delayNode = audioCtx.createDelay(2);
     feedback  = audioCtx.createGain();
     delayWet  = audioCtx.createGain();
     reverbNode= audioCtx.createConvolver();
     reverbWet = audioCtx.createGain();
   
     delayNode.connect(feedback); feedback.connect(delayNode); delayNode.connect(delayWet);
   
     const len = audioCtx.sampleRate * 1.5;
     const buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
     for (let ch=0; ch<2; ++ch) {
       const d = buf.getChannelData(ch);
       for (let i=0; i<len; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 2.5);
     }
     reverbNode.buffer = buf; reverbNode.connect(reverbWet);
   
     gain.connect(delayNode);
     gain.connect(reverbNode);
     gain.connect(audioCtx.destination);
     delayWet.connect(audioCtx.destination);
     reverbWet.connect(audioCtx.destination);
   
     updateFX();
   }
   
   function updateFX() {
     const bpm = +(el.tempo?.value ?? 120);
     const div = 4;
     delayNode.delayTime.value = 60 / bpm / div;
     feedback.gain.value       = Math.min(.95, +(el.delay?.value ?? 0) * .88);
     delayWet.gain.value       = +(el.delay?.value ?? 0);
     reverbWet.gain.value      = +(el.reverb?.value ?? 0) * .8;
   }
   
   /* --------------------------- Audio / Worklet ---------------------------- */
   
   // IMPORTANT : chemin root-relatif principal (prod GitHub Pages)
   const WORKLET_PATH = '/assets/js/synth_fm/floMo-voice-bank.js';
   
   // refs minimales requises pour ne pas crasher
   function refsReady(){
     return !!(el.attack && el.decay && el.sustain && el.release && el.cutoff && el.resonance);
   }
   
   // contrôle large (utile au 1er envoi)
   function controlsReady() {
     const must = [
       'attack','decay','sustain','release','cutoff','resonance','fmRate','fmDepth',
       'distortion','polyCount','playMode','glide','wave1','wave2','harmonics','width',
       'lfoDiv','lfoDepth','lfoTarget','filterPoles','filterType','tempo','masterVol'
     ];
     return must.every(k => !!el[k]);
   }
   
   async function ensureAudio(){
     if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
     if (workletNode) return; // déjà prêt
   
     // Fallbacks pour dev local (sous-dossiers, etc.)
     const CANDIDATES = [
       WORKLET_PATH,
       './assets/js/synth_fm/floMo-voice-bank.js',
       location.origin + '/assets/js/synth_fm/floMo-voice-bank.js'
     ];
   
     let lastErr = null, loaded = false;
     for (const base of CANDIDATES) {
       const url = base + (base.includes('?') ? '&' : '?') + 'v=' + Date.now();
       try {
         await audioCtx.audioWorklet.addModule(url);
         loaded = true;
         console.info('[synth] Worklet OK via', url);
         break;
       } catch (e) {
         lastErr = e;
         console.warn('[synth] Worklet fail via', url, e);
       }
     }
     if (!loaded) {
       console.error('[synth] AUCUN chargement Worklet réussi', lastErr);
       alert('Échec chargement moteur audio. Vérifie le chemin du Worklet dans la console.');
       try { el.audioBtn?.setAttribute('disabled', 'disabled'); } catch {}
       try { el.seqBtn?.setAttribute('disabled', 'disabled'); } catch {}
       return;
     }
   
     try {
       // Options explicites → Firefox/rigueur stéréo
       workletNode = new AudioWorkletNode(audioCtx, 'flomo-voice-bank', {
         numberOfInputs: 0,
         numberOfOutputs: 1,
         outputChannelCount: [2],
         channelCount: 2,
         channelCountMode: 'explicit',
         channelInterpretation: 'speakers'
       });
   
       // Logge toute erreur runtime du processeur Worklet
       workletNode.onprocessorerror = (e) => {
         console.error('[synth] Worklet processor error', e?.message || e);
       };
   
       // Mini API console pour tests instantanés
       window.__synth = {
         ctx: audioCtx,
         node: workletNode,
         beep(freq = 220, ms = 200) {
           try {
             workletNode.port.postMessage({
               type:'noteOn',
               origin:'bip',
               freq,
               vel: 1,
               adsr:{ a:0.01, d:0.1, s:0.0, r:0.2 },
               wave: 'saw', wave2: 'sine', morph: 0,
               cutoff: getCutoffCoeff(), resonance: getResonanceQ(),
               fmq: 0, fmDepth: 0, drive: 0.05, width: 0.3,
               lfoRate: 0, lfoDepth: 0, lfoTarget: 'pan',
               glide: 0, filterPoles:+(el.filterPoles?.value || 2), filterType: el.filterType?.value || 'lowpass',
               playMode: 'mono'
             });
             setTimeout(() => workletNode.port.postMessage({ type:'noteOff' }), ms);
           } catch (e) { console.warn('beep fail', e); }
         }
       };
   
       setupEffects();
       workletNode.connect(gain);
   
       // contrôles globaux
       if (el.masterVol) el.masterVol.oninput = () => (gain.gain.value = +el.masterVol.value);
       [el.delay, el.reverb].forEach(e => { if (e) e.oninput = updateFX; });
   
       gain.gain.value = +(el.masterVol?.value ?? .8);
   
       if (controlsReady()) sendGlobalParams();
     } catch (e) {
       console.error('[synth] construction AudioWorkletNode FAILED', e);
       alert('Erreur création node audio (voir console)');
       try { el.audioBtn?.setAttribute('disabled', 'disabled'); } catch {}
       try { el.seqBtn?.setAttribute('disabled', 'disabled'); } catch {}
     }
   }
   
   function hardAudioStop() {
     try { stopScheduler(); } catch {}
     seqPlaying = false;
   
     try { cancelAnimationFrame(rafId); } catch {}
     rafId = null;
   
     try { workletNode?.disconnect(); } catch {}
     workletNode = null;
   
     try { gain?.disconnect(); } catch {}
     try { delayNode?.disconnect(); } catch {}
     try { reverbNode?.disconnect(); } catch {}
     try { delayWet?.disconnect(); } catch {}
     try { reverbWet?.disconnect(); } catch {}
     gain = delayNode = feedback = delayWet = reverbNode = reverbWet = null;
   
     if (audioCtx) {
       const ctx = audioCtx;
       audioCtx = null;
       try { ctx.suspend().catch(()=>{}); } catch {}
       try { ctx.close().catch(()=>{}); } catch {}
     }
   
     audioStarted = false; // reset du “safe start”
   }
   
   /* -------------------- Envoi des paramètres globaux ---------------------- */
   
   function sendGlobalParams(){
     if (!workletNode || !refsReady()) return;
     workletNode.port.postMessage({
       type:'setParams',
       params:{
         adsr:{ a:+el.attack.value, d:+el.decay.value, s:+el.sustain.value, r:+el.release.value },
         wave: el.wave1.value, wave2: el.wave2.value, morph:+el.morph.value,
         cutoff: getCutoffCoeff(), resonance: getResonanceQ(),
         harmonics:+el.harmonics.value, fmq:+el.fmRate.value, fmDepth:+el.fmDepth.value,
         drive:+el.distortion.value, width:+el.width.value,
         lfoRate: getLfoHz(),
         lfoDepth:+el.lfoDepth.value, lfoTarget: el.lfoTarget.value,
         filterPoles:+el.filterPoles.value, filterType: el.filterType.value,
         playMode: el.playMode.value, glide:+el.glide.value
       }
     });
   }
   
   /* Marquage d’origine pour l’audit */
   function noteOn(row, vel=1, origin){
     if (!workletNode || !refsReady()) return;
     workletNode.port.postMessage({
       type:'noteOn',
       origin, // 'seq' quand appelé par le séquenceur
       freq:indexToFreq(row), vel,
       adsr:{ a:+el.attack.value, d:+el.decay.value, s:+el.sustain.value, r:+el.release.value },
       wave: el.wave1.value, wave2: el.wave2.value, morph:+el.morph.value,
       cutoff: getCutoffCoeff(), resonance: getResonanceQ(),
       harmonics:+el.harmonics.value, fmq:+el.fmRate.value, fmDepth:+el.fmDepth.value,
       drive:+el.distortion.value, width:+el.width.value,
       lfoRate: getLfoHz(),
       lfoDepth:+el.lfoDepth.value, lfoTarget: el.lfoTarget.value,
       glide:+el.glide.value, filterPoles:+el.filterPoles.value, filterType: el.filterType.value,
       playMode: el.playMode.value || 'mono'
     });
   }
   
   /* ------------------------------ Séquenceur ------------------------------ */
   
   // Durée d'un pas (sécurisée)
   function stepDurationSec() {
     const v = Number(el.tempo?.value);
     const bpm = Number.isFinite(v) && v > 0 ? v : 120; // fallback sûr
     return 60 / bpm / 4; // double croche
   }
   
   // --- Scheduler déterministe basé sur l’index de pas ---
   let schedRAF = null;
   let startAt = 0;     // temps d’origine (audioCtx.currentTime)
   let lastStep = -1;   // dernier pas joué
   
   function scheduleStepAt(stepIdx){
     const col = seqMatrix?.[stepIdx] ?? [];
     col.forEach((on,row)=> on && noteOn(row, 1, 'seq'));
   }
   
   function startScheduler(){
     stopScheduler();
     startAt = audioCtx.currentTime + 0.05;
     lastStep = -1;
     const tick = () => {
       if (!audioCtx) return;
       const dur = stepDurationSec();
       const t   = audioCtx.currentTime;
       const phase = Math.floor((t - startAt) / dur);
       if (phase >= 0) {
         const target = ((phase % STEPS) + STEPS) % STEPS;
         while (lastStep !== target) {
           lastStep = (lastStep + 1) % STEPS;
           seqStep  = lastStep;
           scheduleStepAt(lastStep);
         }
       }
       schedRAF = requestAnimationFrame(tick);
     };
     schedRAF = requestAnimationFrame(tick);
   }
   
   function stopScheduler(){
     if (schedRAF) { cancelAnimationFrame(schedRAF); schedRAF = null; }
   }
   
   /* --------------------------- UI & bindings ------------------------------ */
   
   function bindUI() {
     // Miroirs de sliders
     const bindSlider = (id, label, suffix='') => {
       const input = el[id], span = el[label];
       if (!input || !span) return;
       const upd = () => { span.textContent = input.value + suffix; };
       input.addEventListener('input', upd); upd();
     };
     bindSlider('glide',     'glideVal',     ' ms');
     bindSlider('morph',     'morphVal',     '');
     bindSlider('fmRate',    'fmRateVal',    '');
     bindSlider('fmDepth',   'fmDepthVal',   '');
     bindSlider('harmonics', 'harmonicsVal', '');
   
     if (el.filterPoles && el.polesVal) {
       const sync = () => el.polesVal.textContent = el.filterPoles.value;
       el.filterPoles.addEventListener('input', sync); sync();
     }
   
     // LFO label
     if (el.lfoDiv && el.lfoDivLabel) {
       const syncLfoLabel = () => { el.lfoDivLabel.textContent = LFO_LABELS[+el.lfoDiv.value]; };
       el.lfoDiv.addEventListener('input', () => { uiDirty = true; syncLfoLabel(); });
       el.tempo?.addEventListener('input', () => { uiDirty = true; syncLfoLabel(); });
       syncLfoLabel();
     }
   
     // Root change → boost cutoff + retrig
     el.rootSelect?.addEventListener('change', () => {
       if (el.cutoff) el.cutoff.value = 4000;
       sendGlobalParams();
       if (seqPlaying) {
         startAt = audioCtx ? audioCtx.currentTime + .05 : 0;
         lastStep = -1;
         scheduleStepAt(0);
       } else {
         const col = seqStep;
         (seqMatrix?.[col] ?? []).forEach((on, row) => { if (on) noteOn(row); });
       }
     });
   
     // Registres “dirty”
     [
       'attack','decay','sustain','release','morph','cutoff','resonance','fmRate','fmDepth','distortion',
       'polyCount','playMode','glide','wave1','wave2','harmonics','width','lfoDiv','lfoDepth','lfoTarget',
       'filterPoles','filterType'
     ].forEach(id => { el[id]?.addEventListener('input', () => { uiDirty = true; }); });
   
     // Tempo → clamp + FX + resync
     const resync = () => {
       const v = Number(el.tempo.value);
       if (!Number.isFinite(v) || v <= 0) el.tempo.value = 120; // clamp sûr
       updateFX();
       if (seqPlaying && audioCtx) {
         startAt = audioCtx.currentTime + 0.05;
         lastStep = -1;
       }
     };
     el.tempo?.addEventListener('input',  resync);
     el.tempo?.addEventListener('change', resync);
   
     // --------- BOUTON AUDIO “SAFE START” ---------
     if (el.audioBtn) {
       el.audioBtn.addEventListener('click', async () => {
         await ensureAudio();
         if (!audioCtx) return;
   
         // 1er clic → force resume()
         if (!audioStarted || audioCtx.state !== 'running') {
           try { await audioCtx.resume(); } catch {}
           audioStarted = true;
           el.audioBtn.textContent = 'Stop audio';
   
           // Bip court de validation immédiate
           try { window.__synth?.beep?.(220, 220); } catch {}
           return;
         }
         // Clic suivant → suspend
         try { await audioCtx.suspend(); } catch {}
         el.audioBtn.textContent = 'Démarrer l\'audio';
       });
     }
   
     // Séquence
     el.seqBtn?.addEventListener('click', async () => {
       if (seqPlaying) {
         seqPlaying = false;
         stopScheduler();
         el.seqBtn.textContent = 'Lire Séquence';
         return;
       }
   
       await ensureAudio();
       if (!workletNode) return;
   
       if (audioCtx.state !== 'running') {
         try { await audioCtx.resume(); } catch {}
         audioStarted = true;
         if (el.audioBtn) el.audioBtn.textContent = 'Stop audio';
       }
   
       // AUTO-SEED amélioré (pattern 4 pas + cutoff boost) si grille vide
       if (seqMatrix && seqMatrix.every(col => col.every(v => !v))) {
         const steps = [0, 4, 8, 12];
         const rows  = [12, 16, 19]; // 12≈A3, 16≈C#4, 19≈E4
         steps.forEach(c => {
           if (!seqMatrix[c]) return;
           rows.forEach(r => { seqMatrix[c][r] = true; });
         });
         const sel = (c,r) => container?.querySelector(`.piano-roll .cell[data-col="${c}"][data-row="${r}"]`);
         steps.forEach(c => rows.forEach(r => sel(c,r)?.classList.add('active')));
         if (el.cutoff) el.cutoff.value = Math.max(2000, +(el.cutoff.value || 0));
         uiDirty = true;
         console.info('[synth] Auto-seed: pattern 4 pas + cutoff boost appliqués.');
       }
   
       // Démarrage déterministe
       seqPlaying = true;
       seqStep = 0;
       startScheduler();
       el.seqBtn.textContent = 'Stop Séquence';
     });
   
     // Resync si l’onglet redevient visible
     document.addEventListener('visibilitychange', () => {
       if (document.visibilityState === 'visible' && seqPlaying && audioCtx) {
         startAt = audioCtx.currentTime + 0.05;
         lastStep = -1;
       }
     });
   
     // Bouton “Bip test” (facultatif si présent dans l’UI)
     const testBtn = el.testBtn || container.querySelector('#testBtn');
     testBtn?.addEventListener('click', async () => {
       await ensureAudio();
       if (audioCtx?.state !== 'running') {
         try { await audioCtx.resume(); } catch {}
         audioStarted = true;
         if (el.audioBtn) el.audioBtn.textContent = 'Stop audio';
       }
       window.__synth?.beep?.(220, 250); // A3 court
     });
   
     // RAF : push params
     const loop = () => {
       if (uiDirty) { sendGlobalParams(); uiDirty = false; }
       rafId = requestAnimationFrame(loop);
     };
     rafId = requestAnimationFrame(loop);
   }
   
   /* ------------------------------ Piano-roll ------------------------------ */
   
   function buildRoll() {
     const roll = el.roll;
     if (!roll) return;
     if (roll.childElementCount > 0) return; // déjà construit
     for (let r=0; r<ROWS; r++) {
       for (let c=0; c<STEPS; c++) {
         const cell = document.createElement('div');
         cell.className = 'cell';
         cell.dataset.row = r; cell.dataset.col = c;
   
         // Pré-écoute immédiate lors du clic
         cell.addEventListener('click', async () => {
           const row = +cell.dataset.row, col = +cell.dataset.col;
           seqMatrix[col][row] = !seqMatrix[col][row];
           cell.classList.toggle('active', seqMatrix[col][row]);
   
           // Pré-écoute (hors séquenceur)
           try {
             await ensureAudio();
             if (audioCtx?.state !== 'running') {
               try { await audioCtx.resume(); } catch {}
               audioStarted = true;
               if (el.audioBtn) el.audioBtn.textContent = 'Stop audio';
             }
             window.__synth?.beep?.(indexToFreq(row), 200);
           } catch {}
         });
   
         roll.appendChild(cell);
       }
     }
   }
   
   /* ------------------------------ API publique ---------------------------- */
   
   function init(cont) {
     container = cont || document.querySelector('main[data-pjax-root]');
     if (!container) return;
   
     // GARDE anti double-init par container
     if (container.__synthInit) return;
     container.__synthInit = true;
   
     q = (sel) => container.querySelector(sel);
   
     // Références DOM
     el = {
       // boutons / tempo / mode
       audioBtn: q('#audioBtn'),
       seqBtn: q('#seqBtn'),
       tempo: q('#tempo'),
       playMode: q('#playMode'),
       polyCount: q('#polyCount'),
       glide: q('#glide'),
       glideVal: q('#glideVal'),
       masterVol: q('#masterVol'),
   
       // >>> ADSR (manquants auparavant, indispensables à refsReady/noteOn)
       attack: q('#attack'),
       decay: q('#decay'),
       sustain: q('#sustain'),
       release: q('#release'),
   
       // osc / fm / morph / additif
       wave1: q('#wave1'), wave2: q('#wave2'),
       morph: q('#morph'), morphVal: q('#morphVal'),
       fmRate: q('#fmRate'), fmRateVal: q('#fmRateVal'),
       fmDepth: q('#fmDepth'), fmDepthVal: q('#fmDepthVal'),
       harmonics: q('#harmonics'), harmonicsVal: q('#harmonicsVal'),
   
       // filtre
       filterType: q('#filterType'),
       filterPoles: q('#filterPoles'), polesVal: q('#polesVal'),
       cutoff: q('#cutoff'),
       resonance: q('#resonance'),
       filterEnv: q('#filterEnv'),
   
       // effets
       distortion: q('#distortion'),
       delay: q('#delay'),
       reverb: q('#reverb'),
       width: q('#width'),
   
       // lfo
       lfoDiv: q('#lfoDiv'), lfoDivLabel: q('#lfoDivLabel'),
       lfoDepth: q('#lfoDepth'),
       lfoTarget: q('#lfoTarget'),
   
       // musiques / échelle
       rootSelect: q('#rootSelect'),
       modeSelect: q('#modeSelect'),
   
       // roll
       roll: q('#roll'),
   
       // (optionnel) bouton test si présent dans l’UI
       testBtn: q('#testBtn'),
     };
   
     // matrice vide au (ré)chargement PJAX
     seqMatrix = Array.from({ length: STEPS }, () => Array(ROWS).fill(false));
   
     // construit le roll si besoin + bind UI
     buildRoll();
     bindUI();
   
     // Sécurité : si tu quittes la page, on coupe le son même sans page-hub
     pjaxBeforeOnce = () => destroy();
     document.addEventListener('pjax:before', pjaxBeforeOnce, { once: true });
   
     pageHideOnce = () => destroy();
     window.addEventListener('pagehide', pageHideOnce, { once: true });
   }
   
   function destroy() {
     // coupe l’audio/raf
     try { stopScheduler(); } catch {}
     hardAudioStop();
   
     // nettoie les handlers de secours (si encore présents)
     if (pjaxBeforeOnce) { try { document.removeEventListener('pjax:before', pjaxBeforeOnce); } catch {} }
     if (pageHideOnce)   { try { window.removeEventListener('pagehide', pageHideOnce); } catch {} }
     pjaxBeforeOnce = pageHideOnce = null;
   
     // lève le flag anti double-init
     if (container?.__synthInit) { try { delete container.__synthInit; } catch {} }
   
     // on laisse le reste se GC avec le DOM remplacé par PJAX
     container = null; q = null; el = {};
     seqMatrix = null;
   }
   