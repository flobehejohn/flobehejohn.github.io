import * as pw from '@playwright/test';
type PlaywrightRuntime = typeof import('@playwright/test');
const playwrightRuntime = ((pw as unknown as { default?: PlaywrightRuntime }).default ?? pw) as PlaywrightRuntime;
const { test, expect } = playwrightRuntime;


import type { Page } from '@playwright/test';

test.setTimeout(120_000);

type NavigationTarget = {
  from: string;
  next: string;
};

const targets: NavigationTarget[] = [
  { from: '/', next: '/portfolio_florian_b.html' },
  { from: '/portfolio_florian_b.html', next: '/parcours.html' },
  { from: '/parcours.html', next: '/contact.html' },
];

async function getRuntimeState(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const audioPlayers = document.querySelectorAll('#audioPlayer, audio').length;
    const openAudioButtons = new Set(
      Array.from(document.querySelectorAll('#openAudioPlayer')).map((node) => node.id || node.getAttribute('aria-label') || 'openAudioPlayer'),
    ).size;
    const pjaxAudit = (window as unknown as {
      __PJAX_AUDIT__?: {
        navigationCount?: number;
        pushStateCount?: number;
      };
    }).__PJAX_AUDIT__;

    return {
      url: window.location.pathname,
      title: document.title,
      mainTextLength: main?.textContent?.trim().length ?? 0,
      audioPlayers,
      openAudioButtons,
      pjaxNavigationCount: pjaxAudit?.navigationCount ?? 0,
      pjaxPushStateCount: pjaxAudit?.pushStateCount ?? 0,
    };
  });
}

function linkSelector(next: string): string {
  const normalized = next.replace(/^\//, '');

  return [
    `a[href="${next}"]`,
    `a[href="${normalized}"]`,
    `a[href$="${normalized}"]`,
  ].join(', ');
}

for (const target of targets) {
  test(`PJAX/navigation articulation remains stable from ${target.from} to ${target.next}`, async ({ page }) => {
    await page.goto(target.from, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);

    const before = await getRuntimeState(page);
    expect(before.mainTextLength).toBeGreaterThan(300);

    const selector = linkSelector(target.next);
    const link = page.locator(selector).first();

    await expect(link, `navigation link missing: ${selector}`).toHaveCount(1);

    await Promise.allSettled([
      page.waitForURL((url) => url.pathname.endsWith(target.next), { timeout: 30_000 }),
      link.evaluate((element) => {
        const html = element as HTMLElement;
        html.scrollIntoView({ block: 'center', inline: 'center' });
        html.click();
      }),
    ]);

    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await page.waitForTimeout(1_000).catch(() => undefined);

    const after = await getRuntimeState(page);

    expect(after.url).toContain(target.next.replace(/^\//, ''));
    expect(after.mainTextLength).toBeGreaterThan(300);
    expect(after.audioPlayers).toBeLessThanOrEqual(1);
    expect(after.openAudioButtons).toBeLessThanOrEqual(1);
  });
}
