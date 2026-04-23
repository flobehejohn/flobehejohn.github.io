import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const requiredFiles = [
  'docs/index.html',
  'docs/portfolio_florian_b.html',
  'docs/parcours.html',
  'docs/contact.html',
  'docs/assets/js/player-singleton.js',
  'docs/assets/css/theme.min.css',
  'docs/robots.txt',
  'docs/sitemap.xml',
  'docs/.nojekyll'
];

const failures = requiredFiles.filter((relativePath) => !existsSync(join(root, relativePath)));

if (failures.length) {
  console.error('[build-guard] FAIL');
  failures.forEach((failure) => console.error(` - missing ${failure}`));
  process.exit(1);
}

const indexHtml = readFileSync(join(root, 'docs/index.html'), 'utf-8');
if (!/x-build-origin/i.test(indexHtml)) {
  console.error('[build-guard] FAIL');
  console.error(' - docs/index.html is missing the build origin stamp');
  process.exit(1);
}

console.log('[build-guard] OK');
