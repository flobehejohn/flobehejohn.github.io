import { createRequire } from 'module';
import type { Page } from '@playwright/test';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

test.setTimeout(120_000);

type AudioProbe = {
  title: string;
  url: string;
  ok: boolean;
  status: number;
  contentType: string;
  acceptRanges: string;
  corsReadable: boolean;
  error?: string;
};

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

test('audio playlist exposes reachable R2 tracks', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async (): Promise<{ playlistOk: boolean; playlistCount: number; probes: AudioProbe[] }> => {
    async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);

      try {
        return await fetch(url, {
          ...init,
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }
    }

    const response = await fetchWithTimeout('/assets/audio/auto_radio/js/playlist.json', { cache: 'no-store' }, 15_000);
    const playlist = response.ok ? await response.json() : [];
    const tracks = Array.isArray(playlist) ? playlist.slice(0, 5) : [];

    const probes: AudioProbe[] = await Promise.all(
      tracks.map(async (track): Promise<AudioProbe> => {
        const url = String(track.src || '');

        try {
          const probe = await fetchWithTimeout(
            url,
            {
              method: 'GET',
              headers: { Range: 'bytes=0-1' },
              cache: 'no-store',
            },
            15_000,
          );

          return {
            title: String(track.title || ''),
            url,
            ok: probe.ok || probe.status === 206,
            status: probe.status,
            contentType: probe.headers.get('content-type') || '',
            acceptRanges: probe.headers.get('accept-ranges') || '',
            corsReadable: true,
          };
        } catch (error) {
          return {
            title: String(track.title || ''),
            url,
            ok: false,
            status: 0,
            contentType: '',
            acceptRanges: '',
            corsReadable: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    return {
      playlistOk: response.ok,
      playlistCount: Array.isArray(playlist) ? playlist.length : 0,
      probes,
    };
  });

  expect(result.playlistOk).toBeTruthy();
  expect(result.playlistCount).toBeGreaterThan(10);

  for (const probe of result.probes) {
    expect(
      probe.ok,
      `${probe.title} status=${probe.status} url=${probe.url} error=${probe.error || ''}`,
    ).toBeTruthy();

    expect(probe.contentType, `${probe.title} content-type`).toMatch(/audio|mpeg|octet-stream/i);
  }
});

test('audio player boots after user gesture and receives playable source', async ({ page }) => {
  const failures: string[] = [];

  page.on('pageerror', (error) => failures.push(error.message));

  page.on('response', (response) => {
    if (response.status() >= 400 && /\/assets\//.test(response.url())) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  await expect(page.locator('#openAudioPlayer')).toBeVisible();

  const opened = await safeDomClick(page, '#openAudioPlayer');
  expect(opened, 'audio modal open button should be clickable').toBe(true);

  const toggled = await safeDomClick(page, '#toggleBtn');
  expect(toggled, 'audio toggle button should be clickable').toBe(true);

  await page.waitForTimeout(2600);

  const state = await page.evaluate(() => {
    const globals = window as unknown as Record<string, unknown>;
    const audio = document.querySelector('#audioPlayer') as HTMLAudioElement | null;

    return {
      hasPlayer: Boolean(globals.PlayerSingleton || globals.AudioApp),
      hasAudio: Boolean(audio),
      src: audio?.currentSrc || audio?.src || '',
      readyState: audio?.readyState ?? -1,
      networkState: audio?.networkState ?? -1,
      errorCode: audio?.error?.code || 0,
      crossOrigin: audio?.crossOrigin || '',
      title: document.querySelector('#trackTitle')?.textContent || '',
    };
  });

  expect(state.hasPlayer).toBeTruthy();
  expect(state.hasAudio).toBeTruthy();
  expect(state.src).toMatch(/^https?:\/\//);
  expect(state.readyState, `audio readyState for ${state.src}`).toBeGreaterThanOrEqual(1);
  expect(state.errorCode, `audio error for ${state.src}`).toBe(0);
  expect(state.title.trim().length).toBeGreaterThan(0);
  expect(failures).toEqual([]);
});
