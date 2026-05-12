import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

/* PR6_LEGACY_RICH_RUNTIME_ROBUST_V1 */
test.setTimeout(120_000);

type SurfaceProbe = {
  count: number;
  visible: boolean;
  nonBlank: boolean;
  scripts: number;
};

function collectFatalErrors(page: import('@playwright/test').Page, failures: string[]) {
  const isKnownBenignBrowserRuntimeError = (text: string): boolean => {
    const normalized = String(text || '').toLowerCase();

    if (
      /audiocontext/.test(normalized)
      && (
        /audio device/.test(normalized)
        || /webaudio renderer/.test(normalized)
        || /web audio renderer/.test(normalized)
        || /audio renderer/.test(normalized)
      )
    ) {
      return true;
    }

    return /favicon|google|maps|cdn|cors|r2\.dev/i.test(text);
  };

  page.on('pageerror', (error) => {
    const text = error?.message || String(error);

    if (!isKnownBenignBrowserRuntimeError(text)) {
      failures.push(`pageerror: ${text}`);
    }
  });

  page.on('console', (message) => {
    const text = message.text();

    if (message.type() === 'error' && !isKnownBenignBrowserRuntimeError(text)) {
      failures.push(`console: ${text}`);
    }
  });

  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();

    if (status >= 400 && /\/assets\//.test(url) && !isKnownBenignBrowserRuntimeError(url)) {
      failures.push(`asset ${status}: ${url}`);
    }
  });
}

async function probeParticleSurface(page: import('@playwright/test').Page): Promise<SurfaceProbe> {
  return page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const cloud = document.querySelector('#cloud-bg') as HTMLElement | null;
    const scripts = Array.from(document.scripts).filter((script) => /nuage_magique\/test\.js|nuage_magique\/nuage\.js|text_particles\.js/.test(script.src)).length;

    let visible = false;
    let nonBlank = false;

    for (const canvas of canvases) {
      const rect = canvas.getBoundingClientRect();
      const style = getComputedStyle(canvas);
      visible = visible || (rect.width > 32 && rect.height > 32 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0);

      try {
        const ctx = canvas.getContext('2d');
        if (ctx && rect.width > 0 && rect.height > 0) {
          const data = ctx.getImageData(0, 0, Math.min(8, canvas.width || 1), Math.min(8, canvas.height || 1)).data;
          nonBlank = nonBlank || Array.from(data).some((value) => value > 0);
        }
      } catch {
        nonBlank = nonBlank || visible;
      }
    }

    if (!visible && cloud) {
      const rect = cloud.getBoundingClientRect();
      const style = getComputedStyle(cloud);
      visible = rect.width > 32 && rect.height > 32 && style.display !== 'none' && style.visibility !== 'hidden';
    }

    return { count: canvases.length, visible, nonBlank, scripts };
  });
}

test('home rich runtime: particles canvas, audio player and dynamic text are active', async ({ page, request }) => {
  const failures: string[] = [];
  collectFatalErrors(page, failures);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const surface = await probeParticleSurface(page);
  expect(surface.scripts, 'nuage magique bootstrap scripts should be loaded').toBeGreaterThan(0);
  expect(surface.count, 'at least one canvas should be created by the rich runtime').toBeGreaterThan(0);
  expect(surface.visible, 'particle canvas or cloud surface should be visible').toBeTruthy();

  const dynamic = await page.evaluate(() => ({
    animatedText: document.querySelectorAll('.animated-text').length,
    animWords: document.querySelectorAll('.anim-word, .word, .char, [data-animate]').length,
    preload: document.body.classList.contains('preload'),
    headingVisible: Array.from(document.querySelectorAll('h1,h2')).some((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    })
  }));

  expect(dynamic.animatedText).toBeGreaterThan(0);
  expect(dynamic.animWords).toBeGreaterThan(0);
  expect(dynamic.preload).toBeFalsy();
  expect(dynamic.headingVisible).toBeTruthy();

  await expect(page.locator('#openAudioPlayer')).toBeVisible({ timeout: 45_000 });

  await page.evaluate(() => {
    const button = document.querySelector('#openAudioPlayer') as HTMLElement | null;

    if (!button) {
      throw new Error('#openAudioPlayer introuvable');
    }

    button.scrollIntoView({ block: 'center', inline: 'center' });
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    button.click();
  });

  await page.waitForTimeout(700);

  const playlistResponse = await request.get('/assets/audio/auto_radio/js/playlist.json', {
    timeout: 30_000,
  });

  const playlist = playlistResponse.ok()
    ? await playlistResponse.json()
    : [];

  const audio = await page.evaluate(() => {
    const globals = window as unknown as Record<string, unknown>;
    const modal = document.querySelector('#audioPlayerModal') as HTMLElement | null;
    const audioEl = document.querySelector('#audioPlayer') as HTMLAudioElement | null;

    return {
      hasPlayer: Boolean(globals.PlayerSingleton || globals.AudioApp),
      hasAudioElement: Boolean(audioEl),
      modalDisplay: modal ? getComputedStyle(modal).display : '',
      modalVisible: modal ? modal.getBoundingClientRect().width > 0 && modal.getBoundingClientRect().height > 0 : false
    };
  });

  expect(playlistResponse.ok()).toBeTruthy();
  expect(Array.isArray(playlist) ? playlist.length : 0).toBeGreaterThan(10);
  expect(audio.hasPlayer).toBeTruthy();
  expect(audio.hasAudioElement).toBeTruthy();
  expect(audio.modalVisible || audio.modalDisplay !== 'none').toBeTruthy();
  expect(failures).toEqual([]);
});

test('portfolio rich runtime: particles survive with isotope grid', async ({ page }) => {
  const failures: string[] = [];
  collectFatalErrors(page, failures);

  await page.goto('/portfolio_florian_b.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const surface = await probeParticleSurface(page);
  expect(surface.scripts).toBeGreaterThan(0);
  expect(surface.count).toBeGreaterThan(0);
  expect(surface.visible).toBeTruthy();

  const portfolio = await page.evaluate(() => {
    const globals = window as unknown as Record<string, unknown>;
    return {
      isotope: typeof globals.Isotope === 'function',
      imagesLoaded: typeof globals.imagesLoaded === 'function',
      cards: document.querySelectorAll('.carte-projet').length,
      gridVisible: (() => {
        const grid = document.querySelector('.grid') as HTMLElement | null;
        if (!grid) return false;
        const rect = grid.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })()
    };
  });

  expect(portfolio.isotope).toBeTruthy();
  expect(portfolio.imagesLoaded).toBeTruthy();
  expect(portfolio.cards).toBeGreaterThan(0);
  expect(portfolio.gridVisible).toBeTruthy();
  expect(failures).toEqual([]);
});

test('PJAX/navigation keeps singleton audio and dynamic runtime coherent', async ({ page }) => {
  const failures: string[] = [];
  collectFatalErrors(page, failures);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const runtime = window as unknown as { PJAX?: { go?: (url: string) => void } };

    if (typeof runtime.PJAX?.go === 'function') {
      runtime.PJAX.go('/portfolio_florian_b.html');
      return;
    }

    const link = document.querySelector('a[href="/portfolio_florian_b.html"], a[href="portfolio_florian_b.html"], a[href$="portfolio_florian_b.html"]') as HTMLAnchorElement | null;

    if (!link) {
      throw new Error('Lien portfolio introuvable');
    }

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    link.click();
  });

  await page.waitForFunction(() => {
    return location.pathname.endsWith('/portfolio_florian_b.html')
      || document.querySelector('main[data-pjax-root][data-page="portfolio"]');
  }, null, { timeout: 45_000 });

  await page.waitForTimeout(1800);

  const state = await page.evaluate(() => {
    const globals = window as unknown as Record<string, unknown>;
    return {
      audioElements: document.querySelectorAll('#audioPlayer').length,
      hasPlayer: Boolean(globals.PlayerSingleton || globals.AudioApp),
      animatedText: document.querySelectorAll('.animated-text').length,
      preload: document.body.classList.contains('preload'),
      pageHub: Boolean(globals.pageHub),
      pjax: Boolean(globals.PJAX)
    };
  });

  expect(state.audioElements).toBe(1);
  expect(state.hasPlayer).toBeTruthy();
  expect(state.animatedText).toBeGreaterThan(0);
  expect(state.preload).toBeFalsy();
  expect(state.pageHub).toBeTruthy();
  expect(state.pjax).toBeTruthy();
  expect(failures).toEqual([]);
});
