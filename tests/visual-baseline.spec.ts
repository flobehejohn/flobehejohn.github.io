import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';

const CAPTURE_DIR = join(process.cwd(), 'audit', 'pass0-baseline', 'screenshots');

const captures = [
  {
    name: 'home-desktop',
    route: '/',
    viewport: { width: 1440, height: 1200 },
    outputPath: join(CAPTURE_DIR, 'home-desktop.png'),
    anchors: ['#masthead', '#openAudioPlayer', "main[data-page='home']", '#magic-photo', '#skills-grid']
  },
  {
    name: 'home-mobile',
    route: '/',
    viewport: { width: 390, height: 844 },
    outputPath: join(CAPTURE_DIR, 'home-mobile.png'),
    anchors: ['#masthead', '.navbar-toggler', '#openAudioPlayer', "main[data-page='home']"]
  },
  {
    name: 'portfolio-desktop',
    route: '/portfolio_florian_b.html',
    viewport: { width: 1440, height: 1200 },
    outputPath: join(CAPTURE_DIR, 'portfolio-desktop.png'),
    anchors: ['#masthead', "main[data-page='portfolio']", '#portfolio-list', '.grid', '.carte-projet']
  },
  {
    name: 'portfolio-mobile',
    route: '/portfolio_florian_b.html',
    viewport: { width: 390, height: 844 },
    outputPath: join(CAPTURE_DIR, 'portfolio-mobile.png'),
    anchors: ['#masthead', '.navbar-toggler', "main[data-page='portfolio']", '.grid']
  },
  {
    name: 'parcours-desktop',
    route: '/parcours.html',
    viewport: { width: 1440, height: 1200 },
    outputPath: join(CAPTURE_DIR, 'parcours-desktop.png'),
    anchors: ['#masthead', "main[data-page='parcours']", '#cloud-bg', '#analyticsDashboard', '#analyticsToggle']
  },
  {
    name: 'parcours-mobile',
    route: '/parcours.html',
    viewport: { width: 390, height: 844 },
    outputPath: join(CAPTURE_DIR, 'parcours-mobile.png'),
    anchors: ['#masthead', '.navbar-toggler', "main[data-page='parcours']", '#analyticsDashboard']
  },
  {
    name: 'contact-desktop',
    route: '/contact.html',
    viewport: { width: 1440, height: 1200 },
    outputPath: join(CAPTURE_DIR, 'contact-desktop.png'),
    anchors: ['#masthead', "main[data-page='contact']", '#contactForm', '#mapDirections', '#emailSafe']
  },
  {
    name: 'contact-mobile',
    route: '/contact.html',
    viewport: { width: 390, height: 844 },
    outputPath: join(CAPTURE_DIR, 'contact-mobile.png'),
    anchors: ['#masthead', '.navbar-toggler', "main[data-page='contact']", '#contactForm']
  }
] as const;

function ensureDir(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}

async function settlePage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    document.body.classList.remove('preload');
    (document.documentElement as HTMLElement).style.scrollBehavior = 'auto';
  });
}

for (const capture of captures) {
  test(`visual baseline ${capture.name}`, async ({ page }) => {
    await page.setViewportSize(capture.viewport);
    await page.goto(capture.route, { waitUntil: 'domcontentloaded' });
    await settlePage(page);

    for (const anchor of capture.anchors) {
      await expect(page.locator(anchor).first(), `Anchor missing for ${capture.name}: ${anchor}`).toHaveCount(1);
    }

    ensureDir(capture.outputPath);
    await page.screenshot({
      path: capture.outputPath,
      fullPage: false,
      animations: 'disabled'
    });
  });
}
