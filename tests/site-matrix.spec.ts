import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';
import { attachNetworkProbe, assertNoLocalAssetFailures } from './utils/networkProbe';
import { nowIso, writeAuditJson } from './utils/artifactWriter';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

type Matrix = { pages: string[]; features: string[] };
const matrix = JSON.parse(readFileSync('audit/contracts/site-capability-matrix.json', 'utf8')) as Matrix;

for (const path of matrix.pages) {
  test(`site matrix certifies ${path}`, async ({ page }) => {
    const consoleProbe = attachConsoleProbe(page);
    const networkProbe = attachNetworkProbe(page);

    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    expect(response?.status(), `${path} response status`).toBeLessThan(400);

    const state = await page.evaluate(() => {
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      const visibleTextLength = document.body.textContent?.trim().length || 0;
      const canvasCount = document.querySelectorAll('canvas').length;
      const audioCount = document.querySelectorAll('audio').length;
      return {
        title: document.title,
        canonical,
        metaDescription,
        visibleTextLength,
        canvasCount,
        audioCount
      };
    });

    expect(state.title.length, `${path} title`).toBeGreaterThan(0);
    expect(state.visibleTextLength, `${path} visible text length`).toBeGreaterThan(10);
    if (!path.includes('/assets/portfolio/')) {
      expect(state.canonical.length, `${path} canonical`).toBeGreaterThan(0);
      expect(state.metaDescription.length, `${path} meta description`).toBeGreaterThan(0);
    }

    assertNoFatalConsole(consoleProbe);
    assertNoLocalAssetFailures(networkProbe);

    writeAuditJson(`audit/_latest/site-matrix-${path.replace(/[^a-z0-9]/gi, '_') || 'home'}.json`, {
      timestamp: nowIso(),
      path,
      state,
      localAssetFailures: networkProbe.localAssetFailures,
      externalFailures: networkProbe.externalFailures,
      fatalErrors: consoleProbe.fatalErrors,
      verdict: 'passed'
    });
  });
}
