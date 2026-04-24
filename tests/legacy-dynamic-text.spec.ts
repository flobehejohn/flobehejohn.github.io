import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

const pages = ['/', '/portfolio_florian_b.html', '/parcours.html', '/contact.html'];

for (const route of pages) {
  test(`dynamic text active on ${route}`, async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));

    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);

    const state = await page.evaluate(() => {
      const animatedRoots = document.querySelectorAll('.animated-text, .anim-texte, [data-animate]').length;
      const splitNodes = document.querySelectorAll('.word, .char, .anim-word, .letter').length;
      const visibleHeadings = Array.from(document.querySelectorAll('h1,h2,h3')).filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') > 0;
      }).length;
      const scripts = Array.from(document.scripts).filter((script) => /animated-text\.js/.test(script.src)).length;
      return {
        scripts,
        animatedRoots,
        splitNodes,
        visibleHeadings,
        preload: document.body.classList.contains('preload')
      };
    });

    expect(state.scripts, `${route} should load animated-text.js`).toBeGreaterThan(0);
    expect(state.animatedRoots, `${route} should expose animated text roots`).toBeGreaterThan(0);
    expect(state.visibleHeadings, `${route} should expose visible headings`).toBeGreaterThan(0);
    expect(state.preload, `${route} body.preload should be removed`).toBeFalsy();
    expect(state.splitNodes + state.animatedRoots, `${route} should expose dynamic text evidence`).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
}
