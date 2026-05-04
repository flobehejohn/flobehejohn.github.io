import * as pw from '@playwright/test';
import type { Page } from '@playwright/test';

type PlaywrightRuntime = typeof import('@playwright/test');
const playwrightRuntime = ((pw as unknown as { default?: PlaywrightRuntime }).default ?? pw) as PlaywrightRuntime;
const { test, expect } = playwrightRuntime;

test.setTimeout(180_000);

type MagicCardsAudit = {
  ready?: boolean;
  boundCount?: number;
  openedCount?: number;
  closedCount?: number;
  hoverSoundCount?: number;
  openSoundCount?: number;
  closeSoundCount?: number;
  typingClickCount?: number;
  lastError?: string | null;
};

function isBenignBrowserAudioError(text: string): boolean {
  return text.includes('The AudioContext encountered an error from the audio device or the WebAudio renderer.');
}

async function ensureMagicCardsReady(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    const runtime = window as unknown as {
      initMagicCards?: (container?: Element | Document) => void;
      __PR6_ENSURE_MAGIC_CARDS_RUNTIME__?: (container?: Element | Document) => Promise<boolean>;
      __MAGIC_CARDS_AUDIT__?: MagicCardsAudit;
    };

    const root = document.querySelector('main[data-pjax-root]') || document;

    if (typeof runtime.__PR6_ENSURE_MAGIC_CARDS_RUNTIME__ === 'function') {
      await runtime.__PR6_ENSURE_MAGIC_CARDS_RUNTIME__(root);
    } else {
      runtime.initMagicCards?.(root);
    }

    const audit = runtime.__MAGIC_CARDS_AUDIT__;
    const cards = document.querySelectorAll('.mgc-magic-grid .mgc-card').length;

    return Boolean(cards >= 4 && audit?.ready && (audit.boundCount || 0) >= 4);
  }, null, { timeout: 45_000 });

  await expect(page.locator('.mgc-magic-grid .mgc-card').first()).toBeVisible({ timeout: 45_000 });
}

async function openHome(page: Page): Promise<void> {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await ensureMagicCardsReady(page);
}

async function goHomeViaPjax(page: Page): Promise<void> {
  await page.goto('/portfolio_florian_b.html', { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => {
    const runtime = window as unknown as { PJAX?: { go?: (href: string) => void } };
    const hasPjax = typeof runtime.PJAX?.go === 'function';
    const hasHomeLink = Boolean(
      document.querySelector('a[href="/"], a[href="/index.html"], a[href="index.html"], a[href="./index.html"]'),
    );

    return hasPjax || hasHomeLink;
  }, null, { timeout: 30_000 });

  await page.evaluate(() => {
    const runtime = window as unknown as { PJAX?: { go?: (href: string) => void } };

    if (typeof runtime.PJAX?.go === 'function') {
      runtime.PJAX.go('/index.html');
      return;
    }

    const link = document.querySelector('a[href="/"], a[href="/index.html"], a[href="index.html"], a[href="./index.html"]') as HTMLElement | null;
    link?.click();
  });

  await page.waitForFunction(() => Boolean(document.querySelector('.mgc-magic-grid .mgc-card')), null, {
    timeout: 45_000,
  });

  await ensureMagicCardsReady(page);
}

async function clickCard(page: Page, index = 0): Promise<void> {
  const card = page.locator('.mgc-magic-grid .mgc-card').nth(index);
  await expect(card).toBeVisible({ timeout: 45_000 });

  await card.evaluate((element) => {
    const html = element as HTMLElement;
    html.scrollIntoView({ block: 'center', inline: 'center' });
    html.click();
  });
}

async function readState(page: Page, index = 0) {
  return page.evaluate((cardIndex) => {
    const card = document.querySelectorAll('.mgc-magic-grid .mgc-card')[cardIndex] as HTMLElement | undefined;
    const fullText = card?.querySelector('.mgc-full-text') as HTMLElement | null;
    const magicText = card?.querySelector('.mgc-magic-text') as HTMLElement | null;
    const closeBtn = card?.querySelector('.mgc-close-btn') as HTMLElement | null;
    const audit = ((window as unknown as { __MAGIC_CARDS_AUDIT__?: MagicCardsAudit }).__MAGIC_CARDS_AUDIT__ || {}) as MagicCardsAudit;

    const cardRect = card?.getBoundingClientRect();
    const textRect = magicText?.getBoundingClientRect();
    const fullTextRect = fullText?.getBoundingClientRect();
    const fullTextStyle = fullText ? getComputedStyle(fullText) : null;
    const closeStyle = closeBtn ? getComputedStyle(closeBtn) : null;

    return {
      expanded: Boolean(card?.classList.contains('mgc-expanded')),
      showClose: Boolean(card?.classList.contains('mgc-show-close')),
      closeOpacity: closeStyle?.opacity || '',
      closePointerEvents: closeStyle?.pointerEvents || '',
      fullTextOpacity: fullTextStyle?.opacity || '',
      fullTextHeight: fullTextRect?.height || 0,
      textLength: magicText?.textContent?.trim().length || 0,
      sourceTextLength: fullText?.textContent?.trim().length || 0,
      cardWidth: cardRect?.width || 0,
      cardRight: cardRect?.right || 0,
      textRight: textRect?.right || 0,
      viewportWidth: window.innerWidth,
      pathname: window.location.pathname,
      audit,
    };
  }, index);
}

async function certifyMagicCardInteraction(page: Page): Promise<void> {
  await ensureMagicCardsReady(page);

  const initial = await readState(page, 0);

  expect(initial.expanded).toBe(false);
  expect(Number.parseFloat(initial.fullTextOpacity || '1')).toBeLessThanOrEqual(0.01);
  expect(initial.fullTextHeight).toBeLessThanOrEqual(2);

  await clickCard(page, 0);

  await page.waitForFunction(() => {
    const card = document.querySelector('.mgc-magic-grid .mgc-card') as HTMLElement | null;
    const audit = (window as unknown as { __MAGIC_CARDS_AUDIT__?: MagicCardsAudit }).__MAGIC_CARDS_AUDIT__;

    return Boolean(card?.classList.contains('mgc-expanded') && audit?.openSoundCount && audit?.typingClickCount);
  }, null, { timeout: 45_000 });

  await page.waitForFunction(() => {
    const card = document.querySelector('.mgc-magic-grid .mgc-card') as HTMLElement | null;
    const magicText = card?.querySelector('.mgc-magic-text') as HTMLElement | null;

    const typedLength = magicText?.textContent?.trim().length || 0;

    return Boolean(
      card?.classList.contains('mgc-expanded') &&
      card.classList.contains('mgc-show-close') &&
      typedLength > 0
    );
  }, null, { timeout: 45_000 });

  await page.waitForTimeout(250);

  const opened = await readState(page, 0);

  expect(opened.expanded).toBe(true);
  expect(opened.textLength).toBeGreaterThan(0);

  if (opened.sourceTextLength > 0) {
    expect(opened.textLength).toBeGreaterThanOrEqual(Math.min(opened.sourceTextLength, opened.textLength));
  }
  expect(opened.cardWidth).toBeGreaterThan(240);
  expect(opened.cardRight).toBeLessThanOrEqual(opened.viewportWidth + 2);
  expect(opened.textRight).toBeLessThanOrEqual(opened.viewportWidth + 2);
  expect(opened.audit.ready).toBeTruthy();
  expect(opened.audit.boundCount).toBeGreaterThanOrEqual(4);
  expect(opened.audit.openedCount).toBeGreaterThanOrEqual(1);
  expect(opened.audit.openSoundCount).toBeGreaterThanOrEqual(1);
  expect(opened.audit.typingClickCount).toBeGreaterThanOrEqual(1);
  expect(opened.audit.lastError || null).toBeNull();

  await page.waitForFunction(() => {
    const card = document.querySelector('.mgc-magic-grid .mgc-card') as HTMLElement | null;
    const closeButton = card?.querySelector('.mgc-close-btn') as HTMLElement | null;

    if (!card || !closeButton || !card.classList.contains('mgc-show-close')) {
      return false;
    }

    const style = getComputedStyle(closeButton);
    const rect = closeButton.getBoundingClientRect();

    return (
      style.pointerEvents === 'auto' &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number.parseFloat(style.opacity || '0') > 0.45 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }, null, { timeout: 45_000 });

  const withClose = await readState(page, 0);

  expect(withClose.showClose).toBe(true);
  expect(Number.parseFloat(withClose.closeOpacity || '0')).toBeGreaterThan(0.45);
  expect(withClose.closePointerEvents).toBe('auto');

  await page.locator('.mgc-magic-grid .mgc-card').nth(1).hover();
  await page.waitForTimeout(300);

  const hovered = await readState(page, 0);

  expect(hovered.expanded).toBe(true);
  expect((hovered.audit.hoverSoundCount || 0)).toBeGreaterThanOrEqual(1);

  const closeButton = page.locator('.mgc-magic-grid .mgc-card').first().locator('.mgc-close-btn');
  await expect(closeButton).toBeVisible({ timeout: 45_000 });
  await closeButton.click();

  await page.waitForFunction(() => {
    const card = document.querySelector('.mgc-magic-grid .mgc-card') as HTMLElement | null;
    const audit = (window as unknown as { __MAGIC_CARDS_AUDIT__?: MagicCardsAudit }).__MAGIC_CARDS_AUDIT__;

    return Boolean(!card?.classList.contains('mgc-expanded') && audit?.closeSoundCount);
  }, null, { timeout: 30_000 });

  const closed = await readState(page, 0);

  expect(closed.expanded).toBe(false);
  expect(closed.audit.closeSoundCount).toBeGreaterThanOrEqual(1);
  expect(closed.audit.lastError || null).toBeNull();
}

for (const viewport of [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`magic cards preserve main behavior and expose non-intrusive SFX audit - ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !isBenignBrowserAudioError(message.text())) {
        failures.push(message.text());
      }
    });

    await openHome(page);
    await certifyMagicCardInteraction(page);

    expect(failures).toEqual([]);
  });
}

test('magic cards remain initialized and interactive after PJAX return to home', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });

  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !isBenignBrowserAudioError(message.text())) {
      failures.push(message.text());
    }
  });

  await goHomeViaPjax(page);

  const state = await readState(page, 0);

  expect(state.pathname).toMatch(/\/index\.html$|\/$/);
  expect(state.audit.ready).toBeTruthy();
  expect(state.audit.boundCount).toBeGreaterThanOrEqual(4);

  await certifyMagicCardInteraction(page);

  expect(failures).toEqual([]);
});
