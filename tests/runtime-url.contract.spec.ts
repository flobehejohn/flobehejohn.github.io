import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { test } = require('@playwright/test');

test.setTimeout(120_000);

const runtimeScript = readFileSync('assets/js/runtime-url.js', 'utf8');

type RuntimeCase = {
  title: string;
  locationLike: {
    origin: string;
    href: string;
    pathname: string;
    protocol?: string;
    host?: string;
  };
  expectedBase: string;
  assetPath: string;
  pagePath: string;
};

const cases: RuntimeCase[] = [
  {
    title: 'resolves localhost root paths',
    locationLike: {
      origin: 'http://127.0.0.1:4173',
      href: 'http://127.0.0.1:4173/index.html',
      pathname: '/index.html',
      protocol: 'http:',
      host: '127.0.0.1:4173',
    },
    expectedBase: 'http://127.0.0.1:4173/',
    assetPath: 'assets/js/page-hub.js',
    pagePath: 'contact.html',
  },
  {
    title: 'resolves GitHub Pages root paths',
    locationLike: {
      origin: 'https://flobehejohn.github.io',
      href: 'https://flobehejohn.github.io/index.html',
      pathname: '/index.html',
      protocol: 'https:',
      host: 'flobehejohn.github.io',
    },
    expectedBase: 'https://flobehejohn.github.io/',
    assetPath: 'assets/js/page-hub.js',
    pagePath: 'contact.html',
  },
  {
    title: 'resolves RawGitHack preview root paths',
    locationLike: {
      origin: 'https://raw.githack.com',
      href: 'https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/index.html',
      pathname: '/flobehejohn/flobehejohn.github.io/preview/refactor-live/index.html',
      protocol: 'https:',
      host: 'raw.githack.com',
    },
    expectedBase: 'https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/',
    assetPath: 'assets/js/page-hub.js',
    pagePath: 'portfolio_florian_b.html',
  },
  {
    title: 'normalizes deep RawGitHack module paths back to app root',
    locationLike: {
      origin: 'https://raw.githack.com',
      href: 'https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/assets/js/nuage_magique/text_particles.js',
      pathname: '/flobehejohn/flobehejohn.github.io/preview/refactor-live/assets/js/nuage_magique/text_particles.js',
      protocol: 'https:',
      host: 'raw.githack.com',
    },
    expectedBase: 'https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/',
    assetPath: 'assets/js/nuage_magique/text_particles.js',
    pagePath: 'portfolio_florian_b.html',
  },
];

for (const item of cases) {
  test(`AppRuntimeUrl contract › ${item.title}`, async ({ page }) => {
    await page.goto('about:blank');
    await page.addScriptTag({ content: runtimeScript });

    const result = await page.evaluate((input) => {
      const runtime = (window as unknown as {
        AppRuntimeUrl?: {
          _computeBaseHref?: (locationLike: unknown) => string;
        };
      }).AppRuntimeUrl;

      if (!runtime?._computeBaseHref) {
        throw new Error('AppRuntimeUrl._computeBaseHref missing');
      }

      const base = runtime._computeBaseHref(input.locationLike);

      return {
        base,
        asset: new URL(input.assetPath, base).href,
        page: new URL(input.pagePath, base).href,
      };
    }, item);

    assert.equal(result.base, item.expectedBase);
    assert.equal(result.asset, new URL(item.assetPath, item.expectedBase).href);
    assert.equal(result.page, new URL(item.pagePath, item.expectedBase).href);
  });
}
