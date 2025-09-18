﻿﻿// /assets/js/isotope-skill-grid.js
(() => {
  'use strict';

  // ——————————————————————————————————————
  // Store par grille: Isotope + handlers + scope (pour teardown)
  // ——————————————————————————————————————
  const STORE = new WeakMap();
  const $pjaxRoot = () => document.querySelector('main[data-pjax-root]');

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
      e.stopPropagation();

      const sortBy = btn.dataset.sortBy || 'original-order';
      const order  = (btn.dataset.sortOrder || 'asc').toLowerCase();
      const sortAscending = order !== 'desc';

      let targetGrid = grid; try { const toolbar = btn.closest('.sorters'); const targetSel = toolbar?.getAttribute?.('data-grid') || toolbar?.dataset?.grid || null; if (targetSel) targetGrid = scope.querySelector(targetSel) || document.querySelector(targetSel) || targetGrid; } catch {} const activeIso = (targetGrid && targetGrid.__iso) || (grid && grid.__iso) || iso;
      if (!activeIso) return;
      try { activeIso.updateSortData(); } catch {}
      try { activeIso.arrange({ sortBy, sortAscending }); } catch {}

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
      let targetGrid = grid;
      try {
        const targetSel = nav?.getAttribute?.('data-grid') || nav?.dataset?.grid || null;
        if (targetSel) targetGrid = scope.querySelector(targetSel) || document.querySelector(targetSel) || targetGrid;
      } catch {}
      const activeIso = (targetGrid && targetGrid.__iso) || (grid && grid.__iso) || iso;
      if (!activeIso) return;
      try { activeIso.arrange({ filter: filterValue }); } catch {}

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

      iso.arrange({ filter: defFilter, sortBy, sortAscending });
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

  async function globalFilterHandler(e) {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    const nav = btn.closest('.skills-filters, .filters');
    if (!nav) return;
    const scope = findScopeFrom(nav);
    const grid  = findGridFromNav(nav, scope);
    let iso   = (grid && grid.__iso) || window._skillsIso;
    if (!iso) {
      try { await ensureDeps(); } catch {}
      try { await (window.initSkillGrid ? window.initSkillGrid(scope) : init(scope)); } catch {}
      iso = (grid && grid.__iso) || window._skillsIso;
      // Fallback sans Isotope: filtrage manuel via CSS
      if (!iso) {
        e.preventDefault();
        e.stopPropagation();
        const sel = btn.dataset.filter || '*';
        const all = (grid || document).querySelectorAll('.grid-item');
        all.forEach(it => {
          const show = (sel === '*') ? true : it.matches(sel);
          if (show) { it.classList.remove('isotope-hidden'); it.style.removeProperty('display'); }
          else      { it.classList.add('isotope-hidden'); it.style.display = 'none'; }
        });
        try { nav.querySelectorAll('[data-filter].active').forEach(x => x.classList.remove('active')); } catch {}
        btn.classList.add('active');
        return;
      }
    }
    e.preventDefault();
    e.stopPropagation();
    const filterValue = btn.dataset.filter || '*';
    try { iso.arrange({ filter: filterValue }); } catch {}
    try { nav.querySelectorAll('[data-filter].active').forEach(x => x.classList.remove('active')); } catch {}
    btn.classList.add('active');
  }

  async function globalSorterHandler(e) {
    const btn = e.target.closest('.sorters [data-sort-by]');
    if (!btn) return;
    const scope = findScopeFrom(btn);
    // Résoudre grille depuis data-grid sur .sorters si présent
    let grid = null;
    try {
      const toolbar = btn.closest('.sorters');
      const sel = toolbar?.getAttribute?.('data-grid') || toolbar?.dataset?.grid || '#skills-grid';
      grid = scope.querySelector(sel) || document.querySelector(sel);
    } catch {}
    if (!grid) grid = pickGrid(scope);
    let iso = (grid && grid.__iso) || window._skillsIso;
    if (!iso) {
      try { await ensureDeps(); } catch {}
      try { await (window.initSkillGrid ? window.initSkillGrid(scope) : init(scope)); } catch {}
      iso = (grid && grid.__iso) || window._skillsIso;
      // Fallback: tri manuel (réordonne le DOM)
      if (!iso && grid) {
        e.preventDefault();
        e.stopPropagation();
        const sortBy = btn.dataset.sortBy || 'original-order';
        const order  = (btn.dataset.sortOrder || 'asc').toLowerCase();
        const asc    = order !== 'desc';
        const items  = Array.from(grid.querySelectorAll('.grid-item'));
        const getRating = el => parseFloat(el.getAttribute('data-rating')||el.dataset.rating||'0') || 0;
        const getTitle  = el => (el.querySelector('.skill-card h3, .carte-projet-body h3')?.textContent || '').toLowerCase();
        if (sortBy === 'rating') items.sort((a,b) => (getRating(a)-getRating(b)) * (asc?1:-1));
        else if (sortBy === 'title') items.sort((a,b) => (getTitle(a) > getTitle(b) ? 1 : -1) * (asc?1:-1));
        else {/* original-order: do nothing */}
        items.forEach(n => grid.appendChild(n));
        const group = btn.closest('.sorters') || scope;
        try { group.querySelectorAll('.btn.active').forEach(b => b.classList.remove('active')); } catch {}
        btn.classList.add('active');
        return;
      }
    }
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
  }

  // Abonnements globaux (desktop + mobile)
  document.addEventListener('click',     globalFilterHandler, { capture: true });
  document.addEventListener('touchend',  (e) => { globalFilterHandler(e); }, { capture: true, passive: false });
  document.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') globalFilterHandler(e); }, { capture: true });

  document.addEventListener('click',     globalSorterHandler, { capture: true });
  document.addEventListener('touchend',  (e) => { globalSorterHandler(e); }, { capture: true, passive: false });
  document.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') globalSorterHandler(e); }, { capture: true });

})();
