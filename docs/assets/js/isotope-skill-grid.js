﻿﻿// /assets/js/isotope-skill-grid.js
(() => {
  'use strict';

  // ——————————————————————————————————————
  // Store par grille: Isotope + handlers + scope (pour teardown)
  // ——————————————————————————————————————
  const STORE = new WeakMap();
  const $pjaxRoot = () => document.querySelector('main[data-pjax-root]');

  const MOTION_STYLE_ID = 'skill-grid-motion-contract-style';
  const MOTION_DURATION_MS = 520;
  const MOTION_DURATION = '0.52s';

  const SKILL_GRID_AUDIT = window.__SKILL_GRID_AUDIT__ = Object.assign({
    version: 'pr6-isotope-pjax-motion-contract',
    ready: false,
    initCount: 0,
    idempotentInitCount: 0,
    teardownCount: 0,
    arrangeCount: 0,
    fallbackCount: 0,
    lastFilter: '*',
    lastSortBy: 'original-order',
    lastMovedCount: 0,
    lastVisibleCount: 0,
    lastHiddenCount: 0,
    transitionDurationMs: MOTION_DURATION_MS,
    lastSource: 'bootstrap',
    lastError: null
  }, window.__SKILL_GRID_AUDIT__ || {});

  function markSkillGridAudit(partial) {
    try {
      Object.assign(SKILL_GRID_AUDIT, partial, { updatedAt: new Date().toISOString() });
    } catch {}
  }

  function ensureSkillGridMotionStyle() {
    if (document.getElementById(MOTION_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = MOTION_STYLE_ID;
    style.textContent = `
#skills-grid.skill-grid-ready .grid-item,
.grid-wrapper.skill-grid-ready .grid-item {
  transition-property: opacity, transform, filter;
  transition-duration: ${MOTION_DURATION};
  transition-timing-function: cubic-bezier(.22, 1, .36, 1);
  will-change: opacity, transform;
}
#skills-grid.skill-grid-arranging .grid-item,
.grid-wrapper.skill-grid-arranging .grid-item {
  filter: saturate(1.03);
}
#skills-grid .grid-item.isotope-hidden,
.grid-wrapper .grid-item.isotope-hidden {
  pointer-events: none;
}
`;
    document.head.appendChild(style);
  }

  function prepareSkillGridMotion(grid) {
    try {
      ensureSkillGridMotionStyle();
      grid.classList.add('skill-grid-ready');
      grid.dataset.skillGridReady = '1';
      grid.dataset.skillGridMotion = 'certified';
      grid.style.position = grid.style.position || 'relative';

      Array.from(grid.querySelectorAll('.grid-item')).forEach((item, index) => {
        item.dataset.skillGridKey = item.dataset.skillGridKey || `skill-${index}`;
        item.style.transitionProperty = item.style.transitionProperty || 'opacity, transform, filter';
        item.style.transitionDuration = item.style.transitionDuration || MOTION_DURATION;
        item.style.transitionTimingFunction = item.style.transitionTimingFunction || 'cubic-bezier(.22, 1, .36, 1)';
      });
    } catch {}
  }

  function measureSkillGridPositions(grid) {
    const positions = new Map();

    try {
      Array.from(grid.querySelectorAll('.grid-item')).forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const key = item.dataset.skillGridKey || `skill-${index}`;
        positions.set(key, {
          x: Math.round(rect.left),
          y: Math.round(rect.top)
        });
      });
    } catch {}

    return positions;
  }

  function countSkillGridMoves(before, after) {
    let moved = 0;

    after.forEach((position, key) => {
      const previous = before.get(key);
      if (!previous) return;
      if (Math.abs(previous.x - position.x) > 2 || Math.abs(previous.y - position.y) > 2) moved += 1;
    });

    return moved;
  }

  function visibleSkillItems(grid) {
    return Array.from(grid.querySelectorAll('.grid-item')).filter((item) => {
      const style = getComputedStyle(item);
      const rect = item.getBoundingClientRect();

      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && parseFloat(style.opacity || '1') > 0.05
        && rect.width > 0
        && rect.height > 0
        && !item.classList.contains('isotope-hidden');
    });
  }

  function finalizeSkillGridArrange(grid, before, source) {
    try {
      const after = measureSkillGridPositions(grid);
      const total = grid.querySelectorAll('.grid-item').length;
      const visible = visibleSkillItems(grid).length;
      const moved = countSkillGridMoves(before, after);

      grid.classList.remove('skill-grid-arranging');
      grid.dataset.skillGridLastMoved = String(moved);
      grid.dataset.skillGridVisibleCount = String(visible);

      markSkillGridAudit({
        ready: true,
        lastSource: source,
        lastMovedCount: moved,
        lastVisibleCount: visible,
        lastHiddenCount: Math.max(0, total - visible),
        transitionDurationMs: MOTION_DURATION_MS
      });
    } catch (error) {
      markSkillGridAudit({
        lastError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  function arrangeSkillGridWithAudit(iso, grid, options, source) {
    if (!iso || !grid) return false;

    prepareSkillGridMotion(grid);

    const before = measureSkillGridPositions(grid);
    grid.classList.add('skill-grid-arranging');

    markSkillGridAudit({
      arrangeCount: SKILL_GRID_AUDIT.arrangeCount + 1,
      lastFilter: options.filter || SKILL_GRID_AUDIT.lastFilter || '*',
      lastSortBy: options.sortBy || SKILL_GRID_AUDIT.lastSortBy || 'original-order',
      lastSource: source,
      lastError: null
    });

    let finalized = false;
    const done = () => {
      if (finalized) return;
      finalized = true;
      finalizeSkillGridArrange(grid, before, source);
    };

    try {
      if (typeof iso.once === 'function') iso.once('arrangeComplete', done);
      if (options.sortBy && typeof iso.updateSortData === 'function') iso.updateSortData();
      iso.arrange(options);
      window.setTimeout(done, MOTION_DURATION_MS + 180);
      return true;
    } catch (error) {
      grid.classList.remove('skill-grid-arranging');
      markSkillGridAudit({
        lastError: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  // Dépendances dynamiques: Isotope + imagesLoaded (robuste post-PJAX)
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const abs = (() => { try { return new URL(src, location.href).href; } catch { return src; } })();
      const already = Array.from(document.scripts).some(s => {
        try { return s.src && new URL(s.src, location.href).href === abs; } catch { return false; }
      });
      if (already) return resolve(true);
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(true);
      el.onerror = () => reject(new Error('load failed: ' + src));
      document.head.appendChild(el);
    });
  }

  async function ensureDeps() {
    if (typeof window.Isotope === 'undefined') {
      let last;
      for (const u of ['/assets/vendor/isotope.pkgd.min.js','https://unpkg.com/isotope-layout@3/dist/isotope.pkgd.min.js']) {
        try { await loadScript(u); break; } catch (e) { last = e; }
      }
      if (typeof window.Isotope === 'undefined') throw (last || new Error('Isotope non disponible'));
    }
    if (typeof window.imagesLoaded !== 'function') {
      let last;
      for (const u of ['/assets/vendor/imagesloaded.pkgd.min.js','https://unpkg.com/imagesloaded@5/imagesloaded.pkgd.min.js']) {
        try { await loadScript(u); break; } catch (e) { last = e; }
      }
      if (typeof window.imagesLoaded !== 'function') throw (last || new Error('imagesLoaded non disponible'));
    }
  }

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
      e.stopImmediatePropagation();

      const sortBy = btn.dataset.sortBy || 'original-order';
      const order  = (btn.dataset.sortOrder || 'asc').toLowerCase();
      const sortAscending = order !== 'desc';

      let targetGrid = grid; try { const toolbar = btn.closest('.sorters'); const targetSel = toolbar?.getAttribute?.('data-grid') || toolbar?.dataset?.grid || null; if (targetSel) targetGrid = scope.querySelector(targetSel) || document.querySelector(targetSel) || targetGrid; } catch {} const activeIso = (targetGrid && targetGrid.__iso) || (grid && grid.__iso) || iso;
      if (!activeIso) return;
      arrangeSkillGridWithAudit(activeIso, targetGrid || grid, { sortBy, sortAscending }, 'sort-click');

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
      else { e.preventDefault(); e.stopImmediatePropagation(); }

      const filterValue = el.dataset.filter || '*';
      let targetGrid = grid;
      try {
        const targetSel = nav?.getAttribute?.('data-grid') || nav?.dataset?.grid || null;
        if (targetSel) targetGrid = scope.querySelector(targetSel) || document.querySelector(targetSel) || targetGrid;
      } catch {}
      const activeIso = (targetGrid && targetGrid.__iso) || (grid && grid.__iso) || iso;
      if (!activeIso) return;
      arrangeSkillGridWithAudit(activeIso, targetGrid || grid, { filter: filterValue }, 'filter-click');

      try { nav.querySelectorAll('[data-filter].active').forEach(x => x.classList.remove('active')); } catch {}
      el.classList.add('active');
    };

    // Support click + touch/pointer (mobile)
    const onSorterTouch   = (e) => onSorterClick(e);
    const onFilterTouch   = (e) => onFilterClick(e);
    const onSorterPointer = (e) => { if (e.pointerType !== 'mouse') onSorterClick(e); };
    const onFilterPointer = (e) => { if (e.pointerType !== 'mouse') onFilterClick(e); };

    scope.addEventListener('click',     onSorterClick,   { capture: true });
    scope.addEventListener('click',     onFilterClick,   { capture: true });
    scope.addEventListener('touchend',  onSorterTouch,   { capture: true, passive: false });
    scope.addEventListener('touchend',  onFilterTouch,   { capture: true, passive: false });
    scope.addEventListener('pointerup', onSorterPointer, { capture: true });
    scope.addEventListener('pointerup', onFilterPointer, { capture: true });

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

      arrangeSkillGridWithAudit(iso, grid, { filter: defFilter, sortBy, sortAscending }, 'init-default');
    } catch {}

    return { sorterScope, onSorterClick, onSorterTouch, onSorterPointer, filterScope, onFilterClick, onFilterTouch, onFilterPointer };
  }

  // ——————————————————————————————————————
  // init / teardown
  // ——————————————————————————————————————
  function resolveScope(container) {
    if (container instanceof Element) return container.closest('main[data-pjax-root]') || container;
    return $pjaxRoot() || document;
  }

  function resolveGrid(scope, container) {
    if (container instanceof Element) {
      const c = container;
      if (c.matches('#skills-grid, .grid-wrapper, .grid')) return c;
      const maybe = c.querySelector('#skills-grid, .grid-wrapper, .grid');
      if (maybe) return maybe;
    }
    return pickGrid(scope);
  }

  async function init(container) {
    const scope = resolveScope(container);
    try { await ensureDeps(); }
    catch (e) { console.warn('[SkillGrid] dépendances manquantes:', e && (e.message || e)); return; }

    const grid = resolveGrid(scope, container);
    if (!grid) return; // Rien à initialiser sur cette page

    // Évite les doublons si on relance l’init (PJAX / visualReload / auto-init)
    const existingState = STORE.get(grid);
    if (existingState?.iso && grid.__iso === existingState.iso) {
      prepareSkillGridMotion(grid);
      try {
        existingState.iso.reloadItems?.();
        existingState.iso.updateSortData?.();
        existingState.iso.layout?.();
      } catch {}

      window._skillsIso = existingState.iso;

      markSkillGridAudit({
        ready: true,
        idempotentInitCount: SKILL_GRID_AUDIT.idempotentInitCount + 1,
        lastSource: 'idempotent-init',
        lastError: null
      });

      return existingState.iso;
    }

    try { teardown(scope); } catch {}

    prepareSkillGridMotion(grid);

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
      transitionDuration: MOTION_DURATION,
      stagger: 35,
      hiddenStyle:  { opacity: 0, transform: 'translate3d(0, 18px, 0) scale(0.965)' },
      visibleStyle: { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
    });

    // Layout après images
    if (typeof imagesLoaded === 'function') {
      try { imagesLoaded(grid, () => { try { iso.layout(); } catch {} }); } catch {}
    }

    const handlers = bindUI(scope, iso, grid);

    // Expose pour debug
    grid.__iso = iso;
    window._skillsIso = iso;

    markSkillGridAudit({
      ready: true,
      initCount: SKILL_GRID_AUDIT.initCount + 1,
      lastSource: 'init',
      lastError: null
    });

    // Stocke pour teardown propre
    STORE.set(grid, { iso, scope, ...handlers });
  }

  function teardown(container) {
    const scope = resolveScope(container);
    const grid = resolveGrid(scope, container)
      || document.querySelector('#skills-grid')
      || document.querySelector('.grid-wrapper')
      || document.querySelector('.grid');

    if (!grid) return;

    const S = STORE.get(grid);
    if (S) {
      try { S.scope?.removeEventListener('click',     S.onSorterClick,   { capture: true }); } catch {}
      try { S.scope?.removeEventListener('click',     S.onFilterClick,   { capture: true }); } catch {}
      try { S.scope?.removeEventListener('touchend',  S.onSorterTouch,   { capture: true }); } catch {}
      try { S.scope?.removeEventListener('touchend',  S.onFilterTouch,   { capture: true }); } catch {}
      try { S.scope?.removeEventListener('pointerup', S.onSorterPointer, { capture: true }); } catch {}
      try { S.scope?.removeEventListener('pointerup', S.onFilterPointer, { capture: true }); } catch {}
      try { S.iso?.destroy?.(); } catch {}
      STORE.delete(grid);
    }
    try { delete grid.__iso; } catch {}

    try {
      grid.classList.remove('skill-grid-ready', 'skill-grid-arranging');
      delete grid.dataset.skillGridReady;
    } catch {}

    markSkillGridAudit({
      ready: false,
      teardownCount: SKILL_GRID_AUDIT.teardownCount + 1,
      lastSource: 'teardown'
    });
  }

  // API globale
  window.initSkillGrid = init;
  window.SkillGrid = { init, teardown };

  // Filets de sécu
  document.addEventListener('pjax:before', () => { try { teardown(); } catch {} });
  document.addEventListener('DOMContentLoaded', () => { try { const p = init(); if (p?.catch) p.catch(()=>{}); } catch {} });
  document.addEventListener('pjax:ready',      () => { try { const p = init(); if (p?.catch) p.catch(()=>{}); } catch {} });

  // ---------------------------------------------------------------------------
  // DÉLÉGATION GLOBALE (FALLBACK) — capte toujours les filtres/tri après PJAX
  // ---------------------------------------------------------------------------
  function findScopeFrom(el) { return el?.closest?.('main[data-pjax-root]') || document; }
  function findGridFromNav(nav, scope) {
    if (!scope) scope = $pjaxRoot() || document;
    try {
      const sel = nav?.getAttribute?.('data-grid') || nav?.dataset?.grid || '#skills-grid';
      const g = scope.querySelector(sel) || document.querySelector(sel);
      if (g && g.querySelector('.grid-item')) return g;
    } catch {}
    return pickGrid(scope);
  }

  function activateSkillSorterButton(btn, scope) {
    try {
      const group = btn.closest('.sorters') || scope || document;
      group.querySelectorAll('.btn.active').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    } catch {}
  }

  function activateSkillFilterButton(btn, nav) {
    try {
      nav.querySelectorAll('[data-filter].active').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
    } catch {}
  }

  function manualFilterSkillGrid(grid, selector) {
    if (!grid) return false;
    prepareSkillGridMotion(grid);

    const before = measureSkillGridPositions(grid);
    const items = Array.from(grid.querySelectorAll('.grid-item'));

    items.forEach((item) => {
      const show = selector === '*' || item.matches(selector);
      if (show) {
        item.classList.remove('isotope-hidden');
        item.style.removeProperty('display');
        item.style.opacity = '1';
        item.style.transform = 'translate3d(0, 0, 0) scale(1)';
      } else {
        item.classList.add('isotope-hidden');
        item.style.display = 'none';
        item.style.opacity = '0';
        item.style.transform = 'translate3d(0, 18px, 0) scale(0.965)';
      }
    });

    finalizeSkillGridArrange(grid, before, 'filter-click-fallback');
    return true;
  }

  function manualSortSkillGrid(grid, sortBy, sortAscending) {
    if (!grid) return false;
    prepareSkillGridMotion(grid);

    const before = measureSkillGridPositions(grid);
    const items = Array.from(grid.querySelectorAll('.grid-item'));

    const getRating = el => parseFloat(el.getAttribute('data-rating') || el.dataset.rating || '0') || 0;
    const getTitle = el => (el.querySelector('.skill-card h3, .carte-projet-body h3')?.textContent || '').toLowerCase();

    if (sortBy === 'rating') {
      items.sort((a, b) => (getRating(a) - getRating(b)) * (sortAscending ? 1 : -1));
    } else if (sortBy === 'title') {
      items.sort((a, b) => (getTitle(a) > getTitle(b) ? 1 : -1) * (sortAscending ? 1 : -1));
    }

    if (sortBy !== 'original-order') {
      items.forEach(node => grid.appendChild(node));
    }

    finalizeSkillGridArrange(grid, before, 'sort-click-fallback');
    return true;
  }

  async function globalFilterHandler(e) {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    const nav = btn.closest('.skills-filters, .filters');
    if (!nav) return;

    const scope = findScopeFrom(nav);
    const grid = findGridFromNav(nav, scope);
    const filterValue = btn.dataset.filter || '*';

    e.preventDefault();
    e.stopImmediatePropagation();

    if (grid) prepareSkillGridMotion(grid);
    activateSkillFilterButton(btn, nav);

    markSkillGridAudit({
      ready: Boolean(grid?.dataset?.skillGridReady === '1'),
      lastFilter: filterValue,
      lastSource: 'filter-click',
      lastError: null
    });

    let iso = (grid && grid.__iso) || window._skillsIso;

    if (!iso) {
      try { await (window.initSkillGrid ? window.initSkillGrid(scope) : init(scope)); } catch {}
      iso = (grid && grid.__iso) || window._skillsIso;
    }

    if (iso && grid) {
      arrangeSkillGridWithAudit(iso, grid, { filter: filterValue }, 'filter-click');
      return;
    }

    manualFilterSkillGrid(grid, filterValue);
  }

  async function globalSorterHandler(e) {
    const btn = e.target.closest('.sorters [data-sort-by]');
    if (!btn) return;

    const scope = findScopeFrom(btn);
    const sortBy = btn.dataset.sortBy || 'original-order';
    const order = (btn.dataset.sortOrder || 'asc').toLowerCase();
    const sortAscending = order !== 'desc';

    let grid = null;
    try {
      const toolbar = btn.closest('.sorters');
      const sel = toolbar?.getAttribute?.('data-grid') || toolbar?.dataset?.grid || '#skills-grid';
      grid = scope.querySelector(sel) || document.querySelector(sel);
    } catch {}

    if (!grid) grid = pickGrid(scope);

    e.preventDefault();
    e.stopImmediatePropagation();

    if (grid) prepareSkillGridMotion(grid);
    activateSkillSorterButton(btn, scope);

    markSkillGridAudit({
      ready: Boolean(grid?.dataset?.skillGridReady === '1'),
      lastSortBy: sortBy,
      lastSource: 'sort-click',
      lastError: null
    });

    let iso = (grid && grid.__iso) || window._skillsIso;

    if (!iso) {
      try { await (window.initSkillGrid ? window.initSkillGrid(scope) : init(scope)); } catch {}
      iso = (grid && grid.__iso) || window._skillsIso;
    }

    if (iso && grid) {
      arrangeSkillGridWithAudit(iso, grid, { sortBy, sortAscending }, 'sort-click');
      return;
    }

    manualSortSkillGrid(grid, sortBy, sortAscending);
  }

  // Abonnements globaux (desktop + mobile)
  document.addEventListener('click',     globalFilterHandler, { capture: true });
  document.addEventListener('touchend',  (e) => { globalFilterHandler(e); }, { capture: true, passive: false });
  document.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') globalFilterHandler(e); }, { capture: true });

  document.addEventListener('click',     globalSorterHandler, { capture: true });
  document.addEventListener('touchend',  (e) => { globalSorterHandler(e); }, { capture: true, passive: false });
  document.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') globalSorterHandler(e); }, { capture: true });

})();
