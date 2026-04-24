import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

test('audio playlist exposes reachable R2 tracks', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    const response = await fetch('/assets/audio/auto_radio/js/playlist.json', { cache: 'no-store' });
    const playlist = response.ok ? await response.json() : [];
    const tracks = Array.isArray(playlist) ? playlist.slice(0, 5) : [];
    const probes = [];

    for (const track of tracks) {
      const url = String(track.src || '');
      try {
        const probe = await fetch(url, {
          method: 'GET',
          headers: { Range: 'bytes=0-1' },
          cache: 'no-store'
        });
        probes.push({
          title: String(track.title || ''),
          url,
          ok: probe.ok || probe.status === 206,
          status: probe.status,
          contentType: probe.headers.get('content-type') || '',
          acceptRanges: probe.headers.get('accept-ranges') || '',
          corsReadable: true
        });
      } catch (error) {
        probes.push({
          title: String(track.title || ''),
          url,
          ok: false,
          status: 0,
          contentType: '',
          acceptRanges: '',
          corsReadable: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      playlistOk: response.ok,
      playlistCount: Array.isArray(playlist) ? playlist.length : 0,
      probes
    };
  });

  expect(result.playlistOk).toBeTruthy();
  expect(result.playlistCount).toBeGreaterThan(10);
  for (const probe of result.probes) {
    expect(probe.ok, `${probe.title} ${probe.status} ${probe.url}`).toBeTruthy();
    expect(probe.contentType, `${probe.title} content-type`).toMatch(/audio|mpeg|octet-stream/i);
  }
});

test('audio player boots after user gesture and receives playable source', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && /\/assets\//.test(response.url())) failures.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await expect(page.locator('#openAudioPlayer')).toBeVisible();
  await page.locator('#openAudioPlayer').click();
  await page.waitForTimeout(500);
  await page.locator('#toggleBtn').click();
  await page.waitForTimeout(2200);

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
      title: document.querySelector('#trackTitle')?.textContent || ''
    };
  });

  expect(state.hasPlayer).toBeTruthy();
  expect(state.hasAudio).toBeTruthy();
  expect(state.src).toMatch(/^https?:\/\//);
  expect(state.readyState, `audio readyState for ${state.src}`).toBeGreaterThanOrEqual(1);
  expect(state.errorCode, `audio error for ${state.src}`).toBe(0);
  expect(state.crossOrigin, 'R2 playback should not be forced into anonymous CORS mode').not.toBe('anonymous');
  expect(state.title.trim().length).toBeGreaterThan(0);
  expect(failures).toEqual([]);
});
