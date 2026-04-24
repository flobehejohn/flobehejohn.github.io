import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const pages = ['docs/index.html', 'docs/portfolio_florian_b.html', 'docs/parcours.html', 'docs/contact.html'];
const requiredModule = '<script type="module" src="/assets/js/nuage_magique/test.js"></script>';
const failures = [];

function ensureBeforeBodyClose(html, snippet) {
  if (!html.includes('id="cloud-bg"') && !html.includes("id='cloud-bg'")) return html;
  if (html.includes('/assets/js/nuage_magique/test.js')) return html;
  if (!html.includes('</body>')) return `${html}\n${snippet}\n`;
  return html.replace(/\s*<\/body>/i, `\n${snippet}\n</body>`);
}

for (const relativePath of pages) {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) {
    failures.push(`missing page: ${relativePath}`);
    continue;
  }

  const before = readFileSync(fullPath, 'utf-8');
  const after = ensureBeforeBodyClose(before, requiredModule);
  if (after !== before) writeFileSync(fullPath, after, 'utf-8');

  const finalHtml = readFileSync(fullPath, 'utf-8');
  if (finalHtml.includes('id="cloud-bg"') && !finalHtml.includes('/assets/js/nuage_magique/test.js')) {
    failures.push(`missing nuage bootstrap on cloud page: ${relativePath}`);
  }
}

const requiredAssets = [
  'docs/assets/js/nuage_magique/test.js',
  'docs/assets/js/nuage_magique/bootstrap.js',
  'docs/assets/js/nuage_magique/nuage.js',
  'docs/assets/js/nuage_magique/text_particles.js',
  'docs/assets/js/animated-text.js',
  'docs/assets/js/player-singleton.js',
  'docs/assets/audio/auto_radio/js/playlist.json'
];

for (const relativePath of requiredAssets) {
  if (!existsSync(join(root, relativePath))) failures.push(`missing asset: ${relativePath}`);
}

if (failures.length) {
  console.error('[ensure-rich-runtime] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('[ensure-rich-runtime] OK');
