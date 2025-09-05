// /assets/js/pages/portfolio.js
// Contrôleur "Portfolio" — charge Isotope côté JS (compatible PJAX),
// gère fallback local→CDN, idempotence, teardown, et journalisation détaillée.

(() => {
  'use strict';

  /* =======================
     Logger stylé & helpers
     ======================= */
  const TAG  = '%c[SkillGrid]';
  const CSS  = 'background:#0b1f26;color:#5bf0ff;font-weight:700;padding:2px 6px;border-radius:3px';
  const OK   = 'background:#0c2a1a;color:#77ffcc;font-weight:700;padding:2px 6px;border-radius:3px';
  const BAD  = 'background:#2b1d1d;color:#ffb3b3;font-weight:700;padding:2px 6px;border-radius:3px';
  const log  = (m, ...a) => console.log( TAG+' '+m,  CSS, ...a);
  const ok   = (m, ...a) => console.log( TAG+' '+m,  OK,  ...a);
  const warn = (m, ...a) => console.warn(TAG+' '+m,  CSS, ...a);
  const err  = (m, ...a) => console.error(TAG+' '+m, BAD, ...a);
  const grp  = (t) => { try { console.groupCollapsed(TAG+' '+t, CSS); } catch {} };
  const end  = () => { try { console.groupEnd(); } catch {} };

  /* ================
     Constantes clés
     ================ */
  const ROOT_SEL   = 'main#app[data-pjax-root][data-page="portfolio"]';
  const FILTER_SEL = '[data-filter]';       // boutons filtres
  const GRID_SEL   = '[data-skill-grid]';   // conteneur grid

  // Librairies (local → CDN)
  const LIBS = {
    isotopes: [
      '/assets/vendor/isotope-layout/isotope.pkgd.min.js',
      'https://cdn.jsdelivr.net/npm/isotope-layout@3/dist/isotope.pkgd.min.js'
    ],
    imagesLoaded: [
      '/assets/vendor/imagesloaded/imagesloaded.pkgd.min.js',
      'https://cdn.jsdelivr.net/npm/imagesloaded@5/imagesloaded.pkgd.min.js'
    ]
  };

  // État global idempotent pour la page courante
  if (window.__PORTFOLIO_PAGE_READY__ === undefined) window.__PORTFOLIO_PAGE_READY__ = false;

  // Instances et écouteurs à démonter
  const INSTANCES = new Map(); // gridEl -> { iso, destroyHandlers: Function[] }
  let filterHandlerBound = false;  // délégation filtres (évite doublons)
  let resizeHandlerBound = false;  // resize listener

  /* =========
     Utils DOM
     ========= */
  function getRoot(containerMaybe) {
    if (containerMaybe && containerMaybe.matches && containerMaybe.matches(ROOT_SEL)) return containerMaybe;
    return document.querySelector(ROOT_SEL);
  }
  function samePath(href, targetPath) {
    try { return new URL(href, location.origin).pathname === targetPath; } catch { return false; }
  }
  function stripCache(src) {
    try {
      const u = new URL(src, location.origin);
      u.search = ''; return u.href;
    } catch { return src; }
  }

  /* =========================
     Charge un script une fois
     ========================= */
  function injectScriptOnce(src, dataKey) {
    // déjà présent ?
    let found = [...document.querySelectorAll('script[src]')].find(s => stripCache(s.src).endsWith(stripCache(src)));
    if (!found && dataKey) found = document.querySelector(`script[data-portfolio-lib="${dataKey}"]`);
    if (found) {
      return new Promise((res) => {
        if (found.dataset._loaded === '1') { res(true); return; }
        found.addEventListener('load', () => res(true), { once: true });
        found.addEventListener('error', () => res(false), { once: true });
      });
    }

    // injection
    return new Promise((res) => {
      const s = document.createElement('script');
      s.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
      if (dataKey) s.dataset.portfolioLib = dataKey;
      s.async = false; // ordre prévisible
      s.onload = () => { s.dataset._loaded = '1'; res(true); };
      s.onerror = () => { s.dataset._loaded = '0'; res(false); };
      document.head.appendChild(s);
      log('Injection script…', s.src);
    });
  }

  async function needScript(urls, testFn, label) {
    try { if (testFn?.()) { ok(`${label} déjà présent → OK`); return true; } } catch {}
    grp(`Chargement ${label} (fallback local→CDN)`);
    for (let i = 0; i < urls.length; i++) {
      const src = urls[i];
      const isLast = i === urls.length - 1;
      log(`→ tentative ${i+1}/${urls.length}`, src);
      // N’insère pas 10 fois le même src
      const okInject = await injectScriptOnce(src, label);
      if (!okInject && !isLast) { warn(`Échec injection: ${src} → tentative suivante`); continue; }

      // test fonctionnel
      try {
        if (testFn?.()) { ok(`${label} chargé depuis`, src); end(); return true; }
      } catch {}
      if (!isLast) { warn(`Test non concluant pour ${label} depuis ${src} → tentative suivante`); }
    }
    end();
    return !!testFn?.();
  }

  /* ===========================
     Initialisation du/ des grid
     =========================== */
  function initGrids(root) {
    const grids = [...root.querySelectorAll(GRID_SEL)];
    if (!grids.length) { warn('Aucun grid', GRID_SEL, 'dans cette page'); return; }

    grp('Initialisation des grids');
    grids.forEach(grid => {
      if (INSTANCES.has(grid)) {
        log('Grid déjà initialisé → skip', grid);
        return;
      }
      if (!window.Isotope) { err('Isotope indisponible (initGrids)'); return; }

      // imagesLoaded (optionnel) pour layout stable
      const useImagesLoaded = !!(window.imagesLoaded || window.ImagesLoaded);
      if (useImagesLoaded) {
        try {
          const imagesloaded = window.imagesLoaded || window.ImagesLoaded;
          imagesloaded(grid, () => {
            try {
              const iso = new window.Isotope(grid, {
                itemSelector: '.skill-card',
                layoutMode: 'fitRows',
                percentPosition: true
              });
              INSTANCES.set(grid, { iso, destroyHandlers: [] });
              ok('Grid + Isotope OK (après imagesLoaded)', iso);
            } catch (e) { err('Init Isotope (imagesLoaded) a échoué', e); }
          });
          log('imagesLoaded branché → layout après chargement des images');
        } catch (e) {
          warn('imagesLoaded présent mais erreur à l’usage', e);
          fallbackInitIsotope(grid);
        }
      } else {
        fallbackInitIsotope(grid);
      }
    });
    end();

    // Délégation des filtres (une seule fois par page)
    bindFiltersOnce(root);
    bindResizeOnce();
    summarizeResources();
  }

  function fallbackInitIsotope(grid) {
    try {
      const iso = new window.Isotope(grid, {
        itemSelector: '.skill-card',
        layoutMode: 'fitRows',
        percentPosition: true
      });
      INSTANCES.set(grid, { iso, destroyHandlers: [] });
      ok('Grid + Isotope OK (sans imagesLoaded)', iso);
    } catch (e) { err('Init Isotope a échoué (fallback)', e); }
  }

  /* ======================
     Filtres (délégation)
     ====================== */
  function bindFiltersOnce(root) {
    if (filterHandlerBound) return;
    const handler = (ev) => {
      const btn = ev.target.closest?.(FILTER_SEL);
      if (!btn) return;
      const val = btn.getAttribute('data-filter') || '*';
      INSTANCES.forEach(({ iso }) => {
        try { iso.arrange({ filter: val }); } catch {}
      });
      log('Filtre appliqué →', val);
    };
    document.addEventListener('click', handler);
    filterHandlerBound = true;

    // Teardown : enregistrer le remove
    addTeardown(() => document.removeEventListener('click', handler));
  }

  /* =========================
     Resize → relayout Isotope
     ========================= */
  function bindResizeOnce() {
    if (resizeHandlerBound) return;
    const onResize = () => {
      INSTANCES.forEach(({ iso }) => {
        try { iso.layout(); } catch {}
      });
      log('Relayout (resize)');
    };

    // Supporte smartresize si dispo
    const evt = ('onSmartResize' in window) ? 'smartresize' : 'resize';
    window.addEventListener(evt, onResize);
    resizeHandlerBound = true;

    addTeardown(() => window.removeEventListener(evt, onResize));
  }

  /* ==========================
     Teardown global de la page
     ========================== */
  const PAGE_TEARDOWNS = [];
  function addTeardown(fn){ if (typeof fn === 'function') PAGE_TEARDOWNS.push(fn); }

  function destroy() {
    if (!window.__PORTFOLIO_PAGE_READY__) return;
    grp('Teardown Portfolio');

    // Écouteurs et handlers enregistrés
    while (PAGE_TEARDOWNS.length) {
      try { PAGE_TEARDOWNS.pop()(); } catch (e) { warn('teardown listener err', e); }
    }
    filterHandlerBound = false;
    resizeHandlerBound = false;

    // Instances Isotope
    INSTANCES.forEach(({ iso, destroyHandlers }, grid) => {
      try { destroyHandlers?.forEach(fn => { try{fn();}catch{} }); } catch {}
      try { iso?.destroy(); } catch {}
      INSTANCES.delete(grid);
    });

    window.__PORTFOLIO_PAGE_READY__ = false;
    end();
    ok('destroy() effectué');
  }

  /* =========================
     Résumé ressources/chemins
     ========================= */
  function summarizeResources(){
    grp('Ressources Portfolio (Isotope/imagesLoaded)');
    try {
      const res = performance.getEntriesByType('resource') || [];
      const css = res.filter(r => /css(\?|$)/.test(r.name)).map(r => r.name);
      const js  = res.filter(r => /js(\?|$)/.test(r.name)).map(r => r.name);
      ok('CSS chargés:', css);
      ok('JS chargés:', js.filter(n =>
        n.includes('isotope') || n.includes('imagesloaded') || n.includes('/pages/portfolio')
      ));
    } catch (e) {
      warn('Performance API indisponible:', e);
    }
    end();
  }

  /* =========================
     Marque les liens MusiCam
     ========================= */
  function markNoPjaxLinks(root = document) {
    const sel   = 'a[href^="/assets/portfolio/projet_musicam/"]';
    const links = [...root.querySelectorAll(sel)];
    if (!links.length) { log('Aucun lien MusiCam à marquer'); return; }

    let count = 0;
    links.forEach(a => {
      if (!a.hasAttribute('data-no-pjax')) {
        a.setAttribute('data-no-pjax', ''); // attribut booléen : il suffit qu'il existe
        count++;
      }
    });
    ok(`no-pjax ajouté sur ${count} lien(s) MusiCam`);
  }

  /* ================
     BOOT (idempotent)
     ================ */
  async function boot(containerMaybe) {
    const root = getRoot(containerMaybe);
    if (!root) { log('boot ignoré : pas sur la page portfolio'); return; }
    if (window.__PORTFOLIO_PAGE_READY__) { log('boot ignoré (déjà prêt)'); return; }

    log('boot() appelé (Portfolio)');

    // Charger Isotope (fallback local→CDN)
    const isoOK = await needScript(LIBS.isotopes, () => !!window.Isotope, 'isotope');
    if (!isoOK || !window.Isotope) { err('Isotope non chargé.'); return; }

    // Tenter imagesLoaded (optionnel)
    await needScript(LIBS.imagesLoaded, () => !!(window.imagesLoaded || window.ImagesLoaded), 'imagesLoaded')
      .catch(() => {}); // si fail → on continue sans

    initGrids(root);
    markNoPjaxLinks(root);            // ← AJOUT : MusiCam force une navigation pleine

    window.__PORTFOLIO_PAGE_READY__ = true;
    ok('Portfolio prêt ✓');
  }

  /* ==============================
     Hooks PJAX & navigation class.
     ============================== */
  document.addEventListener('DOMContentLoaded', () => {
    const root = getRoot();
    if (root) {
      log('DOMContentLoaded → boot(Portfolio)');
      boot(root);
    }
  }, { once: true });

  document.addEventListener('pjax:ready', (e) => {
    const c = e.detail?.container;
    if (c && c.matches && c.matches(ROOT_SEL)) {
      log('pjax:ready (Portfolio) → boot()');
      boot(c);
    }
  });

  document.addEventListener('pjax:beforeReplace', () => {
    if (document.querySelector(ROOT_SEL)) {
      log('pjax:beforeReplace (Portfolio) → destroy()');
      destroy();
    }
  });

  window.addEventListener('beforeunload', () => { if (window.__PORTFOLIO_PAGE_READY__) destroy(); });

  // (Optionnel) visiblitychange
  document.addEventListener('visibilitychange', () => log('visibilitychange →', document.visibilityState));

  // API publique (facultatif/diag)
  window.PortfolioPage = Object.freeze({ boot, destroy });

})();
