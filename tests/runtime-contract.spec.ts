import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

test('runtime home: audio facade, PJAX and playlist are available', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await expect(page.locator('#audioPlayer')).toHaveCount(1);
  await expect(page.locator('#openAudioPlayer')).toHaveCount(1);

  const runtime = await page.evaluate(async () => {
    const response = await fetch('/assets/audio/auto_radio/js/playlist.json', { cache: 'no-store' });
    const playlist = response.ok ? await response.json() : [];
    return {
      audioApp: Boolean(window.AudioApp),
      player: Boolean(window.PlayerSingleton),
      pageHub: Boolean(window.pageHub),
      pjax: Boolean(window.PJAX),
      analytics: Boolean(window.SiteAnalytics),
      usageSignals: Boolean(window.SiteUsageSignals),
      playlistOk: response.ok,
      playlistCount: Array.isArray(playlist) ? playlist.length : 0
    };
  });

  expect(runtime.audioApp).toBeTruthy();
  expect(runtime.player).toBeTruthy();
  expect(runtime.pageHub).toBeTruthy();
  expect(runtime.pjax).toBeTruthy();
  expect(runtime.analytics).toBeTruthy();
  expect(runtime.usageSignals).toBeTruthy();
  expect(runtime.playlistOk).toBeTruthy();
  expect(runtime.playlistCount).toBeGreaterThan(10);
});

test('runtime portfolio: vendors and project grid are available', async ({ page }) => {
  await page.goto('/portfolio_florian_b.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await expect(page.locator('.grid')).toHaveCount(1);
  await expect(page.locator('.carte-projet').first()).toBeVisible();

  const runtime = await page.evaluate(() => ({
    imagesLoaded: typeof window.imagesLoaded === 'function',
    isotope: typeof window.Isotope === 'function',
    cards: document.querySelectorAll('.carte-projet').length
  }));

  expect(runtime.imagesLoaded).toBeTruthy();
  expect(runtime.isotope).toBeTruthy();
  expect(runtime.cards).toBeGreaterThan(0);
});

test('runtime parcours: particle surface and analytics hooks exist', async ({ page }) => {
  await page.goto('/parcours.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await expect(page.locator('#cloud-bg')).toHaveCount(1);
  await expect(page.locator('#analyticsDashboard')).toHaveCount(1);
  await expect(page.locator('#analyticsToggle')).toHaveCount(1);

  const runtime = await page.evaluate(() => ({
    usageSignals: Boolean(window.SiteUsageSignals),
    analytics: Boolean(window.SiteAnalytics),
    cloud: Boolean(document.querySelector('#cloud-bg'))
  }));

  expect(runtime.usageSignals).toBeTruthy();
  expect(runtime.analytics).toBeTruthy();
  expect(runtime.cloud).toBeTruthy();
});
