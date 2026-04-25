import { createRequire } from 'module';
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';
import { attachNetworkProbe, assertNoLocalAssetFailures } from './utils/networkProbe';
import { getPjaxState, installPjaxAudit } from './utils/pjaxProbe';
import { getAudioRuntimeState } from './utils/audioProbe';
import { nowIso, writeAuditJson } from './utils/artifactWriter';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

const navigationTargets = [
  { url: '/', next: '/portfolio_florian_b.html' },
  { url: '/portfolio_florian_b.html', next: '/parcours.html' },
  { url: '/parcours.html', next: '/contact.html' }
];

for (const target of navigationTargets) {
  test(`PJAX/navigation articulation remains stable from ${target.url} to ${target.next}`, async ({ page }) => {
    await installPjaxAudit(page);
    const consoleProbe = attachConsoleProbe(page);
    const networkProbe = attachNetworkProbe(page);

    await page.goto(target.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const before = await getPjaxState(page);
    const beforeAudio = await getAudioRuntimeState(page);

    await page.locator(`a[href="${target.next}"]`).first().click({ timeout: 5_000 });
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await page.waitForTimeout(1_000);

    const after = await getPjaxState(page);
    const afterAudio = await getAudioRuntimeState(page);

    expect(after.href).toContain(target.next.replace(/^\//, ''));
    expect(after.title.length).toBeGreaterThan(0);
    expect(after.mainTextLength).toBeGreaterThan(10);
    expect(afterAudio.audioElementsCount).toBeLessThanOrEqual(Math.max(1, beforeAudio.audioElementsCount));

    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    await page.waitForTimeout(700);
    const afterBack = await getPjaxState(page);
    expect(afterBack.href).toContain(target.url === '/' ? '/' : target.url.replace(/^\//, ''));

    assertNoFatalConsole(consoleProbe);
    assertNoLocalAssetFailures(networkProbe);

    writeAuditJson(`audit/_latest/pjax-${target.url.replace(/[^a-z0-9]/gi, '_') || 'home'}-summary.json`, {
      timestamp: nowIso(),
      target,
      before,
      after,
      afterBack,
      beforeAudio,
      afterAudio,
      localAssetFailures: networkProbe.localAssetFailures,
      fatalErrors: consoleProbe.fatalErrors,
      verdict: 'passed'
    });
  });
}
