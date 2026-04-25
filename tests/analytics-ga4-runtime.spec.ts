import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

test('analytics truth contract: local signals exist but GA4 is not falsely certified', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => {
    const globals = window as unknown as Record<string, unknown>;
    const scripts = Array.from(document.scripts).map((script) => script.src).filter(Boolean);
    const gaScript = scripts.find((src) => /googletagmanager\.com\/gtag\/js\?id=G-/i.test(src)) || '';
    return {
      hasLocalSignals: Boolean(globals.SiteUsageSignals || globals.SiteAnalytics),
      hasDataLayer: Array.isArray(globals.dataLayer),
      hasGtag: typeof globals.gtag === 'function',
      gaScript,
      hasRealMeasurementId: /id=G-[A-Z0-9]+/i.test(gaScript)
    };
  });

  expect(state.hasLocalSignals).toBeTruthy();
  expect(state.hasRealMeasurementId, 'No real GA4 Measurement ID is configured yet; do not report GA4 as installed').toBeFalsy();
  expect(state.hasGtag && state.hasDataLayer && state.hasRealMeasurementId).toBeFalsy();
});
