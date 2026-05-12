import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

/* PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V2 */
test.setTimeout(120_000);

type AudioToggleState = {
  buttonCount: number;
  modalCount: number;
  wrapperCount: number;
  audioCount: number;
  open: boolean;
  contractOpen: boolean;
  auditOpen: boolean | null;
  auditReady: boolean;
  expanded: string | null;
  lastError: string | null;
};

async function readAudioToggleState(page: import('@playwright/test').Page): Promise<AudioToggleState> {
  return page.evaluate(() => {
    function visible(node: Element | null): boolean {
      if (!node) return false;

      const element = node as HTMLElement;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.parseFloat(style.opacity || '1') > 0.05
        && rect.width > 0
        && rect.height > 0;
    }

    const button = document.querySelector('#openAudioPlayer') as HTMLElement | null;
    const modal = document.querySelector('#audioPlayerModal') as HTMLElement | null;
    const wrapper = document.querySelector('#responsiveWrapper') as HTMLElement | null;
    const api = (window as unknown as {
      __PR6_AUDIO_MODAL_TOGGLE__?: { isOpen?: () => boolean };
    }).__PR6_AUDIO_MODAL_TOGGLE__;
    const audit = (window as unknown as {
      __AUDIO_MODAL_TOGGLE_AUDIT__?: {
        ready?: boolean;
        open?: boolean;
        lastError?: string | null;
      };
    }).__AUDIO_MODAL_TOGGLE_AUDIT__;

    const contractOpen = document.documentElement.dataset.audioModalOpen === 'true';

    return {
      buttonCount: document.querySelectorAll('#openAudioPlayer').length,
      modalCount: document.querySelectorAll('#audioPlayerModal').length,
      wrapperCount: document.querySelectorAll('#responsiveWrapper').length,
      audioCount: document.querySelectorAll('#audioPlayer').length,
      open: Boolean(
        contractOpen
        || api?.isOpen?.()
        || visible(modal)
        || visible(wrapper)
        || modal?.classList.contains('show')
        || modal?.classList.contains('is-open')
        || wrapper?.classList.contains('is-open')
      ),
      contractOpen,
      auditOpen: typeof audit?.open === 'boolean' ? audit.open : null,
      auditReady: Boolean(audit?.ready),
      expanded: button?.getAttribute('aria-expanded') || null,
      lastError: audit?.lastError || null,
    };
  });
}

async function dispatchToggleClick(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const button = document.querySelector('#openAudioPlayer') as HTMLElement | null;

    if (!button) {
      throw new Error('#openAudioPlayer introuvable');
    }

    button.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    }));
  });
}

async function waitForContractOpen(page: import('@playwright/test').Page, expected: boolean) {
  await page.waitForFunction((open) => {
    const api = (window as unknown as {
      __PR6_AUDIO_MODAL_TOGGLE__?: { isOpen?: () => boolean };
    }).__PR6_AUDIO_MODAL_TOGGLE__;

    const contractOpen = document.documentElement.dataset.audioModalOpen === 'true';

    if (open) {
      return Boolean(contractOpen && api?.isOpen?.());
    }

    return Boolean(!contractOpen && api?.isOpen && !api.isOpen());
  }, expected, { timeout: 30_000 });
}

test('audio modal button toggles open then closed then open again', async ({ page }) => {
  const failures: string[] = [];

  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    const text = message.text();

    if (
      message.type() === 'error'
      && !/AudioContext|audio device|WebAudio renderer|favicon|cdn|r2\.dev|NS_BINDING_ABORTED/i.test(text)
    ) {
      failures.push(text);
    }
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#openAudioPlayer')).toHaveCount(1, { timeout: 60_000 });
  await expect(page.locator('#audioPlayer')).toHaveCount(1, { timeout: 60_000 });

  await page.waitForFunction(() => {
    return Boolean((window as unknown as {
      __PR6_AUDIO_MODAL_TOGGLE__?: unknown;
    }).__PR6_AUDIO_MODAL_TOGGLE__);
  }, null, { timeout: 60_000 });

  const initial = await readAudioToggleState(page);
  expect(initial.buttonCount).toBe(1);
  expect(initial.audioCount).toBe(1);
  expect(initial.open).toBeFalsy();
  expect(initial.expanded).toBe('false');

  await dispatchToggleClick(page);
  await waitForContractOpen(page, true);

  const opened = await readAudioToggleState(page);
  expect(opened.open).toBeTruthy();
  expect(opened.contractOpen).toBeTruthy();
  expect(opened.auditReady).toBeTruthy();
  expect(opened.auditOpen).toBe(true);
  expect(opened.expanded).toBe('true');
  expect(opened.lastError).toBeNull();

  await dispatchToggleClick(page);
  await waitForContractOpen(page, false);

  const closed = await readAudioToggleState(page);
  expect(closed.open).toBeFalsy();
  expect(closed.contractOpen).toBeFalsy();
  expect(closed.auditReady).toBeTruthy();
  expect(closed.auditOpen).toBe(false);
  expect(closed.expanded).toBe('false');
  expect(closed.lastError).toBeNull();

  await dispatchToggleClick(page);
  await waitForContractOpen(page, true);

  const reopened = await readAudioToggleState(page);
  expect(reopened.open).toBeTruthy();
  expect(reopened.contractOpen).toBeTruthy();
  expect(reopened.auditReady).toBeTruthy();
  expect(reopened.auditOpen).toBe(true);
  expect(reopened.expanded).toBe('true');
  expect(reopened.lastError).toBeNull();

  expect(failures).toEqual([]);
});
