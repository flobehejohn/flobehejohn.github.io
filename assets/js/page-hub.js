// /assets/js/page-hub.js  (auto-load ESM /assets/js/pages/<page>.js + guards vidéo + visualReload)
// Version patchée — inclut visualReload qui effectue un "reinit visuel only" sans perturber l'audio.
//
// Conventions :
// - main[data-pjax-root] doit exister
// - chaque page peut exposer data-page et data-audio sur <main>
// - les modules ESM chargés sont mis en cache dans window.__PAGE_MODULES__ pour un destroy propre

(() => {
  'use strict';

  // ===================== Logger =================================================
  const TAG = '%c[page-hub]';
  const CSS = 'background:#111;color:#0ff;padding:1px 6px;border-radius:3px;font-weight:600';
  const log  = (...args) => console.log(TAG, CSS, ...args);
  const info = (...args) => console.info(TAG, CSS, ...args);
  const warn = (...args) => console.warn(TAG, CSS, ...args);
  const err  = (...args) => console.error(TAG, CSS, ...args);
  const dbg  = (...args) => console.debug(TAG, CSS, ...args);

  // === État/flags globaux sûrs ================================================
  window.__PAGE_HUB__ = (typeof window.__PAGE_HUB__ === 'object' && window.__PAGE_HUB__) || {};
  window.__PAGE_HUB__.loaded = true;

  // Cache des modules ESM chargés par page (pour destroy propre)
  window.__PAGE_MODULES__ = window.__PAGE_MODULES__ || Object.create(null);

  // Exposition de pageHub (API légère) — garantis l'objet existe
  window.pageHub = window.pageHub || {};

  // Purge des styles page-scoped avant navigation pour éviter la contamination inter-pages
  try {
    document.addEventListener('pjax:before', () => {
      try {
        const scoped = document.head.querySelectorAll('link[rel="stylesheet"][data-page-css], style[data-page-css]');
        scoped.forEach(n => { try { n.remove(); } catch {} });
        dbg('page-scoped CSS purged before PJAX');
      } catch (e) { warn('failed to purge page-scoped CSS', e); }
    }, { passive: true });
  } catch (e) { /* non-fatal */ }

  let currentPage = null;
  let synthModule = null;

  const getContainer = () => {
    const el = document.querySelector('main[data-pjax-root]');
    if (!el) warn('container PJAX introuvable: main[data-pjax-root]');
    return el;
  };

  // -------- helpers: nommage module dynamique (UMD global) --------------------
  const pascalize = (s) =>
    String(s || '')
      .split(/[-_]+/g)
      .filter(Boolean)
      .map(tok => tok.charAt(0).toUpperCase() + tok.slice(1))
      .join('');

  function resolveModule(pageName) {
    if (!pageName) return null;
    const capFirst = pageName.charAt(0).toUpperCase() + pageName.slice(1);
    const pascal   = pascalize(pageName);
    const camel    = pascal.charAt(0).toLowerCase() + pascal.slice(1);
    const alt1     = `${pageName}Page`;
    const alt2     = `${pascal}Page`;

    const names = [capFirst, pageName, pascal, camel, alt1, alt2];
    for (const key of names) {
      const mod = window[key];
      if (mod && typeof mod.init === 'function') {
        dbg('module (UMD) détecté →', key);
        return mod;
      }
    }
    return null;
  }

  // -------- Base styles guard (keeps core CSS present + minimal visual reset) --
  async function ensureBaseStyles(container = document) {
    try {
      // Remove accidental 'preload' flags left by some pages
      try { document.body?.classList?.remove('preload'); } catch {}

      // Ensure core CSS are present (avoid aggressive reordering to prevent flashes)
      const head = document.head || document.getElementsByTagName('head')[0];
      const need = [
        '/assets/css/theme.min.css',
        '/assets/css/swatch.bundle.css',
        '/assets/fonts/fontawesome/css/all.min.css',
        '/assets/css/fixes.css',
        '/assets/css/style_audio_player.css',
        '/assets/css/skill-card-modal.css'
      ];
      need.forEach(href => {
        try {
          const exists = !!Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .find(l => (l.getAttribute('href')||'').endsWith(href));
          if (!exists) {
            const l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = href;
            l.setAttribute('data-base-style','1');
            head.appendChild(l);
          }
        } catch {}
      });

      // (skill-cards init déplacé dans pjax:ready pour garantir l'ordre avec cv-modal)
    } catch (e) {
      warn('ensureBaseStyles failed', e);
    }
  }

  // -------- helper: robust loader with fallbacks (forces order) ---------------
  function needScript(srcOrList, testFn, { module = false } = {}) {
    const urls = Array.isArray(srcOrList) ? srcOrList : [srcOrList];

    try {
      if (typeof testFn === 'function' && testFn()) {
        dbg('needScript: déjà satisfait → skip load');
        return Promise.resolve(true);
      }
    } catch {}

    const tryOne = (idx) => new Promise((resolve, reject) => {
      if (idx >= urls.length) return reject(new Error('all sources failed'));

      const base = urls[idx];
      const src  = base + (base.includes('?') ? '&' : '?') + 'v=' + Date.now();
      const s = document.createElement('script');
      s.src = src;
      if (module) s.type = 'module';
      s.async = false;

      dbg('needScript: tentative', { idx, src });

      s.onload = () => {
        try {
          if (!testFn || testFn()) {
            info('script chargé ✔', src);
            return resolve(true);
          }
        } catch {}
        s.remove();
        tryOne(idx + 1).then(resolve, reject);
      };

      s.onerror = () => {
        warn('échec chargement script ✖', src);
        s.remove();
        tryOne(idx + 1).then(resolve, reject);
      };

      document.head.appendChild(s);
    });

    return tryOne(0).catch((e) => {
      warn('load failed:', urls, e);
      return false;
    });
  }

  // -------- helper: wait for selector (exists + optional child check) ---------
  function waitForSelector(selector, { root = document, hasChild = null, timeout = 2500 } = {}) {
    const t0 = (performance && performance.now) ? performance.now() : Date.now();
    return new Promise((resolve) => {
      function ok(el) {
        if (!el) return false;
        if (typeof hasChild === 'string')   return !!el.querySelector(hasChild);
        if (typeof hasChild === 'function') return !!hasChild(el);
        return true;
      }
      (function tick() {
        const scope = (root instanceof Element ? root : document);
        const el = scope.querySelector(selector);
        if (ok(el)) return resolve(el);
        const now = (performance && performance.now) ? performance.now() : Date.now();
        if (now - t0 > timeout) {
          warn('waitForSelector timeout:', selector, { root, timeout });
          return resolve(null);
        }
        requestAnimationFrame(tick);
      })();
    });
  }

  // -------- Audio arbiter -----------------------------------------------------
  function applyAudioArbiter(container) {
    const root  = (container instanceof Element) ? container : getContainer();
    if (!root) return;
    const policy = (root.getAttribute('data-audio') || 'global').toLowerCase();
    const audio  = document.getElementById('audioPlayer');

    const FORCED_KEY = 'audioForcedState';

    function snapshotAndPause(el){
      try {
        const wasPlaying = el && !el.paused && !el.ended && (el.currentTime||0) > 0;
        const snap = { src: el?.currentSrc || el?.src || '', t: el?.currentTime || 0, wasPlaying: !!wasPlaying };
        sessionStorage.setItem(FORCED_KEY, JSON.stringify(snap));
        info('audio snapshot saved →', snap);
      } catch {}
      try {
        const P = window.AudioApp || window.PlayerSingleton || window.player || window.Player;
        if (P?.pause) { P.pause(); info('Global player paused (snapshotAndPause)'); }
        el?.pause?.();
      } catch {}
    }

    async function resumeIfSnap(el){
      let raw = null; try { raw = sessionStorage.getItem(FORCED_KEY); } catch {}
      if (!raw) return;
      let s = null;   try { s = JSON.parse(raw); } catch {}
      if (!s?.wasPlaying) {
        try { sessionStorage.removeItem(FORCED_KEY); } catch {}
        dbg('no resume: snapshot says wasPlaying=false');
        return;
      }
      try {
        if (s.src && el && el.src !== s.src) {
          el.src = s.src;
          dbg('audio src restored →', s.src);
        }
        if (el && s.t) {
          el.currentTime = s.t;
          dbg('audio time restored →', s.t);
        }
        await el?.play?.().catch(()=>{});
        info('audio resumed from snapshot ✔');
      } finally {
        try { sessionStorage.removeItem(FORCED_KEY); } catch {}
      }
    }

    if (policy === 'local') {
      if (audio) snapshotAndPause(audio);
      else {
        try {
          (window.AudioApp||window.PlayerSingleton||window.player||window.Player)?.pause?.();
          info('Global player paused (no #audioPlayer, policy=local)'); 
        } catch {}
      }
    } else {
      try { if (audio) audio.muted = false; } catch {}
      resumeIfSnap(audio);
    }
  }

  // -------- Teardown générique -----------------------------------------------
  async function teardown(page) {
    if (!page) return;
    info('teardown page =', page);

    // Cas spécifiques existants
    if (page === 'synth_fm' && synthModule) {
      try { synthModule.destroy?.(); info('synth_fm destroy ✔'); } catch {}
      synthModule = null;
    }
    if (page === 'home') {
      try { (window.teardownSkillGrid || window.SkillGrid?.teardown)?.(); } catch {}
      try { window.teardownSkillCards?.();   } catch {}
      try { window.teardownMagicPhoto?.();   } catch {}
      try { window.teardownAnimatedText?.(); } catch {}
      try { window.teardownMagicCards?.();   } catch {}
    }
    if (page === 'smart_city') {
      try { window.SmartCity?.destroy?.(); } catch {}
    }
    if (page === 'nuage_magique') {
      try { window.NuageMagique?.destroy?.(); } catch {}
    }

    // Teardown du module ESM s’il existe
    const esm = window.__PAGE_MODULES__[page];
    if (esm && typeof esm.destroy === 'function') {
      try { await esm.destroy(); info(`destroy() module ESM "${page}" ✔`); } catch (e) { warn('destroy ESM error', e); }
    }
    delete window.__PAGE_MODULES__[page];

    // Fallback UMD global éventuel
    try {
      const mod = resolveModule(page);
      if (mod && typeof mod.destroy === 'function') {
        try { await mod.destroy(); info('destroy() module page dynamique ✔'); } catch {}
      }
    } catch {}
  }

  // -------- HOME --------------------------------------------------------------
  async function bootHome(container) {
    info('boot home…');
    const gridEl = await waitForSelector('.grid-wrapper', { root: container, hasChild: '.grid-item', timeout: 3000 });
    if (!gridEl) { warn('.grid-wrapper introuvable (ou vide) → abandon init Isotope'); return; }

    await needScript(
      ['/assets/vendor/imagesloaded.pkgd.min.js', 'https://unpkg.com/imagesloaded@5/imagesloaded.pkgd.min.js'],
      () => typeof window.imagesLoaded === 'function'
    );
    await needScript(
      ['/assets/vendor/isotope.pkgd.min.js', 'https://unpkg.com/isotope-layout@3/dist/isotope.pkgd.min.js'],
      () => typeof window.Isotope !== 'undefined'
    );

    await needScript('/assets/js/isotope-skill-grid.js', () =>
      (typeof window.initSkillGrid === 'function') || (window.SkillGrid && typeof window.SkillGrid.init === 'function')
    );
    await needScript('/assets/js/skill-card.js',                () => typeof window.initSkillCards      === 'function');
    await needScript('/assets/js/magic-photo.js',               () => typeof window.initMagicPhoto      === 'function');
    await needScript('/assets/js/animated-text.js',             () => typeof window.initAnimatedText    === 'function');
    await needScript('/assets/js/carte_magique/magic-cards.js', () => typeof window.initMagicCards      === 'function');

    try { (window.initSkillGrid || window.SkillGrid?.init)?.(container); } catch (e) { warn(e); }
    try { window.initSkillCards?.(container); }                             catch (e) { warn(e); }
    try { window.initMagicPhoto?.(container); }                             catch (e) { warn(e); }
    try { window.initAnimatedText?.(container); }                           catch (e) { warn(e); }
    try { window.initMagicCards?.(container); }                             catch (e) { warn(e); }

    requestAnimationFrame(() => {
      const g = container.querySelector('.grid-wrapper') || document.querySelector('.grid-wrapper');
      const iso = g?.__iso;
      try {
        g?.querySelectorAll('.grid-item[style*="display"]').forEach(el => { if (el.style.display === 'none') el.style.removeProperty('display'); });
        iso?.arrange?.({ filter: '*' }); iso?.layout?.();
      } catch {}
    });

    try {
      const grid = container.querySelector('.grid-wrapper');
      if (grid && typeof window.imagesLoaded === 'function') {
        window.imagesLoaded(grid, () => {
          const iso = grid.__iso;
          try { iso?.arrange?.({ filter: '*' }); iso?.layout?.(); } catch {}
        });
      }
    } catch {}
  }

  // -------- Synth (existant) --------------------------------------------------
  async function bootSynth(container) {
    try {
      const mod = await import('/assets/js/synth_fm/main_synth_fm.js?v=' + Date.now());
      synthModule = mod;
      (mod.init || mod.default)?.(container);
      info('synth_fm chargé ✔');
    } catch (e) {
      err('Échec chargement synth_fm:', e);
    }
  }

  // -------- Portfolio (existant) ----------------------------------------------
  async function bootPortfolio(container) {
    info('boot portfolio…');
    await needScript(
      ['/assets/vendor/imagesloaded.pkgd.min.js', 'https://unpkg.com/imagesloaded@5/imagesloaded.pkgd.min.js'],
      () => typeof window.imagesLoaded === 'function'
    );
    await needScript(
      ['/assets/vendor/isotope.pkgd.min.js', 'https://unpkg.com/isotope-layout@3/dist/isotope.pkgd.min.js'],
      () => typeof window.Isotope !== 'undefined'
    );

    if (typeof window.initPortfolio !== 'function' && typeof window.initPortfolioGrid !== 'function') {
      await needScript('/assets/js/portfolio-grid.js', () =>
        (typeof window.initPortfolio === 'function') || (typeof window.initPortfolioGrid === 'function')
      );
    }
    try { (window.initPortfolio || window.initPortfolioGrid)?.(container); } catch (e) { warn(e); }
  }

  // -------- Smart City (existant) ---------------------------------------------
  async function bootSmartCity(container) {
    await needScript(
      ['/assets/js/pages/smart_city.js', '/assets/js/smart_city.js'],
      () => window.SmartCity && typeof window.SmartCity.init === 'function'
    );
    try { window.SmartCity?.init?.(container); info('smart_city init ✔'); } catch (e) { warn('smart_city init error', e); }
  }

  // -------- Nuage Magique (existant) ------------------------------------------
  async function bootNuageMagique(container) {
    await needScript(
      ['/assets/js/pages/nuage_magique.js'],
      () => window.NuageMagique && typeof window.NuageMagique.boot === 'function'
    );
    try { window.NuageMagique?.boot?.(container); info('nuage_magique boot ✔'); } catch (e) { warn('nuage_magique boot error', e); }
  }

  // -------- NEW: chargé ESM d'une page ----------------------------------------
  async function loadPageModuleESM(pageName) {
    const url = `/assets/js/pages/${pageName}.js`;
    try {
      dbg('ESM import tentative →', url);
      const mod = await import(url);
      let api = null;
      if (typeof mod?.init === 'function') api = mod;
      else if (typeof mod?.default === 'function') api = { init: mod.default, destroy: mod.destroy || mod.default?.destroy };
      else if (mod?.default && typeof mod.default?.init === 'function') api = mod.default;

      if (api && typeof api.init === 'function') {
        window.__PAGE_MODULES__ = window.__PAGE_MODULES__ || Object.create(null);
        window.__PAGE_MODULES__[pageName] = api;
        info(`module ESM "${pageName}" importé ✔`);
        return api;
      }
      warn(`module ESM "${pageName}" importé mais API init absente → fallback`);
      return null;
    } catch (e) {
      dbg(`ESM import échoué pour "${pageName}" (ok: on tentera UMD)`, e);
      return null;
    }
  }

  // -------- Router ------------------------------------------------------------
  async function bootFor(container) {
    if (!container) return;

    let page = container.getAttribute('data-page');
    if (!page) {
      const mark = container.querySelector('[data-page]');
      if (mark) {
        page = mark.getAttribute('data-page');
        try { container.setAttribute('data-page', page); } catch {}
        info('data-page récupéré depuis enfant →', page);
      }
    }
    page = page || null;

    if (currentPage) await teardown(currentPage);
    currentPage = page;

    if (!page) {
      warn('page sans data-page: aucun boot exécuté');
      return;
    }

    info('bootFor page =', page);
    try { await ensureBaseStyles(container); } catch {}

    // Pages connues
    if (page === 'synth_fm')      return bootSynth(container);
    if (page === 'home')          return bootHome(container);
    if (page === 'portfolio')     return bootPortfolio(container);
    if (page === 'smart_city')    return bootSmartCity(container);
    if (page === 'nuage_magique') return bootNuageMagique(container);

    // ========== NEW: STRATÉGIE ESM-FIRST POUR TOUTE AUTRE PAGE ===============
    try {
      const api = await loadPageModuleESM(page);
      if (api && typeof api.init === 'function') {
        try { await api.init(container); info(`init() module ESM "${page}" ✔`); } catch (e) { warn('init ESM error', e); }
        return;
      }
    } catch (e) {
      warn('exception boot ESM (continuation fallback UMD)', e);
    }

    try {
      const ok = await needScript(
        [`/assets/js/pages/${page}.js`, `/assets/js/${page}.js`],
        () => !!resolveModule(page),
        { module: false }
      );

      if (!ok) {
        warn('aucun script de page trouvé pour', page, '(fallback silencieux)');
      } else {
        const mod = resolveModule(page);
        if (mod && typeof mod.init === 'function') {
          try { await mod.init(container); info(`init() module UMD "${page}" ✔`); return; }
          catch (e) { warn('erreur init() module UMD:', page, e); }
        } else {
          dbg('module UMD non exposé (init absent?) pour', page);
        }
      }
    } catch (e) {
      warn('exception bootFor (fallback UMD)', e);
    }
  }

  // -------- VIDEO CARDS: loader, init, teardown helpers -----------------------
  async function ensureVideoCardLoaded() {
    if (typeof window.initSingleVideoCard === 'function') return true;

    try {
      const mod = await import('/assets/js/components/video-card.js?v=' + Date.now());
      if (mod) {
        if (typeof mod.initSingleVideoCard === 'function') {
          window.initSingleVideoCard = mod.initSingleVideoCard;
          return true;
        }
        if (typeof mod.default === 'function') {
          window.initSingleVideoCard = mod.default;
          return true;
        }
      }
    } catch { /* ignore -> fallback script classique */ }

    await needScript('/assets/js/components/video-card.js', () => typeof window.initSingleVideoCard === 'function');
    return typeof window.initSingleVideoCard === 'function';
  }

  async function initPageVideoCards(container = document) {
    try {
      const ok = await ensureVideoCardLoaded();
      if (!ok) { warn('initPageVideoCards : impossible de charger components/video-card.js'); return; }

      const root = (container instanceof Element) ? container : document;
      const nodes = root.querySelectorAll('.carte-lecteur-video');
      nodes.forEach(node => {
        if (node.dataset.videoInit === '1') return; // Guard anti double-init
        node.dataset.videoInit = '1';

        try {
          if (typeof window.initSingleVideoCard === 'function') {
            window.initSingleVideoCard(node);
          } else {
            const mediaWrap = node.querySelector('.carte-lecteur-video-media');
            const video = mediaWrap?.querySelector('video');
            if (video) {
              const onClick = async (e) => {
                e.preventDefault(); e.stopPropagation();
                try { if (video.paused) await video.play(); else video.pause(); } catch {}
              };
              mediaWrap?.addEventListener('click', onClick, { passive: false });
            }
          }
        } catch (errInner) {
          warn('initPageVideoCards error for node', node, errInner);
        }
      });

      info('video-cards initialisées ✔ (count=' + nodes.length + ')');
    } catch (errOuter) {
      err('initPageVideoCards unexpected error', errOuter);
    }
  }

  function teardownVideoCardsBeforeReplace() {
    try {
      const oldRoot = document.querySelector('main[data-pjax-root]');
      if (!oldRoot) return;

      oldRoot.querySelectorAll('.carte-lecteur-video').forEach(vCard => {
        try {
          vCard.querySelectorAll('video').forEach(v => {
            try { v.pause(); } catch {}
            try { delete v.__vc_init; } catch {}
          });
          delete vCard.dataset.videoInit;
        } catch (errInner) {
          warn('teardownVideoCards: item teardown failed', errInner);
        }
      });

      document.querySelectorAll('.carte-lecteur-video video').forEach(v => { try { v.pause(); } catch {} });
      info('video-cards teardown (pause) ✔');
    } catch (e) {
      warn('pjax:beforeReplace teardown failed', e);
    }
  }

  // --- AJOUT IMPORTANT : teardown AVANT navigation PJAX ----------------------
  document.addEventListener('pjax:before', async () => {
    try {
      if (!currentPage) return;
      info('pjax:before -> teardown currentPage =', currentPage);
      await teardown(currentPage);
    } catch (e) {
      warn('erreur lors du teardown avant PJAX:', e);
    } finally {
      try {
        const root = document.querySelector('main[data-pjax-root]');
        const curPolicy = (root?.getAttribute('data-audio') || 'global').toLowerCase();
        if (curPolicy === 'local') {
          root.querySelectorAll('.audio-player audio').forEach(a => { try { a.pause(); } catch {} });
          info('pause audio local (policy=local) ✔');
        } else {
          dbg('policy=current page is global → no global pause here');
        }
      } catch (err2) {
        warn('pause locale audio failed', err2);
      }
    }
  });

  // -------- Hooks cycle de vie ----------------------------------------------
  document.addEventListener('DOMContentLoaded', async () => {
    const container = getContainer();
    try {
      const pg = container?.getAttribute('data-page') || '';
      if (pg) document.body.setAttribute('data-page', pg); else document.body.removeAttribute('data-page');
    } catch {}
    try { applyAudioArbiter(container); } catch {}
    try { await bootFor(container); } catch (e) { warn('bootFor error on DOMContentLoaded', e); }
    try { await initPageVideoCards(container); } catch (e) { warn('initPageVideoCards error on DOMContentLoaded', e); }
  });

  document.addEventListener('pjax:ready', async (e) => {
    const container = e.detail?.container || getContainer();
    try {
      const pg = container?.getAttribute('data-page') || '';
      if (pg) document.body.setAttribute('data-page', pg); else document.body.removeAttribute('data-page');
    } catch {}
    try { applyAudioArbiter(container); } catch {}
    try { await bootFor(container); } catch (e2) { warn('bootFor error on pjax:ready', e2); }
    try { await initPageVideoCards(container); } catch (e3) { warn('initPageVideoCards error on pjax:ready', e3); }
    // Assurer player prêt + reprise si on revient sur home via PJAX
    try {
      const pg = (container?.getAttribute('data-page') || '').toLowerCase();
      if (pg === 'home') {
        const needInit = (!window.AudioApp || window.AudioApp.initialized !== true) && !!document.getElementById('audioPlayer');
        if (needInit) {
          await needScript('/assets/js/player-singleton.js', () => window.AudioApp && window.AudioApp.initialized);
        }
        if (window.AudioApp && typeof window.AudioApp.resumeFromSnapshot === 'function') {
          await window.AudioApp.resumeFromSnapshot();
        }
      }
    } catch (ee) { warn('pjax:ready resumeFromSnapshot failed', ee); }

    // Filets de sécurité: s'assurer que cv-modal est bindée et que les skill-cards sont initialisées
    try {
      const needsCv = !!(container.querySelector('#open-cv-modal') || document.getElementById('cv-modal'));
      if (needsCv) {
        const okCv = (typeof window.initCvModal === 'function')
          || await needScript('/assets/js/cv-modal-handler.js', () => typeof window.initCvModal === 'function');
        if (okCv && typeof window.initCvModal === 'function') window.initCvModal();
      }
      // Injecter une modale dédiée aux skills si absente (évite d'écraser la CV)
      try {
        if (!document.getElementById('skill-modal')) {
          const overlay  = document.createElement('div');
          overlay.id = 'skill-modal';
          overlay.className = 'sc-modal-overlay modal-overlay';
          overlay.setAttribute('role','dialog');
          overlay.setAttribute('aria-modal','true');
          overlay.setAttribute('aria-hidden','true');
          const content  = document.createElement('div'); content.className = 'sc-modal-content modal-content';
          const closeBtn = document.createElement('span'); closeBtn.className = 'sc-close-btn close-btn'; closeBtn.innerHTML = '\u00d7';
          const body     = document.createElement('div'); body.className = 'sc-modal-body modal-body';
          content.append(closeBtn, body); overlay.appendChild(content);
          document.body.appendChild(overlay);
          closeBtn.addEventListener('click', () => { overlay.style.display='none'; overlay.setAttribute('aria-hidden','true'); body.innerHTML=''; });
          overlay.addEventListener('click', (e) => { if (e.target === overlay) { closeBtn.click(); } });
          content.addEventListener('click', (e) => e.stopPropagation());
        }
      } catch {}
      const hasCards = !!container.querySelector('.skill-card');
      if (hasCards) {
        // Filets vendor: s'assurer qu'Isotope + imagesLoaded + init grid sont prêts
        try {
          await needScript(
            ['/assets/vendor/imagesloaded.pkgd.min.js', 'https://unpkg.com/imagesloaded@5/imagesloaded.pkgd.min.js'],
            () => typeof window.imagesLoaded === 'function'
          );
          await needScript(
            ['/assets/vendor/isotope.pkgd.min.js', 'https://unpkg.com/isotope-layout@3/dist/isotope.pkgd.min.js'],
            () => typeof window.Isotope !== 'undefined'
          );
          await needScript('/assets/js/isotope-skill-grid.js', () => (typeof window.initSkillGrid === 'function') || (window.SkillGrid && typeof window.SkillGrid.init === 'function'));
          // init grid (scope = container)
          try { (window.initSkillGrid || window.SkillGrid?.init)?.(container); } catch {}
        } catch {}
        const okStars = (typeof window.initSkillCards === 'function')
          || await needScript('/assets/js/skill-card.js', () => typeof window.initSkillCards === 'function');
        if (okStars && typeof window.initSkillCards === 'function') window.initSkillCards(container);
        // Réparations tardives (DOM encore en mouvement après PJAX)
        try { setTimeout(() => { try { window.initSkillCards(container); } catch {} }, 0); } catch {}
        try { setTimeout(() => { try { window.initSkillCards(container); } catch {} }, 150); } catch {}
        try { requestAnimationFrame(() => { try { window.initSkillCards(container); } catch {} }); } catch {}
      }
    } catch (e4) { warn('pjax:ready skill-cards/cv-modal ensure failed', e4); }
  });

  document.addEventListener('pjax:beforeReplace', () => {
    try { teardownVideoCardsBeforeReplace(); } catch (e) { warn('pjax:beforeReplace teardown failed', e); }
  });

  // ===========================
  // visualReload (API demandée)
  // - But : ré-initialiser uniquement les composants visuels après un swap PJAX
  // - NE DOIT PAS toucher au player global / snapshot audio
  // - Doit être idempotent et robuste (try/catch autour de chaque étape)
  // ===========================
  async function visualReload(targetPageName) {
    try {
      info('visualReload requested →', targetPageName);

      const container = getContainer();
      if (!container) {
        warn('visualReload: container introuvable'); 
        return;
      }

      // (0) Assurer vendors requis pour certaines pages (home/portfolio)
      try {
        if (targetPageName === 'home' || targetPageName === 'portfolio') {
          await needScript(
            ['/assets/vendor/imagesloaded.pkgd.min.js', 'https://unpkg.com/imagesloaded@5/imagesloaded.pkgd.min.js'],
            () => typeof window.imagesLoaded === 'function'
          );
          await needScript(
            ['/assets/vendor/isotope.pkgd.min.js', 'https://unpkg.com/isotope-layout@3/dist/isotope.pkgd.min.js'],
            () => typeof window.Isotope !== 'undefined'
          );
          await needScript('/assets/js/isotope-skill-grid.js', () =>
            (typeof window.initSkillGrid === 'function') || (window.SkillGrid && typeof window.SkillGrid.init === 'function')
          );
          await needScript('/assets/js/skill-card.js', () => typeof window.initSkillCards === 'function');
        }
      } catch (e) { warn('visualReload vendor ensure failed', e); }

      // (1) Re-bind lazy images: copy data-src -> src si pas encore chargé
      try {
        const lazyImgs = container.querySelectorAll('img[data-src], img[data-lazy-src]');
        lazyImgs.forEach(img => {
          const src = img.dataset.src || img.dataset.lazySrc;
          if (src && (!img.src || img.src.trim() === '')) {
            img.src = src;
            dbg('visualReload: lazy image src applied →', src);
          }
        });
      } catch (e) { warn('visualReload lazy images failed', e); }

      // (2) Re-init imagesLoaded & Isotope grids (home / portfolio / grid-wrapper / portfolio-grid)
      try {
        const gridSelectors = ['.grid-wrapper', '.portfolio-grid', '.portfolio-grid-wrapper', '.grid'];
        for (const sel of gridSelectors) {
          const grid = container.querySelector(sel);
          if (!grid) continue;
          if (typeof window.imagesLoaded === 'function' && typeof window.Isotope !== 'undefined') {
            try {
              // si un Isotope existant est attaché, layout/arrange
              const iso = grid.__iso;
              if (iso) {
                imagesLoaded(grid, () => { try { iso.layout(); iso.arrange && iso.arrange({ filter: '*' }); } catch {} });
                dbg('visualReload: isotope existing re-layout for', sel);
              } else {
                // si pas d'instance, fallback: init via existing helpers si exposés
                if (typeof window.initPortfolioGrid === 'function') {
                  try { window.initPortfolioGrid(grid); dbg('visualReload: initPortfolioGrid called'); }
                  catch(e){ dbg('visualReload initPortfolioGrid error', e); }
                } else if (typeof window.initSkillGrid === 'function') {
                  try { window.initSkillGrid(grid); dbg('visualReload: initSkillGrid called'); }
                  catch(e){ dbg('visualReload initSkillGrid error', e); }
                }
              }
            } catch (e) { warn('visualReload isotope error', e); }
          }
        }
      } catch (e) { warn('visualReload grids handling failed', e); }

      // (3) Reinit magic/photo/skill-card modules si présents
      try {
        // (cv-modal est désormais injectée depuis le fragment cible par pjax-router)
        if (typeof window.initMagicPhoto === 'function') {
          try { window.initMagicPhoto(container); dbg('visualReload: initMagicPhoto'); } catch(e){ warn(e); }
        }
        if (typeof window.initSkillCards === 'function') {
          try { window.initSkillCards(container); dbg('visualReload: initSkillCards'); } catch(e){ warn(e); }
        }
        if (typeof window.initMagicCards === 'function') {
          try { window.initMagicCards(container); dbg('visualReload: initMagicCards'); } catch(e){ warn(e); }
        }
        // Assurer la dispo de la modale CV si la page la contient
        try {
          const needsCv = !!(container.querySelector('#open-cv-modal') || document.getElementById('cv-modal'));
          if (needsCv) {
            const ok = (typeof window.initCvModal === 'function')
              || await needScript('/assets/js/cv-modal-handler.js', () => typeof window.initCvModal === 'function');
            if (ok && typeof window.initCvModal === 'function') window.initCvModal();
          }
        } catch(e){ warn('visualReload: initCvModal failed', e); }
        // Sur la home, tenter une reprise si un snapshot forcé était enregistré
        try {
          const pageName = (container?.getAttribute('data-page') || '').toLowerCase();
          if (pageName === 'home') {
            // Si le singleton n'est pas encore initialisé mais que l'UI a été injectée → (re)charger le script
            const needInit = (!window.AudioApp || window.AudioApp.initialized !== true) && !!document.getElementById('audioPlayer');
            if (needInit) {
              await needScript('/assets/js/player-singleton.js', () => window.AudioApp && window.AudioApp.initialized);
            }
            if (window.AudioApp && typeof window.AudioApp.resumeFromSnapshot === 'function') {
              await window.AudioApp.resumeFromSnapshot();
            }
          }
        } catch(e){ warn('visualReload: resumeFromSnapshot failed', e); }
      } catch (e) { warn('visualReload module inits failed', e); }

      // (4) Re-bind video cards (UI-only) — n'impacte pas le flux audio
      try { await initPageVideoCards(container); } catch (e) { warn('visualReload initPageVideoCards failed', e); }

      // (5) Re-apply page-scoped CSS if any (attempt conservative approach)
      try {
        // Certains styles page-scoped sont fournis via <link data-page-css> clonés dans head par PJAX.
        // Ici on s'assure que s'ils sont présents mais désactivés, on remet display inline — cheap attempt.
        const scoped = document.head.querySelectorAll('link[rel="stylesheet"][data-page-css],style[data-page-css]');
        if (scoped && scoped.length) {
          dbg('visualReload: page-scoped styles present in head count=', scoped.length);
        } else {
          dbg('visualReload: no page-scoped styles found in head');
        }
      } catch(e){ warn('visualReload reapply page-css failed', e); }

      // (6) Force reflow minimal pour régler certains bugs de rendu (très court)
      try {
        document.body.style.display = 'none';
        // micro-delay to let layout settle
        await new Promise(r => setTimeout(r, 20));
        document.body.style.display = '';
        dbg('visualReload: micro reflow forced');
      } catch (e) { warn('visualReload reflow failed', e); }

      // (7) Page specific visual hooks
      try {
        if (typeof window.pageSpecificVisualReload === 'function') {
          try { window.pageSpecificVisualReload(targetPageName, container); dbg('visualReload: pageSpecificVisualReload called'); } catch(e){ warn(e); }
        }
        // Examples: index/home specific function names
        if (targetPageName === 'home' && typeof window.initHomeSpecific === 'function') {
          try { window.initHomeSpecific(container); dbg('visualReload: initHomeSpecific'); } catch(e){ warn(e); }
        }
        if (targetPageName === 'portfolio' && typeof window.initPortfolio === 'function') {
          try { window.initPortfolio(container); dbg('visualReload: initPortfolio'); } catch(e){ warn(e); }
        }
      } catch (e) { warn('visualReload page-specific hooks failed', e); }

      // (8) Emit event for other scripts to hook into (non-blocking)
      try { document.dispatchEvent(new CustomEvent('page-hub:visualReload', { detail: { page: targetPageName } })); } catch (e) { dbg('visualReload event dispatch failed', e); }

      info('visualReload complete for', targetPageName);
    } catch (e) {
      warn('visualReload unexpected error', e);
    }
  }

  // Exposer visualReload sur window.pageHub & window.__PAGE_HUB__
  try {
    window.pageHub = window.pageHub || {};
    window.pageHub.visualReload = visualReload;
    window.__PAGE_HUB__.visualReload = visualReload;
  } catch (e) { warn('expose visualReload failed', e); }

  // --- Exports API interne
  Object.assign(window.__PAGE_HUB__, {
    initPageVideoCards: initPageVideoCards,
    teardownVideoCardsBeforeReplace: teardownVideoCardsBeforeReplace,
    getCurrentPage: () => currentPage,
    visualReload
  });

  info('chargé ✔ (page-hub with visualReload)');
  try {
    window.addEventListener('DOMContentLoaded', () => ensureBaseStyles());
    document.addEventListener('pjax:ready', (e) => ensureBaseStyles(e?.detail?.container || getContainer()));
  } catch {}
})();
