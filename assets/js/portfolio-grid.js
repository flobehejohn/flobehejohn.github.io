// assets/js/portfolio-grid.js
// Grille portfolio (Isotope) avec auto-chargement des dépendances + imagesLoaded.
// - Local → CDN fallback pour Isotope & imagesLoaded
// - Idempotent (pas de double-init), relayout après chargement d'images
// - Filtres [data-filter], resize throttle, teardown sur PJAX
// - Journalisation compatible Firefox

(() => {
  'use strict';

  /* ─────────────────────────── Logger ─────────────────────────── */
  const TAG = '%c[PortfolioGrid]';
  const CSS = 'background:#0b1f2a;color:#79eaff;font-weight:700;padding:2px 6px;border-radius:3px';
  const log  = (...a) => console.log(TAG, CSS, ...a);
  const info = (...a) => console.info(TAG, CSS, ...a);
  const warn = (...a) => console.warn(TAG, CSS, ...a);
  const err  = (...a) => console.error(TAG, CSS, ...a);

  /* ───────────────────── Utils: loader & helpers ───────────────── */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Évite de charger deux fois exactement la même URL absolue
      const abs = (() => { try { return new URL(src, location.href).href; } catch { return src; } })();
      const already = Array.from(document.scripts).some(s => {
        try { return s.src && new URL(s.src, location.href).href === abs; } catch { return false; }
      });
      if (already) return resolve(true);

      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error('load failed: ' + src));
      document.head.appendChild(s);
    });
  }

  async function loadFirstOk(list) {
    let last;
    for (const url of list) {
      try {
        info('load try →', url);
        await loadScript(url);
        return true;
      } catch (e) {
        last = e;
        warn('load error →', url, e);
      }
    }
    throw last || new Error('no source OK');
  }

  async function ensureDeps() {
    // Isotope
    if (typeof window.Isotope === 'undefined') {
      await loadFirstOk([
        '/assets/vendor/isotope.pkgd.min.js',
        'https://unpkg.com/isotope-layout@3/dist/isotope.pkgd.min.js'
      ]);
      if (typeof window.Isotope === 'undefined') throw new Error('Isotope non disponible après chargement.');
      info('Isotope prêt ✔');
    } else {
      info('Isotope déjà présent ✔');
    }

    // imagesLoaded
    if (typeof window.imagesLoaded !== 'function') {
      await loadFirstOk([
        '/assets/vendor/imagesloaded.pkgd.min.js',
        'https://unpkg.com/imagesloaded@5/imagesloaded.pkgd.min.js'
      ]);
      if (typeof window.imagesLoaded !== 'function') throw new Error('imagesLoaded non disponible après chargement.');
      info('imagesLoaded prêt ✔');
    } else {
      info('imagesLoaded déjà présent ✔');
    }
  }

  // Throttle via rAF pour relayout sur resize
  function makeRafThrottle(fn) {
    let req = 0;
    return function throttled(...args) {
      if (req) return;
      req = requestAnimationFrame(() => {
        req = 0;
        try { fn.apply(this, args); } catch(e) { warn(e); }
      });
    };
  }

  /* ─────────────────────── Core: initialisation ─────────────────────── */
  function pickGrid(root) {
    return (
      root.querySelector('.portfolio-grid') ||
      root.querySelector('.grid-wrapper')   ||
      root.querySelector('.grid')
    );
  }

  function bindFilters(root, iso) {
    const controls = root.querySelectorAll('[data-filter]');
    if (!controls.length) return;

    controls.forEach(btn => {
      const onClick = (e) => {
        e.preventDefault();
        const f = btn.getAttribute('data-filter') || '*';
        try { iso.arrange({ filter: f }); } catch(e2) { warn('arrange error', e2); }
        // état visuel
        controls.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
      // Anti-doublon
      if (btn.__pgClick) btn.removeEventListener('click', btn.__pgClick);
      btn.addEventListener('click', onClick);
      btn.__pgClick = onClick;
    });

    info('Filtres [data-filter] liés (count=' + controls.length + ')');
  }

  function unbindFilters(root) {
    const controls = root.querySelectorAll('[data-filter]');
    controls.forEach(btn => {
      if (btn.__pgClick) {
        try { btn.removeEventListener('click', btn.__pgClick); } catch {}
        delete btn.__pgClick;
      }
    });
  }

  function attachResize(grid, iso) {
    const onResize = makeRafThrottle(() => {
      try { iso.layout(); } catch {}
    });
    window.addEventListener('resize', onResize, { passive: true });
    grid.__pg_onResize = onResize;
  }

  function detachResize(grid) {
    const fn = grid.__pg_onResize;
    if (fn) {
      try { window.removeEventListener('resize', fn); } catch {}
      delete grid.__pg_onResize;
    }
  }

  async function initPortfolio(container = document) {
    const root = (container instanceof Element ? container : document);
    const grid = pickGrid(root);

    if (!grid) { warn('.portfolio-grid introuvable'); return null; }

    // Idempotence : si déjà initialisée, on relayout et on sort proprement
    if (grid.dataset.portfolioInit === '1' && grid.__iso) {
      info('déjà initialisée → relayout');
      try { grid.__iso.reloadItems(); grid.__iso.layout(); } catch {}
      return grid.__iso;
    }

    // Charge dépendances
    await ensureDeps();

    // Attendre que les images soient prêtes avant l'instanciation
    await new Promise((res) => {
      try {
        window.imagesLoaded(grid, () => res());
      } catch {
        // Si imagesLoaded indispo (edge-case), on continue quand même
        res();
      }
    });

    // Instanciation Isotope
    const iso = new window.Isotope(grid, {
      itemSelector: '.grid-item',
      layoutMode: 'fitRows',            // change vers 'masonry' si souhaité
      transitionDuration: '0.25s'
    });
    grid.__iso = iso;
    grid.dataset.portfolioInit = '1';

    // Relayout sur nouvelles images (lazy / PJAX fragment)
    try {
      window.imagesLoaded(grid, () => {
        try { iso.reloadItems(); iso.layout(); } catch {}
      });
    } catch {}

    // Filtres & Resize
    bindFilters(root, iso);
    attachResize(grid, iso);

    info('PortfolioGrid initialisé ✔');
    return iso;
  }

  /* ─────────────────────── Teardown (PJAX-safe) ─────────────────────── */
  function destroyPortfolio(container = document) {
    const root = (container instanceof Element ? container : document);
    const grid = pickGrid(root);
    if (!grid) return;

    // Délier les filtres et le listener resize
    unbindFilters(root);
    detachResize(grid);

    // Détruire Isotope proprement
    const iso = grid.__iso;
    if (iso && typeof iso.destroy === 'function') {
      try { iso.destroy(); info('Isotope destroy ✔'); } catch(e) { warn('destroy error', e); }
    }

    delete grid.__iso;
    delete grid.dataset.portfolioInit;

    info('PortfolioGrid démonté ✔');
  }

  // Teardown automatique avant remplacement PJAX
  document.addEventListener('pjax:beforeReplace', () => {
    try { destroyPortfolio(document); } catch(e) { warn('teardown PJAX error', e); }
  });

  /* ─────────────────────── Exposition UMD (global) ─────────────────────── */
  // Deux alias pour compat avec du code existant
  window.initPortfolio      = window.initPortfolio      || initPortfolio;
  window.initPortfolioGrid  = window.initPortfolioGrid  || initPortfolio;
  window.destroyPortfolio   = window.destroyPortfolio   || destroyPortfolio;

  // Auto-boot si une grille est déjà au DOM (OK avec pages non-PJAX)
  document.addEventListener('DOMContentLoaded', async () => {
    const grid = pickGrid(document);
    if (grid) {
      try { await initPortfolio(document); } catch(e) { err('init auto error', e); }
    } else {
      log('Aucune grille détectée au DOMContentLoaded (ok si PJAX)');
    }
  });

  info('chargé ✔');
})();
