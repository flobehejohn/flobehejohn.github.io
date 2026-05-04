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
#skills-grid.skill-grid-ready,
.grid-wrapper.skill-grid-ready {
  box-sizing: border-box;
  max-width: 100%;
  overflow-x: clip;
  contain: layout paint;
}
#skills-grid.skill-grid-ready .grid-item,
.grid-wrapper.skill-grid-ready .grid-item {
  box-sizing: border-box;
  max-width: 100%;
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
      grid.style.maxWidth = grid.style.maxWidth || '100%';
      grid.style.overflowX = grid.style.overflowX || 'clip';
      grid.style.boxSizing = grid.style.boxSizing || 'border-box';

      Array.from(grid.querySelectorAll('.grid-item')).forEach((item, index) => {
        item.dataset.skillGridKey = item.dataset.skillGridKey || `skill-${index}`;
        item.style.boxSizing = item.style.boxSizing || 'border-box';
        item.style.maxWidth = item.style.maxWidth || '100%';
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

  function enforceSkillGridViewportFit(grid) {
    if (!grid) return;

    try {
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      if (!viewportWidth) return;

      const visible = visibleSkillItems(grid);
      if (!visible.length) return;

      let maxRight = 0;
      let minLeft = Number.POSITIVE_INFINITY;

      visible.forEach((item) => {
        const rect = item.getBoundingClientRect();
        maxRight = Math.max(maxRight, rect.right);
        minLeft = Math.min(minLeft, rect.left);
      });

      const rightOverflow = Math.ceil(maxRight - viewportWidth);
      if (rightOverflow <= 2) return;

      const safeShift = Math.min(rightOverflow + 2, Math.max(0, Math.floor(minLeft)));

      if (safeShift > 0) {
        grid.style.transform = 'translateX(-' + safeShift + 'px)';
        grid.dataset.skillGridViewportShift = String(safeShift);
      } else {
        grid.style.maxWidth = 'calc(100% - ' + Math.min(rightOverflow + 4, 16) + 'px)';
        grid.dataset.skillGridViewportFit = 'width-clamped';
        try { grid.__iso?.layout?.(); } catch {}
      }
    } catch {}
  }

  function finalizeSkillGridArrange(grid, before, source) {
    try {
      enforceSkillGridViewportFit(grid);
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

  function resetSkillGridFallbackResidues(grid) {
    if (!grid) return;

    try {
      Array.from(grid.querySelectorAll('.grid-item')).forEach((item) => {
        // Le fallback manuel peut laisser display:none / opacity / transform.
        // Avant de rendre la main à Isotope, on enlève uniquement les résidus
        // qui empêchent une carte de redevenir visible après filtres répétés/PJAX.
        item.style.removeProperty('display');

        if (item.classList.contains('isotope-hidden')) {
          item.style.removeProperty('opacity');
          item.style.removeProperty('transform');
        }
      });
    } catch {}
  }

  function arrangeSkillGridWithAudit(iso, grid, options, source) {
    if (!iso || !grid) return false;

    prepareSkillGridMotion(grid);
    resetSkillGridFallbackResidues(grid);

    try {
      iso.reloadItems?.();
      iso.updateSortData?.();
    } catch {}

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

      try {
        window.requestAnimationFrame(() => {
          try { iso.layout?.(); } catch {}
        });
      } catch {}

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
        resetSkillGridFallbackResidues(grid);
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

/* PR6_ISOTOPE_CANONICAL_OWNER_V1_START */
(function () {
  'use strict';

  if (window.__PR6_ISOTOPE_CANONICAL_OWNER_V1__) {
    return;
  }

  window.__PR6_ISOTOPE_CANONICAL_OWNER_V1__ = true;

  var API_KEY = '__PR6_SKILL_GRID_CANONICAL__';
  var AUDIT_KEY = '__SKILL_GRID_AUDIT__';
  var MOTION_MS = 520;

  function delay(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function audit(partial) {
    try {
      window[AUDIT_KEY] = Object.assign(
        {
          version: 'pr6-isotope-pjax-motion-contract',
          ready: false,
          lastFilter: '*',
          lastSortBy: 'original-order',
          lastSortOrder: 'asc',
          lastError: null,
        },
        window[AUDIT_KEY] || {},
        partial || {},
        { updatedAt: new Date().toISOString() },
      );
    } catch {}
  }

  function asElement(value) {
    return value && value.nodeType === 1 ? value : null;
  }

  function findGrid(container) {
    try {
      var root = asElement(container) || document.querySelector('main[data-pjax-root]') || document;

      var scoped =
        root.querySelector?.('#skills-grid') ||
        root.querySelector?.('.grid-wrapper') ||
        root.querySelector?.('.grid');

      if (scoped && scoped.querySelector?.('.grid-item')) {
        return scoped;
      }

      var global =
        document.querySelector('#skills-grid') ||
        document.querySelector('.grid-wrapper') ||
        document.querySelector('.grid');

      if (global && global.querySelector?.('.grid-item')) {
        return global;
      }
    } catch {}

    return null;
  }

  function getIso(grid) {
    if (!grid) return null;

    try {
      if (grid.__iso) return grid.__iso;
      if (window._skillsIso) return window._skillsIso;
      if (typeof window.Isotope?.data === 'function') {
        return window.Isotope.data(grid);
      }
    } catch {}

    return null;
  }

  function activeFilter() {
    try {
      var button = document.querySelector(
        '.skills-filters [data-filter].active, .filters [data-filter].active',
      );

      return button?.getAttribute('data-filter') || button?.dataset?.filter || '*';
    } catch {
      return '*';
    }
  }

  function activeSort() {
    try {
      var button = document.querySelector('.sorters [data-sort-by].active');

      return {
        sortBy: button?.getAttribute('data-sort-by') || button?.dataset?.sortBy || 'original-order',
        sortOrder: (button?.getAttribute('data-sort-order') || button?.dataset?.sortOrder || 'asc').toLowerCase(),
      };
    } catch {
      return { sortBy: 'original-order', sortOrder: 'asc' };
    }
  }

  function unlockControls() {
    try {
      document
        .querySelectorAll('.skills-filters [data-filter], .filters [data-filter], .sorters [data-sort-by]')
        .forEach(function (control) {
          control.removeAttribute('disabled');
          control.setAttribute('aria-disabled', 'false');
          control.style.pointerEvents = '';
        });
    } catch {}
  }

  function activateFilterButton(button) {
    try {
      var nav = button?.closest?.('.skills-filters, .filters');

      if (!nav) return;

      nav.querySelectorAll('[data-filter].active').forEach(function (item) {
        item.classList.remove('active');
      });

      button.classList.add('active');
    } catch {}
  }

  function activateSortButton(button) {
    try {
      var nav = button?.closest?.('.sorters');

      if (!nav) return;

      nav.querySelectorAll('[data-sort-by].active, .btn.active').forEach(function (item) {
        item.classList.remove('active');
      });

      button.classList.add('active');
    } catch {}
  }

  async function ensureRuntime(container) {
    var grid = findGrid(container);

    if (!grid) return null;

    try {
      if (!getIso(grid) && typeof window.initSkillGrid === 'function') {
        var maybe = window.initSkillGrid(container || document);
        if (maybe && typeof maybe.then === 'function') {
          await maybe;
        }
      }
    } catch (error) {
      audit({
        canonicalReady: false,
        canonicalLastError: error instanceof Error ? error.message : String(error),
      });
    }

    return findGrid(container) || grid;
  }

  function resetItemsForArrange(grid) {
    try {
      Array.from(grid.querySelectorAll('.grid-item')).forEach(function (item) {
        item.classList.remove('isotope-hidden');
        item.style.removeProperty('display');
        item.style.removeProperty('visibility');
        item.style.removeProperty('opacity');
        item.style.removeProperty('pointer-events');
        item.style.maxWidth = 'calc(100vw - 32px)';
        item.style.boxSizing = 'border-box';
      });
    } catch {}
  }

  function lockDomVisibility(grid, filterValue) {
    var mismatched = 0;
    var visible = 0;
    var hidden = 0;

    try {
      Array.from(grid.querySelectorAll('.grid-item')).forEach(function (item) {
        var match = true;

        if (filterValue && filterValue !== '*') {
          try {
            match = item.matches(filterValue);
          } catch {
            match = false;
          }
        }

        if (match) {
          item.classList.remove('isotope-hidden');
          item.style.removeProperty('display');
          item.style.visibility = 'visible';
          item.style.opacity = '1';
          item.style.pointerEvents = '';
          item.style.maxWidth = 'calc(100vw - 32px)';
          item.style.boxSizing = 'border-box';
          visible += 1;
        } else {
          item.classList.add('isotope-hidden');
          item.style.display = 'none';
          item.style.visibility = 'hidden';
          item.style.opacity = '0';
          item.style.pointerEvents = 'none';
          hidden += 1;
        }
      });

      Array.from(grid.querySelectorAll('.grid-item')).forEach(function (item) {
        var style = window.getComputedStyle(item);
        var rect = item.getBoundingClientRect();
        var rendered =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number.parseFloat(style.opacity || '1') > 0.05 &&
          rect.width > 0 &&
          rect.height > 0 &&
          !item.classList.contains('isotope-hidden');

        if (rendered && filterValue !== '*' && !item.matches(filterValue)) {
          mismatched += 1;
        }
      });
    } catch (error) {
      audit({
        domVisibilityLockReady: false,
        domVisibilityLockLastError: error instanceof Error ? error.message : String(error),
      });
    }

    audit({
      domVisibilityLockReady: true,
      domVisibilityLockApplied: true,
      domVisibilityLockLastFilter: filterValue || '*',
      domVisibilityLockVisibleCount: visible,
      domVisibilityLockHiddenCount: hidden,
      domVisibilityLockMismatchedCount: mismatched,
      domVisibilityLockLastError: null,
    });

    return mismatched === 0;
  }

  function fitViewport(grid) {
    var maxOverflow = 0;

    try {
      grid.style.maxWidth = '100%';
      grid.style.overflowX = 'clip';
      grid.style.boxSizing = 'border-box';

      Array.from(grid.querySelectorAll('.grid-item:not(.isotope-hidden)')).forEach(function (item) {
        item.style.maxWidth = 'calc(100vw - 32px)';
        item.style.boxSizing = 'border-box';

        var rect = item.getBoundingClientRect();
        var overflow = Math.max(0, rect.right - window.innerWidth, -rect.left);

        if (overflow > maxOverflow) {
          maxOverflow = overflow;
        }
      });
    } catch (error) {
      audit({
        viewportFitReady: false,
        viewportFitLastError: error instanceof Error ? error.message : String(error),
      });
    }

    audit({
      viewportFitReady: true,
      viewportFitMaxOverflow: maxOverflow,
      viewportFitItemCount: grid.querySelectorAll('.grid-item:not(.isotope-hidden)').length,
      viewportFitLastError: null,
    });

    return maxOverflow;
  }

  async function applyState(container, state, source) {
    var grid = await ensureRuntime(container);

    if (!grid) {
      audit({
        canonicalReady: false,
        canonicalLastSource: source || 'canonical-missing-grid',
        canonicalLastError: 'Skill Grid introuvable',
      });

      return false;
    }

    var filterValue = state?.filter || activeFilter() || '*';
    var sort = {
      sortBy: state?.sortBy || activeSort().sortBy || 'original-order',
      sortOrder: (state?.sortOrder || activeSort().sortOrder || 'asc').toLowerCase(),
    };

    unlockControls();
    resetItemsForArrange(grid);

    var iso = getIso(grid);

    if (iso) {
      try {
        if (typeof iso.reloadItems === 'function') iso.reloadItems();
        if (typeof iso.updateSortData === 'function') iso.updateSortData();

        iso.arrange({
          filter: filterValue,
          sortBy: sort.sortBy,
          sortAscending: sort.sortOrder !== 'desc',
        });
      } catch (error) {
        audit({
          canonicalLastError: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await delay(MOTION_MS + 120);

    lockDomVisibility(grid, filterValue);

    iso = getIso(grid);

    if (iso) {
      try {
        if (typeof iso.reloadItems === 'function') iso.reloadItems();
        if (typeof iso.layout === 'function') iso.layout();
      } catch {}
    }

    await delay(80);

    lockDomVisibility(grid, filterValue);
    var maxOverflow = fitViewport(grid);

    var visible = grid.querySelectorAll('.grid-item:not(.isotope-hidden)').length;
    var total = grid.querySelectorAll('.grid-item').length;

    grid.dataset.skillGridReady = '1';
    grid.dataset.skillGridCanonicalOwner = '1';
    grid.dataset.skillGridLastFilter = filterValue;
    grid.dataset.skillGridViewportFit = maxOverflow <= 16 ? 'ok' : 'overflow-capped';

    audit({
      ready: true,
      canonicalReady: true,
      canonicalLastSource: source || 'canonical-apply',
      lastFilter: filterValue,
      lastSortBy: sort.sortBy,
      lastSortOrder: sort.sortOrder,
      lastVisibleCount: visible,
      lastHiddenCount: Math.max(0, total - visible),
      lastError: null,
      filterStateReconcilerReady: true,
      filterStateReconcilerApplied: true,
      filterStateReconcilerLastFilter: filterValue,
      filterStateReconcilerLastSortBy: sort.sortBy,
      filterStateReconcilerLastSortOrder: sort.sortOrder,
      filterStateReconcilerLastError: null,
    });

    return true;
  }

  function claim(event) {
    try {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    } catch {}
  }

  function handleControl(event) {
    var target = event.target;

    if (!target || !target.closest) return;

    var filterButton = target.closest('.skills-filters [data-filter], .filters [data-filter]');
    var sortButton = filterButton ? null : target.closest('.sorters [data-sort-by]');

    if (!filterButton && !sortButton) return;

    var control = filterButton || sortButton;
    var grid = findGrid(control.closest?.('main[data-pjax-root]') || document);

    if (!grid) return;

    claim(event);

    if (filterButton) {
      var filterValue = filterButton.getAttribute('data-filter') || filterButton.dataset.filter || '*';
      var sort = activeSort();

      activateFilterButton(filterButton);

      applyState(grid, {
        filter: filterValue,
        sortBy: sort.sortBy,
        sortOrder: sort.sortOrder,
      }, 'canonical-filter-click').catch(function (error) {
        audit({
          canonicalLastError: error instanceof Error ? error.message : String(error),
        });
      });

      return;
    }

    if (sortButton) {
      var sortBy = sortButton.getAttribute('data-sort-by') || sortButton.dataset.sortBy || 'original-order';
      var sortOrder = sortButton.getAttribute('data-sort-order') || sortButton.dataset.sortOrder || 'asc';

      activateSortButton(sortButton);

      applyState(grid, {
        filter: activeFilter(),
        sortBy: sortBy,
        sortOrder: sortOrder,
      }, 'canonical-sort-click').catch(function (error) {
        audit({
          canonicalLastError: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  window.addEventListener('click', handleControl, true);
  window.addEventListener('touchend', handleControl, { capture: true, passive: false });
  window.addEventListener('pointerup', function (event) {
    if (event.pointerType !== 'mouse') {
      handleControl(event);
    }
  }, true);

  async function applyCurrent(source) {
    return applyState(document, {
      filter: activeFilter(),
      sortBy: activeSort().sortBy,
      sortOrder: activeSort().sortOrder,
    }, source || 'canonical-current');
  }

  window[API_KEY] = {
    apply: applyState,
    applyCurrent: applyCurrent,
    lockDomVisibility: function (container, source) {
      return applyState(container || document, {
        filter: activeFilter(),
        sortBy: activeSort().sortBy,
        sortOrder: activeSort().sortOrder,
      }, source || 'canonical-lock-visibility');
    },
  };

  window.__PR6_RECONCILE_SKILL_GRID_FILTER_STATE__ = function (container, source) {
    return applyState(container || document, {
      filter: activeFilter(),
      sortBy: activeSort().sortBy,
      sortOrder: activeSort().sortOrder,
    }, source || 'canonical-reconcile');
  };

  window.__PR6_LOCK_SKILL_GRID_DOM_VISIBILITY__ = function (container, source) {
    return applyState(container || document, {
      filter: activeFilter(),
      sortBy: activeSort().sortBy,
      sortOrder: activeSort().sortOrder,
    }, source || 'canonical-dom-lock');
  };

  window.__PR6_HARDEN_SKILL_GRID_VIEWPORT__ = function (container, source) {
    return applyState(container || document, {
      filter: activeFilter(),
      sortBy: activeSort().sortBy,
      sortOrder: activeSort().sortOrder,
    }, source || 'canonical-viewport-fit');
  };

  [
    'DOMContentLoaded',
    'load',
    'pjax:ready',
    'pjax:success',
    'pjax:complete',
    'flobehejohn:pjax:complete',
  ].forEach(function (eventName) {
    document.addEventListener(eventName, function () {
      [0, 120, 420, 900].forEach(function (delayMs) {
        window.setTimeout(function () {
          applyCurrent('canonical-' + eventName + '-' + delayMs).catch(function (error) {
            audit({
              canonicalLastError: error instanceof Error ? error.message : String(error),
            });
          });
        }, delayMs);
      });
    }, true);
  });

  [80, 360, 900].forEach(function (delayMs) {
    window.setTimeout(function () {
      applyCurrent('canonical-boot-' + delayMs).catch(function (error) {
        audit({
          canonicalLastError: error instanceof Error ? error.message : String(error),
        });
      });
    }, delayMs);
  });

  audit({
    canonicalReady: true,
    canonicalLastSource: 'canonical-installed',
    canonicalLastError: null,
  });
})();
/* PR6_ISOTOPE_CANONICAL_OWNER_V1_END */
