/* ============================================================================
   File: /assets/js/parcours-analytics-cloud.js
   (c) 2025 — Nuage de particules + Analytics (local + opt-in serveur)
   Idempotent, compatible PJAX, journaux propres (Firefox/Chromium)

   Dépendances DOM attendues (si présentes) :
   - #cloud-bg                            (container du canvas nuage)
   - #analyticsDashboard                  (panneau overlay)
   - #analyticsToggle, #analyticsClose    (btns)
   - #analyticsExportJson, #analyticsExportCsv
   - #analyticsTime, #analyticsSummary, #analyticsTop, #analyticsRaw
   - #analyticsScore, #analyticsScroll, #analyticsAudio, #analyticsTimeline
   - #analyticsConsent + #consentAccept / #consentReject
   - <main data-page="parcours">          (racine de la page Parcours)
   - #audioPlayer                         (lecteur global s’il existe)
============================================================================ */
(() => {
    'use strict';
  
    /* =======================
       Logger stylé & helpers
       ======================= */
    const TAG  = '%c[Parcours]';
    const CSS  = 'background:#0b1f26;color:#5bf0ff;font-weight:700;padding:2px 6px;border-radius:3px';
    const OK   = 'background:#0c2a1a;color:#77ffcc;font-weight:700;padding:2px 6px;border-radius:3px';
    const BAD  = 'background:#2b1d1d;color:#ffb3b3;font-weight:700;padding:2px 6px;border-radius:3px';
    const log  = (...a) => console.log(TAG, CSS, ...a);
    const info = (...a) => console.info(TAG, CSS, ...a);
    const warn = (...a) => console.warn(TAG, CSS, ...a);
    const err  = (...a) => console.error(TAG, CSS, ...a);
  
    const qs  = (s, r=document) => r.querySelector(s);
    const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  
    /* ====================================================
       1) Nuage de particules — Canvas 2D (fond transparent)
       ==================================================== */
    const Cloud = (() => {
      let rafId = null, canvas = null, ctx = null, particles = [], started = false;
      const CFG = { linkDist:110, maxSpeed:0.35, color:'rgba(255,255,255,0.55)', line:'rgba(77,163,255,0.15)' };
  
      function dim() {
        if (!canvas || !ctx) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth, h = canvas.clientHeight;
        canvas.width  = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
  
      function initParticles() {
        if (!canvas) return;
        particles.length = 0;
        const rect  = canvas.getBoundingClientRect();
        const count = Math.max(40, Math.round((rect.width * rect.height) / 12000));
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * rect.width,
            y: Math.random() * rect.height,
            vx: (Math.random() - 0.5) * CFG.maxSpeed * 2,
            vy: (Math.random() - 0.5) * CFG.maxSpeed * 2,
            r: 1 + Math.random() * 1.5
          });
        }
      }
  
      function step() {
        if (!canvas || !ctx) return;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = CFG.color;
  
        // points
        for (const p of particles) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
  
        // liens
        ctx.beginPath();
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i], b = particles[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const dist = Math.hypot(dx, dy);
            if (dist < CFG.linkDist) {
              const alpha = 1 - dist / CFG.linkDist;
              ctx.strokeStyle = `rgba(77,163,255,${(0.10 + alpha * 0.20).toFixed(2)})`;
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
            }
          }
        }
        ctx.stroke();
  
        rafId = requestAnimationFrame(step);
      }
  
      function start(container) {
        if (started || !container) return;
        canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        Object.assign(canvas.style, { position:'absolute', inset:0, background:'transparent' });
        container.appendChild(canvas);
        try {
          ctx = canvas.getContext('2d', { alpha:true, desynchronized:true });
        } catch {
          ctx = canvas.getContext('2d');
        }
        dim();
        initParticles();
  
        try {
          if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
            CFG.maxSpeed = 0.15; CFG.linkDist = 80;
          }
        } catch {}
  
        window.addEventListener('resize', onResize, { passive:true });
        document.addEventListener('visibilitychange', onVis, { passive:true });
  
        started = true;
        rafId = requestAnimationFrame(step);
        info('%cNuage démarré', OK);
      }
  
      function onResize(){ if (!canvas) return; dim(); initParticles(); }
      function onVis(){
        if (document.hidden) { cancelAnimationFrame(rafId); rafId = null; }
        else if (!rafId) { rafId = requestAnimationFrame(step); }
      }
  
      function stop() {
        if (!started) return;
        try { cancelAnimationFrame(rafId); } catch {}
        rafId = null;
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVis);
        try { canvas?.remove(); } catch {}
        canvas = null; ctx = null; particles.length = 0; started = false;
        info('%cNuage stoppé', OK);
      }
  
      return { start, stop };
    })();
  
    /* =========================================
       2) Analytics client — local + opt-in push
       ========================================= */
    const Analytics = (() => {
      const KEY_Q  = 'site_analytics_queue_v1';
      const KEY_ID = 'site_analytics_clientid_v1';
      const KEY_CS = 'site_analytics_consent_v1';
  
      const FLUSH_MS = 30000;
      const BATCH_N  = 50;
  
      let flushTimer = null, started = false;
      const state = {
        clientId   : getId(),
        sessionId  : uuid(),
        startAt    : Date.now(),
        interactions: 0,
        maxScroll  : 0,
        audioPlayed: false
      };
      const config = {
        endpoint : null,   // ex: '/collect' (serveur Node/Express)
        autoSend : false,
        openOnInit: true   // ouvre le dashboard au boot
      };
  
      /* ---------- utils ---------- */
      function uuid(){
        try {
          // Firefox/Chromium modernes
          if (crypto?.randomUUID) return crypto.randomUUID();
          // Fallback
          const r = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
          return `${r()}${r()}-${r()}-${r()}-${r()}-${r()}${r()}${r()}`;
        } catch {
          const r = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
          return `${r()}${r()}-${r()}-${r()}-${r()}-${r()}${r()}${r()}`;
        }
      }
      function nowIso(){ try { return new Date().toISOString(); } catch { return ''+Date.now(); } }
      function getId(){
        try {
          let x = localStorage.getItem(KEY_ID);
          if (!x) { x = uuid(); localStorage.setItem(KEY_ID, x); }
          return x;
        } catch {
          return uuid();
        }
      }
      function hasConsent(){ try { return localStorage.getItem(KEY_CS) === 'granted'; } catch { return false; } }
      function setConsent(v){ try { localStorage.setItem(KEY_CS, v ? 'granted' : 'denied'); } catch {} }
      function qRead(){ try { return JSON.parse(localStorage.getItem(KEY_Q) || '[]'); } catch { return []; } }
      function qWrite(list){ try { localStorage.setItem(KEY_Q, JSON.stringify(list.slice(-1000))); } catch {} }
      function qPush(ev){ const q = qRead(); q.push(ev); qWrite(q); }
  
      /* ---------- init ---------- */
      function init(opts = {}) {
        if (started) { rebindUI({ open: config.openOnInit }); return; }
        Object.assign(config, opts || {});
        started = true;
  
        setupConsent();
  
        track('page_view', {
          url     : location.pathname + location.search,
          title   : document.title,
          referrer: document.referrer
        });
  
        document.addEventListener('click', onClick, { capture:true });
        window.addEventListener('scroll', throttle(onScroll, 250), { passive:true });
  
        const audio = qs('#audioPlayer');
        if (audio) {
          audio.addEventListener('play',  () => { state.audioPlayed = true; track('audio_play'); }, { passive:true });
          audio.addEventListener('pause', () => track('audio_pause'), { passive:true });
          audio.addEventListener('ended', () => track('audio_end'),   { passive:true });
        }
  
        setupInView();
  
        // Heartbeat léger
        setInterval(() => {
          track('heartbeat', { uptimeSec: Math.round((Date.now() - state.startAt) / 1000) });
        }, 5000);
  
        // Déchargement : envoi opportuniste (sendBeacon ou fetch keepalive)
        const onUnload = () => {
          try {
            track('page_unload', {
              duration   : Math.round((Date.now() - state.startAt) / 1000),
              maxScroll  : state.maxScroll,
              interactions: state.interactions,
              audioPlayed: !!state.audioPlayed
            }, { persist:true });
  
            if (config.endpoint && hasConsent()) {
              // Tentative sendBeacon synchrone
              flushBeacon();
            }
          } catch {}
        };
        window.addEventListener('pagehide', onUnload, { capture:true });
        window.addEventListener('beforeunload', onUnload, { capture:true });
  
        // Auto-flush périodique si autorisé
        if (config.endpoint && hasConsent()) { config.autoSend = true; restartFlush(); }
  
        // UI dashboard (idempotent)
        installDashboard();
        if (config.openOnInit) {
          const dash = qs('#analyticsDashboard');
          if (dash) { dash.style.display = 'block'; updateDashboard(); }
        }
  
        info('%cAnalytics prêt', OK, { endpoint: config.endpoint || '(local only)', openOnInit: !!config.openOnInit });
      }
  
      function setupConsent(){
        const box = qs('#analyticsConsent'); if (!box) return;
        const decided = (() => { try { return localStorage.getItem(KEY_CS); } catch { return null; } })();
        if (!decided) box.style.display = 'flex';
  
        qs('#consentAccept')?.addEventListener('click', () => {
          setConsent(true); box.style.display = 'none';
          if (config.endpoint) { config.autoSend = true; restartFlush(); }
        });
        qs('#consentReject')?.addEventListener('click', () => {
          setConsent(false); box.style.display = 'none';
          config.autoSend = false;
        });
      }
  
      function restartFlush(){
        if (flushTimer) clearInterval(flushTimer);
        flushTimer = setInterval(() => { flushOnce().catch(()=>{}); }, FLUSH_MS);
      }
  
      function onClick(e){
        const el = e.target?.closest?.('a,button,[data-track]');
        if (!el) return;
        state.interactions++;
        track('click', {
          tag  : el.tagName,
          text : (el.innerText || el.title || el.alt || '').trim().slice(0,120),
          href : el.getAttribute('href') || null,
          track: el.dataset.track || null
        });
      }
  
      function onScroll(){
        const doc = document.documentElement;
        const sc = Math.round( (window.scrollY + window.innerHeight) / Math.max(1, doc.scrollHeight) * 100 );
        if (sc > state.maxScroll) state.maxScroll = sc;
        track('scroll', { pct: sc });
      }
  
      function setupInView(){
        try {
          const io = new IntersectionObserver((entries) => {
            entries.forEach(en => {
              if (en.isIntersecting) {
                track('inview', { id: en.target.id || en.target.className || 'section', ratio: en.intersectionRatio });
              }
            });
          }, { root:null, threshold:[0.25, 0.5, 0.9] });
          qsa('.parcours-hero, .timeline, .counters').forEach(el => io.observe(el));
        } catch {}
      }
  
      function track(type, data={}, opts={}){
        const ev = {
          id       : uuid(),
          clientId : state.clientId,
          sessionId: state.sessionId,
          type, ts : nowIso(),
          url      : location.pathname + location.search,
          title    : document.title,
          data
        };
        qPush(ev);
  
        // Envoi opportuniste si autorisé
        if (config.endpoint && config.autoSend && hasConsent()) {
          // Laisser le temps au DOM d’être réactif
          queueMicrotask?.(() => { flushOnce().catch(()=>{}); });
        }
  
        // Mise à jour UI non bloquante
        try { requestAnimationFrame(updateDashboard); } catch { updateDashboard(); }
      }
  
      async function flushOnce(){
        if (!config.endpoint || !hasConsent()) return;
        const q = qRead();
        if (!q.length) return;
  
        const batch = q.splice(0, BATCH_N);
        qWrite(q);
  
        try {
          const res = await fetch(config.endpoint, {
            method : 'POST',
            headers: { 'Content-Type':'application/json' },
            body   : JSON.stringify({ batch, meta:{ receivedAt: nowIso() } }),
            keepalive: true
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          info('%cFlush OK', OK, { sent: batch.length, left: q.length });
        } catch (e) {
          // ré-empile en tête
          const cur = qRead();
          qWrite(batch.concat(cur));
          warn('%cFlush FAIL (requeue)', BAD, e?.message || e);
        }
      }
  
      // Envoi « best effort » au déchargement (Firefox OK)
      function flushBeacon(){
        if (!config.endpoint || !hasConsent()) return;
        const q = qRead();
        if (!q.length) return;
        const batch = q.splice(0, Math.min(BATCH_N, q.length));
        qWrite(q);
  
        try {
          const payload = JSON.stringify({ batch, meta:{ receivedAt: nowIso(), beacon:true } });
          const ok = navigator.sendBeacon?.(config.endpoint, new Blob([payload], { type:'application/json' }));
          if (!ok) {
            // fallback synchrone (keepalive) — non bloquant pour Firefox
            fetch(config.endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:payload, keepalive:true }).catch(()=>{});
          }
          info('%cBeacon flush', OK, { sent: batch.length, left: q.length });
        } catch (e) {
          // Si échec, on remet tout en tête
          const cur = qRead();
          qWrite(batch.concat(cur));
          warn('%cBeacon FAIL (requeue)', BAD, e?.message || e);
        }
      }
  
      /* ---------- Dashboard overlay (idempotent, rebind PJAX-safe) ---------- */
      function installDashboard(){
        const dash = qs('#analyticsDashboard');
        if (!dash || dash.dataset.bound === '1') return;
        dash.dataset.bound = '1';
  
        const tgl  = qs('#analyticsToggle');
        const close= qs('#analyticsClose');
        const expJ = qs('#analyticsExportJson');
        const expC = qs('#analyticsExportCsv');
  
        tgl  && tgl.addEventListener('click', () => {
          dash.style.display = (dash.style.display === 'block' ? 'none' : 'block');
          updateDashboard();
        });
        close && close.addEventListener('click', () => { dash.style.display = 'none'; });
  
        expJ && expJ.addEventListener('click', () => {
          const blob = new Blob([JSON.stringify(qRead(), null, 2)], { type:'application/json' });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href = url; a.download = 'analytics-local.json'; a.click();
          URL.revokeObjectURL(url);
        });
  
        expC && expC.addEventListener('click', () => {
          const rows = qRead();
          const head = ['id','clientId','sessionId','type','ts','url','title','data'];
          const csv  = [head.join(',')].concat(
            rows.map(r => [ r.id, r.clientId, r.sessionId, r.type, r.ts,
                            JSON.stringify(r.url||''), JSON.stringify(r.title||''),
                            JSON.stringify(r.data||{}) ].map(csvCell).join(','))
          ).join('\n');
          const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href = url; a.download = 'analytics-local.csv'; a.click();
          URL.revokeObjectURL(url);
        });
  
        const time = qs('#analyticsTime');
        if (time) time.textContent = `Client ${state.clientId.slice(0,8)} · Session ${state.sessionId.slice(0,8)}`;
  
        info('%cDashboard lié', OK);
      }
  
      function csvCell(v){ const s = (typeof v === 'string') ? v : JSON.stringify(v); return `"${s.replace(/"/g,'""')}"`; }
      function fmtSec(s){ if (s < 60) return s + 's'; const m = Math.floor(s/60), r = s % 60; return `${m}m ${r}s`; }
      function scoreOf({ durationSec, interactions, maxScroll, audioPlayed }){
        const dur = Math.min(durationSec / 120, 1.0);
        const inter = Math.min(interactions / 12, 1.0);
        const scroll = Math.min(maxScroll / 100, 1.0);
        const audio = audioPlayed ? 1 : 0;
        return Math.round((dur*0.4 + inter*0.35 + scroll*0.2 + audio*0.05) * 100);
      }
      function topEvents(list, n=5){
        const map = Object.create(null);
        list.forEach(e => map[e.type] = (map[e.type]||0) + 1);
        return Object.entries(map).map(([type,count]) => ({ type, count }))
                   .sort((a,b)=>b.count-a.count).slice(0,n);
      }
  
      function drawTimeline(list){
        const c = qs('#analyticsTimeline'); if (!c) return;
        const ctx = c.getContext('2d', { willReadFrequently:false });
        const w = c.width, h = c.height;
        ctx.clearRect(0, 0, w, h);
        if (!list.length){
          ctx.fillStyle = '#eef2f7';
          ctx.fillRect(0, 0, w, h);
          return;
        }
        const times = list.map(e => +new Date(e.ts));
        const min = Math.min(...times), max = Math.max(...times), span = Math.max(1, max-min);
        const buckets = 12, counts = Array(buckets).fill(0);
        times.forEach(t => { const i = Math.min(buckets-1, Math.floor((t-min)/span*buckets)); counts[i]++; });
        const m = Math.max(...counts, 1);
  
        // aire
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let i = 0; i < buckets; i++) {
          const x = Math.round(i * w / (buckets - 1));
          const y = h - Math.round((counts[i] / m) * (h - 8)) - 4;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.closePath();
        ctx.fillStyle = 'rgba(13,110,253,0.12)';
        ctx.fill();
  
        // ligne
        ctx.beginPath();
        for (let i = 0; i < buckets; i++) {
          const x = Math.round(i * w / (buckets - 1));
          const y = h - Math.round((counts[i] / m) * (h - 8)) - 4;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#0d6efd';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
  
      function updateDashboard(){
        const q = qRead();
        const dur = Math.round((Date.now() - state.startAt) / 1000);
        const score = scoreOf({
          durationSec: dur,
          interactions: state.interactions,
          maxScroll: state.maxScroll,
          audioPlayed: state.audioPlayed
        });
  
        const sm = qs('#analyticsSummary');
        if (sm) {
          sm.innerHTML = `
            <div class="statCard"><div>Événements en file</div><div>${q.length}</div></div>
            <div class="statCard"><div>Interactions (session)</div><div>${state.interactions}</div></div>
            <div class="statCard"><div>Temps sur page</div><div>${fmtSec(dur)}</div></div>
          `;
        }
  
        const t = qs('#analyticsTop');
        if (t) {
          t.innerHTML = '';
          topEvents(q, 5).forEach(e => {
            const li = document.createElement('li');
            li.textContent = `${e.type} — ${e.count}`;
            t.appendChild(li);
          });
        }
  
        const raw = qs('#analyticsRaw');
        if (raw) raw.textContent = q.slice(-40).map(e => `${e.ts} ${e.type} ${JSON.stringify(e.data||{})}`).join('\n');
  
        const sc = qs('#analyticsScore');  if (sc) sc.textContent = `${score}/100`;
        const ms = qs('#analyticsScroll'); if (ms) ms.textContent = state.maxScroll + '%';
        const au = qs('#analyticsAudio');  if (au) au.textContent = state.audioPlayed ? 'Oui' : 'Non';
  
        drawTimeline(q);
      }
  
      /* ---------- API utilitaire pour PJAX / modules ---------- */
      function rebindUI({ open = false } = {}){
        installDashboard();   // relie les nouveaux nœuds (idempotent)
        updateDashboard();    // rafraîchit l’affichage
        if (open) {
          const dash = qs('#analyticsDashboard');
          if (dash) dash.style.display = 'block';
        }
      }
  
      // Rebind auto après remplacement PJAX
      window.addEventListener('pjax:ready', () => {
        const dash = qs('#analyticsDashboard');
        if (dash) rebindUI({ open: config.openOnInit });
      });
  
      /* ---------- export ---------- */
      return { init, track, state, config, rebindUI };
    })();
  
    /* ====================================
       3) Boot (PJAX-friendly) + Compteurs
       ==================================== */
    function animateCounters(){
      qsa('.counter-card .value').forEach(el => {
        const target = Number(el.dataset.target) || 0;
        const duration = 1200;
        const start = performance.now();
        function step(now){
          const t = Math.min(1, (now - start) / duration);
          const eased = t * (2 - t); // easeOutQuad
          el.textContent = Math.round(target * eased);
          if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }
  
    function bootOnce(){
      const root = qs('main[data-page="parcours"]');
      if (!root) return;
  
      // Nuage
      const cloudContainer = qs('#cloud-bg');
      if (cloudContainer) Cloud.start(cloudContainer);
  
      // Analytics — local only par défaut (endpoint null) + ouverture immédiate
      Analytics.init({ endpoint: null, openOnInit: true });
  
      // Métriques animées
      animateCounters();
  
      log('bootOnce() OK');
    }
  
    function teardown(){
      Cloud.stop();
      log('teardown() OK');
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootOnce, { once:true });
    } else {
      bootOnce();
    }
    window.addEventListener('pjax:beforeReplace', teardown);
    window.addEventListener('beforeunload', teardown);
  
    // Facades utiles en debug / via console
    window.ParcoursAnalytics = Analytics;
    window.ParcoursCloud     = Cloud;
  
    /* ======================
       Utilitaires génériques
       ====================== */
    function throttle(fn, wait){
      let last = 0, t;
      return function throttled(){
        const now = Date.now();
        if (now - last > wait) {
          last = now;
          fn.apply(this, arguments);
        } else {
          clearTimeout(t);
          t = setTimeout(() => {
            last = Date.now();
            fn.apply(this, arguments);
          }, wait - (now - last));
        }
      };
    }
  })();
  