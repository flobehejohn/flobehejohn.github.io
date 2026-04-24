import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

type DeepPage = {
  name: string;
  path: string;
  expectedText: RegExp;
  optionalSelectors?: string[];
};

const deepPages: DeepPage[] = [
  {
    name: 'nuage-magique',
    path: '/assets/portfolio/nuage_magique/nuage_magique_def.html',
    expectedText: /nuage|magique|particle|particule/i,
    optionalSelectors: ['canvas', '#canvas', '#cloud-bg', '[data-page]']
  },
  {
    name: 'musicam',
    path: '/assets/portfolio/projet_musicam/projet_musicam.html',
    expectedText: /musicam|media|midi|audio|gesture|geste/i,
    optionalSelectors: ['canvas', 'video', 'audio', '[data-page]']
  },
  {
    name: 'synth-fm',
    path: '/assets/portfolio/projet_synth/main_synth_fm.html',
    expectedText: /synth|fm|audio|oscillator|oscillateur/i,
    optionalSelectors: ['canvas', 'audio', 'button', 'input']
  },
  {
    name: 'dotnet-demo',
    path: '/assets/portfolio/Projet_dotnet/app_dotnet.html',
    expectedText: /commande|dotnet|api|gestion|chargement/i,
    optionalSelectors: ['#root', '#app', 'main', 'script[type="module"]']
  },
  {
    name: 'rencontre',
    path: '/assets/portfolio/projet_rencontre/rencontre.html',
    expectedText: /rencontre|projet|audio|image|vidéo/i
  },
  {
    name: 'holon',
    path: '/assets/portfolio/projet_holon/holon.html',
    expectedText: /holon|projet|audio|image|vidéo/i
  },
  {
    name: 'ehm',
    path: '/assets/portfolio/projet_ehm/ehm.html',
    expectedText: /ehm|projet|audio|image|vidéo/i
  },
  {
    name: 'mac-val',
    path: '/assets/portfolio/projet_mac_val/mac_val.html',
    expectedText: /mac|val|projet|audio|image|vidéo/i
  },
  {
    name: 'smart-city',
    path: '/assets/portfolio/projet_smart_city/smart_city.html',
    expectedText: /smart|city|ville|projet/i
  }
];

function attachFailureGuards(page: import('@playwright/test').Page, failures: string[]) {
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && !/favicon|google|maps|cdn/i.test(text)) failures.push(`console: ${text}`);
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && /\/assets\//.test(url)) failures.push(`asset ${status}: ${url}`);
  });
}

test('deep assets: logos, profile photos and vendors load with natural dimensions', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const probes = await page.evaluate(async () => {
    const urls = [
      '/assets/images/log_zim.jpg',
      '/assets/images/log_zim.webp',
      '/assets/images/people/moi_.png',
      '/assets/images/people/moi_.webp',
      '/assets/vendor/isotope.pkgd.min.js',
      '/assets/vendor/imagesloaded.pkgd.min.js',
      '/assets/js/nuage_magique/nuage.js',
      '/assets/js/nuage_magique/text_particles.js',
      '/assets/audio/auto_radio/js/playlist.json'
    ];

    const results = [];
    for (const url of urls) {
      const response = await fetch(url, { cache: 'no-store' });
      results.push({ url, ok: response.ok, status: response.status });
    }

    const imageChecks = await Promise.all(
      ['/assets/images/log_zim.jpg', '/assets/images/people/moi_.png'].map(
        (src) =>
          new Promise<{ src: string; loaded: boolean; width: number; height: number }>((resolve) => {
            const image = new Image();
            image.onload = () => resolve({ src, loaded: true, width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => resolve({ src, loaded: false, width: 0, height: 0 });
            image.src = src;
          })
      )
    );

    return { results, imageChecks };
  });

  for (const result of probes.results) {
    expect(result.ok, `${result.url} returned ${result.status}`).toBeTruthy();
  }

  for (const image of probes.imageChecks) {
    expect(image.loaded, `${image.src} must load`).toBeTruthy();
    expect(image.width, `${image.src} width`).toBeGreaterThan(16);
    expect(image.height, `${image.src} height`).toBeGreaterThan(16);
  }
});

for (const deepPage of deepPages) {
  test(`deep page ${deepPage.name}: loads content and critical surfaces`, async ({ page }) => {
    const failures: string[] = [];
    attachFailureGuards(page, failures);

    const response = await page.goto(deepPage.path, { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), `${deepPage.path} must return OK`).toBeTruthy();
    await page.waitForTimeout(1800);

    await expect(page.locator('body')).toContainText(deepPage.expectedText);

    const bodyStats = await page.evaluate(() => ({
      textLength: document.body.innerText.trim().length,
      images: Array.from(document.images).map((img) => ({
        src: img.currentSrc || img.src,
        complete: img.complete,
        width: img.naturalWidth,
        height: img.naturalHeight
      })),
      canvasCount: document.querySelectorAll('canvas').length,
      buttonCount: document.querySelectorAll('button, a[href], input, select, textarea').length,
      scriptCount: document.scripts.length,
      hasWebGL: Array.from(document.querySelectorAll('canvas')).some((canvas) => {
        try {
          return Boolean(canvas.getContext('webgl') || canvas.getContext('webgl2') || canvas.getContext('2d'));
        } catch {
          return false;
        }
      })
    }));

    expect(bodyStats.textLength, `${deepPage.name} should expose meaningful text`).toBeGreaterThan(80);
    expect(bodyStats.scriptCount, `${deepPage.name} should retain scripts`).toBeGreaterThan(0);

    for (const selector of deepPage.optionalSelectors || []) {
      const count = await page.locator(selector).count();
      expect(count, `${deepPage.name} expected selector ${selector}`).toBeGreaterThan(0);
    }

    const brokenImages = bodyStats.images.filter((img) => !img.complete || img.width === 0 || img.height === 0);
    expect(brokenImages, `${deepPage.name} broken images: ${JSON.stringify(brokenImages.slice(0, 5))}`).toEqual([]);

    if (/nuage|musicam|synth/i.test(deepPage.name)) {
      expect(bodyStats.buttonCount, `${deepPage.name} should expose interactive controls or links`).toBeGreaterThan(0);
    }

    expect(failures, `${deepPage.name} runtime failures`).toEqual([]);
  });
}

test('home dynamic typography and apparition classes remain active', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  const dynamic = await page.evaluate(() => ({
    animatedTextCount: document.querySelectorAll('.animated-text, .anim-texte, [data-animate], .word, .char').length,
    visibleHeadings: Array.from(document.querySelectorAll('h1,h2,h3')).filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    }).length,
    bodyHasPreload: document.body.classList.contains('preload')
  }));

  expect(dynamic.animatedTextCount).toBeGreaterThan(0);
  expect(dynamic.visibleHeadings).toBeGreaterThan(0);
  expect(dynamic.bodyHasPreload).toBeFalsy();
});
