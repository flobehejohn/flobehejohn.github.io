import { expect, test } from '@playwright/test';
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';
import { attachNetworkProbe, assertNoLocalAssetFailures } from './utils/networkProbe';

const basePath = process.env.PREVIEW_BASE_PATH || '/flobehejohn/flobehejohn.github.io/preview/refactor-live/';
const url = `${basePath}assets/portfolio/Projet_dotnet/app_dotnet.html`.replace(/\/+/g, '/').replace(':/', '://');

test('DotNet demo is available or controlled fallback under RawGitHack base path', async ({ page }) => {
  const consoleProbe = attachConsoleProbe(page);
  const networkProbe = attachNetworkProbe(page);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

  const audit = await page.evaluate(() => window.__DOTNET_AUDIT__ || null);
  const hasIframe = await page.locator('iframe').count();
  const hasControlledFallback = await page.locator('[data-fallback-controlled="true"], .fallback, [role="status"]').count();
  const hasDemoSurface = await page.locator('[data-page="dotnet_demo"], #app-modal, [data-dotnet-demo]').count();

  expect(Boolean(audit) || hasIframe > 0 || hasControlledFallback > 0 || hasDemoSurface > 0).toBeTruthy();

  if (audit) {
    expect(Boolean(audit.initialized || audit.fallbackControlled || audit.iframeReady)).toBeTruthy();
  }

  const badUrls = networkProbe.responses
    .map((response) => response.url)
    .filter((value) => /https:\/\/raw\.githack\.com\/assets\/portfolio\/Projet_dotnet\//.test(value));
  expect(badUrls, `Bad DotNet app base URLs:\n${badUrls.join('\n')}`).toEqual([]);

  assertNoFatalConsole(consoleProbe);
  assertNoLocalAssetFailures(networkProbe);
});
