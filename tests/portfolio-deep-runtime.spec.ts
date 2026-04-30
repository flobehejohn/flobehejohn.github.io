import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

type DeepPage = {
  name: string;
  path: string;
  expectedText: RegExp;
  proofSelectors?: string[];
  allowExternalCors?: boolean;
};

type AssetProbe = { url: string; ok: boolean; status: number };
type ImageProbe = { src: string; loaded: boolean; width: number; height: number };
type LocalImageProbe = { src: string; ok: boolean; status: number; timedOut?: boolean; method?: string };

const deepPages: DeepPage[] = [
  { name: 'nuage-magique', path: '/assets/portfolio/nuage_magique/nuage_magique_def.html', expectedText: /nuage|magique|particle|particule/i, proofSelectors: ['canvas', '#cloud-bg', '[data-page]', 'script[src*="nuage"]'] },
  { name: 'musicam', path: '/assets/portfolio/projet_musicam/projet_musicam.html', expectedText: /musicam|media|midi|audio|gesture|geste/i, proofSelectors: ['canvas', 'video', 'button', 'input', '[data-page]', 'script[src*="musicam"]'] },
  { name: 'synth-fm', path: '/assets/portfolio/projet_synth/main_synth_fm.html', expectedText: /synth|fm|audio|oscillator|oscillateur/i, proofSelectors: ['canvas', 'button', 'input', '[data-page]', 'script[src*="synth"]'] },
  { name: 'dotnet-demo', path: '/assets/portfolio/Projet_dotnet/app_dotnet.html', expectedText: /commande|dotnet|api|gestion|chargement/i, proofSelectors: ['#app', 'main', 'script[type="module"]', 'script[src*="dotnet"]'], allowExternalCors: true },
  { name: 'rencontre', path: '/assets/portfolio/projet_rencontre/rencontre.html', expectedText: /rencontre|projet|audio|image|vidéo/i },
  { name: 'holon', path: '/assets/portfolio/projet_holon/holon.html', expectedText: /holon|projet|audio|image|vidéo/i },
  { name: 'ehm', path: '/assets/portfolio/projet_ehm/ehm.html', expectedText: /ehm|projet|audio|image|vidéo/i, allowExternalCors: true },
  { name: 'mac-val', path: '/assets/portfolio/projet_mac_val/mac_val.html', expectedText: /mac|val|projet|audio|image|vidéo/i, allowExternalCors: true },
  { name: 'smart-city', path: '/assets/portfolio/projet_smart_city/smart_city.html', expectedText: /smart|city|ville|projet/i }
];

function isAllowedExternalFailure(text: string, allowExternalCors: boolean) {
  if (!allowExternalCors) return false;
  if (/CORS|blocked|Access-Control-Allow-Origin/i.test(text)) return true;
  if (/Failed to load resource: net::ERR_FAILED/i.test(text)) return true;
  return false;
}

function attachFailureGuards(page: import('@playwright/test').Page, failures: string[], options: { allowExternalCors?: boolean } = {}) {
  const allowExternalCors = Boolean(options.allowExternalCors);
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    const text = message.text();
    if (isAllowedExternalFailure(text, allowExternalCors)) return;
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
  const probes = await page.evaluate(async (): Promise<{ results: AssetProbe[]; imageChecks: ImageProbe[] }> => {
    const urls = ['/assets/images/log_zim.jpg', '/assets/images/log_zim.webp', '/assets/images/people/moi_.png', '/assets/images/people/moi_.webp', '/assets/vendor/isotope.pkgd.min.js', '/assets/vendor/imagesloaded.pkgd.min.js', '/assets/js/nuage_magique/nuage.js', '/assets/js/nuage_magique/text_particles.js', '/assets/audio/auto_radio/js/playlist.json'];
    const results: AssetProbe[] = [];
    for (const url of urls) {
      const response = await fetch(url, { cache: 'no-store' });
      results.push({ url, ok: response.ok, status: response.status });
    }
    const imageChecks = await Promise.all(['/assets/images/log_zim.jpg', '/assets/images/people/moi_.png'].map((src) => new Promise<ImageProbe>((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ src, loaded: true, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ src, loaded: false, width: 0, height: 0 });
      image.src = src;
    })));
    return { results, imageChecks };
  });
  for (const result of probes.results) expect(result.ok, `${result.url} returned ${result.status}`).toBeTruthy();
  for (const image of probes.imageChecks) {
    expect(image.loaded, `${image.src} must load`).toBeTruthy();
    expect(image.width, `${image.src} width`).toBeGreaterThan(16);
    expect(image.height, `${image.src} height`).toBeGreaterThan(16);
  }
});

for (const deepPage of deepPages) {
  test(`deep page ${deepPage.name}: loads content and critical surfaces`, async ({ page }) => {
    const failures: string[] = [];
    attachFailureGuards(page, failures, { allowExternalCors: deepPage.allowExternalCors });
    const response = await page.goto(deepPage.path, { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), `${deepPage.path} must return OK`).toBeTruthy();
    await page.waitForTimeout(1800);
    await expect(page.locator('body')).toContainText(deepPage.expectedText);
    const bodyStats = await page.evaluate(async (): Promise<{ textLength: number; localImages: LocalImageProbe[]; controls: number; scripts: number; canvases: number; media: number }> => {
      const localImageSrcs = Array.from(new Set(
        Array.from(document.images)
          .map((img) => img.currentSrc || img.src)
          .filter((src) => src.includes('/assets/'))
      )).slice(0, 64);

      async function probeLocalImage(src: string): Promise<LocalImageProbe> {
        const url = new URL(src, window.location.href).pathname;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 5000);
        try {
          const headResponse = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
          if (headResponse.ok) {
            return { src: url, ok: true, status: headResponse.status, method: 'HEAD' };
          }

          const getResponse = await fetch(url, { cache: 'no-store', signal: controller.signal });
          return { src: url, ok: getResponse.ok, status: getResponse.status, method: 'GET' };
        } catch {
          return { src: url, ok: false, status: 0, timedOut: true, method: 'HEAD' };
        } finally {
          window.clearTimeout(timeout);
        }
      }

      const localImages = await Promise.all(localImageSrcs.map((src) => probeLocalImage(src)));
      return { textLength: document.body.innerText.trim().length, localImages, controls: document.querySelectorAll('button, a[href], input, select, textarea').length, scripts: document.scripts.length, canvases: document.querySelectorAll('canvas').length, media: document.querySelectorAll('audio, video').length };
    });
    expect(bodyStats.textLength, `${deepPage.name} should expose meaningful text`).toBeGreaterThan(80);
    expect(bodyStats.scripts, `${deepPage.name} should retain scripts`).toBeGreaterThan(0);
    const failedLocalImages = bodyStats.localImages.filter((img) => !img.ok);
    expect(failedLocalImages, `${deepPage.name} local images not reachable: ${JSON.stringify(failedLocalImages.slice(0, 8))}`).toEqual([]);
    if (deepPage.proofSelectors?.length) {
      const proofCounts = await Promise.all(deepPage.proofSelectors.map(async (selector) => ({ selector, count: await page.locator(selector).count() })));
      const totalProofs = proofCounts.reduce((sum, proof) => sum + proof.count, 0);
      expect(totalProofs, `${deepPage.name} should expose at least one functional proof among ${JSON.stringify(proofCounts)}`).toBeGreaterThan(0);
    }
    if (/nuage|musicam|synth/i.test(deepPage.name)) {
      const interactiveSurfaceCount = bodyStats.controls + bodyStats.canvases + bodyStats.media;
      expect(interactiveSurfaceCount, `${deepPage.name} should expose interactive surfaces`).toBeGreaterThan(0);
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
