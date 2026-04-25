import type { Page } from '@playwright/test';

export type PjaxState = {
  href: string;
  title: string;
  mainTextLength: number;
  audioElementsCount: number;
  pjaxEventsCount: number;
};

export async function installPjaxAudit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const globals = window as unknown as Record<string, unknown>;
    globals.__PJAX_AUDIT__ = { navigationCount: 0, pushStateCount: 0 };

    const originalPushState = history.pushState.bind(history);
    history.pushState = function patchedPushState(...args: Parameters<typeof history.pushState>) {
      const audit = globals.__PJAX_AUDIT__ as { navigationCount: number; pushStateCount: number };
      audit.pushStateCount += 1;
      audit.navigationCount += 1;
      return originalPushState(...args);
    };
  });
}

export async function getPjaxState(page: Page): Promise<PjaxState> {
  return page.evaluate(() => {
    const globals = window as unknown as { __PJAX_AUDIT__?: { navigationCount?: number; pushStateCount?: number } };
    const main = document.querySelector('main') || document.body;
    return {
      href: location.href,
      title: document.title,
      mainTextLength: main.textContent?.trim().length || 0,
      audioElementsCount: document.querySelectorAll('audio').length,
      pjaxEventsCount: globals.__PJAX_AUDIT__?.navigationCount || 0
    };
  });
}

export async function clickInternalNavigation(page: Page, hrefPattern: RegExp): Promise<{ before: PjaxState; after: PjaxState }> {
  const before = await getPjaxState(page);
  const link = page.locator('a[href]').filter({ hasNotText: /^$/ }).filter({ hasText: hrefPattern }).first();
  if ((await link.count()) === 0) throw new Error(`No internal navigation link found for ${hrefPattern}`);
  await link.click();
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForTimeout(700);
  const after = await getPjaxState(page);
  return { before, after };
}
