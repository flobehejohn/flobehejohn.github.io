import * as pw from '@playwright/test';
type PlaywrightRuntime = typeof import('@playwright/test');
const playwrightRuntime = ((pw as unknown as { default?: PlaywrightRuntime }).default ?? pw) as PlaywrightRuntime;
const { test, expect } = playwrightRuntime;


test.setTimeout(120_000);
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';
import { attachNetworkProbe, assertNoLocalAssetFailures } from './utils/networkProbe';

const basePath = process.env.PREVIEW_BASE_PATH || '/flobehejohn/flobehejohn.github.io/preview/refactor-live/';
const url = `${basePath}assets/portfolio/projet_synth/main_synth_fm.html`.replace(/\/+/g, '/').replace(':/', '://');

test('Synth module is visible or controlled fallback under RawGitHack base path', async ({ page }) => {
  const consoleProbe = attachConsoleProbe(page);
  const networkProbe = attachNetworkProbe(page);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

  const surfaceCount = await page.locator('main, canvas, button, input, [data-fallback-controlled="true"], .fallback, [role="status"]').count();
  expect(surfaceCount).toBeGreaterThan(0);

  assertNoFatalConsole(consoleProbe);
  assertNoLocalAssetFailures(networkProbe);
});
