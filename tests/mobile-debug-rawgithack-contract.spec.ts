import * as pw from '@playwright/test';
type PlaywrightRuntime = typeof import('@playwright/test');
const playwrightRuntime = ((pw as unknown as { default?: PlaywrightRuntime }).default ?? pw) as PlaywrightRuntime;
const { test, expect } = playwrightRuntime;


test.setTimeout(120_000);

const basePath = process.env.PREVIEW_BASE_PATH || '/flobehejohn/flobehejohn.github.io/preview/refactor-live/';

function previewUrl(path: string): string {
  return `${basePath}${path}`.replace(/\/+/g, '/').replace(':/', '://');
}

test.describe('RawGitHack mobile audit module', () => {
  test('remains inactive without explicit query parameter', async ({ page }) => {
    await page.goto(previewUrl('index.html'), { waitUntil: 'domcontentloaded' });
    const audit = await page.evaluate(() => window.__RAWGITHACK_MOBILE_AUDIT__);
    expect(audit?.active).toBe(false);
    await expect(page.locator('[data-rawgithack-mobile-debug]')).toHaveCount(0);
  });

  test('shows a copyable diagnostic panel when explicitly enabled', async ({ page }) => {
    await page.goto(`${previewUrl('index.html')}?debug=rawgithack`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rawgithack-mobile-debug]')).toBeVisible();
    await expect(page.locator('[data-rmd-copy]')).toBeVisible();

    const audit = await page.evaluate(() => window.__RAWGITHACK_MOBILE_AUDIT__.snapshot());
    expect(audit.active).toBe(true);
    expect(audit.privacy.readOnly).toBe(true);
    expect(audit.privacy.externalTransmissions).toBe(0);
    expect(audit.version).toContain('mobile-debug');
  });
});
