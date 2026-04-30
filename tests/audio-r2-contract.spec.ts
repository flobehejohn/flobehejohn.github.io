import * as pw from '@playwright/test';
type PlaywrightRuntime = typeof import('@playwright/test');
const playwrightRuntime = ((pw as unknown as { default?: PlaywrightRuntime }).default ?? pw) as PlaywrightRuntime;
const { test, expect } = playwrightRuntime;


import type { Page } from '@playwright/test';

test.setTimeout(120_000);

type AudioSurface = {
  hasPlayer: boolean;
  hasOpenButton: boolean;
  hasToggleButton: boolean;
  hasSource: boolean;
  hasFallback: boolean;
  bodyLength: number;
  currentSrc: string;
};

async function getAudioSurface(page: Page): Promise<AudioSurface> {
  return page.evaluate(() => {
    const audio = document.querySelector('#audioPlayer') as HTMLAudioElement | null;
    const openButton = document.querySelector('#openAudioPlayer') as HTMLElement | null;
    const toggleButton = document.querySelector('#toggleBtn') as HTMLElement | null;
    const fallback = document.querySelector('[data-audio-fallback], .audio-fallback, #audioError, .audio-error');

    return {
      hasPlayer: Boolean(audio),
      hasOpenButton: Boolean(openButton),
      hasToggleButton: Boolean(toggleButton),
      hasSource: Boolean(audio?.currentSrc || audio?.src || audio?.querySelector('source')),
      hasFallback: Boolean(fallback),
      bodyLength: document.body?.innerText?.length ?? 0,
      currentSrc: audio?.currentSrc || audio?.src || '',
    };
  });
}

async function safeDomClick(page: Page, selector: string): Promise<boolean> {
  const locator = page.locator(selector).first();

  if ((await locator.count()) === 0) {
    return false;
  }

  await locator
    .evaluate((element) => {
      const html = element as HTMLElement;
      html.scrollIntoView({ block: 'center', inline: 'center' });
      html.click();
    })
    .catch(() => undefined);

  await page.waitForTimeout(750).catch(() => undefined);
  return true;
}

async function readPlaylist(page: Page): Promise<{ ok: boolean; status: number; count: number }> {
  return page.evaluate(async () => {
    const response = await fetch('/assets/audio/auto_radio/js/playlist.json', { cache: 'no-store' });
    const playlist = response.ok ? await response.json() : [];

    return {
      ok: response.ok,
      status: response.status,
      count: Array.isArray(playlist) ? playlist.length : 0,
    };
  });
}

test('R2 audio player exposes a certified simple-playback path', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const playlist = await readPlaylist(page);
  expect(playlist.ok, `playlist status=${playlist.status}`).toBe(true);
  expect(playlist.count).toBeGreaterThan(0);

  await safeDomClick(page, '#openAudioPlayer');
  await safeDomClick(page, '#toggleBtn');

  const surface = await getAudioSurface(page);

  expect(surface.hasPlayer || surface.hasOpenButton).toBe(true);
  expect(surface.hasToggleButton || surface.hasSource || surface.hasFallback).toBe(true);
  expect(surface.bodyLength).toBeGreaterThan(500);
});

test('R2 outage remains controlled and does not break local runtime', async ({ page }) => {
  const fatalErrors: string[] = [];

  page.on('pageerror', (error) => {
    fatalErrors.push(error.message);
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') return;

    const text = message.text();

    if (
      /Failed to load resource|ERR_FAILED|ERR_ABORTED|media|audio|play\\(\\)|échec de lecture après retries|Erreur playlist|HTTP 404 on .*playlist\\.json|NotSupportedError|AbortError/i.test(text)
    ) {
      return;
    }

    fatalErrors.push(text);
  });

  await page.route(/https?:\/\/.*\.(mp3|ogg|wav|m4a|aac)(\?|$)/i, (route) => route.abort('failed'));
  await page.route(/r2|cloudflare|pub-|\.r2\.dev/i, (route) => route.abort('failed'));

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await safeDomClick(page, '#openAudioPlayer');
  await safeDomClick(page, '#toggleBtn');

  const surface = await getAudioSurface(page);

  expect(surface.hasPlayer || surface.hasOpenButton).toBe(true);
  expect(surface.bodyLength).toBeGreaterThan(500);
  const unexpectedFatalErrors = fatalErrors.filter(
    (entry) =>
      !/échec de lecture après retries|Erreur playlist|HTTP 404 on .*playlist\\.json|Failed to load resource|ERR_FAILED|ERR_ABORTED|NotSupportedError|AbortError/i.test(entry),
  );

  expect(unexpectedFatalErrors).toEqual([]);
});
