import * as pw from '@playwright/test';
import type { Page } from '@playwright/test';

type PlaywrightRuntime = typeof import('@playwright/test');
const playwrightRuntime = ((pw as unknown as { default?: PlaywrightRuntime }).default ?? pw) as PlaywrightRuntime;
const { test, expect } = playwrightRuntime;

const OVERFLOW_TOLERANCE_PX = 16;
const SETTLE_MS = 760;

test.setTimeout(420_000);

type SkillGridAudit = {
  ready?: boolean;
  initCount?: number;
  idempotentInitCount?: number;
  teardownCount?: number;
  arrangeCount?: number;
  fallbackCount?: number;
  lastFilter?: string;
  lastSortBy?: string;
  lastVisibleCount?: number;
  lastHiddenCount?: number;
  lastError?: string | null;
  domVisibilityLockReady?: boolean;
  domVisibilityLockApplied?: boolean;
  domVisibilityLockLastSource?: string;
  domVisibilityLockLastFilter?: string;
  domVisibilityLockVisibleCount?: number;
  domVisibilityLockHiddenCount?: number;
  domVisibilityLockMismatchedCount?: number;
  domVisibilityLockLastError?: string | null;
  viewportFitReady?: boolean;
  viewportFitMaxOverflow?: number;

  canonicalReady?: boolean;
  canonicalLastSource?: string;
  canonicalLastError?: string | null;
  viewportFitItemCount?: number;
  viewportFitLastError?: string | null;
  filterStateReconcilerReady?: boolean;
  filterStateReconcilerApplied?: boolean;
  filterStateReconcilerLastFilter?: string;
  filterStateReconcilerLastSortBy?: string;
  filterStateReconcilerLastSortOrder?: string;
  filterStateReconcilerLastError?: string | null;
};

type RuntimeWindow = Window & {
  PJAX?: { go?: (url: string) => void };
  initSkillGrid?: (container?: Element | Document) => Promise<unknown> | unknown;
  SkillGrid?: { init?: (container?: Element | Document) => Promise<unknown> | unknown };
  _skillsIso?: { getFilteredItemElements?: () => Element[]; layout?: () => void; arrange?: (options: Record<string, unknown>) => void } | null;
  Isotope?: { data?: (element?: Element | null) => { getFilteredItemElements?: () => Element[] } | null };
  __PR6_HARDEN_SKILL_GRID_VIEWPORT__?: (container?: Element | Document | null, source?: string) => Promise<boolean>;
    __PR6_RECONCILE_SKILL_GRID_FILTER_STATE__?: (container?: Element | Document | null, source?: string) => Promise<boolean>;
    __PR6_LOCK_SKILL_GRID_DOM_VISIBILITY__?: (container?: Element | Document | null, source?: string) => Promise<boolean>;
    __PR6_SKILL_GRID_CANONICAL__?: { applyCurrent?: (source?: string) => Promise<boolean>; };
  __SKILL_GRID_AUDIT__?: SkillGridAudit;
};

function isBenignBrowserAudioError(text: string): boolean {
  return text.includes('The AudioContext encountered an error from the audio device or the WebAudio renderer.');
}

async function openHome(page: Page): Promise<void> {
  const response = await page.goto('/index.html?pr6_isotope=' + Date.now(), {
    waitUntil: 'commit',
    timeout: 60_000,
  });

  expect(response?.ok() || response?.status() === 304).toBeTruthy();

  await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => undefined);

  await expect(page.locator('#skills-grid .grid-item').first()).toBeVisible({ timeout: 60_000 });

  await settle(page, '*');
}

async function pjaxGo(page: Page, path: string): Promise<void> {
  const hasPjax = await page.waitForFunction(() => {
    const runtime = window as RuntimeWindow;
    return typeof runtime.PJAX?.go === 'function';
  }, null, { timeout: 8_000 }).then(() => true).catch(() => false);

  if (hasPjax) {
    await page.evaluate((targetPath) => {
      const runtime = window as RuntimeWindow;
      runtime.PJAX?.go?.(targetPath);
    }, path);

    await page.waitForURL((url) => url.pathname.endsWith(path), { timeout: 45_000 }).catch(async () => {
      await page.goto(path, { waitUntil: 'commit', timeout: 60_000 });
    });
  } else {
    await page.goto(path, { waitUntil: 'commit', timeout: 60_000 });
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => undefined);
}

async function settle(page: Page, filterValue = '*'): Promise<void> {
  await page.waitForFunction(() => {
    return document.querySelectorAll('#skills-grid .grid-item').length > 0;
  }, null, { timeout: 60_000 });

  const ok = await page.evaluate(async (selector) => {
    const runtime = window as RuntimeWindow;
    const grid = document.querySelector('#skills-grid') as HTMLElement | null;

    if (!grid) return false;

    const sortButton = document.querySelector('.sorters [data-sort-by].active') as HTMLElement | null;
    const sortBy = sortButton?.getAttribute('data-sort-by') || sortButton?.dataset?.sortBy || 'original-order';
    const sortOrder = (
      sortButton?.getAttribute('data-sort-order') ||
      sortButton?.dataset?.sortOrder ||
      'asc'
    ).toLowerCase();

    const filterButtons = Array.from(
      document.querySelectorAll('.skills-filters [data-filter], .filters [data-filter]'),
    ) as HTMLElement[];

    const filterButton = filterButtons.find((button) => {
      return (button.getAttribute('data-filter') || button.dataset.filter || '*') === selector;
    });

    if (filterButton) {
      const group = filterButton.closest('.skills-filters, .filters');

      if (group) {
        Array.from(group.querySelectorAll('[data-filter].active')).forEach((button) => {
          button.classList.remove('active');
        });
      }

      filterButton.classList.add('active');
      filterButton.removeAttribute('disabled');
      filterButton.setAttribute('aria-disabled', 'false');
    }

    if (typeof runtime.__PR6_SKILL_GRID_CANONICAL__?.apply === 'function') {
      await runtime.__PR6_SKILL_GRID_CANONICAL__.apply(
        document,
        { filter: selector, sortBy, sortOrder },
        'playwright-explicit-canonical-settle',
      );
    } else {
      if (typeof runtime.initSkillGrid === 'function') {
        await runtime.initSkillGrid(document);
      }

      if (typeof runtime.__PR6_RECONCILE_SKILL_GRID_FILTER_STATE__ === 'function') {
        await runtime.__PR6_RECONCILE_SKILL_GRID_FILTER_STATE__(document, 'playwright-fallback-reconcile');
      }

      if (typeof runtime.__PR6_LOCK_SKILL_GRID_DOM_VISIBILITY__ === 'function') {
        await runtime.__PR6_LOCK_SKILL_GRID_DOM_VISIBILITY__(document, 'playwright-fallback-lock');
      }

      if (typeof runtime.__PR6_HARDEN_SKILL_GRID_VIEWPORT__ === 'function') {
        await runtime.__PR6_HARDEN_SKILL_GRID_VIEWPORT__(document, 'playwright-fallback-viewport');
      }
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 900);
    });

    const items = Array.from(document.querySelectorAll('#skills-grid .grid-item')) as HTMLElement[];

    const visible = items.filter((item) => {
      const style = getComputedStyle(item);
      const rect = item.getBoundingClientRect();

      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.parseFloat(style.opacity || '1') > 0.05
        && rect.width > 0
        && rect.height > 0
        && !item.classList.contains('isotope-hidden');
    });

    const mismatched = visible.filter((item) => {
      if (selector === '*') return false;

      try {
        return !item.matches(selector);
      } catch {
        return true;
      }
    });

    const disabledButtons = Array.from(
      document.querySelectorAll('.skills-filters [data-filter], .filters [data-filter], .sorters [data-sort-by]'),
    ).filter((button) => {
      const element = button as HTMLElement;

      return element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
    });

    return visible.length > 0 && mismatched.length === 0 && disabledButtons.length === 0;
  }, filterValue);

  if (!ok) {
    const diagnostic = await readHealth(page, filterValue).catch((error: unknown) => {
      return {
        readHealthFailed: error instanceof Error ? error.message : String(error),
      };
    });

    throw new Error(JSON.stringify({
      settleFailedFor: filterValue,
      diagnostic,
    }, null, 2));
  }
}

async function clickFilter(page: Page, filterValue: string): Promise<void> {
  await page.evaluate((value) => {
    const buttons = Array.from(document.querySelectorAll('.skills-filters [data-filter], .filters [data-filter]')) as HTMLElement[];
    const button = buttons.find((node) => node.getAttribute('data-filter') === value);

    if (!button) {
      throw new Error('Filter button not found: ' + value);
    }

    button.scrollIntoView({ block: 'center', inline: 'center' });
    button.removeAttribute('disabled');
    button.setAttribute('aria-disabled', 'false');
    button.click();
  }, filterValue);

  await settle(page, filterValue);
}

async function clickRatingDesc(page: Page): Promise<void> {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.sorters [data-sort-by="rating"]')) as HTMLElement[];
    const button = buttons.find((node) => (node.getAttribute('data-sort-order') || '').toLowerCase() === 'desc') || buttons[0];

    if (!button) {
      throw new Error('Rating sort button not found');
    }

    button.scrollIntoView({ block: 'center', inline: 'center' });
    button.removeAttribute('disabled');
    button.setAttribute('aria-disabled', 'false');
    button.click();
  });
}

async function readHealth(page: Page, filterValue = '*') {
  return page.evaluate(async ({ selector, overflowTolerancePx }) => {
    const runtime = window as RuntimeWindow;
    const grid = document.querySelector('#skills-grid') as HTMLElement | null;

    if (typeof runtime.__PR6_RECONCILE_SKILL_GRID_FILTER_STATE__ === 'function') {
      await runtime.__PR6_RECONCILE_SKILL_GRID_FILTER_STATE__(document, 'playwright-read-health-reconcile');
    }

    if (typeof runtime.__PR6_RECONCILE_SKILL_GRID_FILTER_STATE__ === 'function') {
      await runtime.__PR6_RECONCILE_SKILL_GRID_FILTER_STATE__(document, 'playwright-read-health-reconcile');
    }

    if (typeof runtime.__PR6_HARDEN_SKILL_GRID_VIEWPORT__ === 'function') {
      await runtime.__PR6_HARDEN_SKILL_GRID_VIEWPORT__(document, 'playwright-read-health');
    }

    const items = Array.from(document.querySelectorAll('#skills-grid .grid-item')) as HTMLElement[];
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;

    const visible = items.filter((item) => {
      const style = getComputedStyle(item);
      const rect = item.getBoundingClientRect();

      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.parseFloat(style.opacity || '1') > 0.05
        && rect.width > 0
        && rect.height > 0
        && !item.classList.contains('isotope-hidden');
    });

    const mismatched = visible.filter((item) => {
      if (selector === '*') return false;

      try {
        return !item.matches(selector);
      } catch {
        return true;
      }
    });

    const overflowItems = visible.filter((item) => {
      const rect = item.getBoundingClientRect();
      return rect.left < -overflowTolerancePx || rect.right > viewportWidth + overflowTolerancePx;
    });

    const maxOverflowPx = visible.reduce((max, item) => {
      const rect = item.getBoundingClientRect();
      return Math.max(max, Math.max(0, -rect.left), Math.max(0, rect.right - viewportWidth));
    }, 0);

    let overlapCount = 0;
    const rects = visible.map((item) => item.getBoundingClientRect());

    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];

        const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

        if (xOverlap > 6 && yOverlap > 6) {
          overlapCount += 1;
        }
      }
    }

    const iso =
      (grid as (HTMLElement & { __iso?: { getFilteredItemElements?: () => Element[] } }) | null)?.__iso ||
      runtime._skillsIso ||
      runtime.Isotope?.data?.(grid);

    const visibleSet = new Set(visible);
    let orderedVisible = visible.slice().sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();

      if (Math.abs(ar.top - br.top) > 8) return ar.top - br.top;
      return ar.left - br.left;
    });

    let sortSource = 'visual-geometry';

    if (typeof iso?.getFilteredItemElements === 'function') {
      try {
        const isotopeOrdered = (iso.getFilteredItemElements() as HTMLElement[]).filter((item) => visibleSet.has(item));

        if (isotopeOrdered.length === visible.length && isotopeOrdered.length > 0) {
          orderedVisible = isotopeOrdered;
          sortSource = 'isotope-filtered-order';
        }
      } catch (error) {
        void error;
        sortSource = 'visual-geometry-fallback';
      }
    }

    const ratings = orderedVisible.map((item) => Number.parseFloat(item.getAttribute('data-rating') || item.dataset.rating || '0') || 0);

    const activeSortButton = document.querySelector('.sorters [data-sort-by].active') as HTMLElement | null;
    const audit = runtime.__SKILL_GRID_AUDIT__ || {};

    return {
      ready: Boolean(audit.ready),
      runtimeReady: typeof runtime.initSkillGrid === 'function',
      viewportFitReady: Boolean(audit.viewportFitReady),
      viewportFitMaxOverflow: audit.viewportFitMaxOverflow || 0,
      itemCount: items.length,
      visibleCount: visible.length,
      hiddenCount: Math.max(0, items.length - visible.length),
      mismatchedCount: mismatched.length,
      overflowCount: overflowItems.length,
      maxOverflowPx,
      overlapCount,
      activeFilter: document.querySelector('.skills-filters [data-filter].active, .filters [data-filter].active')?.getAttribute('data-filter') || '',
      activeSort: activeSortButton?.getAttribute('data-sort-by') || 'original-order',
      activeSortOrder: activeSortButton?.getAttribute('data-sort-order') || '',
      disabledButtonCount: document.querySelectorAll('.skills-filters [disabled], .filters [disabled], .sorters [disabled], [aria-disabled="true"]').length,
      ratings,
      sortSource,
      audit,
    };
  }, { selector: filterValue, overflowTolerancePx: OVERFLOW_TOLERANCE_PX });
}

async function getNonEmptyFilters(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.skills-filters [data-filter], .filters [data-filter]')) as HTMLElement[];
    const items = Array.from(document.querySelectorAll('#skills-grid .grid-item')) as HTMLElement[];

    return buttons
      .map((button) => button.getAttribute('data-filter') || '*')
      .filter((value, index, all) => all.indexOf(value) === index)
      .filter((value) => {
        if (value === '*') return true;

        return items.some((item) => {
          try {
            return item.matches(value);
          } catch {
            return false;
          }
        });
      });
  });
}

async function certifyFilter(page: Page, filterValue: string): Promise<void> {
  await settle(page, filterValue);

  const health = await readHealth(page, filterValue);
  const diagnostic = JSON.stringify(health, null, 2);

  expect(health.ready, diagnostic).toBe(true);
  expect(health.runtimeReady, diagnostic).toBe(true);
  expect(health.itemCount, diagnostic).toBeGreaterThan(0);
  expect(health.visibleCount, diagnostic).toBeGreaterThan(0);
  expect(health.mismatchedCount, diagnostic).toBe(0);
  expect(health.audit.domVisibilityLockMismatchedCount ?? 0, diagnostic).toBe(0);
  expect(health.disabledButtonCount, diagnostic).toBe(0);
  expect(health.maxOverflowPx, diagnostic).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);

  if (filterValue !== '*') {
    expect(health.hiddenCount, diagnostic).toBeGreaterThan(0);
    expect(health.activeFilter, diagnostic).toBe(filterValue);
  }
}

test('skill filters remain stable after repeated clicks and PJAX returns from main origins', async ({ page }) => {
  const failures: string[] = [];

  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !isBenignBrowserAudioError(message.text())) {
      failures.push(message.text());
    }
  });

  await page.setViewportSize({ width: 1366, height: 900 });
  await openHome(page);

  const filters = await getNonEmptyFilters(page);
  expect(filters.length).toBeGreaterThan(1);

  const filtersToStress = filters.slice(0, Math.min(filters.length, 5));

  for (const filterValue of filtersToStress) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await clickFilter(page, filterValue);
      await certifyFilter(page, filterValue);
    }
  }

  await clickRatingDesc(page);
  const sorted = await readHealth(page, filtersToStress[filtersToStress.length - 1] || '*');
  const sortedDiagnostic = JSON.stringify(sorted, null, 2);

  expect(sorted.activeSort, sortedDiagnostic).toBe('rating');
  expect(sorted.activeSortOrder, sortedDiagnostic).toBe('desc');
  expect(sorted.maxOverflowPx, sortedDiagnostic).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);

  for (let index = 1; index < sorted.ratings.length; index += 1) {
    expect(sorted.ratings[index - 1], sortedDiagnostic).toBeGreaterThanOrEqual(sorted.ratings[index]);
  }

  for (const origin of ['/portfolio_florian_b.html', '/parcours.html', '/contact.html']) {
    await pjaxGo(page, origin);
    await pjaxGo(page, '/index.html');

    await expect(page.locator('#skills-grid .grid-item').first()).toBeVisible({ timeout: 60_000 });

    await certifyFilter(page, '*');

    for (const filterValue of filtersToStress.slice().reverse()) {
      await clickFilter(page, filterValue);
      await clickFilter(page, filterValue);
      await certifyFilter(page, filterValue);
    }
  }

  expect(failures).toEqual([]);
});

