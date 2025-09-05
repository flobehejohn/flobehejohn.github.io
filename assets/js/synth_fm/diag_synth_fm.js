/* ==================================================================
   diag_synth_fm.js – Panneau d’audit avancé pour FloMo-Dulator
   - Wrap setInterval / clearInterval → compte les ticks & drift
   - Mesure rAF FPS, visibilité onglet (throttling potentiel)
   - Compte noteOn par ORIGINE : bip / seq / diag
   - Outils de test : interval 25ms, play colonne, motif 0-4-8-12
   ================================================================== */

   (function () {
    'use strict';
  
    const POLL_MS = 300;
    const PANEL_ID = 'synth-audit-panel';
  
    const styles = `
      #${PANEL_ID}{
        position:fixed; right:12px; bottom:12px; z-index:99999;
        font:12px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;
        color:#111; background:#fff; border:1px solid #e2e2e2; border-radius:10px;
        box-shadow:0 6px 24px rgba(0,0,0,.12); min-width:300px; max-width:400px;
      }
      #${PANEL_ID} .hd{display:flex; align-items:center; justify-content:space-between;
        padding:8px 10px; border-bottom:1px solid #eee; background:#f9fafb; border-radius:10px 10px 0 0;}
      #${PANEL_ID} .hd b{font-weight:600; font-size:12px}
      #${PANEL_ID} .bd{padding:10px}
      #${PANEL_ID} .kv{display:flex; justify-content:space-between; margin:3px 0}
      #${PANEL_ID} .kv span{opacity:.75}
      #${PANEL_ID} .tips{margin-top:8px; padding:8px; background:#f6fbff; border:1px solid #d9efff; border-radius:8px}
      #${PANEL_ID} .ok{color:#0a7}
      #${PANEL_ID} .warn{color:#c60}
      #${PANEL_ID} .bad{color:#c00}
      #${PANEL_ID} .muted{opacity:.6}
      #${PANEL_ID} .foot{padding:8px 10px; border-top:1px solid #eee; font-size:11px; color:#444; display:flex; gap:8px; align-items:center; flex-wrap:wrap}
      #${PANEL_ID} .pill{padding:0 8px; height:22px; display:inline-flex; align-items:center; border-radius:999px; border:1px solid #ddd; background:#fff}
      #${PANEL_ID} .btn{cursor:pointer; user-select:none}
      #${PANEL_ID} .row{display:flex; gap:6px; flex-wrap:wrap; margin-top:6px}
      #${PANEL_ID} .mini{font-size:11px}
      #${PANEL_ID} .tbl{margin-top:6px; border-top:1px dashed #ddd; padding-top:6px}
      #${PANEL_ID} code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:11px}
    `;
  
    // --------------------------- State & helpers ---------------------------
  
    const state = {
      attached: false,
      wrapDone: false,
      t0: performance.now(),
      counts: {
        noteOn_total: 0,
        noteOn_beep: 0, // origin 'bip'
        noteOn_seq:  0, // origin 'seq'
        noteOn_diag: 0, // origin 'diag' (tests)
        lastNoteOnMs: 0
      },
      lastMsg: null,
      lastWarn: '',
      // timers
      intervals: {}, // id -> {delay, created, count, last, cbName, suspected, drift}
      raf: { count: 0, last: 0, fps: 0, enabled: false },
      diagIntervalId: null,
    };
  
    function h(tag, attrs = {}, text) {
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else el.setAttribute(k, v);
      });
      if (text != null) el.textContent = text;
      return el;
    }
    const qs  = (sel, root=document) => root.querySelector(sel);
    const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  
    const NOTE_TO_INDEX = { C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11 };
    function indexToFreq(i) {
      const rootName = qs('#rootSelect')?.value || 'A';
      const root = NOTE_TO_INDEX[rootName] ?? 9; // A
      return 220 * Math.pow(2, ((i - 12 + root - 9) / 12));
    }
    function stepDurationSec() {
      const v = Number(qs('#tempo')?.value);
      const bpm = Number.isFinite(v) && v > 0 ? v : 120;
      return 60 / bpm / 4;
    }
  
    // --------------------------- Overlay panel ----------------------------
  
    function ensurePanel() {
      if (qs('#' + PANEL_ID)) return;
      document.head.appendChild(h('style', {}, styles));
  
      const panel = h('div', { id: PANEL_ID });
      const hd = h('div', { class: 'hd' });
      hd.append(h('b', {}, 'FloMo – Audit'), h('div', { class: 'pill btn', id: 'synth-audit-toggle' }, 'Minimiser'));
      const bd = h('div', { class: 'bd', id: 'synth-audit-body' });
      const foot = h('div', { class: 'foot' });
  
      // Actions
      const btnReset  = h('span', { class: 'pill btn', id: 'synth-audit-reset' }, 'Réinitialiser');
      const btnTick25 = h('span', { class: 'pill btn', id: 'synth-audit-interval' }, 'Interval 25ms (test)');
      const btnPlayC0 = h('span', { class: 'pill btn', id: 'synth-audit-col0' }, 'Play colonne 0');
      const btnPattern= h('span', { class: 'pill btn', id: 'synth-audit-pattern' }, 'Motif 0-4-8-12');
      const badge     = h('span', { class: 'pill muted mini' }, 'diag_synth_fm.js');
      foot.append(badge, btnReset, btnTick25, btnPlayC0, btnPattern);
  
      panel.append(hd, bd, foot);
      document.body.appendChild(panel);
  
      // Toggle
      qs('#synth-audit-toggle').addEventListener('click', () => {
        const body = qs('#synth-audit-body');
        const btn = qs('#synth-audit-toggle');
        const vis = body.style.display !== 'none';
        body.style.display = vis ? 'none' : 'block';
        btn.textContent = vis ? 'Agrandir' : 'Minimiser';
      });
  
      // Reset counters
      btnReset.addEventListener('click', () => {
        Object.assign(state.counts, { noteOn_total:0, noteOn_beep:0, noteOn_seq:0, noteOn_diag:0, lastNoteOnMs:0 });
        state.lastMsg = null;
        state.lastWarn = '';
        render();
      });
  
      // Interval 25ms (diagnostic)
      btnTick25.addEventListener('click', () => {
        if (state.diagIntervalId) {
          clearInterval(state.diagIntervalId);
          state.diagIntervalId = null;
          btnTick25.textContent = 'Interval 25ms (test)';
        } else {
          state.diagIntervalId = setInterval(() => { /* no-op */ }, 25);
          btnTick25.textContent = 'Stop interval test';
        }
      });
  
      // Play colonne 0
      btnPlayC0.addEventListener('click', playColumn0Once);
  
      // Motif 0-4-8-12
      btnPattern.addEventListener('click', playPatternTest);
    }
  
    function playColumn0Once() {
      const port = window.__synth?.node?.port;
      if (!port) return alert('Worklet non prêt.');
      const col = 0;
      const cells = qsa(`.piano-roll .cell[data-col="${col}"].active`);
      if (cells.length === 0) return alert('Aucune note active en colonne 0.');
      ensureAudioRunning().then(() => {
        cells.forEach(cell => {
          const row = Number(cell.dataset.row);
          port.postMessage({
            type:'noteOn', origin:'diag', freq:indexToFreq(row), vel:1,
            adsr:{a:0.01,d:0.1,s:0,r:0.2}, wave:'saw', wave2:'sine', morph:0,
            cutoff: clampCutoff(), resonance: getResQ(), fmq:0, fmDepth:0,
            drive:0.05, width:0.3, lfoRate:0, lfoDepth:0, lfoTarget:'pan',
            glide:0, filterPoles:+(qs('#filterPoles')?.value||2),
            filterType: qs('#filterType')?.value||'lowpass', playMode:'poly'
          });
          setTimeout(()=>port.postMessage({type:'noteOff'}), 180);
        });
      });
    }
  
    function playPatternTest() {
      const port = window.__synth?.node?.port;
      if (!port) return alert('Worklet non prêt.');
      const steps = [0,4,8,12];
      const cols = new Set(steps.map(String));
      const any = qsa('.piano-roll .cell.active').some(c => cols.has(c.dataset.col));
      if (!any) return alert('Aucune note sur 0/4/8/12. Active quelques cases puis reteste.');
      ensureAudioRunning().then(async () => {
        const dur = stepDurationSec();
        for (const c of steps) {
          const act = qsa(`.piano-roll .cell[data-col="${c}"].active`);
          act.forEach(cell => {
            const row = Number(cell.dataset.row);
            port.postMessage({
              type:'noteOn', origin:'diag', freq:indexToFreq(row), vel:1,
              adsr:{a:0.01,d:0.1,s:0,r:0.25}, wave:'saw', wave2:'sine', morph:0,
              cutoff: clampCutoff(), resonance: getResQ(), fmq:0, fmDepth:0,
              drive:0.03, width:0.2, lfoRate:0, lfoDepth:0, lfoTarget:'pan',
              glide:0, filterPoles:+(qs('#filterPoles')?.value||2),
              filterType: qs('#filterType')?.value||'lowpass', playMode:'poly'
            });
            setTimeout(()=>port.postMessage({type:'noteOff'}), Math.max(120, dur*800));
          });
          await sleep(Math.max(100, dur*1000)); // avance au pas suivant
        }
      });
    }
  
    function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
    function clampCutoff(){
      const v = Math.max(80, +(qs('#cutoff')?.value || 1000));
      // même mapping que moteur
      return (Math.log(v / 80) / Math.log(15000 / 80)) * 0.19 + 0.01;
    }
    function getResQ(){ return (+(qs('#resonance')?.value || 1) / 20) * 1.35; }
  
    async function ensureAudioRunning(){
      const ctx = window.__synth?.ctx;
      if (!ctx) return;
      if (ctx.state !== 'running') {
        try { await ctx.resume(); } catch {}
        const btn = qs('#audioBtn');
        if (btn) btn.textContent = 'Stop audio';
      }
    }
  
    // --------------------------- Rendering ---------------------------------
  
    function render() {
      ensurePanel();
      const bd = qs('#synth-audit-body'); if (!bd) return;
      bd.innerHTML = '';
  
      const ctxState = window.__synth?.ctx?.state || '(n/a)';
      const nodeOk   = !!window.__synth?.node;
      const vol      = qs('#masterVol')?.value ?? '(n/a)';
      const btnSeq   = qs('#seqBtn')?.textContent?.trim() || '(n/a)';
      const activeCells = qsa('.piano-roll .cell.active').length;
      const activeCols  = new Set(qsa('.piano-roll .cell.active').map(c=>c.dataset.col)).size;
      const adsrOk = ['#attack','#decay','#sustain','#release','#cutoff','#resonance'].every(sel => !!qs(sel));
      const lfoDiv = qs('#lfoDiv')?.value ?? '(n/a)';
      const cutoff = qs('#cutoff')?.value ?? '(n/a)';
      const vis    = document.visibilityState;
      const stepS  = stepDurationSec();
  
      const c = state.counts;
      const lastAge = c.lastNoteOnMs ? Math.round(performance.now() - c.lastNoteOnMs) : 0;
  
      const rows = [
        ['AudioContext', ctxState === 'running' ? `running` : ctxState],
        ['Worklet node', nodeOk ? 'OK' : 'absent'],
        ['MasterVol', String(vol)],
        ['Séquence', String(btnSeq)],
        ['Cases actives', `${activeCells} (${activeCols} colonnes)`],
        ['ADSR refs', adsrOk ? 'OK' : 'manquantes'],
        ['LFO div', String(lfoDiv)],
        ['Cutoff', String(cutoff)],
        ['Tempo', String(qs('#tempo')?.value ?? '(n/a)')],
        ['Durée 1 pas', `${(stepS*1000).toFixed(1)} ms`],
        ['Onglet', vis],
        ['rAF FPS', state.raf.fps ? state.raf.fps.toFixed(1) : '—'],
        ['noteOn total', String(c.noteOn_total)],
        ['noteOn bip',   String(c.noteOn_beep)],
        ['noteOn séq',   String(c.noteOn_seq)],
        ['noteOn diag',  String(c.noteOn_diag)],
        ['Dernier noteOn', c.lastNoteOnMs ? `${lastAge} ms` : '—'],
      ];
      rows.forEach(([k,v])=>{
        const line = h('div',{class:'kv'});
        line.append(h('span',{},k), h('b',{},v));
        bd.append(line);
      });
  
      // Liste des intervals
      const ints = Object.entries(state.intervals);
      const box = h('div', { class:'tbl' });
      box.append(h('div', { class:'muted mini' }, `Intervals actifs: ${ints.length}`));
      ints
        .sort((a,b)=>a[1].delay-b[1].delay)
        .forEach(([id, rec])=>{
          const now = performance.now();
          const age = ((now - (rec.last||rec.created))|0);
          const life= ((now - rec.created)|0);
          const should = Math.max(1, Math.floor(life / rec.delay));
          const drift = (should - rec.count);
          const suspected = rec.suspected ? ' • <b>scheduler?</b>' : '';
          const line = h('div', { class:'kv mini' });
          line.innerHTML = `<span><code>#${id}</code> ${rec.cbName}${suspected}</span><b>${rec.delay}ms • ${rec.count}/${should} (Δ${drift}) • last ${age}ms</b>`;
          box.append(line);
        });
      bd.append(box);
  
      // Conseils
      const tips = h('div', { class:'tips' });
      const msgs = [];
  
      if (ctxState !== 'running') {
        msgs.push('Le contexte audio n’est pas "running". Clique "Démarrer l’audio".');
      }
      if (!nodeOk) {
        msgs.push('Worklet non initialisé. Vérifie le log "Worklet OK via …".');
      }
      if (!adsrOk) {
        msgs.push('Références ADSR manquantes → noteOn séquence ignorés (refsReady=false).');
      }
      if (btnSeq.includes('Stop') && activeCols > 0 && c.noteOn_seq === 0) {
        msgs.push('Séquence démarrée + grille active, mais 0 "noteOn" séquence → problème probable de scheduler (interval non déclenché ou throttle).');
      }
      if (document.visibilityState !== 'visible') {
        msgs.push('Onglet non visible → setInterval peut être fortement ralenti (throttling).');
      }
      // Interval suspect
      const suspected = ints.find(([,r])=>r.suspected);
      if (!suspected && btnSeq.includes('Stop')) {
        msgs.push('Aucun interval "scheduler" détecté. Le setInterval n’a peut-être pas été créé.');
      } else if (suspected) {
        const [id, r] = suspected;
        const now = performance.now();
        const age = ((now - (r.last||r.created))|0);
        if (age > 2000) msgs.push(`Le scheduler (#${id}) ne ticke plus (dernier tick ${age} ms).`);
        const life= ((now - r.created)|0);
        const should = Math.max(1, Math.floor(life / r.delay));
        const drift = (should - r.count);
        if (drift > 10) msgs.push(`Drift important sur le scheduler (#${id}): ${r.count}/${should} ticks.`);
      }
  
      if (msgs.length === 0) {
        tips.append(h('div', {class:'ok'}, 'Tout semble prêt. Si pas de son en séquence : vérifie cutoff (>2000), master (~0.8), et essaye "Motif 0-4-8-12".'));
      } else {
        msgs.forEach(m => tips.append(h('div', {class:'warn'}, '• ' + m)));
      }
      bd.append(tips);
  
      // Dernier message
      if (state.lastMsg) {
        const m = JSON.stringify(state.lastMsg);
        const box2 = h('pre', {
          class:'muted',
          style:'margin-top:8px; max-height:120px; overflow:auto; white-space:pre-wrap'
        }, m);
        bd.append(box2);
      }
    }
  
    // -------------------- Instrumentation : postMessage --------------------
  
    function tryWrapPort() {
      if (state.wrapDone) return;
      const port = window.__synth?.node?.port;
      if (!port || !port.postMessage) return;
  
      const orig = port.postMessage.bind(port);
      port.postMessage = (msg) => {
        try {
          if (msg && msg.type === 'noteOn') {
            state.counts.noteOn_total++;
            const origin = msg.origin || null; // 'bip' | 'seq' | 'diag' | null
            if (origin === 'bip') state.counts.noteOn_beep++;
            else if (origin === 'seq') state.counts.noteOn_seq++;
            else if (origin === 'diag') state.counts.noteOn_diag++;
            state.counts.lastNoteOnMs = performance.now();
            state.lastMsg = msg;
          }
        } catch {}
        return orig(msg);
      };
      state.wrapDone = true;
      console.info('[audit] Port Worklet wrap: OK');
    }
  
    // -------------------- Instrumentation : timers -------------------------
  
    (function wrapTimersOnce(){
      const _setInterval = window.setInterval;
      const _clearInterval = window.clearInterval;
      window.setInterval = function(fn, delay, ...args){
        // marqueur heuristique
        const name = fn?.name || '(anon)';
        const suspected = /scheduler/.test(name) || /scheduleStep|nextStep/.test(String(fn||''));
        const rec = { delay: Number(delay)||0, created: performance.now(), count:0, last:0,
                      cbName: name, suspected };
        function wrapped(){
          rec.count++; rec.last = performance.now();
          return fn?.(...args);
        }
        const id = _setInterval(wrapped, delay);
        state.intervals[id] = rec;
        return id;
      };
      window.clearInterval = function(id){
        delete state.intervals[id];
        return _clearInterval(id);
      };
    })();
  
    // rAF FPS
    (function trackRAF(){
      let lastSec = performance.now(), secCount = 0;
      state.raf.enabled = true;
      function loop(){
        state.raf.count++; secCount++;
        const now = performance.now();
        if (now - lastSec >= 1000) {
          state.raf.fps = secCount * 1000 / (now - lastSec);
          lastSec = now; secCount = 0;
        }
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    })();
  
    // ------------------------------- Loop ----------------------------------
  
    function tick(){
      tryWrapPort();
      render();
    }
  
    // Expose de petites aides
    window.__synthDiag = {
      snapshot(){
        return {
          ctx: window.__synth?.ctx?.state || '(n/a)',
          node: !!window.__synth?.node,
          vol: qs('#masterVol')?.value,
          seqBtn: qs('#seqBtn')?.textContent?.trim(),
          visibility: document.visibilityState,
          stepMs: +(stepDurationSec()*1000).toFixed(1),
          activeCells: qsa('.piano-roll .cell.active').length,
          activeCols: new Set(qsa('.piano-roll .cell.active').map(c=>c.dataset.col)).size,
          counts: {...state.counts},
          intervals: Object.fromEntries(Object.entries(state.intervals).map(([id,r])=>[id,{...r}]))
        };
      },
      reset(){
        Object.assign(state.counts, { noteOn_total:0, noteOn_beep:0, noteOn_seq:0, noteOn_diag:0, lastNoteOnMs:0 });
        state.lastMsg = null; render();
      },
      // pour forcer un tick de test
      testIntervalOnce(){ setInterval(()=>{}, 25); }
    };
  
    // Init
    function init(){
      ensurePanel();
      tick();
      setInterval(tick, POLL_MS);
      document.addEventListener('visibilitychange', render);
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
  