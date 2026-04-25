import { expect, test } from '@playwright/test';
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';
import { attachNetworkProbe, assertNoLocalAssetFailures } from './utils/networkProbe';

const basePath = process.env.PREVIEW_BASE_PATH || '/flobehejohn/flobehejohn.github.io/preview/refactor-live/';
const url = `${basePath}contact.html`.replace(/\/+/g, '/').replace(':/', '://');

test('contact keeps Maps and GA4 disabled without explicit consent', async ({ page }) => {
  const consoleProbe = attachConsoleProbe(page);
  const networkProbe = attachNetworkProbe(page);
  const externalCalls: string[] = [];

  page.on('request', (request) => {
    const requestUrl = request.url();
    if (/maps\.googleapis\.com|google\.com\/maps|google-analytics|googletagmanager|\/g\/collect|\/collect/i.test(requestUrl)) {
      externalCalls.push(requestUrl);
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

  const fallbackVisible = await page.getByText(/Carte désactivée|ouvrir dans Google Maps/i).count();
  expect(fallbackVisible).toBeGreaterThan(0);
  expect(externalCalls, `Unexpected privacy-sensitive calls:\n${externalCalls.join('\n')}`).toEqual([]);

  assertNoFatalConsole(consoleProbe);
  assertNoLocalAssetFailures(networkProbe);
});
