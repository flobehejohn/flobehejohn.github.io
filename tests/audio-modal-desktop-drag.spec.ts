import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

test.setTimeout(120_000);

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

async function openAudioModal(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#openAudioPlayer')).toHaveCount(1, { timeout: 60_000 });

  await page.evaluate(async () => {
    const api = (window as unknown as {
      __PR6_AUDIO_MODAL_TOGGLE__?: { open?: () => Promise<boolean> | boolean };
    }).__PR6_AUDIO_MODAL_TOGGLE__;

    if (api?.open) {
      await api.open();
      return;
    }

    const button = document.querySelector('#openAudioPlayer') as HTMLElement | null;
    if (!button) throw new Error('#openAudioPlayer introuvable');

    button.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    }));
  });

  await page.waitForFunction(() => {
    const wrapper = document.querySelector('#responsiveWrapper') as HTMLElement | null;
    const dragBar = document.querySelector('#dragBar.drag-bar, #dragBar, .drag-bar') as HTMLElement | null;
    const audit = (window as unknown as {
      __PR6_AUDIO_MODAL_DRAG__?: { ready?: boolean; version?: string };
    }).__PR6_AUDIO_MODAL_DRAG__;

    if (!wrapper || !dragBar || !audit?.ready) return false;

    const wrapperStyle = getComputedStyle(wrapper);
    const dragStyle = getComputedStyle(dragBar);
    const wrapperRect = wrapper.getBoundingClientRect();
    const dragRect = dragBar.getBoundingClientRect();

    return audit.version === 'PR6_AUDIO_MODAL_DESKTOP_DRAG_V4_DOT_HANDLE_STABLE'
      && wrapperStyle.display !== 'none'
      && wrapperStyle.visibility !== 'hidden'
      && Number.parseFloat(wrapperStyle.opacity || '1') > 0.05
      && dragStyle.display !== 'none'
      && dragStyle.visibility !== 'hidden'
      && wrapperRect.width > 0
      && wrapperRect.height > 0
      && dragRect.width > 0
      && dragRect.height > 0;
  }, null, { timeout: 60_000 });
}

async function rectOf(page: import('@playwright/test').Page, selector: string): Promise<Rect> {
  return page.locator(selector).evaluate((node) => {
    const rect = (node as HTMLElement).getBoundingClientRect();

    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function syntheticDrag(
  page: import('@playwright/test').Page,
  moves: Array<{ x: number; y: number }>
) {
  await page.evaluate(async (movesArg) => {
    const handle = document.querySelector('#dragBar.drag-bar, #dragBar, .drag-bar') as HTMLElement | null;
    if (!handle) throw new Error('#dragBar introuvable');

    const rect = handle.getBoundingClientRect();
    const startX = Math.round(rect.left + rect.width / 2);
    const startY = Math.round(rect.top + rect.height / 2);
    const pointerId = 771;

    function dispatch(target: EventTarget, type: string, x: number, y: number, buttons: number) {
      target.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons,
        clientX: x,
        clientY: y,
      }));
    }

    function tick() {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }

    dispatch(handle, 'pointerdown', startX, startY, 1);
    await tick();
    await tick();

    for (const move of movesArg) {
      dispatch(document, 'pointermove', move.x, move.y, 1);
      await tick();
      await tick();
    }
  }, moves);
}

async function syntheticPointerUp(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 771,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: 0,
      clientX: 0,
      clientY: 0,
    }));
  });
}

test('audio modal uses only historical six-dot drag handle', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openAudioModal(page);

  await expect(page.locator('#pr6AudioDragHandle')).toHaveCount(0);
  await expect(page.locator('.pr6-audio-drag-handle')).toHaveCount(0);
  await expect(page.locator('#dragBar.drag-bar, #dragBar, .drag-bar')).toHaveCount(1);

  const audit = await page.evaluate(() => {
    return (window as unknown as {
      __PR6_AUDIO_MODAL_DRAG__?: {
        version?: string;
        ready?: boolean;
        activeHandleId?: string | null;
        dotHandleCount?: number;
        addedHandleCount?: number;
        handleVisible?: boolean;
      };
    }).__PR6_AUDIO_MODAL_DRAG__;
  });

  expect(audit?.version).toBe('PR6_AUDIO_MODAL_DESKTOP_DRAG_V4_DOT_HANDLE_STABLE');
  expect(audit?.ready).toBeTruthy();
  expect(audit?.activeHandleId).toBe('dragBar');
  expect(audit?.dotHandleCount).toBe(1);
  expect(audit?.addedHandleCount).toBe(0);
  expect(audit?.handleVisible).toBeTruthy();
});

test('six-dot drag follows pointer without jump or dimension mutation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openAudioModal(page);

  const wrapperBefore = await rectOf(page, '#responsiveWrapper');
  const handle = await rectOf(page, '#dragBar');

  const startX = Math.round(handle.left + handle.width / 2);
  const startY = Math.round(handle.top + handle.height / 2);
  const dx = 96;
  const dy = -54;

  await syntheticDrag(page, [{ x: startX + dx, y: startY + dy }]);

  const wrapperAfterMove = await rectOf(page, '#responsiveWrapper');

  expect(Math.abs(wrapperAfterMove.left - (wrapperBefore.left + dx))).toBeLessThanOrEqual(3);
  expect(Math.abs(wrapperAfterMove.top - (wrapperBefore.top + dy))).toBeLessThanOrEqual(3);
  expect(Math.abs(wrapperAfterMove.width - wrapperBefore.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(wrapperAfterMove.height - wrapperBefore.height)).toBeLessThanOrEqual(1);

  const audit = await page.evaluate(() => {
    return (window as unknown as {
      __PR6_AUDIO_MODAL_DRAG__?: {
        ready?: boolean;
        dragging?: boolean;
        activeHandleId?: string | null;
        addedHandleCount?: number;
        offset?: { x: number; y: number } | null;
        startRect?: { left: number; top: number; width: number; height: number } | null;
        frozenRect?: { left: number; top: number; width: number; height: number } | null;
      };
    }).__PR6_AUDIO_MODAL_DRAG__;
  });

  expect(audit?.ready).toBeTruthy();
  expect(audit?.dragging).toBeTruthy();
  expect(audit?.activeHandleId).toBe('dragBar');
  expect(audit?.addedHandleCount).toBe(0);
  expect(audit?.offset?.x).toBeGreaterThanOrEqual(0);
  expect(audit?.offset?.y).toBeGreaterThanOrEqual(0);
  expect(Math.abs((audit?.startRect?.left || 0) - (audit?.frozenRect?.left || 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((audit?.startRect?.top || 0) - (audit?.frozenRect?.top || 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((audit?.startRect?.width || 0) - (audit?.frozenRect?.width || 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((audit?.startRect?.height || 0) - (audit?.frozenRect?.height || 0))).toBeLessThanOrEqual(1);

  await syntheticPointerUp(page);
});

test('six-dot drag clamps modal inside viewport without OS mouse-outside freeze', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 620 });
  await openAudioModal(page);

  await syntheticDrag(page, [{ x: -1200, y: -1200 }]);

  const topLeft = await rectOf(page, '#responsiveWrapper');

  expect(topLeft.left).toBeGreaterThanOrEqual(7);
  expect(topLeft.top).toBeGreaterThanOrEqual(7);

  await syntheticPointerUp(page);

  await syntheticDrag(page, [{ x: 1800, y: 1400 }]);

  const bottomRight = await rectOf(page, '#responsiveWrapper');
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('viewport introuvable');

  expect(bottomRight.right).toBeLessThanOrEqual(viewport.width - 7);
  expect(bottomRight.bottom).toBeLessThanOrEqual(viewport.height - 7);

  const audit = await page.evaluate(() => {
    return (window as unknown as {
      __PR6_AUDIO_MODAL_DRAG__?: {
        ready?: boolean;
        inViewport?: boolean;
        addedHandleCount?: number;
      };
    }).__PR6_AUDIO_MODAL_DRAG__;
  });

  expect(audit?.ready).toBeTruthy();
  expect(audit?.inViewport).toBeTruthy();
  expect(audit?.addedHandleCount).toBe(0);

  await syntheticPointerUp(page);
});
