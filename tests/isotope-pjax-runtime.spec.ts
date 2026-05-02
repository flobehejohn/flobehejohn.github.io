import * as pw from '@playwright/test';
import type { Page } from '@playwright/test';

type PlaywrightRuntime = typeof import('@playwright/test');
const playwrightRuntime = ((pw as unknown as { default?: PlaywrightRuntime }).default ?? pw) as PlaywrightRuntime;
const { test, expect } = playwrightRuntime;

test.setTimeout(120_000);

type SkillGridAudit = {
  ready?: boolean;
  arrangeCount?: number;
  lastFilter?: string;
  lastSortBy?: string;
  lastMovedCount?: number;
  lastVisibleCount?: number;
  lastHiddenCount?: number;
  transitionDurationMs?: number;
  lastError?: string | null;
};

async function pjaxGo(page: Page, path: string): Promise<void> {
  await page.waitForFunction(() => {
    const runtime = window as unknown as { PJAX?: { go?: (url: string) => void } };
    return typeof runtime.PJAX?.go === 'function';
  });

  await page.evaluate((targetPath) => {
    const runtime = window as unknown as { PJAX?: { go?: (url: string) => void } };
    runtime.PJAX?.go?.(targetPath);
  }, path);

  await page.waitForURL((url) => url.pathname.endsWith(path), { timeout: 45_000 });
}

async function domClick(page: Page, selector: string): Promise<void> {
  const locator = page.locator(selector).first();
  await expect(locator, `missing clickable selector: ${selector}`).toHaveCount(1);
  await locator.evaluate((element) => {
    const html = element as HTMLElement;
    html.scrollIntoView({ block: 'center', inline: 'center' });
    html.click();
  });
}

async function readGridState(page: Page) {
  return page.evaluate(() => {
    const grid = document.querySelector('#skills-grid') as HTMLElement | null;
    const items = Array.from(document.querySelectorAll('#skills-grid .grid-item')) as HTMLElement[];
    const audit = (window as unknown as { __SKILL_GRID_AUDIT__?: SkillGridAudit }).__SKILL_GRID_AUDIT__ || {};

    const visibleItems = items.filter((item) => {
      const style = getComputedStyle(item);
      const rect = item.getBoundingClientRect();

      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.parseFloat(style.opacity || '1') > 0.05
        && rect.width > 0
        && rect.height > 0
        && !item.classList.contains('isotope-hidden');
    });

    const firstVisible = visibleItems[0];
    const firstStyle = firstVisible ? getComputedStyle(firstVisible) : null;
    const transitionDuration = firstStyle?.transitionDuration || '';
    const transitionProperty = firstStyle?.transitionProperty || '';

    const transitionMs = transitionDuration
      .split(',')
      .map((value) => value.trim())
      .map((value) => value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000)
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => b - a)[0] || 0;

    return {
      gridReady: grid?.dataset.skillGridReady === '1',
      motionCertified: grid?.dataset.skillGridMotion === 'certified',
      itemCount: items.length,
      visibleCount: visibleItems.length,
      hiddenCount: Math.max(0, items.length - visibleItems.length),
      activeFilter: document.querySelector('.skills-filters [data-filter].active')?.getAttribute('data-filter') || '',
      activeSort: document.querySelector('.sorters [data-sort-by].active')?.getAttribute('data-sort-by') || '',
      transitionMs,
      transitionProperty,
      audit,
    };
  });
}

test('Isotope skill grid survives PJAX return and keeps controlled motion', async ({ page }) => {
  const failures: string[] = [];

  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });

  await page.goto('/portfolio_florian_b.html', { waitUntil: 'domcontentloaded' });
  await pjaxGo(page, '/index.html');

  await expect(page.locator('main[data-pjax-root][data-page="home"]')).toHaveCount(1);
  await expect(page.locator('#skills-grid .grid-item').first()).toBeVisible({ timeout: 45_000 });

  const initial = await readGridState(page);
  expect(initial.itemCount).toBeGreaterThan(10);
  expect(initial.visibleCount).toBeGreaterThan(0);

  await domClick(page, '.sorters [data-sort-by="rating"][data-sort-order="desc"]');

  await page.waitForFunction(() => {
    const audit = (window as unknown as { __SKILL_GRID_AUDIT__?: SkillGridAudit }).__SKILL_GRID_AUDIT__;
    const activeSort = document.querySelector('.sorters [data-sort-by].active')?.getAttribute('data-sort-by') || '';
    return activeSort === 'rating' || audit?.lastSortBy === 'rating';
  }, null, { timeout: 30_000 });

  await page.waitForTimeout(900);

  const sorted = await readGridState(page);
  expect(sorted.activeSort).toBe('rating');
  expect(sorted.gridReady || sorted.audit.ready).toBeTruthy();
  expect(sorted.motionCertified).toBeTruthy();
  expect(sorted.transitionMs).toBeGreaterThanOrEqual(400);
  expect(sorted.transitionProperty).toMatch(/transform|all/i);
  expect(sorted.audit.lastError || null).toBeNull();

  await domClick(page, '.skills-filters [data-filter=".code"]');

  await page.waitForFunction(() => {
    const audit = (window as unknown as { __SKILL_GRID_AUDIT__?: SkillGridAudit }).__SKILL_GRID_AUDIT__;
    const activeFilter = document.querySelector('.skills-filters [data-filter].active')?.getAttribute('data-filter') || '';
    return activeFilter === '.code' || audit?.lastFilter === '.code';
  }, null, { timeout: 30_000 });

  await page.waitForTimeout(900);

  const filtered = await readGridState(page);
  expect(filtered.activeFilter).toBe('.code');
  expect(filtered.visibleCount).toBeGreaterThan(0);
  expect(filtered.hiddenCount).toBeGreaterThan(0);
  expect(filtered.motionCertified).toBeTruthy();
  expect(filtered.audit.lastError || null).toBeNull();

  expect(failures).toEqual([]);
});
