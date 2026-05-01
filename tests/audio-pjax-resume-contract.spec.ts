import * as pw from '@playwright/test';
import type { Page } from '@playwright/test';

type PlaywrightRuntime = typeof import('@playwright/test');
const playwrightRuntime = ((pw as unknown as { default?: PlaywrightRuntime }).default ?? pw) as PlaywrightRuntime;
const { test, expect } = playwrightRuntime;

test.setTimeout(120_000);

type AudioRuntimeState = {
  hasFacade: boolean;
  globalPlayerCount: number;
  openButtonCount: number;
  src: string;
  sessionSrc: string;
  title: string;
  sessionTitle: string;
  readyState: number;
  networkState: number;
  errorCode: number;
  paused: boolean;
};

async function safeDomClick(page: Page, selector: string): Promise<boolean> {
  const locator = page.locator(selector).first();

  if ((await locator.count()) === 0) return false;

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

async function readAudioRuntimeState(page: Page): Promise<AudioRuntimeState> {
  return page.evaluate(() => {
    const globals = window as unknown as Record<string, unknown>;
    const audio = document.querySelector('#audioPlayer') as HTMLAudioElement | null;
    let session: Record<string, unknown> = {};

    try {
      session = JSON.parse(sessionStorage.getItem('audioState') || '{}') as Record<string, unknown>;
    } catch {
      session = {};
    }

    return {
      hasFacade: Boolean(globals.PlayerSingleton || globals.AudioApp),
      globalPlayerCount: document.querySelectorAll('#audioPlayer').length,
      openButtonCount: document.querySelectorAll('#openAudioPlayer').length,
      src: audio?.currentSrc || audio?.src || '',
      sessionSrc: typeof session.src === 'string' ? session.src : '',
      title: document.querySelector('#trackTitle')?.textContent?.trim() || '',
      sessionTitle: typeof session.title === 'string' ? session.title : '',
      readyState: audio?.readyState ?? -1,
      networkState: audio?.networkState ?? -1,
      errorCode: audio?.error?.code || 0,
      paused: audio?.paused ?? true,
    };
  });
}

async function bootGlobalAudio(page: Page): Promise<AudioRuntimeState> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_800);

  await expect(page.locator('#openAudioPlayer')).toBeVisible({ timeout: 30_000 });

  expect(await safeDomClick(page, '#openAudioPlayer'), 'audio modal open button should be clickable').toBe(true);
  expect(await safeDomClick(page, '#toggleBtn'), 'audio toggle button should be clickable').toBe(true);

  await page.waitForTimeout(2_800);

  const state = await readAudioRuntimeState(page);
  expect(state.hasFacade).toBe(true);
  expect(state.globalPlayerCount).toBe(1);
  expect(state.openButtonCount).toBe(1);
  expect(state.src || state.sessionSrc).toMatch(/^https?:\/\//);
  expect(state.errorCode, `audio error for ${state.src || state.sessionSrc}`).toBe(0);

  return state;
}

test('audio/PJAX keeps a single global player and preserves the current source across global pages', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && /\/assets\//.test(response.url())) failures.push(`${response.status()} ${response.url()}`);
  });

  const before = await bootGlobalAudio(page);
  const beforeSrc = before.src || before.sessionSrc;

  await page.evaluate(() => {
    const maybePjax = (window as unknown as { PJAX?: { navigate?: (url: string, push?: boolean) => Promise<void> } }).PJAX;
    if (!maybePjax?.navigate) throw new Error('PJAX.navigate unavailable');
    return maybePjax.navigate('/portfolio_florian_b.html', true);
  });

  await page.waitForURL((url) => url.pathname.endsWith('/portfolio_florian_b.html'), { timeout: 30_000 });
  await page.waitForTimeout(1_500);

  const afterPortfolio = await readAudioRuntimeState(page);
  expect(afterPortfolio.globalPlayerCount).toBe(1);
  expect(afterPortfolio.openButtonCount).toBe(1);
  expect(afterPortfolio.src || afterPortfolio.sessionSrc).toBe(beforeSrc);
  expect(afterPortfolio.errorCode).toBe(0);

  await page.evaluate(() => {
    const maybePjax = (window as unknown as { PJAX?: { navigate?: (url: string, push?: boolean) => Promise<void> } }).PJAX;
    if (!maybePjax?.navigate) throw new Error('PJAX.navigate unavailable');
    return maybePjax.navigate('/contact.html', true);
  });

  await page.waitForURL((url) => url.pathname.endsWith('/contact.html'), { timeout: 30_000 });
  await page.waitForTimeout(1_500);

  const afterContact = await readAudioRuntimeState(page);
  expect(afterContact.globalPlayerCount).toBe(1);
  expect(afterContact.openButtonCount).toBe(1);
  expect(afterContact.src || afterContact.sessionSrc).toBe(beforeSrc);
  expect(afterContact.errorCode).toBe(0);
  expect(failures).toEqual([]);
});

test('audio remains user-resumable after a media project full-page roundtrip', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && /\/assets\//.test(response.url())) failures.push(`${response.status()} ${response.url()}`);
  });

  const before = await bootGlobalAudio(page);
  const beforeSrc = before.src || before.sessionSrc;

  await page.goto('/assets/portfolio/projet_musicam/projet_musicam.html', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1_200);

  await page.goto('/portfolio_florian_b.html', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => Boolean(document.querySelector('#audioPlayer') && document.querySelector('#openAudioPlayer')), null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(2_500);

  const restored = await readAudioRuntimeState(page);
  const restoredSrc = restored.src || restored.sessionSrc;

  expect(restored.hasFacade).toBe(true);
  expect(restored.globalPlayerCount).toBe(1);
  expect(restored.openButtonCount).toBe(1);
  expect(restoredSrc).toMatch(/^https?:\/\//);
  expect(restoredSrc).toBe(beforeSrc);
  expect(restored.errorCode, `audio error for restored source ${restoredSrc}`).toBe(0);
  expect((restored.title || restored.sessionTitle).trim().length).toBeGreaterThan(0);

  expect(await safeDomClick(page, '#openAudioPlayer'), 'audio modal should remain openable after media project roundtrip').toBe(true);
  expect(await safeDomClick(page, '#toggleBtn'), 'audio should remain manually resumable after media project roundtrip').toBe(true);

  await page.waitForTimeout(2_000);
  const resumed = await readAudioRuntimeState(page);
  expect(resumed.readyState, `audio readyState for ${resumed.src || resumed.sessionSrc}`).toBeGreaterThanOrEqual(1);
  expect(resumed.errorCode).toBe(0);
  expect(failures).toEqual([]);
});
