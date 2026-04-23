import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

const routes = [
  { path: '/', heading: /Au croisement|innovation/i },
  { path: '/portfolio_florian_b.html', heading: /Portfolio/i },
  { path: '/parcours.html', heading: /Analytics|Parcours/i },
  { path: '/contact.html', heading: /Contact/i }
];

for (const route of routes) {
  test(`smoke ${route.path}`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Florian|Portfolio|Contact|Analytics/i);
    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.getByRole('heading').first()).toContainText(route.heading);
  });
}
