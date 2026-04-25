import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

const pages = ['/', '/portfolio_florian_b.html', '/parcours.html', '/contact.html'];

for (const route of pages) {
  test(`particles visible on ${route}`, async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400 && /\/assets\//.test(response.url())) failures.push(`${response.status()} ${response.url()}`);
    });

    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2600);

    const probe = await page.evaluate(() => {
      const cloud = document.querySelector('#cloud-bg') as HTMLElement | null;
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const scripts = Array.from(document.scripts).filter((script) => /nuage_magique\/test\.js/.test(script.src)).length;
      const visibleCanvases = canvases.filter((canvas) => {
        const rect = canvas.getBoundingClientRect();
        const style = getComputedStyle(canvas);
        return rect.width > 32 && rect.height > 32 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0;
      }).length;
      const cloudVisible = (() => {
        if (!cloud) return false;
        const rect = cloud.getBoundingClientRect();
        const style = getComputedStyle(cloud);
        return rect.width > 32 && rect.height > 32 && style.display !== 'none' && style.visibility !== 'hidden';
      })();
      return { scripts, canvases: canvases.length, visibleCanvases, cloudVisible };
    });

    expect(probe.scripts, `${route} should load nuage bootstrap`).toBeGreaterThan(0);
    expect(probe.cloudVisible, `${route} #cloud-bg should be visible`).toBeTruthy();
    expect(probe.canvases, `${route} should create at least one canvas`).toBeGreaterThan(0);
    expect(probe.visibleCanvases, `${route} should expose visible canvas`).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
}

test('particles survive navigation from home to portfolio', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.goto('/portfolio_florian_b.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const canvases = await page.locator('canvas').count();
  const scripts = await page.locator('script[src*="nuage_magique/test.js"]').count();
  expect(scripts).toBeGreaterThan(0);
  expect(canvases).toBeGreaterThan(0);
});
