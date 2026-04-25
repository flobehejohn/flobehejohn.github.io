import { test, expect } from '@playwright/test';
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';
import { attachNetworkProbe, assertNoLocalAssetFailures } from './utils/networkProbe';
import { assertSecurityBaseline, getSecurityState } from './utils/securityProbe';
import { attachAnalyticsProbe, assertNoAnalyticsLeak } from './utils/analyticsProbe';
import { nowIso, writeAuditJson } from './utils/artifactWriter';

const pages = ['/', '/portfolio_florian_b.html', '/parcours.html', '/contact.html'];

for (const path of pages) {
  test(`security baseline holds for ${path}`, async ({ page }) => {
    const consoleProbe = attachConsoleProbe(page);
    const networkProbe = attachNetworkProbe(page);
    const analyticsProbe = attachAnalyticsProbe(page);

    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const security = await getSecurityState(page);
    assertSecurityBaseline(security);
    assertNoAnalyticsLeak(analyticsProbe);
    assertNoFatalConsole(consoleProbe);
    assertNoLocalAssetFailures(networkProbe);

    expect(security.externalScripts.filter((src) => /google-analytics|googletagmanager/i.test(src))).toHaveLength(0);

    writeAuditJson(`audit/_latest/security-${path.replace(/[^a-z0-9]/gi, '_') || 'home'}-summary.json`, {
      timestamp: nowIso(),
      path,
      security,
      googleAnalyticsRequests: analyticsProbe.googleAnalyticsRequests,
      piiLeaks: analyticsProbe.piiLeaks,
      localAssetFailures: networkProbe.localAssetFailures,
      fatalErrors: consoleProbe.fatalErrors,
      verdict: 'passed'
    });
  });
}
