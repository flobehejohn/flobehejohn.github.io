import { expect, test } from '@playwright/test';

const resolverPath = 'assets/js/runtime-url.js';

async function installResolver(page, href: string) {
  await page.goto('about:blank');
  await page.addScriptTag({ content: `history.replaceState(null, '', ${JSON.stringify(href)});` });
  await page.addScriptTag({ path: resolverPath });
}

test.describe('AppRuntimeUrl contract', () => {
  test('resolves localhost root paths', async ({ page }) => {
    await installResolver(page, 'http://127.0.0.1:4173/index.html');

    const result = await page.evaluate(() => ({
      base: window.AppRuntimeUrl.baseHref(),
      asset: window.AppRuntimeUrl.asset('assets/js/page-hub.js'),
      page: window.AppRuntimeUrl.page('portfolio_florian_b.html')
    }));

    expect(result.base).toBe('http://127.0.0.1:4173/');
    expect(result.asset).toBe('http://127.0.0.1:4173/assets/js/page-hub.js');
    expect(result.page).toBe('http://127.0.0.1:4173/portfolio_florian_b.html');
  });

  test('resolves GitHub Pages root paths', async ({ page }) => {
    await installResolver(page, 'https://flobehejohn.github.io/index.html');

    const result = await page.evaluate(() => ({
      base: window.AppRuntimeUrl.baseHref(),
      asset: window.AppRuntimeUrl.asset('assets/js/page-hub.js'),
      page: window.AppRuntimeUrl.page('contact.html')
    }));

    expect(result.base).toBe('https://flobehejohn.github.io/');
    expect(result.asset).toBe('https://flobehejohn.github.io/assets/js/page-hub.js');
    expect(result.page).toBe('https://flobehejohn.github.io/contact.html');
  });

  test('resolves RawGitHack preview root paths', async ({ page }) => {
    await installResolver(page, 'https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/index.html');

    const result = await page.evaluate(() => ({
      base: window.AppRuntimeUrl.baseHref(),
      asset: window.AppRuntimeUrl.asset('assets/js/page-hub.js'),
      page: window.AppRuntimeUrl.page('portfolio_florian_b.html')
    }));

    expect(result.base).toBe('https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/');
    expect(result.asset).toBe('https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/assets/js/page-hub.js');
    expect(result.page).toBe('https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/portfolio_florian_b.html');
  });

  test('normalizes deep RawGitHack module paths back to app root', async ({ page }) => {
    await installResolver(page, 'https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/assets/portfolio/nuage_magique/nuage_magique_def.html');

    const result = await page.evaluate(() => ({
      base: window.AppRuntimeUrl.baseHref(),
      asset: window.AppRuntimeUrl.asset('assets/js/nuage_magique/text_particles.js'),
      portfolio: window.AppRuntimeUrl.normalizeInternalHref('portfolio_florian_b.html'),
      brokenAssets: window.AppRuntimeUrl.normalizeInternalHref('assets/portfolio/nuage_magique/assets/js/page-hub.js')
    }));

    expect(result.base).toBe('https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/');
    expect(result.asset).toBe('https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/assets/js/nuage_magique/text_particles.js');
    expect(result.portfolio).toBe('https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/portfolio_florian_b.html');
    expect(result.brokenAssets).toBe('https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/assets/js/page-hub.js');

    for (const value of Object.values(result)) {
      expect(String(value)).not.toContain('/assets/portfolio/nuage_magique/assets/');
      expect(String(value)).not.toContain('/assets/portfolio/Projet_dotnet/assets/');
      expect(String(value)).not.toContain('https://raw.githack.com/assets/');
    }
  });
});
