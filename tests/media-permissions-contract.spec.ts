import { expect, test } from '@playwright/test';
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';

const basePath = process.env.PREVIEW_BASE_PATH || '/flobehejohn/flobehejohn.github.io/preview/refactor-live/';
const url = `${basePath}assets/portfolio/projet_musicam/projet_musicam.html`.replace(/\/+/g, '/').replace(':/', '://');

async function installMediaMock(page, mode: 'granted' | 'denied' | 'unsupported') {
  await page.addInitScript((mockMode) => {
    window.__MEDIA_AUDIT__ = { cameraPermission: mockMode, getUserMediaCalls: 0 };

    if (mockMode === 'unsupported') {
      Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
      return;
    }

    const fakeStream = {
      id: 'mock-stream',
      active: true,
      getTracks: () => [{ kind: 'video', readyState: 'live', stop: () => undefined }],
      getVideoTracks: () => [{ kind: 'video', readyState: 'live', stop: () => undefined }],
      getAudioTracks: () => []
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          window.__MEDIA_AUDIT__.getUserMediaCalls += 1;
          if (mockMode === 'denied') {
            const error = new DOMException('Permission denied', 'NotAllowedError');
            window.__MEDIA_AUDIT__.cameraPermission = 'denied';
            throw error;
          }
          window.__MEDIA_AUDIT__.cameraPermission = 'granted';
          return fakeStream;
        }
      }
    });
  }, mode);
}

for (const mode of ['granted', 'denied', 'unsupported'] as const) {
  test(`media devices contract: ${mode}`, async ({ page }) => {
    await installMediaMock(page, mode);
    const consoleProbe = attachConsoleProbe(page);

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

    const audit = await page.evaluate(() => window.__MEDIA_AUDIT__ || null);
    expect(audit?.cameraPermission).toBe(mode);

    assertNoFatalConsole(consoleProbe);
  });
}
