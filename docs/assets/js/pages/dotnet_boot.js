// /assets/js/pages/dotnet_boot.js
// FICHIER UNIQUE : Bootloader + Contrôleur .NET (PJAX + ouverture directe/F5).
// - Monte si [data-page="dotnet_demo"] **ou** si la modale/bouton (#app-modal / #open-app-modal) existe.
// - Iframe srcdoc isolé (CSP) + URL-Shim blindé (corrige about:srcdoc + bases invalides).
// - Idempotent, logs propres Firefox, safe avec PJAX (page-hub / pjax-router).
// - Correctifs :
//   * qs() robuste (root null toléré)
//   * Modale absente => injection automatique (robuste PJAX)
//   * Handlers en **délégation** sur document (zéro double-binding)
//   * Sonde latence configurable via window.API_PROBE_URL (404 OK) + intervalle adaptable (backoff)
//   * Journaux homogènes (Firefox-friendly)

(function (window, document) {
  'use strict';

  /* ─────────────────────────── Helpers communs ─────────────────────────── */

  const qs  = (sel, root=document) => (root || document).querySelector(sel);
  const on  = (el, ev, fn, opt)     => el && el.addEventListener(ev, fn, opt);
  const off = (el, ev, fn, opt)     => el && el.removeEventListener(ev, fn, opt);

  const thisScript = document.currentScript || (function () {
    const all = document.querySelectorAll('script[src]');
    return all[all.length - 1] || null;
  })();

  const APP_BASE_ABS = (function resolveAppBase() {
    const attr = thisScript?.dataset?.appBase || '/assets/portfolio/Projet_dotnet/';
    const u = new URL(attr, window.location.origin);
    let p = u.pathname;
    if (!p.endsWith('/')) p += '/';
    const abs = u.origin + p;
    try {
      console.log('%c[DotNetBoot]', 'background:#15202b;color:#7fd1ff;font-weight:700;padding:2px 6px;border-radius:3px',
                  'script =', thisScript?.getAttribute('src') || '(inline)', '| appBase =', abs);
    } catch {}
    window.DOTNET_APP_BASE = abs;
    return abs;
  })();

  /* ─────────────────────── Contrôleur: window.DotNetDemo ─────────────────────── */

  (function defineController(){
    const NS  = 'DotNetDemo';
    const API = { init, destroy, open, close, __mounted: false };
    let state = null;

    const TAG = '%c[DotNetDemo]';
    const CSS = 'background:#0b1f2a;color:#8bf0ff;font-weight:700;padding:2px 6px;border-radius:3px';
    const OK  = 'background:#0c2a1a;color:#77ffcc;font-weight:700;padding:2px 6px;border-radius:3px';
    const BAD = 'background:#2b1d1d;color:#ffb3b3;font-weight:700;padding:2px 6px;border-radius:3px';
    const LOG  = (...a) => console.log(TAG, CSS, ...a);
    const OKL  = (...a) => console.log(TAG, OK,  ...a);
    const BADL = (...a) => console.log(TAG, BAD, ...a);

    /* ============ Scroll lock ============ */
    function lockBodyScroll() {
      const b = document.body;
      const n = (parseInt(b.dataset._scrollLockCount||'0',10) || 0) + 1;
      b.dataset._scrollLockCount = String(n);
      if (n === 1) {
        b.dataset._prevOverflow = b.style.overflow || '';
        b.dataset._prevPaddingRight = b.style.paddingRight || '';
        const sw = window.innerWidth - document.documentElement.clientWidth;
        if (sw > 0) b.style.paddingRight = sw + 'px';
        b.style.overflow = 'hidden';
      }
    }
    function unlockBodyScroll() {
      const b = document.body;
      const n = Math.max(0, (parseInt(b.dataset._scrollLockCount||'0',10) || 1) - 1);
      b.dataset._scrollLockCount = String(n);
      if (n === 0) {
        b.style.overflow = b.dataset._prevOverflow || '';
        b.style.paddingRight = b.dataset._prevPaddingRight || '';
        delete b.dataset._prevOverflow; delete b.dataset._prevPaddingRight;
      }
    }

    /* ============ CSP dynamique ============ */
    function buildCSP() {
      const isHttp = location.protocol === 'http:';
      const SRC = (k, extras=[]) => {
        const base = ["'self'","'unsafe-inline'","https:"].concat(extras);
        return `${k} ${base.join(' ')};`;
      };
      const httpToken = isHttp ? ['http:'] : [];
      return [
        SRC('default-src', httpToken.concat(['data:','blob:'])),
        SRC('style-src',   httpToken.concat(['data:'])),
        SRC('script-src',  httpToken.concat(['blob:'])),
        SRC('connect-src', httpToken.concat(['data:','blob'])),
        SRC('img-src',     httpToken.concat(['data:','blob:'])),
        SRC('font-src',    httpToken.concat(['data:'])),
        "base-uri 'self';"
      ].join(' ');
    }

    /* ============ URL-Shim blindé ============ */
    function buildUrlShimInline() {
      return `
        (function(){
          const TAG='%c[DotNetDemo/URLShim]';
          const CSS='background:#133047;color:#b4f3ff;font-weight:700;padding:2px 6px;border-radius:3px';
          const ORIG_URL = URL;
          const hasScheme = s => typeof s==='string' && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s);
          const isRel     = s => typeof s==='string' && !hasScheme(s);
          function safeOrigin(str) {
            try { if (!str) return '';
              const u = new ORIG_URL(str, 'http://localhost');
              return (u.protocol && u.host) ? (u.protocol + '//' + u.host) : '';
            } catch { return ''; }
          }
          function baseFromParent() {
            try {
              const p = window.parent && window.parent.location ? window.parent.location : null;
              if (p && p.origin && p.origin !== 'null' && p.origin !== 'about:srcdoc') return p.origin;
              const ref = document.referrer ? safeOrigin(document.referrer) : '';
              if (ref) return ref;
              if (p && p.protocol && p.host) return p.protocol + '//' + p.host;
            } catch {}
            return '';
          }
          function baseProvider() {
            let api = '';
            try {
              api = (typeof window.API_BASE_URL==='string' && window.API_BASE_URL.trim()) ? window.API_BASE_URL.trim() : api;
              if (!api && typeof window.API_BASE==='string' && window.API_BASE.trim()) api = window.API_BASE.trim();
            } catch {}
            if (api) api = api.replace(/\\/+$/,'');
            if (!api) api = baseFromParent();
            if (!api) api = 'http://localhost';
            if (!hasScheme(api)) api = 'http://localhost';
            try { console.log(TAG, CSS, 'base =', api); } catch {}
            return api;
          }
          function isBadBase(b) {
            if (!b) return true;
            if (/^(about:|null$)/i.test(String(b))) return true;
            try { new ORIG_URL('/', b); return false; } catch { return true; }
          }
          const URLProxy = new Proxy(ORIG_URL, {
            construct(target, args) {
              try {
                try { console.log(TAG, CSS, 'args =', Array.from(args)); } catch {}
                if (args && args.length === 1 && isRel(args[0])) {
                  const api = baseProvider();
                  const u = new target(args[0], api);
                  try { console.log(TAG, CSS, '→', u.href); } catch {}
                  return u;
                }
                if (args && args.length >= 2) {
                  let base = args[1];
                  if (isBadBase(base)) {
                    base = baseProvider();
                    args[1] = base;
                    try { console.log(TAG, CSS, '(fix bad base) =', base); } catch {}
                  }
                  if (isRel(args[0])) return new target(args[0], base);
                  return new target(...args);
                }
                return new target(...args);
              } catch (e) {
                try { console.log(TAG, CSS, 'construct error', e); } catch {}
                try {
                  const fixed = new target(args && args[0] || '/', baseProvider());
                  try { console.log(TAG, CSS, 'fallback →', fixed.href); } catch {}
                  return fixed;
                } catch(e2){
                  try { console.log(TAG, CSS, 'fallback failed', e2); } catch {}
                  throw e;
                }
              }
            }
          });
          try { window.URL = URLProxy; console.log(TAG, CSS, 'activé'); } catch(e){ console.log(TAG, CSS, 'activation échouée', e); }
          try {
            const ORIG_Request = window.Request;
            window.Request = function(input, init) {
              if (typeof input === 'string' && isRel(input)) { input = new URLProxy(input).href; }
              return new ORIG_Request(input, init);
            };
            console.log(TAG, CSS, 'Request shim OK');
          } catch(e) { console.log(TAG, CSS, 'Request shim KO', e); }
        })();
      `;
    }

    /* ============ Iframe srcdoc (app Vue isolée) ============ */
    function buildSrcDoc() {
      const csp = buildCSP();
      const urlShim = buildUrlShimInline();
      const BASE = window.DOTNET_APP_BASE || APP_BASE_ABS;
      return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Démo .NET (iframe)</title>
    <link rel="stylesheet" href="${BASE}dist/assets/index-C7ORl4QR.css">
    <style>
      html,body { margin:0; padding:0; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#fafafa; color:#222; }
      #app { padding:.25rem; }
      .table-wrap { overflow:auto; -webkit-overflow-scrolling:touch; }
      table.sticky-first-col td:first-child, table.sticky-first-col th:first-child { position: sticky; left: 0; background: #fff; z-index: 1; }
    </style>
  </head>
  <body>
    <div id="app" aria-live="polite"></div>

    <!-- Helpers -->
    <script src="${BASE}config.js" charset="utf-8"></script>
    <script src="${BASE}normalize-requests.js" charset="utf-8"></script>

    <!-- URL Shim (AVANT le bundle) -->
    <script>
${urlShim}
    </script>

    <!-- Bundle Vite (Vue + app) -->
    <script type="module" src="${BASE}dist/assets/index-Bpjn-eMl.js"></script>

    <script>
      (function(){
        const TAG='%c[DotNetDemo/iframe]';
        const CSS='background:#10222d;color:#b0f0ff;font-weight:700;padding:2px 6px;border-radius:3px';
        console.log(TAG, CSS, 'Chargement iframe OK');
        window.__DotNetIframeReady__ = true;
      })();
    </script>
  </body>
</html>`;
    }

    /* ============ Tables responsives dans l’iframe ============ */
    function enhanceTables(doc) {
      try {
        const tables = doc.querySelectorAll('table:not([data-enhanced])');
        tables.forEach(t => {
          if (!t.parentElement.classList.contains('table-wrap')) {
            const wrap = doc.createElement('div');
            wrap.className = 'table-wrap';
            t.parentNode.insertBefore(wrap, t);
            wrap.appendChild(t);
          }
          t.classList.add('sticky-first-col');
          t.setAttribute('data-enhanced','1');
        });
      } catch(e) {
        BADL('enhanceTables error', e);
      }
    }

    /* ============ KPIs + Swagger ============ */
    function animateNumber(el, target, suffix, duration = 800) {
      const start = Number((el.textContent || '').replace(/[^\d.]/g,'')) || 0;
      const t0 = performance.now();
      function frame(ts){
        const t = Math.min(1,(ts - t0)/duration);
        const val = start + (target - start) * (0.5 - Math.cos(Math.PI*t)/2);
        el.textContent = (Math.round(val*100)/100) + (suffix||'');
        if (t < 1) requestAnimationFrame(frame); else { el.classList.add('kpi-pulse'); setTimeout(()=>el.classList.remove('kpi-pulse'),450); }
      }
      requestAnimationFrame(frame);
    }
    function initKPIs(root) {
      const testsEl  = qs('#kpi-tests', root);
      const upEl     = qs('#kpi-uptime', root);
      const dockerEl = qs('#kpi-docker', root);
      const testsTgt = (window.DOTNET_PROOFS && window.DOTNET_PROOFS.tests) || Number(testsEl?.dataset.target || 98.7);
      const upTgt    = (window.DOTNET_PROOFS && window.DOTNET_PROOFS.uptime30d) || Number(upEl?.dataset.target || 99.95);
      if (dockerEl && window.DOTNET_PROOFS?.dockerTag) dockerEl.textContent = window.DOTNET_PROOFS.dockerTag;
      if (testsEl) animateNumber(testsEl, testsTgt, testsEl.dataset.unit || '%', 700);
      if (upEl)    animateNumber(upEl,    upTgt,    upEl.dataset.unit    || '%', 900);
    }
    function initSwaggerLink(root) {
      const swaggerA = qs('#swagger-link', root);
      const API = (typeof window.API_BASE_URL === 'string' && window.API_BASE_URL.trim())
        ? window.API_BASE_URL.replace(/\/+$/,'')
        : ((typeof window.API_BASE === 'string' && window.API_BASE.trim()) ? window.API_BASE.replace(/\/+$/,'') : null);
      if (swaggerA) {
        const tail = (typeof window.API_PROBE_URL === 'string' && window.API_PROBE_URL.trim())
          ? window.API_PROBE_URL.trim()
          : '/swagger';
        swaggerA.href = API ? (API + tail) : '#';
        swaggerA.classList.toggle('disabled', !API);
        swaggerA.setAttribute('aria-disabled', API ? 'false' : 'true');
      }
    }

    /* ============ Latence (configurable + backoff) ============ */
    function measureLatencyLoop(root) {
      const API_BASE = (typeof window.API_BASE_URL === 'string' && window.API_BASE_URL.trim())
        ? window.API_BASE_URL.replace(/\/+$/,'')
        : ((typeof window.API_BASE === 'string' && window.API_BASE.trim()) ? window.API_BASE.replace(/\/+$/,'') : null);
      const el = qs('#kpi-latency', root);
      if (!el) return { stop: ()=>{} };

      const PROBE_PATH = (typeof window.API_PROBE_URL === 'string' && window.API_PROBE_URL.trim())
        ? window.API_PROBE_URL.trim() : '/swagger/index.html';

      function buildProbes(base){
        const b = base.replace(/\/+$/,'');
        // Probes réduites: uniquement endpoint API (HEAD + GET légère) et racine (HEAD)
        const endpoints = [PROBE_PATH, '/'];
        const uniq = Array.from(new Set(endpoints.map(p => b + (p.startsWith('/') ? p : ('/' + p)))));
        const out = [];
        // HEAD partout
        for (const u of uniq) out.push({ url: u, method: 'HEAD' });
        // GET uniquement sur PROBE_PATH (si différent de '/')
        const probeAbs = new URL(PROBE_PATH, b).href;
        if (!/\/$/.test(probeAbs)) out.push({ url: probeAbs, method: 'GET' });
        return out;
      }

      let timer = null;

      async function measureOnce() {
        if (!API_BASE) { el.textContent = '—'; return false; }
        const probes = buildProbes(API_BASE);
        for (const p of probes) {
          try {
            const t0 = performance.now();
            const res = await fetch(p.url, { method: p.method, mode: 'cors', cache: 'no-store' });
            const ms = Math.max(0, Math.round(performance.now() - t0));
            if (res && typeof res.status === 'number') {
              el.textContent = ms + (el.dataset.unit || 'ms');
              el.classList.add('kpi-pulse'); setTimeout(()=>el.classList.remove('kpi-pulse'),450);
              return true;
            }
          } catch { /* ignore */ }
        }
        el.textContent = '—';
        return false;
      }

      (async function loop(){
        const ok = await measureOnce();
        clearInterval(timer);
        timer = setInterval(measureOnce, ok ? 30000 : 20000);
      })();

      return { stop: ()=> clearInterval(timer) };
    }

    /* ============ Modale + iframe ============ */

    function ensureModalExists() {
      const existing = document.getElementById('app-modal');
      if (existing) return existing;

      const overlay = document.createElement('div');
      overlay.id = 'app-modal';
      overlay.className = 'modal-overlay';
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-hidden','true');

      overlay.innerHTML = `
        <div class="modal-shell" role="document" aria-labelledby="app-modal-title">
          <div class="modal-header d-flex align-items-center">
            <h3 id="app-modal-title" class="modal-title mb-0" tabindex="-1">Démo .NET – Interface</h3>
            <button type="button" id="close-app-modal" class="close-btn" aria-label="Fermer la fenêtre">&times;</button>
          </div>
          <div class="modal-body">
            <div id="iframe-wrap" class="app-host" aria-live="polite"></div>
          </div>
          <div class="modal-footer">
            <button type="button" id="close-app-modal-footer" class="btn btn-outline-secondary">Fermer</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      OKL('Modale injectée dynamiquement (#app-modal)');
      return overlay;
    }

    function initModalControls(root) {
      const overlay = document.getElementById('app-modal') || ensureModalExists();
      const closeA  = qs('#close-app-modal', overlay);
      const closeB  = qs('#close-app-modal-footer', overlay);
      const wrap    = qs('#iframe-wrap', overlay);

      const focusablesSelector = [
        'a[href]','area[href]','input:not([disabled])','select:not([disabled])',
        'textarea:not([disabled])','button:not([disabled])','iframe','object','embed',
        '[contenteditable]','[tabindex]:not([tabindex="-1"])'
      ].join(',');

      let lastFocused = null;
      let keydownHandler = null;
      let iframeEl = null;
      let moIframe = null;

      function trapFocus(e) {
        if (e.key !== 'Tab') return;
        const arr = Array.from(overlay.querySelectorAll(focusablesSelector));
        if (!arr.length) return;
        const first = arr[0], last = arr[arr.length-1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      function onOverlayClick(e) { if (e.target === overlay) closeModal(); }

      function injectIframe() {
        if (iframeEl) return iframeEl;
        iframeEl = document.createElement('iframe');
        iframeEl.id = 'dotnet-app-frame';
        iframeEl.title = 'Interface de démonstration .NET';
        iframeEl.setAttribute('aria-label','Interface de démonstration .NET');
        iframeEl.setAttribute('sandbox','allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-downloads');
        iframeEl.setAttribute('referrerpolicy','no-referrer-when-downgrade');
        iframeEl.style.width = '100%';
        iframeEl.style.height = '70vh';
        iframeEl.style.border = '0';

        iframeEl.srcdoc = buildSrcDoc();
        wrap && wrap.replaceChildren(iframeEl);

        on(iframeEl, 'load', () => {
          try {
            const idoc = iframeEl.contentDocument;
            if (!idoc) return;
            enhanceTables(idoc);
            moIframe = new MutationObserver(() => enhanceTables(idoc));
            moIframe.observe(idoc.body, { childList: true, subtree: true });
            state.moIframe = moIframe;
            OKL('iframe prêt → tables améliorées');
          } catch (e) {
            BADL('iframe load: amélioration tables impossible', e);
          }
        });

        return iframeEl;
      }

      function openModal() {
        lastFocused = document.activeElement;
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden','false');
        lockBodyScroll();
        injectIframe();
        const title = qs('#app-modal-title', overlay);
        if (title && title.focus) title.focus();
        keydownHandler = (e) => { if (e.key === 'Escape') { e.preventDefault(); closeModal(); } else { trapFocus(e); } };
        on(document, 'keydown', keydownHandler);
        on(overlay, 'click', onOverlayClick);
        OKL('Modale ouverte');
      }
      function closeModal() {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden','true');
        off(document, 'keydown', keydownHandler);
        off(overlay, 'click', onOverlayClick);
        keydownHandler = null;
        unlockBodyScroll();
        if (lastFocused && lastFocused.focus) lastFocused.focus();
        OKL('Modale fermée');
      }

      on(closeA,  'click', closeModal);
      on(closeB,  'click', closeModal);

      return { overlay, openModal, closeModal, wrap, get iframe(){ return iframeEl; } };
    }

    /* ============ API publique ============ */
    function open() {
      if (!state?.modalCtl) {
        state = state || {};
        state.modalCtl = initModalControls(state.root || (qs('main[data-pjax-root]') || document));
      }
      state.modalCtl.openModal();
    }
    function close() { state?.modalCtl?.closeModal?.(); }

    /* ============ INIT / DESTROY ============ */
    function init(root) {
      try {
        if (API.__mounted === true && state) { OKL('déjà initialisé — skip'); return; }
        if (state) destroy();

        if (!root) root = qs('main[data-pjax-root]') || document;

        // Safety: tagguer aussi si l’HTML ne l’avait pas (mais le bon fix est dans le HTML)
        document.body.setAttribute('data-page','dotnet_demo');
        const main = qs('main[data-pjax-root]');
        if (main) main.setAttribute('data-page','dotnet_demo');

        LOG('boot page…');
        initKPIs(root);
        initSwaggerLink(root);
        const latencyCtl = measureLatencyLoop(root);
        const modalCtl   = initModalControls(root);

        state = { root, modalCtl, latencyCtl, moIframe: null };
        API.__mounted = true;
        OKL('init OK');
      } catch (e) {
        BADL('init ERROR', e);
      }
    }

    function destroy() {
      if (!state) return;
      LOG('destroy…');
      try {
        state.latencyCtl && state.latencyCtl.stop && state.latencyCtl.stop();
        if (state.moIframe) { try { state.moIframe.disconnect(); } catch {} }
        const ov = state.modalCtl && state.modalCtl.overlay;
        if (ov && ov.classList.contains('show')) { try { ov.classList.remove('show'); } catch {}; unlockBodyScroll(); }
        if (document.body.getAttribute('data-page') === 'dotnet_demo') document.body.removeAttribute('data-page');
        const main = qs('main[data-pjax-root]');
        if (main && main.getAttribute('data-page') === 'dotnet_demo') main.removeAttribute('data-page');
      } catch (e) {
        BADL('destroy WARN', e);
      } finally {
        state = null;
        API.__mounted = false;
      }
    }

    window[NS] = API;
  })();

  /* ────────────────────────── Bootloader global ────────────────────────── */

  (function defineBoot(){
    const TAG = '%c[DotNetBoot]';
    const CSS = 'background:#15202b;color:#7fd1ff;font-weight:700;padding:2px 6px;border-radius:3px';
    const OK  = 'background:#10331f;color:#8bffc6;font-weight:700;padding:2px 6px;border-radius:3px';
    const BAD = 'background:#3b1e22;color:#ffb3c1;font-weight:700;padding:2px 6px;border-radius:3px';
    const LOG  = (...a) => console.log(TAG, CSS, ...a);
    const OKL  = (...a) => console.log(TAG, OK,  ...a);
    const BADL = (...a) => console.log(TAG, BAD, ...a);

    if (window.__DOTNET_BOOT_WIRED__) { try { OKL('déjà câblé — skip'); } catch {} return; }
    window.__DOTNET_BOOT_WIRED__ = true;

    let mounted = false;

    function hostHasDotnet() {
      if (qs('[data-page="dotnet_demo"]')) return true;
      if (document.getElementById('open-app-modal')) return true;
      if (document.getElementById('app-modal')) return true;
      return false;
    }

    async function mountIfNeeded() {
      try {
        if (!hostHasDotnet()) {
          if (mounted && window.DotNetDemo?.destroy) {
            try { window.DotNetDemo.destroy(); } catch {}
            mounted = false;
            OKL('destroy (page absente)');
          }
          return;
        }

        if (window.DotNetDemo?.__mounted === true) {
          mounted = true;
          OKL('déjà monté (aucune action)');
          return;
        }

        if (typeof window.DotNetDemo?.init === 'function') {
          const root = qs('main[data-pjax-root]') || document;
          window.DotNetDemo.init(root);
          mounted = true;
          OKL('init (page présente)');
        } else {
          BADL('DotNetDemo manquant');
        }
      } catch (e) {
        BADL('mountIfNeeded error', e);
      }
    }

    function onPjaxBefore() {
      if (mounted && window.DotNetDemo?.destroy) {
        try { window.DotNetDemo.destroy(); } catch {}
        mounted = false;
        OKL('destroy @pjax:before');
      }
    }
    function onPjaxReady() { mountIfNeeded(); }

    function waitMounted(cb){
      const go = () => (window.DotNetDemo?.__mounted === true) ? cb() : requestAnimationFrame(go);
      go();
    }

    // Délégation globale (PJAX-safe)
    function onDelegatedClick(e){
      const t = e.target;
      if (t && t.closest && t.closest('#open-app-modal')) {
        e.preventDefault();
        mountIfNeeded();
        waitMounted(() => {
          try {
            if (typeof window.DotNetDemo?.open === 'function') {
              window.DotNetDemo.open();
              OKL('ouverture modale (délégation)');
            } else {
              const overlay = document.getElementById('app-modal') || (function(){
                const ov = document.createElement('div');
                ov.id = 'app-modal';
                ov.className = 'modal-overlay';
                ov.setAttribute('role','dialog');
                ov.setAttribute('aria-modal','true');
                ov.setAttribute('aria-hidden','false');
                ov.classList.add('show');
                ov.innerHTML = '<div class="modal-shell"><div class="modal-body"><div id="iframe-wrap" class="app-host"></div></div></div>';
                document.body.appendChild(ov);
                return ov;
              })();
              overlay.classList.add('show');
              overlay.setAttribute('aria-hidden','false');
              OKL('ouverture modale (fallback)');
            }
          } catch(err){
            BADL('erreur ouverture déléguée', err);
          }
        });
      }
    }

    on(document, 'pjax:before', onPjaxBefore);
    on(document, 'pjax:ready',  onPjaxReady);
    on(document, 'click',       onDelegatedClick);

    if (document.readyState === 'loading') {
      on(document, 'DOMContentLoaded', () => mountIfNeeded());
    } else {
      mountIfNeeded();
    }

    console.log(TAG, CSS, 'bootloader prêt');
  })();

})(window, document);
