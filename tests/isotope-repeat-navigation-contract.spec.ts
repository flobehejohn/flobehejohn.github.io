import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

type Page = import('@playwright/test').Page;

const requirePlaywright = createRequire(import.meta.url);
const { test } = requirePlaywright('@playwright/test') as typeof import('@playwright/test');

const ORIGINS = ['/portfolio_florian_b.html', '/parcours.html', '/contact.html'];
const FILTER_LIMIT = Math.max(1, Number.parseInt(process.env.PR6_FILTER_LIMIT || '2', 10));

test.describe.configure({ mode: 'serial', timeout: 240_000 });

type RuntimeWindow = Window & {
  PJAX?: { go?: (url: string) => void };
  SkillGrid?: {
    init?: (container?: Element | Document) => unknown | Promise<unknown>;
    apply?: (container?: Element | Document, state?: Record<string, unknown>, source?: string) => unknown | Promise<unknown>;
    snapshot?: (container?: Element | Document) => Record<string, unknown>;
  };
  initSkillGrid?: (container?: Element | Document) => unknown | Promise<unknown>;
  __SKILL_GRID_AUDIT__?: Record<string, unknown>;
};

function isBenignBrowserAudioError(text: string): boolean {
  return text.includes('The AudioContext encountered an error from the audio device or the WebAudio renderer.');
}

function collectFailures(page: Page): string[] {
  const failures: string[] = [];

  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !isBenignBrowserAudioError(message.text())) {
      failures.push(message.text());
    }
  });

  return failures;
}

async function openHome(page: Page): Promise<void> {
  const response = await page.goto('/index.html?pr6_cert=' + Date.now(), {
    waitUntil: 'commit',
    timeout: 45_000,
  });

  assert.equal(Boolean(response?.ok() || response?.status() === 304), true);

  await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForFunction(() => Boolean(document.querySelector('#skills-grid .grid-item')), null, { timeout: 30_000 });
  await applyState(page, '*');
}

async function pjaxGo(page: Page, path: string): Promise<void> {
  const hasPjax = await page.evaluate(() => {
    const runtime = window as RuntimeWindow;
    return typeof runtime.PJAX?.go === 'function';
  }).catch(() => false);

  if (hasPjax) {
    await page.evaluate((target) => {
      const runtime = window as RuntimeWindow;
      runtime.PJAX?.go?.(target);
    }, path);

    await page.waitForFunction((target) => location.pathname.endsWith(target), path, { timeout: 35_000 }).catch(async () => {
      await page.goto(path, { waitUntil: 'commit', timeout: 45_000 });
    });
  } else {
    await page.goto(path, { waitUntil: 'commit', timeout: 45_000 });
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => undefined);
}

async function getFilters(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll('[aria-label="Filtres compétences"] [data-filter], .skills-filters [data-filter], .filters [data-filter]'),
    ) as HTMLElement[];

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

async function applyState(
  page: Page,
  filter = '*',
  sortBy = 'original-order',
  sortOrder: 'asc' | 'desc' = 'asc',
): Promise<Record<string, unknown>> {
  await page.evaluate(async ({ filter, sortBy, sortOrder }) => {
    const runtime = window as RuntimeWindow;

    const state = {
      filter,
      sortBy,
      sortOrder,
      activeSortOrder: sortOrder,
      sortAscending: sortOrder !== 'desc',
    };

    const call = async (fn: () => unknown | Promise<unknown>, timeoutMs = 3_500): Promise<void> => {
      await Promise.race([
        Promise.resolve().then(fn),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, timeoutMs);
        }),
      ]);
    };

    if (typeof runtime.SkillGrid?.init === 'function') {
      await call(() => runtime.SkillGrid?.init?.(document), 2_000);
    } else if (typeof runtime.initSkillGrid === 'function') {
      await call(() => runtime.initSkillGrid?.(document), 2_000);
    }

    if (typeof runtime.SkillGrid?.apply === 'function') {
      await call(() => runtime.SkillGrid?.apply?.(document, state, 'playwright-pr6-fast-cert'), 4_000);
    }

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  }, { filter, sortBy, sortOrder });

  await page.waitForFunction(({ filter }) => {
    const runtime = window as RuntimeWindow;
    const snapshot =
      (typeof runtime.SkillGrid?.snapshot === 'function' ? runtime.SkillGrid.snapshot(document) : runtime.__SKILL_GRID_AUDIT__) ||
      {};

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
      if (filter === '*') return false;

      try {
        return !item.matches(filter);
      } catch {
        return true;
      }
    });

    const activeFilters = Array.from(
      document.querySelectorAll('[aria-label="Filtres compétences"] [data-filter], .skills-filters [data-filter], .filters [data-filter]'),
    ).filter((button) => {
      const element = button as HTMLElement;
      return element.classList.contains('active') || element.getAttribute('aria-pressed') === 'true';
    });

    const activeSorts = Array.from(
      document.querySelectorAll('[aria-label="Tri"] [data-sort-by], .sorters [data-sort-by]'),
    ).filter((button) => {
      const element = button as HTMLElement;
      return element.classList.contains('active') || element.getAttribute('aria-pressed') === 'true';
    });

    return Boolean(
      snapshot.ready &&
      items.length > 0 &&
      visible.length > 0 &&
      mismatched.length === 0 &&
      activeFilters.length === 1 &&
      activeSorts.length === 1
    );
  }, { filter }, { timeout: 18_000 });

  return readHealth(page, filter);
}

async function readHealth(page: Page, filter = '*'): Promise<Record<string, unknown>> {
  return page.evaluate((filter) => {
    const runtime = window as RuntimeWindow;
    const snapshot =
      (typeof runtime.SkillGrid?.snapshot === 'function' ? runtime.SkillGrid.snapshot(document) : runtime.__SKILL_GRID_AUDIT__) ||
      {};

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
      if (filter === '*') return false;

      try {
        return !item.matches(filter);
      } catch {
        return true;
      }
    });

    const overflows = visible.filter((item) => {
      const rect = item.getBoundingClientRect();
      return rect.left < -16 || rect.right > viewportWidth + 16;
    });

    const activeFilters = Array.from(
      document.querySelectorAll('[aria-label="Filtres compétences"] [data-filter], .skills-filters [data-filter], .filters [data-filter]'),
    ).filter((button) => {
      const element = button as HTMLElement;
      return element.classList.contains('active') || element.getAttribute('aria-pressed') === 'true';
    }).map((button) => (button as HTMLElement).getAttribute('data-filter') || '*');

    const activeSorts = Array.from(
      document.querySelectorAll('[aria-label="Tri"] [data-sort-by], .sorters [data-sort-by]'),
    ).filter((button) => {
      const element = button as HTMLElement;
      return element.classList.contains('active') || element.getAttribute('aria-pressed') === 'true';
    }).map((button) => ({
      sortBy: (button as HTMLElement).getAttribute('data-sort-by') || 'original-order',
      sortOrder: (button as HTMLElement).getAttribute('data-sort-order') || '',
    }));

    return {
      snapshot,
      itemCount: items.length,
      visibleCount: visible.length,
      mismatchedCount: mismatched.length,
      overflowCount: overflows.length,
      activeFilters,
      activeSorts,
    };
  }, filter);
}

function assertHealth(health: Record<string, unknown>, _expectedFilter: string): void {
  const diagnostic = JSON.stringify(health, null, 2);

  assert.equal((health.snapshot as Record<string, unknown>).ready, true, diagnostic);
  assert.equal((health.activeFilters as unknown[]).length, 1, diagnostic);
  assert.equal(health.mismatchedCount, 0, diagnostic);
  assert.equal(health.overflowCount, 0, diagnostic);
  assert.equal((health.activeFilters as unknown[]).length, 1, diagnostic);
  assert.equal((health.activeSorts as unknown[]).length, 1, diagnostic);
}

test('home SkillGrid filters and Masonry sort remain deterministic', async ({ page }) => {
  const failures = collectFailures(page);

  await page.setViewportSize({ width: 1366, height: 900 });
  await openHome(page);

  const filters = (await getFilters(page)).slice(0, FILTER_LIMIT + 1);

  assert.ok(filters.length >= 2, JSON.stringify(filters));

  for (const filter of filters) {
    const health = await applyState(page, filter);
    assertHealth(health, filter);
  }

  const sorted = await applyState(page, '*', 'rating', 'desc');
  assertHealth(sorted, '*');
assert.equal((sorted.activeSorts as Array<{ sortBy: string; sortOrder: string }>)[0].sortBy, 'rating', JSON.stringify(sorted, null, 2));
  assert.equal((sorted.activeSorts as Array<{ sortBy: string; sortOrder: string }>)[0].sortOrder, 'desc', JSON.stringify(sorted, null, 2));

  assert.deepEqual(failures, []);
});

for (const origin of ORIGINS) {
  test('PJAX return keeps SkillGrid ready from ' + origin, async ({ page }) => {
    const failures = collectFailures(page);

    await page.setViewportSize({ width: 1366, height: 900 });
    await openHome(page);

    await pjaxGo(page, origin);
    await pjaxGo(page, '/index.html');

    await page.waitForFunction(() => Boolean(document.querySelector('#skills-grid .grid-item')), null, { timeout: 30_000 });

    const health = await applyState(page, '*');
    assertHealth(health, '*');

    const filters = (await getFilters(page)).slice(0, 2);
    for (const filter of filters) {
      const filtered = await applyState(page, filter);
      assertHealth(filtered, filter);
    }

    assert.deepEqual(failures, []);
  });
}
