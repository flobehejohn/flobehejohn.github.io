import { expect, test } from '@playwright/test';
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';
import { attachNetworkProbe, assertNoLocalAssetFailures } from './utils/networkProbe';

const basePath = process.env.PREVIEW_BASE_PATH || '/flobehejohn/flobehejohn.github.io/preview/refactor-live/';

const pages = [
  'index.html',
  'portfolio_florian_b.html',
  'parcours.html',
  'contact.html',
  'assets/portfolio/nuage_magique/nuage_magique_def.html',
  'assets/portfolio/Projet_dotnet/app_dotnet.html',
  'assets/portfolio/projet_synth/main_synth_fm.html',
  'assets/portfolio/projet_musicam/projet_musicam.html'
];

const brokenPathPatterns = [
  /\/assets\/portfolio\/nuage_magique\/assets\//,
  /\/assets\/portfolio\/Projet_dotnet\/assets\//,
  /\/assets\/portfolio\/[^/]+\/portfolio_florian_b\.html/,
  /\/assets\/portfolio\/[^/]+\/parcours\.html/,
  /\/assets\/portfolio\/[^/]+\/contact\.html/,
  /https:\/\/raw\.githack\.com\/assets\//
];

function previewUrl(path: string): string {
  return `${basePath}${path}`.replace(/\/+/g, '/').replace(':/', '://');
}

async function collectResourceUrls(page) {
  return page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
}

test.describe('RawGitHack strict preview contract', () => {
  for (const pagePath of pages) {
    test(`${pagePath} has no fatal JS or local asset failures`, async ({ page }) => {
      const consoleProbe = attachConsoleProbe(page);
      const networkProbe = attachNetworkProbe(page);

      await page.goto(previewUrl(pagePath), { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

      expect(await page.evaluate(() => document.readyState)).not.toBe('loading');

      const hasPjaxRootOrControlledFallback = await page.evaluate(() => {
        const main = document.querySelector('main[data-pjax-root]');
        const controlledFallback = document.querySelector('[data-fallback-controlled="true"], [data-legacy-isolated="true"]');
        return Boolean(main || controlledFallback);
      });
      expect(hasPjaxRootOrControlledFallback).toBeTruthy();

      const urls = [page.url(), ...(await collectResourceUrls(page)), ...networkProbe.localAssetFailures];
      const broken = urls.filter((url) => brokenPathPatterns.some((pattern) => pattern.test(String(url))));
      expect(broken, `Broken RawGitHack-relative URLs:\n${broken.join('\n')}`).toEqual([]);

      assertNoFatalConsole(consoleProbe);
      assertNoLocalAssetFailures(networkProbe);
    });
  }
});
