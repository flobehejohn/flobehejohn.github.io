import type { Page } from '@playwright/test';

export type AudioRuntimeState = {
  audioElementsCount: number;
  playerVisible: boolean;
  openButtonVisible: boolean;
  currentSrc: string;
  readyState: number;
  networkState: number;
  errorCode: number;
  crossOrigin: string;
  fallbackVisible: boolean;
  title: string;
};

export async function getAudioRuntimeState(page: Page): Promise<AudioRuntimeState> {
  return page.evaluate(() => {
    const audio = document.querySelector('#audioPlayer') as HTMLAudioElement | null;
    const openButton = document.querySelector('#openAudioPlayer') as HTMLElement | null;
    const fallbackCandidates = Array.from(document.querySelectorAll('[data-audio-fallback], .audio-fallback, #audioError, .audio-error')) as HTMLElement[];

    return {
      audioElementsCount: document.querySelectorAll('audio').length,
      playerVisible: Boolean(audio && audio.offsetParent !== null),
      openButtonVisible: Boolean(openButton && openButton.offsetParent !== null),
      currentSrc: audio?.currentSrc || audio?.src || '',
      readyState: audio?.readyState ?? -1,
      networkState: audio?.networkState ?? -1,
      errorCode: audio?.error?.code || 0,
      crossOrigin: audio?.crossOrigin || '',
      fallbackVisible: fallbackCandidates.some((element) => element.offsetParent !== null || element.getAttribute('aria-hidden') === 'false'),
      title: document.querySelector('#trackTitle')?.textContent?.trim() || ''
    };
  });
}

export async function openAndAttemptAudio(page: Page): Promise<AudioRuntimeState> {
  const openButton = page.locator('#openAudioPlayer');
  if (await openButton.count()) {
    await openButton.first().click({ timeout: 5_000 });
    await page.waitForTimeout(300);
  }

  const toggle = page.locator('#toggleBtn');
  if (await toggle.count()) {
    await toggle.first().click({ timeout: 5_000 });
    await page.waitForTimeout(1_500);
  }

  return getAudioRuntimeState(page);
}

export function assertAudioSimpleMode(state: AudioRuntimeState): void {
  if (state.audioElementsCount !== 1) throw new Error(`Expected one audio element, got ${state.audioElementsCount}`);
  if (!state.openButtonVisible && !state.playerVisible) throw new Error('Audio player/open button is not visible');
  if (state.crossOrigin === 'anonymous') throw new Error('Simple audio playback must not force anonymous CORS');
}
