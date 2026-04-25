import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const docsDir = join(root, 'docs');
const pages = ['index.html', 'portfolio_florian_b.html', 'parcours.html', 'contact.html'];
const requiredAssets = [
  'docs/assets/js/analytics.js',
  'docs/assets/js/usage-signals.js'
];
const failures = [];
const analyticsLoaderPattern = /src="(?:\.\.\/)*assets\/js\/analytics\.js"/i;

for (const path of requiredAssets) {
  if (!existsSync(join(root, path))) {
    failures.push(`missing analytics asset: ${path}`);
  }
}

for (const page of pages) {
  const fullPath = join(docsDir, page);
  if (!existsSync(fullPath)) {
    failures.push(`missing built page: ${page}`);
    continue;
  }

  const html = readFileSync(fullPath, 'utf-8');
  if (!analyticsLoaderPattern.test(html)) {
    failures.push(`${page}: missing analytics loader`);
  }
}

if (failures.length) {
  console.error('[analytics-audit] FAIL');
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log('[analytics-audit] OK');
