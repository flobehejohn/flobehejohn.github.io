(function () {
  'use strict';

  if (window.__PR6_SKILL_GRID_SINGLE_OWNER_READY__) return;
  window.__PR6_SKILL_GRID_SINGLE_OWNER_READY__ = true;

  var AUDIT_KEY = '__SKILL_GRID_AUDIT__';
  var OWNER_KEY = '__PR6_SKILL_GRID_SINGLE_OWNER__';



  /* PR6_MOTION_CONTRACT_V1 */
  var MOTION_STYLE_ID = 'skill-grid-motion-contract-style';
  var MOTION_DURATION_MS = 520;
  var MOTION_DURATION = '520ms';
var instanceSeq = 0;
  var initCount = 0;
  var destroyCount = 0;
  var arrangeCount = 0;
  var applyQueue = Promise.resolve();
  var currentRecord = null;

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (_) {
      return String(Date.now());
    }
  }

  function rootOf(container) {
    if (container && container.nodeType === 1) return container;
    if (container && container.nodeType === 9) return container;
    return document;
  }

  function findGrid(container) {
    var root = rootOf(container);
    return (
      (root.querySelector && root.querySelector('#skills-grid')) ||
      document.querySelector('#skills-grid')
    );
  }

  function getItems(grid) {
    return Array.prototype.slice.call(grid ? grid.querySelectorAll('.grid-item') : []);
  }

  function filterSelector(container) {
    var root = rootOf(container);
    var selector = '[aria-label="Filtres compétences"] [data-filter], .skills-filters [data-filter], .filters [data-filter]';

    return Array.prototype.slice.call(
      (root.querySelectorAll && root.querySelectorAll(selector)) ||
      document.querySelectorAll(selector)
    );
  }

  function sortSelector(container) {
    var root = rootOf(container);
    var selector = '[aria-label="Tri"] [data-sort-by], .sorters [data-sort-by]';

    return Array.prototype.slice.call(
      (root.querySelectorAll && root.querySelectorAll(selector)) ||
      document.querySelectorAll(selector)
    );
  }

  function normalizeFilter(value) {
    return value && typeof value === 'string' ? value : '*';
  }

  function safeMatches(element, selector) {
    if (!selector || selector === '*') return true;

    try {
      return element.matches(selector);
    } catch (_) {
      return false;
    }
  }

  function parseRating(element) {
    var raw = element.getAttribute('data-rating') || element.dataset.rating || '0';
    var value = Number.parseFloat(raw);

    return Number.isFinite(value) ? value : 0;
  }

  function readState(container) {
    var filters = filterSelector(container);
    var activeFilter = filters.find(function (button) {
      return button.classList.contains('active') || button.getAttribute('aria-pressed') === 'true';
    });

    var sorters = sortSelector(container);
    var activeSorters = sorters.filter(function (button) {
      return button.classList.contains('active') || button.getAttribute('aria-pressed') === 'true';
    });

    var activeSort = activeSorters.length ? activeSorters[activeSorters.length - 1] : null;

    var filter = normalizeFilter(
      activeFilter && (activeFilter.getAttribute('data-filter') || activeFilter.dataset.filter)
    );

    var sortBy =
      (activeSort && (activeSort.getAttribute('data-sort-by') || activeSort.dataset.sortBy)) ||
      'original-order';

    var rawOrder =
      (activeSort && (activeSort.getAttribute('data-sort-order') || activeSort.dataset.sortOrder)) ||
      '';

    var sortAscending = String(rawOrder).toLowerCase() !== 'desc';

    if (sortBy === 'original-order') {
      sortAscending = true;
    }

    return {
      filter: filter,
      sortBy: sortBy,
      sortAscending: sortAscending,
    };
  }

  function updateActiveControls(container, state) {
    filterSelector(container).forEach(function (button) {
      var value = normalizeFilter(button.getAttribute('data-filter') || button.dataset.filter);
      var active = value === state.filter;

      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute('aria-disabled', 'false');
      button.removeAttribute('disabled');

      if (active) {
        button.setAttribute('aria-current', 'true');
      } else {
        button.removeAttribute('aria-current');
      }
    });

    sortSelector(container).forEach(function (button) {
      var value = button.getAttribute('data-sort-by') || button.dataset.sortBy || 'original-order';
      var rawOrder = button.getAttribute('data-sort-order') || button.dataset.sortOrder || '';
      var buttonAscending = String(rawOrder).toLowerCase() !== 'desc';

      var active =
        value === state.sortBy &&
        (
          value === 'original-order' ||
          rawOrder === '' ||
          buttonAscending === state.sortAscending
        );

      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute('aria-disabled', 'false');
      button.removeAttribute('disabled');

      if (active) {
        button.setAttribute('aria-current', 'true');
      } else {
        button.removeAttribute('aria-current');
      }
    });
  }

  function disabledButtonCount(container) {
    return filterSelector(container).concat(sortSelector(container)).filter(function (button) {
      return button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true';
    }).length;
  }
  function ensureMotionContractStyle() {
    try {
      if (document.getElementById(MOTION_STYLE_ID)) return;

      var style = document.createElement('style');
      style.id = MOTION_STYLE_ID;
      style.textContent =
        '#skills-grid.skill-grid-ready, .grid-wrapper.skill-grid-ready {' +
        'box-sizing: border-box; max-width: 100%; overflow-x: clip;' +
        '}' +
        '#skills-grid.skill-grid-ready .grid-item, .grid-wrapper.skill-grid-ready .grid-item {' +
        'box-sizing: border-box; max-width: 100%;' +
        'transition-property: opacity, transform, filter;' +
        'transition-duration: ' + MOTION_DURATION + ';' +
        'transition-timing-function: cubic-bezier(.22, 1, .36, 1);' +
        'will-change: opacity, transform;' +
        '}' +
        '#skills-grid .grid-item.isotope-hidden, .grid-wrapper .grid-item.isotope-hidden {' +
        'pointer-events: none;' +
        '}';

      document.head.appendChild(style);
    } catch (_) {}
  }

  function certifyMotionContract(grid) {
    if (!grid) return;

    try {
      ensureMotionContractStyle();

      grid.classList.add('skill-grid-ready');
      grid.dataset.skillGridReady = '1';
      grid.dataset.skillGridMotion = 'certified';
      grid.dataset.skillGridMotionDurationMs = String(MOTION_DURATION_MS);

      grid.style.position = grid.style.position || 'relative';
      grid.style.boxSizing = 'border-box';
      grid.style.maxWidth = '100%';
      grid.style.overflowX = 'clip';

      getItems(grid).forEach(function (item, index) {
        item.dataset.skillGridKey = item.dataset.skillGridKey || 'skill-' + index;
        item.style.boxSizing = 'border-box';
        item.style.maxWidth = '100%';
        item.style.transitionProperty = 'opacity, transform, filter';
        item.style.transitionDuration = MOTION_DURATION;
        item.style.transitionTimingFunction = 'cubic-bezier(.22, 1, .36, 1)';
        item.style.willChange = 'opacity, transform';
      });
    } catch (_) {}
  }


  function ensureCss(grid) {
    if (!grid) return;


    /* PR6_MOTION_CONTRACT_ENSURECSS_CALL */
    certifyMotionContract(grid);
grid.style.position = grid.style.position || 'relative';
    grid.style.boxSizing = 'border-box';
    grid.style.width = '100%';
    grid.style.maxWidth = '100%';
    grid.style.overflowX = 'clip';
    grid.style.isolation = 'isolate';

    getItems(grid).forEach(function (item) {
      item.style.boxSizing = 'border-box';
      item.style.maxWidth = '100%';
    });
  }

  function prepareItems(grid) {

    /* PR6_MOTION_CONTRACT_PREPARE_ITEMS_CALL */
    certifyMotionContract(grid);
getItems(grid).forEach(function (item) {
      item.style.display = '';
      item.style.visibility = '';
      item.style.opacity = '';
      item.style.pointerEvents = '';
      item.removeAttribute('aria-hidden');
      item.classList.remove('isotope-hidden');
    });
  }

  function lockDomVisibility(grid, filter) {
    var mismatched = 0;
    var visibleCount = 0;
    var hiddenCount = 0;

    getItems(grid).forEach(function (item) {
      var match = safeMatches(item, filter);

      if (match) {
        visibleCount += 1;
        item.classList.remove('isotope-hidden');
        item.style.display = '';
        item.style.visibility = 'visible';
        item.style.opacity = '1';
        item.style.pointerEvents = '';
        item.setAttribute('aria-hidden', 'false');
      } else {
        hiddenCount += 1;
        item.classList.add('isotope-hidden');
        item.style.display = 'none';
        item.style.visibility = 'hidden';
        item.style.opacity = '0';
        item.style.pointerEvents = 'none';
        item.setAttribute('aria-hidden', 'true');
      }
    });

    getItems(grid).forEach(function (item) {
      var style = window.getComputedStyle(item);
      var rect = item.getBoundingClientRect();
      var visible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity || '1') > 0.05 &&
        rect.width > 0 &&
        rect.height > 0 &&
        !item.classList.contains('isotope-hidden');

      if (visible && filter !== '*' && !safeMatches(item, filter)) {
        mismatched += 1;
      }
    });

    return {
      visibleCount: visibleCount,
      hiddenCount: hiddenCount,
      mismatchedVisibleCount: mismatched,
    };
  }

  function measureOverflow(grid) {
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    var maxOverflow = 0;

    getItems(grid).forEach(function (item) {
      var style = window.getComputedStyle(item);
      var rect = item.getBoundingClientRect();

      var visible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity || '1') > 0.05 &&
        rect.width > 0 &&
        rect.height > 0 &&
        !item.classList.contains('isotope-hidden');

      if (!visible) return;

      if (rect.left < 0) {
        maxOverflow = Math.max(maxOverflow, Math.abs(rect.left));
      }

      if (rect.right > viewportWidth) {
        maxOverflow = Math.max(maxOverflow, rect.right - viewportWidth);
      }
    });

    return Math.ceil(maxOverflow);
  }

  function fitViewport(grid) {
    if (!grid) return 0;

    grid.style.transform = '';
    ensureCss(grid);

    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    var visible = getItems(grid).filter(function (item) {
      var style = window.getComputedStyle(item);
      var rect = item.getBoundingClientRect();

      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity || '1') > 0.05 &&
        rect.width > 0 &&
        rect.height > 0 &&
        !item.classList.contains('isotope-hidden')
      );
    });

    if (!visible.length) return 0;

    var minLeft = Math.min.apply(null, visible.map(function (item) {
      return item.getBoundingClientRect().left;
    }));

    var maxRight = Math.max.apply(null, visible.map(function (item) {
      return item.getBoundingClientRect().right;
    }));

    var shift = 0;

    if (minLeft < 8) {
      shift = 8 - minLeft;
    } else if (maxRight > viewportWidth - 8) {
      shift = (viewportWidth - 8) - maxRight;
    }

    if (Math.abs(shift) > 0.5) {
      grid.style.transform = 'translateX(' + Math.round(shift) + 'px)';
    }

    return measureOverflow(grid);
  }

function scheduleLayoutRefresh(record, reason) {
    if (!record || !record.grid) return;

    var grid = record.grid;
    var iso = record.iso;
    var state = record.state;

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        try {
          lockDomVisibility(grid, state.filter);

          if (iso && typeof iso.layout === 'function') {
            iso.layout();
          }

          fitViewport(grid);

          writeAudit(Object.assign({}, snapshot(record.container || document), {
            version: 'pr6-skill-grid-single-owner',
            ready: true,


      transitionDurationMs: MOTION_DURATION_MS,
      motionCertified: Boolean(record && record.grid && record.grid.dataset && record.grid.dataset.skillGridMotion === 'certified'),
transitionDurationMs: MOTION_DURATION_MS,
      motionCertified: Boolean(record && record.grid && record.grid.dataset && record.grid.dataset.skillGridMotion === 'certified'),
lastSource: reason || 'layout-refresh',
            lastError: null,

      /* PR6_CLEAR_ISVISIBLEITEM_LASTERROR_V1 */
}));
        } catch (error) {
          writeAudit({
            lastError: error && error.message ? error.message : String(error),
          });
        }
      });
    });
  }

  function bindImageRelayout(record) {
    if (!record || !record.grid || record.grid.__pr6SkillGridImageRelayoutBound) return;

    record.grid.__pr6SkillGridImageRelayoutBound = true;

    getItems(record.grid).forEach(function (item) {
      Array.prototype.slice.call(item.querySelectorAll('img')).forEach(function (img) {
        if (img.complete) return;

        ['load', 'error'].forEach(function (eventName) {
          img.addEventListener(eventName, function () {
            scheduleLayoutRefresh(record, 'image-' + eventName + '-layout-refresh');
          }, { once: true });
        });
      });
    });
  }

  function getGrid(container) {
    return findGrid(container);
  }

  function getIsotope(grid) {
    if (!grid || !window.Isotope) return null;

    try {
      if (typeof window.Isotope.data === 'function') {
        var existing = window.Isotope.data(grid);
        if (existing) return existing;
      }
    } catch (_) {}

    try {
      return new window.Isotope(grid, {
        itemSelector: '.grid-item',
        layoutMode: 'masonry',
        percentPosition: true,
        transitionDuration: '520ms',
        masonry: {
          columnWidth: '.grid-item',
        },
        getSortData: {
          rating: parseRating,
        },
      });
    } catch (error) {
      writeAudit({
        ready: false,
        lastError: error && error.message ? error.message : String(error),
      });

      return null;
    }
  }

  function arrangeFallback(grid, state) {
    var items = getItems(grid);

    if (state.sortBy === 'rating') {
      items
        .slice()
        .sort(function (a, b) {
          var diff = parseRating(a) - parseRating(b);
          return state.sortAscending ? diff : -diff;
        })
        .forEach(function (item) {
          grid.appendChild(item);
        });
    }

    return Promise.resolve();
  }

  function waitArrange(iso) {
    return new Promise(function (resolve) {
      var done = false;

      function finish() {
        if (done) return;
        done = true;
        resolve();
      }

      try {
        if (iso && typeof iso.once === 'function') {
          iso.once('arrangeComplete', finish);
        }
      } catch (_) {}

      window.setTimeout(finish, 220);
    });
  }

  function timeoutAfter(ms, fallback) {
    return new Promise(function (resolve) {
      window.setTimeout(function () {
        try {
          resolve(typeof fallback === 'function' ? fallback() : fallback);
        } catch (_) {
          resolve(undefined);
        }
      }, ms);
    });
  }

  function runWithTimeout(promise, ms, fallback) {
    return Promise.race([
      Promise.resolve(promise),
      timeoutAfter(ms, fallback),
    ]);
  }


  async function arrange(grid, iso, state) {
    arrangeCount += 1;

    prepareItems(grid);

    if (iso && typeof iso.arrange === 'function') {
      try {
        iso.arrange({
          filter: state.filter,
          sortBy: state.sortBy,
          sortAscending: state.sortAscending,
        });

        await waitArrange(iso);
      } catch (error) {
        writeAudit({
          lastError: error && error.message ? error.message : String(error),
        });

        await arrangeFallback(grid, state);
      }
    } else {
      await arrangeFallback(grid, state);
    }

    lockDomVisibility(grid, state.filter);

    if (iso && typeof iso.layout === 'function') {
      try {
        iso.layout();
        await waitArrange(iso);
      } catch (_) {}
    }

    fitViewport(grid);

    if (currentRecord && currentRecord.grid === grid) {
      scheduleLayoutRefresh(currentRecord, 'post-arrange-layout-refresh');
    }
  }

  function writeAudit(partial) {
    var previous = window[AUDIT_KEY] || {};
    window[AUDIT_KEY] = Object.assign({}, previous, partial, {
      updatedAt: nowIso(),
    });
  }
  /* PR6_IS_VISIBLE_ITEM_HELPER_V1 */
  function isVisibleItem(item) {
    if (!item || item.nodeType !== 1) return false;

    try {
      var style = window.getComputedStyle(item);
      var rect = item.getBoundingClientRect();

      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.parseFloat(style.opacity || '1') > 0.05
        && rect.width > 0
        && rect.height > 0
        && !item.classList.contains('isotope-hidden');
    } catch (_) {
      return false;
    }
  }



  function snapshot(container) {
    var grid = getGrid(container);
    var stateFromDom = readState(container);

    var record =
      currentRecord && currentRecord.grid === grid
        ? currentRecord
        : {
            container: container || document,
            grid: grid,
            state: stateFromDom,
            iso: grid ? getIsotope(grid) : null,
          };

    record.state = Object.assign({}, record.state || {}, stateFromDom || {});
    record.state.filter = normalizeFilter(record.state.filter);
    record.state.sortBy = record.state.sortBy || 'original-order';

    if (record.state.sortBy === 'original-order') {
      record.state.sortAscending = true;
    } else {
      record.state.sortAscending = record.state.sortAscending !== false;
    }

    var items = grid ? getItems(grid) : [];
    var visible = items.filter(function (item) {
      return isVisibleItem(item);
    });

    var mismatchedVisible = visible.filter(function (item) {
      if (record.state.filter === '*') return false;

      try {
        return !item.matches(record.state.filter);
      } catch (_) {
        return true;
      }
    });

    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;

    var overflowItems = visible.filter(function (item) {
      var rect = item.getBoundingClientRect();

      return rect.left < -16 || rect.right > viewportWidth + 16;
    });

    var activeFilters = filterSelector(container).filter(function (button) {
      return button.classList.contains('active') || button.getAttribute('aria-pressed') === 'true';
    });

    var activeSorts = sortSelector(container).filter(function (button) {
      return button.classList.contains('active') || button.getAttribute('aria-pressed') === 'true';
    });

    var audit = {
      ready: Boolean(grid),
      hasGrid: Boolean(grid),
      itemCount: items.length,
      visibleCount: visible.length,
      hiddenCount: Math.max(0, items.length - visible.length),
      activeFilter: record.state.filter,
      filter: record.state.filter,
      sortBy: record.state.sortBy,
      activeSort: record.state.sortBy,
      sortAscending: record.state.sortAscending !== false,
      activeSortOrder: record.state.sortAscending === false ? 'desc' : 'asc',

      transitionDurationMs: MOTION_DURATION_MS,
      motionCertified: Boolean(grid && grid.dataset && grid.dataset.skillGridMotion === 'certified'),
disabledButtonCount: Array.prototype.slice
        .call(document.querySelectorAll('[disabled], [aria-disabled="true"]'))
        .filter(function (element) {
          return element.matches('[data-filter], [data-sort-by]');
        }).length,
      mismatchedVisibleCount: mismatchedVisible.length,
      mismatchedCount: mismatchedVisible.length,
      maxOverflowPx: overflowItems.reduce(function (max, item) {
        var rect = item.getBoundingClientRect();

        return Math.max(
          max,
          Math.max(0, -rect.left),
          Math.max(0, rect.right - viewportWidth)
        );
      }, 0),
      overflowCount: overflowItems.length,
      activeFilterButtonCount: activeFilters.length,
      activeSortButtonCount: activeSorts.length,
      instanceId: record.instanceId || 1,
      initCount: record.initCount || 1,
      destroyCount: record.destroyCount || 0,
      arrangeCount: record.arrangeCount || 0,
      lastError: null,
      version: 'pr6-skill-grid-single-owner',
      lastSource: 'snapshot-dom-reconciled',
      updatedAt: new Date().toISOString(),
    };

    window.__SKILL_GRID_AUDIT__ = audit;

    if (currentRecord && currentRecord.grid === grid) {
      currentRecord.state = Object.assign({}, currentRecord.state || {}, record.state);
    }

    return audit;
  }

  function ownControls(record) {
    var container = record.container || document;
    var owner = String(record.instanceId);

    filterSelector(container).concat(sortSelector(container)).forEach(function (button) {
      if (button.dataset.skillGridOwner === owner) return;

      var clone = button.cloneNode(true);
      clone.dataset.skillGridOwner = owner;
      clone.removeAttribute('disabled');
      clone.setAttribute('aria-disabled', 'false');

      button.parentNode.replaceChild(clone, button);
    });
  }

  function bind(record) {
    if (record.abort) {
      record.abort.abort();
    }

    record.abort = new AbortController();
    var signal = record.abort.signal;
    var container = record.container || document;

    ownControls(record);

    filterSelector(container).forEach(function (button) {
      button.removeAttribute('disabled');
      button.setAttribute('aria-disabled', 'false');

      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();

        var filter = normalizeFilter(button.getAttribute('data-filter') || button.dataset.filter);

        updateActiveControls(container, Object.assign({}, record.state, { filter: filter }));

        window.setTimeout(function () {
          apply(container, { filter: filter }, 'filter-click').catch(function (error) {
            writeAudit({
              lastError: error && error.message ? error.message : String(error),
            });
          });
        }, 0);
      }, { signal: signal });
    });

    sortSelector(container).forEach(function (button) {
      button.removeAttribute('disabled');
      button.setAttribute('aria-disabled', 'false');

      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();

        var sortBy = button.getAttribute('data-sort-by') || button.dataset.sortBy || 'original-order';
        var rawOrder = button.getAttribute('data-sort-order') || button.dataset.sortOrder || '';
        var sortAscending = String(rawOrder).toLowerCase() !== 'desc';

        if (!rawOrder && record.state.sortBy === sortBy) {
          sortAscending = !record.state.sortAscending;
        }

        updateActiveControls(container, Object.assign({}, record.state, {
          sortBy: sortBy,
          sortAscending: sortAscending,
        }));

        window.setTimeout(function () {
          apply(container, {
            sortBy: sortBy,
            sortAscending: sortAscending,
          }, 'sort-click').catch(function (error) {
            writeAudit({
              lastError: error && error.message ? error.message : String(error),
            });
          });
        }, 0);
      }, { signal: signal });
    });
  }

  function ensureRecord(container) {
    var grid = findGrid(container);

    if (!grid) {
      writeAudit({
        version: 'pr6-skill-grid-single-owner',
        ready: false,
        hasGrid: false,
        lastError: null,
      });

      return null;
    }

    if (currentRecord && currentRecord.grid === grid) {
      return currentRecord;
    }

    destroy(container);

    initCount += 1;

    var record = {
      instanceId: ++instanceSeq,
      container: rootOf(container),
      grid: grid,
      iso: null,
      abort: null,
      ready: false,
      state: readState(container),
    };

    ensureCss(grid);
    record.iso = getIsotope(grid);
    currentRecord = record;

    bindImageRelayout(record);

    bind(record);

    return record;
  }

  async function applyNow(container, nextState, source) {
    var record = ensureRecord(container);

    if (!record) {
      return snapshot(container);
    }

    record.state = Object.assign({}, record.state, nextState || {});
    record.state.filter = normalizeFilter(record.state.filter);
    record.state.sortBy = record.state.sortBy || 'original-order';

    if (typeof record.state.sortAscending !== 'boolean') {
      var rawSortOrder = record.state.sortOrder || record.state.activeSortOrder || '';
      record.state.sortAscending = String(rawSortOrder).toLowerCase() !== 'desc';
    }

    if (record.state.sortBy === 'original-order') {
      record.state.sortAscending = true;
    }

    updateActiveControls(record.container, record.state);
    ensureCss(record.grid);

    await arrange(record.grid, record.iso, record.state);

    record.ready = true;

    var snap = snapshot(record.container);

    writeAudit(Object.assign({}, snap, {
      version: 'pr6-skill-grid-single-owner',
      ready: true,


      transitionDurationMs: MOTION_DURATION_MS,
      motionCertified: Boolean(record && record.grid && record.grid.dataset && record.grid.dataset.skillGridMotion === 'certified'),
transitionDurationMs: MOTION_DURATION_MS,
      motionCertified: Boolean(record && record.grid && record.grid.dataset && record.grid.dataset.skillGridMotion === 'certified'),
lastSource: source || 'apply',
      lastError: null,
    }));

    return snap;
  }

  function enqueueApply(task) {
    var previous = applyQueue;

    var run = runWithTimeout(
      previous.catch(function () {
        return undefined;
      }),
      900,
      undefined
    ).then(function () {
      return runWithTimeout(
        task(),
        2400,
        function () {
          writeAudit({
            version: 'pr6-skill-grid-single-owner',
            ready: Boolean(currentRecord && currentRecord.grid),
            lastSource: 'apply-timeout-fallback',
            lastError: 'SkillGrid.apply timed out and recovered',
          });

          return snapshot(document);
        }
      );
    });

    applyQueue = run.catch(function () {
      return undefined;
    });

    return run;
  }

  async function init(container) {
    var record = ensureRecord(container);

    if (!record) {
      return snapshot(container);
    }

    return apply(record.container, record.state, 'init');
  }

  function destroy(container) {
    var grid = findGrid(container);

    if (!currentRecord) return;

    if (grid && currentRecord.grid !== grid) return;

    destroyCount += 1;

    try {
      if (currentRecord.abort) currentRecord.abort.abort();
    } catch (_) {}

    try {
      if (currentRecord.iso && typeof currentRecord.iso.destroy === 'function') {
        currentRecord.iso.destroy();
      }
    } catch (_) {}

    currentRecord = null;

    writeAudit({
      version: 'pr6-skill-grid-single-owner',
      ready: false,
      destroyCount: destroyCount,
      lastSource: 'destroy',
      lastError: null,
    });
  }

  function apply(container, state, source) {
    return Promise.resolve()
      .then(function () {
        return applyNow(container, state, source);
      })
      .catch(function (error) {
        writeAudit({
          version: 'pr6-skill-grid-single-owner',
          ready: Boolean(currentRecord && currentRecord.grid),
          lastSource: source || 'apply-error',
          lastError: error && error.message ? error.message : String(error),
        });

        return snapshot(container || document);
      });
  }

  window.SkillGrid = {
    init: init,
    destroy: destroy,
    apply: apply,
    snapshot: snapshot,
  };

  window[OWNER_KEY] = window.SkillGrid;

  document.addEventListener('DOMContentLoaded', function () {
    init(document).catch(function (error) {
      writeAudit({
        lastError: error && error.message ? error.message : String(error),
      });
    });
  });

  document.addEventListener('pjax:ready', function (event) {
    var container = event && event.detail && event.detail.container ? event.detail.container : document;

    init(container).catch(function (error) {
      writeAudit({
        lastError: error && error.message ? error.message : String(error),
      });
    });
  });

  window.addEventListener('resize', function () {
    if (!currentRecord) return;

    window.clearTimeout(window.__PR6_SKILL_GRID_RESIZE_TIMER__);
    window.__PR6_SKILL_GRID_RESIZE_TIMER__ = window.setTimeout(function () {
      apply(currentRecord.container, currentRecord.state, 'resize').catch(function () {});
    }, 120);
  });

  /* PR6_CONTROL_DELEGATION_FALLBACK_V1 */
  function pr6ControlRoot(element) {
    try {
      return element && element.closest && element.closest('main[data-pjax-root]')
        ? element.closest('main[data-pjax-root]')
        : document;
    } catch (_) {
      return document;
    }
  }

  function pr6SetActiveControl(button, groupSelector, itemSelector) {
    try {
      var group = button.closest(groupSelector) || document;

      Array.prototype.slice.call(group.querySelectorAll(itemSelector)).forEach(function (candidate) {
        candidate.classList.remove('active');
        candidate.setAttribute('aria-pressed', 'false');
      });

      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      button.removeAttribute('disabled');
      button.setAttribute('aria-disabled', 'false');
    } catch (_) {}
  }

  function pr6WriteImmediateControlAudit(partial) {
    try {
      writeAudit(Object.assign({
        version: 'pr6-skill-grid-single-owner',
        ready: true,
        hasGrid: Boolean(findGrid(document)),
        lastError: null,
        lastSource: 'control-delegation-immediate',
        updatedAt: new Date().toISOString(),
      }, partial || {}));
    } catch (_) {
      try {
        window.__SKILL_GRID_AUDIT__ = Object.assign(
          {},
          window.__SKILL_GRID_AUDIT__ || {},
          partial || {},
          {
            ready: true,
            lastError: null,
            lastSource: 'control-delegation-immediate-fallback',
            updatedAt: new Date().toISOString(),
          }
        );
      } catch (__) {}
    }
  }

  function pr6ScheduleApply(container, state, source) {
    window.setTimeout(function () {
      try {
        var api = window.SkillGrid || {};
        var runner = typeof api.apply === 'function' ? api.apply : apply;
        var result = runner(container, state, source);

        if (result && typeof result.catch === 'function') {
          result.catch(function (error) {
            pr6WriteImmediateControlAudit({
              lastError: error && error.message ? error.message : String(error),
              lastSource: source + '-error',
            });
          });
        }
      } catch (error) {
        pr6WriteImmediateControlAudit({
          lastError: error && error.message ? error.message : String(error),
          lastSource: source + '-throw',
        });
      }
    }, 0);
  }

  function pr6ControlDelegationHandler(event) {
    var target = event && event.target;

    if (!target || !target.closest) return;

    var sortButton = target.closest('.sorters [data-sort-by]');
    if (sortButton) {
      var container = pr6ControlRoot(sortButton);
      var sortBy = sortButton.getAttribute('data-sort-by') || sortButton.dataset.sortBy || 'original-order';
      var rawOrder = sortButton.getAttribute('data-sort-order') || sortButton.dataset.sortOrder || '';
      var sortAscending = String(rawOrder).toLowerCase() !== 'desc';

      event.preventDefault();
      event.stopPropagation();

      pr6SetActiveControl(sortButton, '.sorters', '[data-sort-by]');

      pr6WriteImmediateControlAudit({
        lastSortBy: sortBy,
        sortBy: sortBy,
        activeSort: sortBy,
        sortAscending: sortAscending,
        activeSortOrder: sortAscending ? 'asc' : 'desc',
        transitionDurationMs: typeof MOTION_DURATION_MS !== 'undefined' ? MOTION_DURATION_MS : 520,
        motionCertified: true,
        lastSource: 'sort-click-immediate',
      });

      pr6ScheduleApply(container, {
        sortBy: sortBy,
        sortAscending: sortAscending,
      }, 'sort-click');

      return;
    }

    var filterButton = target.closest('.skills-filters [data-filter], .filters [data-filter]');
    if (filterButton) {
      var filterContainer = pr6ControlRoot(filterButton);
      var filter = filterButton.getAttribute('data-filter') || filterButton.dataset.filter || '*';

      event.preventDefault();
      event.stopPropagation();

      pr6SetActiveControl(filterButton, '.skills-filters, .filters', '[data-filter]');

      pr6WriteImmediateControlAudit({
        lastFilter: filter,
        filter: filter,
        activeFilter: filter,
        transitionDurationMs: typeof MOTION_DURATION_MS !== 'undefined' ? MOTION_DURATION_MS : 520,
        motionCertified: true,
        lastSource: 'filter-click-immediate',
      });

      pr6ScheduleApply(filterContainer, {
        filter: filter,
      }, 'filter-click');
    }
  }

  if (!window.__PR6_CONTROL_DELEGATION_FALLBACK_V1__) {
    window.__PR6_CONTROL_DELEGATION_FALLBACK_V1__ = true;

    document.addEventListener('click', pr6ControlDelegationHandler, true);
    document.addEventListener('touchend', pr6ControlDelegationHandler, { capture: true, passive: false });
    document.addEventListener('pointerup', function (event) {
      if (event.pointerType !== 'mouse') {
        pr6ControlDelegationHandler(event);
      }
    }, true);
  }


  /* PR6_FINAL_VIEWPORT_HARDENER_V1 */
  function pr6VisibleGridItemsForViewport(grid) {
    if (!grid) return [];

    try {
      return Array.prototype.slice
        .call(grid.querySelectorAll('.grid-item'))
        .filter(function (item) {
          var style = window.getComputedStyle(item);
          var rect = item.getBoundingClientRect();

          return style.display !== 'none'
            && style.visibility !== 'hidden'
            && Number.parseFloat(style.opacity || '1') > 0.05
            && rect.width > 0
            && rect.height > 0
            && !item.classList.contains('isotope-hidden');
        });
    } catch (_) {
      return [];
    }
  }

  function pr6MeasureViewportOverflow(grid) {
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    var items = pr6VisibleGridItemsForViewport(grid);

    if (!viewportWidth || !items.length) {
      return {
        viewportWidth: viewportWidth,
        itemCount: items.length,
        overflowCount: 0,
        maxOverflowPx: 0,
        minLeft: 0,
        maxRight: 0,
        span: 0
      };
    }

    var minLeft = Infinity;
    var maxRight = -Infinity;
    var overflowCount = 0;
    var maxOverflowPx = 0;

    items.forEach(function (item) {
      var rect = item.getBoundingClientRect();
      minLeft = Math.min(minLeft, rect.left);
      maxRight = Math.max(maxRight, rect.right);

      var leftOverflow = Math.max(0, -rect.left);
      var rightOverflow = Math.max(0, rect.right - viewportWidth);
      var localOverflow = Math.max(leftOverflow, rightOverflow);

      if (localOverflow > 0.5) {
        overflowCount += 1;
      }

      maxOverflowPx = Math.max(maxOverflowPx, localOverflow);
    });

    return {
      viewportWidth: viewportWidth,
      itemCount: items.length,
      overflowCount: overflowCount,
      maxOverflowPx: maxOverflowPx,
      minLeft: minLeft === Infinity ? 0 : minLeft,
      maxRight: maxRight === -Infinity ? 0 : maxRight,
      span: maxRight > minLeft ? maxRight - minLeft : 0
    };
  }

  async function pr6FinalHardenSkillGridViewport(container, source) {
    var root = container && container.querySelector ? container : document;
    var grid = null;

    try {
      grid =
        root.querySelector && root.querySelector('#skills-grid')
          ? root.querySelector('#skills-grid')
          : document.querySelector('#skills-grid');
    } catch (_) {
      grid = document.querySelector('#skills-grid');
    }

    if (!grid) return false;

    try {
      grid.classList.add('skill-grid-viewport-fit');
      grid.style.boxSizing = 'border-box';
      grid.style.maxWidth = '100%';
      grid.style.overflowX = 'visible';
      grid.style.transformOrigin = '0 0';

      Array.prototype.slice.call(grid.querySelectorAll('.grid-item')).forEach(function (item) {
        item.style.boxSizing = 'border-box';
        item.style.maxWidth = 'calc(100vw - 32px)';
      });
    } catch (_) {}

    async function frame() {
      await new Promise(function (resolve) {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(resolve);
        });
      });
    }

    try {
      grid.style.transform = '';
      grid.dataset.skillGridViewportShift = '0';
      grid.dataset.skillGridViewportScale = '1';
    } catch (_) {}

    await frame();

    var measure = pr6MeasureViewportOverflow(grid);
    var viewportWidth = measure.viewportWidth || 0;
    var safeLeft = 0;
    var safeRight = viewportWidth;
    var available = Math.max(240, safeRight - safeLeft);

    var scale = 1;

    if (measure.span > available) {
      scale = Math.max(0.82, Math.min(1, available / measure.span));
    }

    var shift = 0;

    if (measure.maxOverflowPx > 0.5 || scale < 1) {
      var scaledLeft = measure.minLeft * scale;
      var scaledRight = measure.maxRight * scale;
      var scaledSpan = Math.max(1, scaledRight - scaledLeft);

      if (scaledSpan >= available) {
        shift = safeLeft - scaledLeft;
      } else {
        var targetLeft = safeLeft + Math.max(0, (available - scaledSpan) / 2);
        shift = targetLeft - scaledLeft;
      }

      grid.style.transform =
        'translate3d(' + shift.toFixed(3) + 'px, 0, 0) scale(' + scale.toFixed(5) + ')';

      grid.dataset.skillGridViewportShift = String(shift);
      grid.dataset.skillGridViewportScale = String(scale);
    }

    await frame();

    var after = pr6MeasureViewportOverflow(grid);

    if (after.maxOverflowPx > 0.5) {
      var correction = 0;

      if (after.minLeft < 0) {
        correction += -after.minLeft;
      }

      if (after.maxRight > viewportWidth) {
        correction -= (after.maxRight - viewportWidth);
      }

      var previousShift = Number.parseFloat(grid.dataset.skillGridViewportShift || '0') || 0;
      var finalShift = previousShift + correction;

      grid.style.transform =
        'translate3d(' + finalShift.toFixed(3) + 'px, 0, 0) scale(' + scale.toFixed(5) + ')';

      grid.dataset.skillGridViewportShift = String(finalShift);

      await frame();
      after = pr6MeasureViewportOverflow(grid);
    }

    try {
      var previous = window.__SKILL_GRID_AUDIT__ || {};

      window.__SKILL_GRID_AUDIT__ = Object.assign({}, previous, {
        viewportFitReady: true,
        viewportFitApplied: true,
        viewportFitLastSource: source || 'final-viewport-hardener',
        viewportFitItemCount: after.itemCount,
        viewportFitOverflowCount: after.overflowCount,
        viewportFitMaxOverflow: after.maxOverflowPx,
        viewportFitShift: Number.parseFloat(grid.dataset.skillGridViewportShift || '0') || 0,
        viewportFitScale: Number.parseFloat(grid.dataset.skillGridViewportScale || '1') || 1,
        viewportFitLastError: null,
        updatedAt: new Date().toISOString()
      });
    } catch (_) {}

    return after.maxOverflowPx <= 0.5;
  }

  window.__PR6_HARDEN_SKILL_GRID_VIEWPORT__ = pr6FinalHardenSkillGridViewport;

  if (window.SkillGrid && !window.SkillGrid.__PR6_FINAL_VIEWPORT_WRAPPED__) {
    ['init', 'apply'].forEach(function (name) {
      var originalFn = window.SkillGrid[name];

      if (typeof originalFn !== 'function') return;

      window.SkillGrid[name] = function () {
        var args = arguments;
        var result = originalFn.apply(this, args);

        return Promise.resolve(result).then(function (value) {
          return pr6FinalHardenSkillGridViewport(
            args[0] || document,
            'skillgrid-' + name + '-final-viewport'
          ).then(function () {
            return value;
          });
        });
      };
    });

    if (typeof window.SkillGrid.snapshot === 'function') {
      var originalSnapshot = window.SkillGrid.snapshot;

      window.SkillGrid.snapshot = function () {
        var snap = originalSnapshot.apply(this, arguments);

        try {
          pr6FinalHardenSkillGridViewport(
            arguments[0] || document,
            'skillgrid-snapshot-final-viewport'
          ).catch(function () {});
        } catch (_) {}

        return snap;
      };
    }

    window.SkillGrid.__PR6_FINAL_VIEWPORT_WRAPPED__ = true;
  }

  document.addEventListener('pjax:ready', function (event) {
    window.setTimeout(function () {
      pr6FinalHardenSkillGridViewport(
        event && event.detail && event.detail.container ? event.detail.container : document,
        'pjax-ready-final-viewport'
      ).catch(function () {});
    }, 120);
  });

  window.addEventListener('resize', function () {
    window.clearTimeout(window.__PR6_FINAL_VIEWPORT_TIMER__);
    window.__PR6_FINAL_VIEWPORT_TIMER__ = window.setTimeout(function () {
      pr6FinalHardenSkillGridViewport(document, 'resize-final-viewport').catch(function () {});
    }, 140);
  });
})();
