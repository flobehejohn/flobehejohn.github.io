// /assets/js/isotope-skill-grid.js
(() => {
  'use strict';

  // ——————————————————————————————————————
  // Store par grille: Isotope + handlers + scope (pour teardown)
  // ——————————————————————————————————————
  const STORE = new WeakMap();
  const $pjaxRoot = () => document.querySelector('main[data-pjax-root]');

  // Parse un rating numérique depuis data-rating (fallback 0)
  function parseRating(el) {
    const v = el.getAttribute('data-rating') || el.dataset.rating || '0';
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isNaN(n) ? 0 : n;
  }

  // Trouve la grille à utiliser, de manière robuste
  function pickGrid(scope) {
    const root = (scope instanceof Element) ? scope : ($pjaxRoot() || document);

    const nav = root.querySelector('.skills-filters,.filters,[data-grid]');
    const targetSel = nav?.getAttribute?.('data-grid');
    if (targetSel) {
      const g = root.querySelector(targetSel) || document.querySelector(targetSel);
      if (g && g.querySelector('.grid-item')) return g;
    }

    const byId = root.querySelector('#skills-grid') || document.querySelector('#skills-grid');
    if (byId && byId.querySelector('.grid-item')) return byId;

    const wrap = root.querySelector('.grid-wrapper') || document.querySelector('.grid-wrapper');
    if (wrap && wrap.querySelector('.grid-item')) return wrap;

    const any = root.querySelector('.grid') || document.querySelector('.grid');
    if (any && any.querySelector('.grid-item')) return any;

    return null;
  }

  // ——————————————————————————————————————
  // Liaison UI (délégation globale au container)
  // ——————————————————————————————————————
  function bindUI(scope, iso, grid) {
    // TRI
    const onSorterClick = (e) => {
      const btn = e.target.closest('.sorters [data-sort-by]');
      if (!btn || !scope.contains(btn)) return;

      e.preventDefault();
      e.stopPropagation();

      const sortBy = btn.dataset.sortBy || 'original-order';
      const order  = (btn.dataset.sortOrder || 'asc').toLowerCase();
      const sortAscending = order !== 'desc';

      try { iso.updateSortData(); } catch {}
      try { iso.arrange({ sortBy, sortAscending }); } catch {}

      const group = btn.closest('.sorters') || scope;
      try { group.querySelectorAll('.btn.active').forEach(b => b.classList.remove('active')); } catch {}
      btn.classList.add('active');
    };

    // FILTRES (.skills-filters et/ou .filters)
    const onFilterClick = (e) => {
      const el = e.target.closest('[data-filter]');
      if (!el || !scope.contains(el)) return;

      const nav = el.closest('.skills-filters, .filters');
      if (!nav) return;

      if (el.tagName === 'A') { e.preventDefault(); e.stopImmediatePropagation(); }
      else { e.preventDefault(); e.stopPropagation(); }

      const filterValue = el.dataset.filter || '*';
      try { iso.arrange({ filter: filterValue }); } catch {}

      try { nav.querySelectorAll('[data-filter].active').forEach(x => x.classList.remove('active')); } catch {}
      el.classList.add('active');
    };

    scope.addEventListener('click', onSorterClick, { capture: true });
    scope.addEventListener('click', onFilterClick,  { capture: true });

    const sorterScope = scope.querySelector('.sorters') || scope;
    const filterScope = scope.querySelector('.skills-filters, .filters') || scope;

    // Valeurs par défaut (tri/filtre)
    try {
      const defFilterBtn = filterScope.querySelector('[data-filter].active') || filterScope.querySelector('[data-filter="*"]');
      const defSortBtn   = sorterScope.querySelector('.btn.active') || sorterScope.querySelector('[data-sort-by="original-order"]');

      const defFilter     = defFilterBtn?.dataset?.filter || '*';
      const sortBy        = defSortBtn?.dataset?.sortBy || 'original-order';
      const order         = (defSortBtn?.dataset?.sortOrder || 'asc').toLowerCase();
      const sortAscending = order !== 'desc';

      iso.arrange({ filter: defFilter, sortBy, sortAscending });
    } catch {}

    return { sorterScope, onSorterClick, filterScope, onFilterClick };
  }

  // ——————————————————————————————————————
  // init / teardown
  // ——————————————————————————————————————
  function init(container) {
    const scope = (container instanceof Element) ? container : ($pjaxRoot() || document);

    if (typeof Isotope === 'undefined') {
      console.warn('[SkillGrid] Isotope non chargé.');
      return;
    }

    const grid = pickGrid(scope);
    if (!grid) return; // Rien à initialiser sur cette page

    // Évite les doublons si on relance l’init (PJAX / auto-init)
    try { teardown(scope); } catch {}

    // CSS de sécurité
    try {
      grid.style.position = grid.style.position || 'relative';
      if (getComputedStyle(grid).display === 'flex') {
        grid.style.display = 'block';
      }
    } catch {}

    // Crée Isotope (animation douce + étagée)
    const iso = new Isotope(grid, {
      itemSelector: '.grid-item',
      percentPosition: true,
      layoutMode: 'masonry',
      masonry: {
        columnWidth: grid.querySelector('.grid-sizer') || '.grid-item'
      },
      getSortData: {
        rating: (itemElem) => parseRating(itemElem),
        title:  (itemElem) => (itemElem.querySelector('.skill-card h3, .carte-projet-body h3')?.textContent || '').toLowerCase(),
        date:   (itemElem) => itemElem.getAttribute('data-date') || ''
      },
      sortBy: 'original-order',
      transitionDuration: '0.40s',
      stagger: 25,
      hiddenStyle:  { opacity: 0, transform: 'translateY(12px) scale(0.98)' },
      visibleStyle: { opacity: 1, transform: 'translateY(0)  scale(1)' }
    });

    // Layout après images
    if (typeof imagesLoaded === 'function') {
      try { imagesLoaded(grid, () => { try { iso.layout(); } catch {} }); } catch {}
    }

    const handlers = bindUI(scope, iso, grid);

    // Expose pour debug
    grid.__iso = iso;
    window._skillsIso = iso;

    // Stocke pour teardown propre
    STORE.set(grid, { iso, scope, ...handlers });
  }

  function teardown(container) {
    const scope = (container instanceof Element) ? container : ($pjaxRoot() || document);
    const grid = pickGrid(scope)
      || document.querySelector('#skills-grid')
      || document.querySelector('.grid-wrapper')
      || document.querySelector('.grid');

    if (!grid) return;

    const S = STORE.get(grid);
    if (S) {
      try { S.scope?.removeEventListener('click', S.onSorterClick, { capture: true }); } catch {}
      try { S.scope?.removeEventListener('click', S.onFilterClick,  { capture: true }); } catch {}
      try { S.iso?.destroy?.(); } catch {}
      STORE.delete(grid);
    }
    try { delete grid.__iso; } catch {}
  }

  // API globale
  window.initSkillGrid = init;
  window.SkillGrid = { init, teardown };

  // Filets de sécu
  document.addEventListener('pjax:before', () => { try { teardown(); } catch {} });
  document.addEventListener('DOMContentLoaded', () => { try { init(); } catch {} });
  document.addEventListener('pjax:ready',      () => { try { init(); } catch {} });

})();
