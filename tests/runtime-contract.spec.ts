import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

/* PR6_RUNTIME_CONTRACT_HARDENED_V1 */
test.setTimeout(120_000);

async function waitForRuntimeGlobals(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const globals = window as unknown as Record<string, unknown>;

    return Boolean(globals.pageHub)
      && Boolean(globals.PJAX)
      && Boolean(globals.SiteAnalytics)
      && Boolean(globals.SiteUsageSignals);
  }, null, { timeout: 60_000 });
}

async function waitForAudioRuntime(page: import('@playwright/test').Page) {
  await expect(page.locator('#audioPlayer')).toHaveCount(1, { timeout: 60_000 });
  await expect(page.locator('#openAudioPlayer')).toHaveCount(1, { timeout: 60_000 });

  await page.waitForFunction(() => {
    const globals = window as unknown as Record<string, unknown>;

    return Boolean(globals.AudioApp)
      || Boolean(globals.PlayerSingleton)
      || Boolean(document.querySelector('#audioPlayer'));
  }, null, { timeout: 60_000 });
}

test('runtime home: audio facade, PJAX and playlist are available', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await waitForRuntimeGlobals(page);
  await waitForAudioRuntime(page);

  const playlistResponse = await request.get('/assets/audio/auto_radio/js/playlist.json', {
    timeout: 45_000,
  });

  const playlist = playlistResponse.ok()
    ? await playlistResponse.json()
    : [];

  const runtime = await page.evaluate(() => {
    const globals = window as unknown as Record<string, unknown>;

    return {
      audioApp: Boolean(globals.AudioApp),
      player: Boolean(globals.PlayerSingleton),
      pageHub: Boolean(globals.pageHub),
      pjax: Boolean(globals.PJAX),
      analytics: Boolean(globals.SiteAnalytics),
      usageSignals: Boolean(globals.SiteUsageSignals),
      audioElements: document.querySelectorAll('#audioPlayer').length,
      openAudioButtons: document.querySelectorAll('#openAudioPlayer').length,
    };
  });

  expect(runtime.audioApp || runtime.player).toBeTruthy();
  expect(runtime.audioElements).toBe(1);
  expect(runtime.openAudioButtons).toBe(1);
  expect(runtime.pageHub).toBeTruthy();
  expect(runtime.pjax).toBeTruthy();
  expect(runtime.analytics).toBeTruthy();
  expect(runtime.usageSignals).toBeTruthy();
  expect(playlistResponse.ok()).toBeTruthy();
  expect(Array.isArray(playlist) ? playlist.length : 0).toBeGreaterThan(10);
});

test('runtime portfolio: vendors and project grid are available', async ({ page }) => {
  await page.goto('/portfolio_florian_b.html', { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => {
    const globals = window as unknown as Record<string, unknown>;
    const grid = document.querySelector('.grid') as HTMLElement | null;
    const cards = Array.from(document.querySelectorAll('.carte-projet, .grid-item'));

    const gridVisible = (() => {
      if (!grid) return false;
      const rect = grid.getBoundingClientRect();
      const style = getComputedStyle(grid);

      return rect.width > 0
        && rect.height >= 0
        && style.display !== 'none'
        && style.visibility !== 'hidden';
    })();

    const visibleCards = cards.filter((card) => {
      const element = card as HTMLElement;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);

      return rect.width > 0
        && rect.height > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden';
    }).length;

    return typeof globals.imagesLoaded === 'function'
      && typeof globals.Isotope === 'function'
      && Boolean(grid)
      && gridVisible
      && visibleCards > 0;
  }, null, { timeout: 75_000 });

  const runtime = await page.evaluate(() => {
    const globals = window as unknown as Record<string, unknown>;
    const grid = document.querySelector('.grid') as HTMLElement | null;
    const cards = Array.from(document.querySelectorAll('.carte-projet, .grid-item'));

    const visibleCards = cards.filter((card) => {
      const element = card as HTMLElement;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);

      return rect.width > 0
        && rect.height > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden';
    }).length;

    return {
      imagesLoaded: typeof globals.imagesLoaded === 'function',
      isotope: typeof globals.Isotope === 'function',
      cards: cards.length,
      visibleCards,
      grid: Boolean(grid),
    };
  });

  expect(runtime.imagesLoaded).toBeTruthy();
  expect(runtime.isotope).toBeTruthy();
  expect(runtime.grid).toBeTruthy();
  expect(runtime.cards).toBeGreaterThan(0);
  expect(runtime.visibleCards).toBeGreaterThan(0);
});

test('runtime parcours: particle surface and analytics hooks exist', async ({ page }) => {
  await page.goto('/parcours.html', { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => {
    const globals = window as unknown as Record<string, unknown>;

    return Boolean(document.querySelector('#cloud-bg'))
      && Boolean(document.querySelector('#analyticsDashboard'))
      && Boolean(document.querySelector('#analyticsToggle'))
      && Boolean(globals.SiteUsageSignals)
      && Boolean(globals.SiteAnalytics);
  }, null, { timeout: 75_000 });

  const runtime = await page.evaluate(() => {
    const globals = window as unknown as Record<string, unknown>;
    const cloud = document.querySelector('#cloud-bg') as HTMLElement | null;

    return {
      usageSignals: Boolean(globals.SiteUsageSignals),
      analytics: Boolean(globals.SiteAnalytics),
      cloud: Boolean(cloud),
      cloudVisible: (() => {
        if (!cloud) return false;

        const rect = cloud.getBoundingClientRect();
        const style = getComputedStyle(cloud);

        return rect.width > 0
          && rect.height > 0
          && style.display !== 'none'
          && style.visibility !== 'hidden';
      })(),
      dashboard: Boolean(document.querySelector('#analyticsDashboard')),
      toggle: Boolean(document.querySelector('#analyticsToggle')),
    };
  });

  expect(runtime.usageSignals).toBeTruthy();
  expect(runtime.analytics).toBeTruthy();
  expect(runtime.cloud).toBeTruthy();
  expect(runtime.cloudVisible).toBeTruthy();
  expect(runtime.dashboard).toBeTruthy();
  expect(runtime.toggle).toBeTruthy();
});
