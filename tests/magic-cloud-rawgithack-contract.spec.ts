import { expect, test } from '@playwright/test';
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';
import { attachNetworkProbe, assertNoLocalAssetFailures } from './utils/networkProbe';

const basePath = process.env.PREVIEW_BASE_PATH || '/flobehejohn/flobehejohn.github.io/preview/refactor-live/';
const url = `${basePath}assets/portfolio/nuage_magique/nuage_magique_def.html`.replace(/\/+/g, '/').replace(':/', '://');

test('nuage magique is usable or controlled fallback under RawGitHack base path', async ({ page }) => {
  const consoleProbe = attachConsoleProbe(page);
  const networkProbe = attachNetworkProbe(page);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

  const audit = await page.evaluate(() => window.__NUAGE_AUDIT__ || null);
  const hasCanvas = await page.locator('canvas').count();
  const hasControlledFallback = await page.locator('[data-fallback-controlled="true"], .fallback, [role="status"]').count();

  expect(Boolean(audit) || hasCanvas > 0 || hasControlledFallback > 0).toBeTruthy();

  if (audit) {
    expect(audit.rafLoops ?? 1).toBeLessThanOrEqual(1);
    expect(Boolean(audit.initialized || audit.fallbackControlled || audit.fontFallback)).toBeTruthy();
  }

  assertNoFatalConsole(consoleProbe);
  assertNoLocalAssetFailures(networkProbe);
});
