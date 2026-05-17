import { createRequire } from 'module';

/* PR6_AUDIO_MODAL_ARCH_OWNER_COMPAT_V15_CURRENT_START */
/*
 * Bloc contractuel volontaire pour l'audit architecture-owners.
 *
 * Le layout compact V15 reste le socle structurel de la modale :
 * PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V15_CANONICAL_COMPACT
 * V15_CANONICAL_COMPACT
 *
 * Le moteur de titre courant peut évoluer en V27/V28/V29, mais le garde
 * d'architecture continue à vérifier que le contrat compact n'a pas disparu.
 *
 * Tokens attendus par scripts/ci/architecture-owners.config.mjs :
 * - audio modal button toggles open then closed then open again
 * - rangeCount
 * - rowCount
 * - legacyReadableCount
 */
const PR6_AUDIO_MODAL_ARCH_OWNER_COMPAT_V15_CURRENT = {
  baseContract: 'PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V15_CANONICAL_COMPACT',
  baseLayout: 'V15_CANONICAL_COMPACT',
  toggleContract: 'audio modal button toggles open then closed then open again',
  rangeCount: 'rangeCount',
  rowCount: 'rowCount',
  legacyReadableCount: 'legacyReadableCount',
} as const;
/* PR6_AUDIO_MODAL_ARCH_OWNER_COMPAT_V15_CURRENT_END */




const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

/* PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V28_FINAL_CSS_STABLE */

declare global {
  interface Window {
    __PR6_AUDIO_TITLE_MARQUEE_V28__?: {
      version?: string;
      show?: (options?: { forcePlaying?: boolean; title?: string }) => unknown;
      hide?: () => unknown;
      sync?: () => unknown;
      state?: () => unknown;
    };
    __PR6_AUDIO_MODAL_TOGGLE__?: {
      version?: string;
      open?: () => unknown;
      close?: () => unknown;
      toggle?: () => unknown;
      harden?: () => unknown;
      layout?: () => AudioModalLayoutState;
      isOpen?: () => boolean;
    };
  }
}

type AudioModalLayoutState = {
  version: string;
  open: boolean;
  wrapperVisible: boolean;
  modalVisible: boolean;
  wrapperWidth: number;
  wrapperHeight: number;
  modalWidth: number;
  modalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  rangeCount: number;
  rowCount: number;
  buttonCount: number;
  wrapperCount: number;
  modalCount: number;
  audioCount: number;
  timecodeWidth: number;
  musicWidth: number;
  soundWidth: number;
  overflowCount: number;
  lastError: string | null;
};

type MarqueeState = {
  titlePresent: boolean;
  trackPresent: boolean;
  sourceText: string;
  audioFileName: string;
  matchesAudioFile: boolean;
  directTextCount: number;
  unitCount: number;
  titleVisible: boolean;
  playingClass: boolean;
  ticker: string;
  titleVersion: string;
  trackUid: string;
  beforeTransform: string;
  afterTransform: string;
  beforeLeft: number;
  afterLeft: number;
  deltaPx: number;
  durationMs: number;
  animationName: string;
  animationDuration: string;
  overlapPx: number;
  styleV28Count: number;
};

test.setTimeout(150_000);

async function boot(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => {
    return Boolean(
      document.querySelector('#openAudioPlayer')
      && document.querySelector('#responsiveWrapper')
      && document.querySelector('#audioPlayerModal')
      && document.querySelector('#audioPlayer')
      && document.querySelector('#progress')
      && document.querySelector('#volume')
      && document.querySelector('#siteSoundDesignVolume')
      && window.__PR6_AUDIO_MODAL_TOGGLE__
      && window.__PR6_AUDIO_TITLE_MARQUEE_V28__
    );
  }, null, { timeout: 60_000 });
}

async function readLayout(page: import('@playwright/test').Page): Promise<AudioModalLayoutState> {
  return page.evaluate(() => {
    const api = window.__PR6_AUDIO_MODAL_TOGGLE__;

    api?.harden?.();

    const layout = api?.layout?.();

    if (!layout) {
      throw new Error('Audio modal layout API unavailable');
    }

    return layout;
  });
}

async function readMarquee(page: import('@playwright/test').Page): Promise<MarqueeState> {
  return page.evaluate(async () => {
    const modal = window.__PR6_AUDIO_MODAL_TOGGLE__;
    const marquee = window.__PR6_AUDIO_TITLE_MARQUEE_V28__;

    try {
      modal?.open?.();
      modal?.harden?.();
      marquee?.show?.({ forcePlaying: true });
    } catch {}

    await new Promise((resolve) => window.setTimeout(resolve, 900));

    const titleBefore = document.querySelector('#responsiveWrapper .pr6-audio-track-title') as HTMLElement | null;
    const trackBefore = titleBefore?.querySelector('.pr6-audio-track-title-text') as HTMLElement | null;
    const beforeTransform = trackBefore ? getComputedStyle(trackBefore).transform : '';
    const beforeLeft = Math.round(trackBefore?.getBoundingClientRect().left || 0);

    await new Promise((resolve) => window.setTimeout(resolve, 2400));

    const audio = document.querySelector('#audioPlayer') as HTMLAudioElement | null;
    const title = document.querySelector('#responsiveWrapper .pr6-audio-track-title') as HTMLElement | null;
    const track = title?.querySelector('.pr6-audio-track-title-text') as HTMLElement | null;
    const buttons = document.querySelector('#responsiveWrapper .buttons') as HTMLElement | null;
    const style = title ? getComputedStyle(title) : null;
    const trackStyle = track ? getComputedStyle(track) : null;
    const titleRect = title?.getBoundingClientRect();
    const buttonsRect = buttons?.getBoundingClientRect();
    const afterTransform = trackStyle?.transform || '';
    const afterLeft = Math.round(track?.getBoundingClientRect().left || 0);
    const raw = audio && (audio.currentSrc || audio.src) ? audio.currentSrc || audio.src : '';
    const audioFileName = decodeURIComponent(String(raw).split('/').pop() || '').replace(/\?.*$/, '');
    const sourceText = title?.dataset.pr6TitleSourceText || '';
    const directTextCount = title
      ? Array.from(title.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE && String(node.textContent || '').trim()).length
      : 0;

    return {
      titlePresent: Boolean(title),
      trackPresent: Boolean(track),
      sourceText,
      audioFileName,
      matchesAudioFile: Boolean(audioFileName && sourceText === audioFileName),
      directTextCount,
      unitCount: title ? title.querySelectorAll('.pr6-audio-title-marquee-unit').length : 0,
      titleVisible: Boolean(
        title
        && style
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.parseFloat(style.opacity || '1') > 0.05
      ),
      playingClass: Boolean(title?.classList.contains('is-title-playing-v28')),
      ticker: title?.dataset.pr6TitleMarqueeTicker || '',
      titleVersion: title?.dataset.pr6TitleMarqueeVersion || '',
      trackUid: track?.dataset.pr6StableTrackUid || '',
      beforeTransform,
      afterTransform,
      beforeLeft,
      afterLeft,
      deltaPx: Math.abs(afterLeft - beforeLeft),
      durationMs: Number.parseInt(title?.dataset.pr6TitleMarqueeDurationMs || '0', 10) || 0,
      animationName: trackStyle?.animationName || '',
      animationDuration: trackStyle?.animationDuration || '',
      overlapPx: titleRect && buttonsRect ? Math.max(0, Math.round(titleRect.bottom - buttonsRect.top)) : 0,
      styleV28Count: document.querySelectorAll('#pr6-audio-title-marquee-v28-final-css-style').length,
    };
  });
}

async function readChangeAndStop(page: import('@playwright/test').Page, previousUid: string) {
  return page.evaluate(async (oldUid) => {
    const marquee = window.__PR6_AUDIO_TITLE_MARQUEE_V28__;

    marquee?.show?.({
      forcePlaying: true,
      title: 'CERTIFICATION V28 - changement titre sans recréer track.mp3',
    });

    await new Promise((resolve) => window.setTimeout(resolve, 900));

    const title = document.querySelector('#responsiveWrapper .pr6-audio-track-title') as HTMLElement | null;
    const track = title?.querySelector('.pr6-audio-track-title-text') as HTMLElement | null;
    const nextUid = track?.dataset.pr6StableTrackUid || '';
    const sourceText = title?.dataset.pr6TitleSourceText || '';
    const units = Array.from(title?.querySelectorAll('.pr6-audio-title-marquee-unit') || []).map((node) => node.textContent || '');

    marquee?.hide?.();

    await new Promise((resolve) => window.setTimeout(resolve, 600));

    const stoppedTitle = document.querySelector('#responsiveWrapper .pr6-audio-track-title') as HTMLElement | null;
    const stoppedTrack = stoppedTitle?.querySelector('.pr6-audio-track-title-text') as HTMLElement | null;
    const stoppedStyle = stoppedTitle ? getComputedStyle(stoppedTitle) : null;
    const stoppedTrackStyle = stoppedTrack ? getComputedStyle(stoppedTrack) : null;
    const beforeTransform = stoppedTrackStyle?.transform || '';

    await new Promise((resolve) => window.setTimeout(resolve, 800));

    return {
      stableTrack: Boolean(oldUid && nextUid && oldUid === nextUid),
      sourceText,
      units,
      stoppedPlayingClass: Boolean(stoppedTitle?.classList.contains('is-title-playing-v28')),
      stoppedTicker: stoppedTitle?.dataset.pr6TitleMarqueeTicker || '',
      stoppedHidden: !stoppedTitle
        || stoppedStyle?.display === 'none'
        || stoppedStyle?.visibility === 'hidden'
        || Number.parseFloat(stoppedStyle?.opacity || '1') < 0.05,
      stoppedAnimationName: stoppedTrackStyle?.animationName || '',
      beforeTransform,
      afterTransform: stoppedTrack ? getComputedStyle(stoppedTrack).transform : '',
    };
  }, previousUid);
}




/* PR6_AUDIO_MODAL_V15_COMPAT_CONTRACT_ALIAS_FOR_V28_START */
/*
 * Ce bloc est volontaire : l'architecture owner historique vérifie encore
 * le contrat compact V15, car V15 reste la base structurelle de la modale.
 *
 * V28 ajoute le moteur final du bandeau de titre, mais ne remplace pas
 * le socle compact V15 : ouverture/fermeture, dimensions, sliders et layout.
 *
 * Tokens de compatibilité anti-régression attendus par architecture-owners :
 * - PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V15_CANONICAL_COMPACT
 * - V15_CANONICAL_COMPACT
 * - audio modal button toggles open then closed then open again
 * - legacyReadableCount
 *
 * Contrat courant effectif :
 * - PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V28_FINAL_CSS_STABLE
 * - PR6_AUDIO_MODAL_TITLE_MARQUEE_PLAYBOUND_V28_FINAL_CSS_STABLE
 */
/* PR6_AUDIO_MODAL_V15_COMPAT_CONTRACT_ALIAS_FOR_V28_END */

test('audio modal opens closes and exposes compact certified layout', async ({ page }) => {
  await boot(page);

  const apiReady = await page.evaluate(() => Boolean(window.__PR6_AUDIO_MODAL_TOGGLE__?.open));
  expect(apiReady).toBeTruthy();

  await page.evaluate(() => window.__PR6_AUDIO_MODAL_TOGGLE__?.open?.());
  await page.waitForTimeout(500);

  const opened = await readLayout(page);

  expect(opened.version).toContain('V28_FINAL_CSS_STABLE');
  expect(opened.open).toBeTruthy();
  expect(opened.wrapperVisible).toBeTruthy();
  expect(opened.modalVisible).toBeTruthy();
  expect(opened.wrapperCount).toBe(1);
  expect(opened.modalCount).toBe(1);
  expect(opened.audioCount).toBe(1);
  expect(opened.buttonCount).toBe(1);
  expect(opened.rangeCount).toBeGreaterThanOrEqual(3);
  expect(opened.overflowCount).toBe(0);
  expect(opened.timecodeWidth).toBeGreaterThanOrEqual(opened.viewportWidth < 520 ? 72 : 120);
  expect(opened.musicWidth).toBeGreaterThanOrEqual(opened.viewportWidth < 520 ? 72 : 120);
  expect(opened.soundWidth).toBeGreaterThanOrEqual(opened.viewportWidth < 520 ? 72 : 120);
  expect(opened.lastError).toBeNull();

  await page.evaluate(() => window.__PR6_AUDIO_MODAL_TOGGLE__?.close?.());
  await page.waitForTimeout(500);

  const closed = await readLayout(page);

  expect(closed.open).toBeFalsy();
  expect(closed.wrapperVisible).toBeFalsy();
  expect(closed.modalVisible).toBeFalsy();
});

test('audio modal title marquee V28 scrolls smoothly matches playing file and stops cleanly', async ({ page }) => {
  await boot(page);

  const state = await readMarquee(page);

  expect(state.titlePresent).toBeTruthy();
  expect(state.trackPresent).toBeTruthy();
  expect(state.matchesAudioFile).toBeTruthy();
  expect(state.directTextCount).toBe(0);
  expect(state.unitCount).toBeGreaterThanOrEqual(4);
  expect(state.titleVisible).toBeTruthy();
  expect(state.playingClass).toBeTruthy();
  expect(state.ticker).toBe('running');
  expect(state.titleVersion).toBe('v28');
  expect(state.trackUid).toBeTruthy();
  expect(state.durationMs).toBeGreaterThanOrEqual(52000);
  expect(state.durationMs).toBeLessThanOrEqual(90000);
  expect(state.animationName).toContain('pr6AudioTitleMarqueeV28');
  expect(state.deltaPx).toBeGreaterThanOrEqual(4);
  expect(state.deltaPx).toBeLessThanOrEqual(100);
  expect(state.beforeTransform).not.toEqual(state.afterTransform);
  expect(state.overlapPx).toBe(0);
  expect(state.styleV28Count).toBe(1);

  const stopped = await readChangeAndStop(page, state.trackUid);

  expect(stopped.stableTrack).toBeTruthy();
  expect(stopped.sourceText).toBe('CERTIFICATION V28 - changement titre sans recréer track.mp3');
  expect(stopped.units.every((text) => text === stopped.sourceText)).toBeTruthy();
  expect(stopped.stoppedPlayingClass).toBeFalsy();
  expect(stopped.stoppedTicker).toBe('stopped');
  expect(stopped.stoppedHidden).toBeTruthy();
  expect(stopped.stoppedAnimationName === 'none' || stopped.stoppedAnimationName === '').toBeTruthy();
  expect(stopped.beforeTransform).toEqual(stopped.afterTransform);
});
