// assets/js/pjax-router.js
// PJAX minimal, robuste et compatible Bootstrap Collapse (navbar).
// - Remplace uniquement le contenu de main[data-pjax-root]
// - N'exécute PAS les <script> du fragment cible
// - Gère AbortController, historique, focus a11y, scroll control
// - Événements: pjax:before, pjax:beforeReplace, pjax:success, pjax:ready, pjax:complete, pjax:error
// - Synchronise <meta name="audio-policy">, les styles "page" (data-page-css),
//   les classes du <body> (sans 'preload'), l'attribut data-page du root PJAX,
//   et purge les backdrops/overlays modaux orphelins.
// - AUDIO global: lecture continue préservée par défaut entre pages "global" (data-audio="global").
//   - global→global : on NE pause pas le lecteur global (sauf si un cleanup externe le fait)
//   - global→local  : pause du global juste avant le swap
//   - local →global : reprise gérée par page-hub.js (snapshot/replay)

(() => {
  'use strict';

  /* ---------------- Debug & journalisation ---------------- */

  const DEBUG = (() => {
    try {
      return (localStorage.getItem('pjax:debug') === '1') || /\bpjaxdebug=1\b/i.test(location.search);
    } catch { return false; }
  })();

  const log   = (...args) => { if (DEBUG) console.log('[pjax-router]', ...args); };
  const info  = (...args) => { if (DEBUG) console.info('[pjax-router]', ...args); };
  const warn  = (...args) => { if (DEBUG) console.warn('[pjax-router]', ...args); };
  const error = (...args) => { console.error('[pjax-router]', ...args); };

  function setDebug(on) {
    try { localStorage.setItem('pjax:debug', on ? '1' : '0'); } catch {}
    info('debug set to', !!on);
  }

  /* ---------------- Correctif B : fetch natif sécurisé --------------- */

  const NATIVE_FETCH = (() => {
    try {
      const f = (window.fetch && (window.fetch.__orig || window.fetch));
      return f ? f.bind(window) : null;
    } catch { return null; }
  })();

  async function fetchFragment(url, signal) {
    const abs = new URL(url, location.href).href;
    const f = NATIVE_FETCH || window.fetch;
    if (typeof f !== 'function') throw new Error('fetch not available');
    const res = await f(abs, {
      method: 'GET',
      headers: {
        'X-PJAX': 'true',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'text/html, */*;q=0.9'
      },
      credentials: 'same-origin',
      cache: 'no-cache',
      signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  /* ------------------------- Constantes ------------------------- */

  const ROOT_SELECTOR = 'main[data-pjax-root]';

  // EXCLUSION: navigation "pleine page" (pas de PJAX) pour ces chemins
  const EXCLUDE_PATHS = [
    '/assets/portfolio/Projet_dotnet/',
    '/assets/portfolio/projet_musicam/',
    '/assets/portfolio/projet_synth/',
    '/assets/portfolio/projet_mac_val/',
    '/assets/portfolio/nuage_magique/',
    '/assets/portfolio/contact/',
    '/assets/portfolio/ehm/'
  ];

  // whitelist pages "visual-only"
  // Pages visuelles (reload léger) — conserver audio global
  // Parcours nécessite un boot complet (analytics + layout), ne pas le mettre ici.
  const VISUAL_ONLY_PAGES = new Set(['home','portfolio','contact']);

  let inflight = null; // AbortController en cours

  /* ------------------------- Utilitaires ------------------------ */

  const $root = () => document.querySelector(ROOT_SELECTOR);

  function fire(name, detail = {}) {
    try {
      document.dispatchEvent(new CustomEvent(name, { detail } ));
      log('event fired →', name, detail);
    } catch (e) {
      warn('event fire failed', name, e);
    }
  }

  function isSameOriginAbsolute(url) {
    try {
      const u = new URL(url, window.location.href);
      return u.origin === window.location.origin;
    } catch { return false; }
  }

  function shouldExcludeLink(a) {
    const reason = (r) => { info('skip PJAX (reason):', r, '| href=', a && a.getAttribute && a.getAttribute('href')); return true; };
    if (!a) return reason('no anchor');

    const href = a.getAttribute('href') || '';
    if (a.hasAttribute('data-no-pjax')) return reason('data-no-pjax');
    if (a.hasAttribute('download'))     return reason('download attribute');
    if (a.target && a.target.toLowerCase() === '_blank') return reason('target=_blank');
    if (href.startsWith('#'))           return reason('hash-only link');
    if (!isSameOriginAbsolute(href))    return reason('cross-origin');

    try {
      const u = new URL(href, window.location.href);
      if (u.pathname === window.location.pathname && u.hash) return reason('same-path anchor');
      if (EXCLUDE_PATHS.some(p => u.pathname.startsWith(p))) return reason('matches EXCLUDE_PATHS');
    } catch {
      return reason('URL parse error');
    }

    log('PJAX candidate →', href);
    return false;
  }

  // Retire récursivement les <script> et retourne un Fragment sûr.
  function safeFragmentFrom(rootEl) {
    const frag = document.createDocumentFragment();

    function cloneNodeSafe(node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return node.cloneNode(true);
      const tag = node.tagName.toLowerCase();
      if (tag === 'script') return null; // ignorer tous les <script>

      const clone = node.cloneNode(false);
      node.childNodes.forEach(ch => {
        const safe = cloneNodeSafe(ch);
        if (safe) clone.appendChild(safe);
      });
      return clone;
    }

    rootEl.childNodes.forEach(n => {
      const safe = cloneNodeSafe(n);
      if (safe) frag.appendChild(safe);
    });

    return frag;
  }

  /* ----------------------- Purge des modales ---------------------- */

  function purgeGlobalModals(opts = {}) {
    const { pauseAudio = false } = (opts instanceof Event ? {} : opts);
    info('purgeGlobalModals(pauseAudio=%s)', pauseAudio);

    try { window.closeAllModals?.(); } catch {}

    document.querySelectorAll('.modal-overlay, #cv-modal').forEach(el => {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
      const body = el.querySelector('.modal-body');
      if (body) body.innerHTML = '';
    });

    const wrapper = document.getElementById('responsiveWrapper');
    const audioModal = document.getElementById('audioPlayerModal');
    if (wrapper) {
      wrapper.classList.remove('is-open','open','show','active');
      wrapper.style.display = 'none';
      wrapper.setAttribute('aria-hidden','true');
    }
    if (audioModal){
      audioModal.classList.remove('is-open','show','open','active');
      audioModal.style.display='none';
      audioModal.setAttribute('aria-hidden','true');
    }

    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
    document.documentElement.style.removeProperty('overflow');

    document.querySelectorAll('.modal-backdrop, .offcanvas-backdrop').forEach(n => n.remove());

    if (pauseAudio) {
      try {
        const P = window.AudioApp || window.PlayerSingleton || window.playerSingleton || window.player || window.Player;
        if (P && typeof P.pause === 'function') {
          try { P.pause(); info('Global player paused via purgeGlobalModals'); } catch {}
        }
        const g = document.getElementById('audioPlayer');
        try { g?.pause?.(); } catch {}
      } catch (e) {
        warn('global audio pause failed in purgeGlobalModals', e);
      }
    }
  }

  /* ------------------------ Navbar helpers ------------------------ */

  function hardCloseNavbar() {
    const el = document.getElementById('main-navbar');
    if (!el) return;
    info('hardCloseNavbar()');

    try {
      const inst = window.bootstrap?.Collapse?.getOrCreateInstance(el, { toggle: false });
      inst?.hide?.();
    } catch {}

    el.classList.remove('collapsing', 'show');
    el.classList.add('collapse');
    el.style.height = '';

    const toggler = document.querySelector('.navbar-toggler');
    if (toggler) {
      toggler.classList.add('collapsed');
      toggler.setAttribute('aria-expanded', 'false');
    }
  }

  function rebindNavbarAutoClose() {
    const container = document.getElementById('main-navbar');
    if (!container) return;

    try { window.bootstrap?.Collapse?.getOrCreateInstance(container, { toggle: false }); } catch {}

    container.querySelectorAll('.nav-link').forEach(a => {
      if (a.__pjaxClose) a.removeEventListener('click', a.__pjaxClose, true);
      const fn = () => hardCloseNavbar();
      a.addEventListener('click', fn, { capture: true });
      a.__pjaxClose = fn;
    });
    info('rebindNavbarAutoClose() done');
  }

  /* --------------- HEAD / BODY sync helpers (page-scoped) ---------- */

  function syncAudioPolicyMetaFrom(doc) {
    const newPolicy = (doc.querySelector('meta[name="audio-policy"]')?.getAttribute('content') || 'allow').toLowerCase();
    let policyMeta = document.head.querySelector('meta[name="audio-policy"]');
    if (newPolicy === 'allow') {
      policyMeta?.remove();
      log('audio-policy → allow (meta removed)');
    } else {
      if (!policyMeta) {
        policyMeta = document.createElement('meta');
        policyMeta.setAttribute('name', 'audio-policy');
        document.head.appendChild(policyMeta);
      }
      policyMeta.setAttribute('content', newPolicy);
      log('audio-policy →', newPolicy);
    }
  }

  function syncPageScopedStylesFrom(doc) {
    document.head.querySelectorAll('style[data-page-css],link[rel="stylesheet"][data-page-css]').forEach(n => n.remove());
    const nodes = [...doc.head.querySelectorAll('style[data-page-css],link[rel="stylesheet"][data-page-css]')];
    nodes.forEach(n => document.head.appendChild(n.cloneNode(true)));
    log('page-scoped styles synced (count=', nodes.length, ')');
  }

  function syncBodyClassesFrom(doc) {
    const WHITELIST = new Set(['normal-header']);
    const BLOCKLIST = new Set(['preload', 'pjax-loading']);

    const newBody = doc.querySelector('body');
    if (!newBody) return;

    const keep = [...document.body.classList].filter(c => WHITELIST.has(c));
    const next = [...newBody.classList].filter(c => !BLOCKLIST.has(c));

    document.body.className = keep.concat(next.filter(c => !WHITELIST.has(c))).join(' ');
    log('body classes synced →', document.body.className);
  }

  // Injecte/remplace la modale CV globale (#cv-modal) pour garantir le contenu complet
  function syncGlobalCvModalFrom(doc) {
    try {
      const src = doc.getElementById('cv-modal');
      if (!src) return;
      const dst = document.getElementById('cv-modal');
      const isComplete = (el) => !!(el && el.querySelector('#cv-viewer'));
      if (!dst) {
        document.body.appendChild(src.cloneNode(true));
        log('cv-modal injected from target doc');
      } else if (!isComplete(dst) && isComplete(src)) {
        dst.replaceWith(src.cloneNode(true));
        log('cv-modal replaced with complete version from target doc');
      }
    } catch (e) { warn('syncGlobalCvModalFrom failed', e); }
  }

  // Injecte l'UI globale du lecteur audio (#responsiveWrapper) si absente,
  // en la recopiant depuis le document de destination (doc)
  function syncGlobalAudioUIFrom(doc) {
    try {
      const hasWrapper = !!document.getElementById('responsiveWrapper');
      const srcWrapper = doc.getElementById('responsiveWrapper');
      if (!hasWrapper && srcWrapper) {
        const clone = srcWrapper.cloneNode(true);
        document.body.appendChild(clone);
        log('global audio UI injected from target doc');
      }
    } catch (e) { warn('syncGlobalAudioUIFrom failed', e); }
  }

  function syncRootAttributes(container, newRoot) {
    const page = newRoot.getAttribute('data-page');
    if (page) {
      container.setAttribute('data-page', page);
      log('root data-page →', page);
    } else {
      container.removeAttribute('data-page');
      log('root data-page removed');
    }
  }

  /* ---------------- Teardown media avant remplacement (AUDIO-AWARE) ------- */

  function teardownMediaBeforeReplace({ pauseGlobalAudio = true } = {}) {
    try {
      const oldRoot = $root();
      if (!oldRoot) return;

      // (A) Vidéo cards
      oldRoot.querySelectorAll('.carte-lecteur-video').forEach(vCard => {
        try {
          vCard.querySelectorAll('video').forEach(v => {
            try { v.pause(); } catch {}
            try { delete v.__vc_init; } catch {}
          });
          delete vCard.dataset.videoInit;
        } catch (errInner) {
          warn('teardown video-card failed', errInner);
        }
      });

      // (B) Audios locaux
      oldRoot.querySelectorAll('.audio-player').forEach(player => {
        try {
          player.querySelectorAll('audio').forEach(a => { try { a.pause(); } catch {} });
          delete player.dataset.audioInit;
          const mejs = player.querySelector('.mejs-container');
          if (mejs) { try { mejs.remove(); } catch {} }
        } catch (inner) {
          warn('cleanup audio-player failed for an item', inner);
        }
      });

      // (C) Filets génériques
      document.querySelectorAll('video').forEach(v => { try { v.pause(); } catch {} });

      if (pauseGlobalAudio) {
        const P = window.AudioApp || window.PlayerSingleton || window.playerSingleton || window.player || window.Player;
        if (P && typeof P.pause === 'function') {
          try { P.pause(); info('Global player paused via teardown'); } catch {}
        }
        const g = document.getElementById('audioPlayer');
        try { g?.pause?.(); } catch {}
      }
    } catch (e) {
      warn('teardownMediaBeforeReplace error', e);
    }
  }

  /* ------------------ Extra : installer styles page-scoped depuis réponse -- */

  /**
   * installPageScopedCSSFromFragment(htmlString)
   * - robuste : parse la réponse via DOMParser (évite regex fragiles)
   * - supprime les anciens <style|link data-page-css> et clone les nouveaux dans <head>
   * - utilisé juste après injection du fragment dans le DOM (avant pjax:ready)
   */
  function installPageScopedCSSFromFragment(fragmentHTML) {
    try {
      if (!fragmentHTML || typeof fragmentHTML !== 'string') {
        log('installPageScopedCSSFromFragment: pas de html fourni');
        return;
      }

      // parse safely
      const parser = new DOMParser();
      const doc = parser.parseFromString(fragmentHTML, 'text/html');
      // S'assurer que la modale CV complète est présente
      try { syncGlobalCvModalFrom(doc); } catch {}
      // Avant tout, s'assurer que l'UI audio globale est présente
      try { syncGlobalAudioUIFrom(doc); } catch {}

      // collect new nodes
      const newNodes = [...doc.head.querySelectorAll('style[data-page-css],link[rel="stylesheet"][data-page-css]')];
      if (!newNodes.length) {
        log('installPageScopedCSSFromFragment: aucun style[data-page-css] trouvé dans la réponse');
        return;
      }

      // remove old scoped styles
      const old = [...document.head.querySelectorAll('style[data-page-css],link[rel="stylesheet"][data-page-css]')];
      old.forEach(n => { try { n.remove(); } catch (e) { /* silent */ } });
      log('installPageScopedCSSFromFragment: anciens styles retirés (count=', old.length, ')');

      // clone & append new ones
      let added = 0;
      newNodes.forEach(n => {
        try {
          const clone = n.cloneNode(true);
          document.head.appendChild(clone);
          added++;
        } catch (e) { warn('clone/append page-css failed', e); }
      });

      info('installPageScopedCSSFromFragment: styles installés (count=', added, ')');
    } catch (e) {
      warn('installPageScopedCSSFromFragment failed', e);
    }
  }

  /* ----------------------- Navigation principale ------------------------- */

  // helper: extract data-page from response HTML (string) — safe parse via DOMParser
  function pageNameFromResponse(html) {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const main = doc.querySelector('main[data-page]');
      if (main) return main.getAttribute('data-page');
    } catch (e) { /* ignore */ }
    return null;
  }

  async function pjaxNavigate(url, push = true) {
    const container = $root();
    if (!container) {
      warn('no PJAX root found; fallback to full navigation →', url);
      return window.location.assign(url);
    }

    if (inflight) inflight.abort();
    inflight = new AbortController();

    const t0 = (performance && performance.now) ? performance.now() : Date.now();
    try {
      document.documentElement.classList.add('pjax-loading');

      // Fermer le menu + PURGE globale AVANT fetch (sans toucher au son)
      hardCloseNavbar();
      purgeGlobalModals({ pauseAudio: false });

      fire('pjax:before', { url });

      info('navigate →', url);
      if (console.time) console.time('[pjax] fetch');
      const html = await fetchFragment(url, inflight.signal);
      if (console.timeEnd) console.timeEnd('[pjax] fetch');
      info('fetch OK', url, 'in', (((performance && performance.now) ? performance.now() : Date.now()) - t0).toFixed(1), 'ms');

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const newRoot = doc.querySelector(ROOT_SELECTOR);
      if (!newRoot) throw new Error('Racine PJAX introuvable dans la page cible');

      // --- Determine target page name and visual-only flag
      const targetPage = (newRoot.getAttribute && newRoot.getAttribute('data-page')) || pageNameFromResponse(html) || (new URL(url, location.href)).pathname.split('/').pop().replace('.html','');
      const isVisualOnly = !!(targetPage && VISUAL_ONLY_PAGES.has(targetPage));
      log('targetPage=', targetPage, 'isVisualOnly=', isVisualOnly);

      // HEAD / BODY sync (AVANT swap)
      syncAudioPolicyMetaFrom(doc);
      syncPageScopedStylesFrom(doc); // clones link/style[data-page-css] venant du <head> de la réponse (fallback)
      syncBodyClassesFrom(doc);
      // S'assurer que la modale CV complète est présente
      syncGlobalCvModalFrom(doc);
      syncRootAttributes(container, newRoot);

      // Politique audio source/destination
      const oldRoot = container;
      const oldPolicy = (oldRoot.getAttribute('data-audio') || 'global').toLowerCase();
      const newPolicy = (newRoot.getAttribute('data-audio') || 'global').toLowerCase();

      // Si la page est "visual-only", on PRESERVE l'audio global même si newPolicy !== 'global'
      const pauseGlobalAudio = (newPolicy !== 'global') && !isVisualOnly;
      info('audio policy:', { from: oldPolicy, to: newPolicy, pauseGlobalAudio, isVisualOnly });

      // Purge overlays juste avant le swap (sans toucher à l’audio)
      purgeGlobalModals({ pauseAudio: false });

      // Hook + teardown media avec le bon flag
      fire('pjax:beforeReplace', { url, container, newRoot, pauseGlobalAudio, isVisualOnly, targetPage });
      teardownMediaBeforeReplace({ pauseGlobalAudio });

      // Remplacement interne (sans scripts)
      const safeFrag = safeFragmentFrom(newRoot);
      container.replaceChildren(safeFrag);

      // --- IMPORTANT: installer les styles page-scoped extraits de la réponse brute
      // (utilise le HTML brut reçu pour capturer <style data-page-css> inline si présent)
      try {
        installPageScopedCSSFromFragment(html);
      } catch (e) { warn('installPageScopedCSSFromFragment call failed', e); }

      // Purge des overlays/backdrops orphelins (post-swap)
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop,.offcanvas-backdrop').forEach(n => n.remove());

      // Titre
      const newTitle = doc.querySelector('title');
      if (newTitle) document.title = newTitle.textContent || document.title;

      // Scroll & focus a11y
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      const h1 = container.querySelector('h1,h2,[role="heading"]');
      if (h1) { try { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); } catch {} }

      document.body.classList.remove('preload');

      fire('pjax:success', { url, container, stage: 'after-dom' });

      if (push) {
        try { history.pushState({ pjax: true, url }, '', url); } catch {}
      }

      // READY / COMPLETE -> fournir meta afin que les listeners puissent réagir
      fire('pjax:ready', { url, container, isVisualOnly, targetPage });
      fire('pjax:complete', { url, container, stage: 'after-pushState', isVisualOnly, targetPage });

      // Si page visual-only, appeler visualReload (ne pas re-init audio)
      if (isVisualOnly) {
        try {
          if (window.pageHub && typeof window.pageHub.visualReload === 'function') {
            info('calling pageHub.visualReload(', targetPage, ')');
            window.pageHub.visualReload(targetPage);
          } else {
            warn('visualReload non trouvé sur pageHub — fallback reinit visuelle manuelle');
            try {
              if (window.initIsotope) window.initIsotope();
              if (window.initMagicPhoto) window.initMagicPhoto();
            } catch(e){ console.error(e); }
          }
        } catch (e) {
          warn('visualReload failed', e);
        }
      }

      rebindNavbarAutoClose();

      info('navigate OK →', url, 'total', (((performance && performance.now) ? performance.now() : Date.now()) - t0).toFixed(1), 'ms');

    } catch (err) {
      if (err?.name !== 'AbortError') {
        error('Erreur PJAX:', err);
        fire('pjax:error', { url, error: String(err) });
        window.location.assign(url); // fallback full load
      } else {
        info('navigation aborted');
      }
    } finally {
      document.documentElement.classList.remove('pjax-loading');
      inflight = null;
    }
  }

  /* ------------------ Délégation clic sur liens internes (PJAX) ----------- */

  document.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const a = e.target.closest('a[href]');
    if (!a) return;
    if (shouldExcludeLink(a)) return;

    const href = a.getAttribute('href');
    if (!href) return;

    e.preventDefault();
    pjaxNavigate(href, true);
  }, { capture: true });

  /* ---------------------- Back/Forward ------------------------------- */

  window.addEventListener('popstate', (e) => {
    info('popstate', e.state);
    if (e.state && e.state.pjax && e.state.url) {
      pjaxNavigate(e.state.url, false);
    } else {
      pjaxNavigate(window.location.href, false);
    }
  });

  /* ------------------------- Init ---------------------------------- */

  document.addEventListener('DOMContentLoaded', () => {
    if (!$root()) {
      warn('no PJAX root on page; router idle');
      return;
    }

    try { history.scrollRestoration = 'manual'; } catch {}

    if (!history.state || !history.state.pjax) {
      try { history.replaceState({ pjax: true, url: window.location.href }, '', window.location.href); } catch {}
    }

    document.body.classList.remove('preload');

    rebindNavbarAutoClose();
    hardCloseNavbar();

    info('router ready. EXCLUDE_PATHS =', EXCLUDE_PATHS, 'VISUAL_ONLY_PAGES=', Array.from(VISUAL_ONLY_PAGES));
  });

  /* ----------------------- API publique ------------------------------ */

  window.PJAX = Object.freeze({
    go: (u) => pjaxNavigate(u, true),
    exclude: (p) => { EXCLUDE_PATHS.push(p); info('exclude added →', p); },
    closeNavbar: hardCloseNavbar,
    navigate: pjaxNavigate,
    debug: setDebug,
    // API pour gérer dynamiquement les pages visual-only
    addVisualOnly: (pageName) => { VISUAL_ONLY_PAGES.add(pageName); info('visual-only added →', pageName); },
    isVisualOnly: (pageName) => VISUAL_ONLY_PAGES.has(pageName),
    listVisualOnly: () => Array.from(VISUAL_ONLY_PAGES)
  });

  /* ---------------- Security hooks: purge on pjax:before (non visual) ----- */

  document.addEventListener('pjax:before', (ev) => {
    const detail = ev?.detail || {};
    if (detail.isVisualOnly) {
      info('pjax:before -> visual-only -> skip purgeGlobalModals');
      return;
    }
    purgeGlobalModals(detail);
  });

})();
// fin IIFE
