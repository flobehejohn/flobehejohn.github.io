import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const pages = ['docs/index.html', 'docs/portfolio_florian_b.html', 'docs/parcours.html', 'docs/contact.html'];
const requiredNuageModule = '<script type="module" src="/assets/js/nuage_magique/test.js"></script>';
const requiredAnimatedText = '<script src="/assets/js/animated-text.js" defer></script>';
const requiredJqueryLite = '<script src="/assets/js/jquery-lite-compat.js" defer></script>';
const failures = [];

function insertBeforeBodyClose(html, snippet) {
  if (html.includes(snippet)) return html;
  if (!html.includes('</body>')) return `${html}\n${snippet}\n`;
  return html.replace(/\s*<\/body>/i, `\n${snippet}\n</body>`);
}

function insertBeforeTheme(html, snippet) {
  if (html.includes(snippet)) return html;
  const marker = '<script src="/assets/js/theme.min.js" defer></script>';
  if (html.includes(marker)) return html.replace(marker, `${snippet}\n    ${marker}`);
  return insertBeforeBodyClose(html, snippet);
}

function ensureNuageBootstrap(html) {
  if (!html.includes('id="cloud-bg"') && !html.includes("id='cloud-bg'")) return html;
  if (html.includes('/assets/js/nuage_magique/test.js')) return html;
  return insertBeforeBodyClose(html, requiredNuageModule);
}

function ensureAnimatedTextRuntime(html) {
  if (html.includes('/assets/js/animated-text.js')) return html;
  return insertBeforeBodyClose(html, requiredAnimatedText);
}

function ensureAnimatedRoot(relativePath, html) {
  if (relativePath !== 'docs/parcours.html') return html;
  if (/class=["'][^"']*(animated-text|anim-texte|anim-word|word|char)[^"']*["']|data-animate/i.test(html)) return html;
  return html.replace(/<h([1-3])([^>]*)>/i, (match, level, attrs) => {
    if (/class=/.test(attrs)) return `<h${level}${attrs.replace(/class=(["'])(.*?)\1/, 'class=$1$2 animated-text$1')}>`;
    return `<h${level}${attrs} class="animated-text">`;
  });
}

function ensureContactJqueryCompat(relativePath, html) {
  if (relativePath !== 'docs/contact.html') return html;
  return insertBeforeTheme(html, requiredJqueryLite)
    .split('\n')
    .filter((line) => !line.includes('/assets/js/pages/mac_val.js'))
    .join('\n');
}

function relaxAudioCors(html) {
  return html
    .replace(/\s+crossorigin="anonymous"/gi, '')
    .replace(/\s+crossorigin='anonymous'/gi, '');
}

for (const relativePath of pages) {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) {
    failures.push(`missing page: ${relativePath}`);
    continue;
  }

  const before = readFileSync(fullPath, 'utf-8');
  const after = relaxAudioCors(ensureAnimatedRoot(relativePath, ensureAnimatedTextRuntime(ensureNuageBootstrap(ensureContactJqueryCompat(relativePath, before)))));
  if (after !== before) writeFileSync(fullPath, after, 'utf-8');

  const finalHtml = readFileSync(fullPath, 'utf-8');
  if (finalHtml.includes('id="cloud-bg"') && !finalHtml.includes('/assets/js/nuage_magique/test.js')) failures.push(`missing nuage bootstrap on cloud page: ${relativePath}`);
  if (!finalHtml.includes('/assets/js/animated-text.js')) failures.push(`missing animated text runtime: ${relativePath}`);
  if (relativePath === 'docs/parcours.html' && !/class=["'][^"']*(animated-text|anim-texte|anim-word|word|char)[^"']*["']|data-animate/i.test(finalHtml)) failures.push('missing animated root on parcours');
  if (relativePath === 'docs/contact.html') {
    if (!finalHtml.includes('/assets/js/jquery-lite-compat.js')) failures.push('missing local jQuery compatibility shim on contact');
    if (finalHtml.includes('/assets/js/pages/mac_val.js')) failures.push('contact still loads mac_val.js');
  }
}

const playerPath = join(root, 'docs/assets/js/player-singleton.js');
if (existsSync(playerPath)) {
  const before = readFileSync(playerPath, 'utf-8');
  const after = before
    .replace("player.setAttribute('crossorigin','anonymous');", "player.removeAttribute('crossorigin');")
    .replace("player.crossOrigin = 'anonymous';", "player.crossOrigin = null;");
  if (after !== before) writeFileSync(playerPath, after, 'utf-8');
} else {
  failures.push('missing asset: docs/assets/js/player-singleton.js');
}

const requiredAssets = [
  'docs/assets/js/nuage_magique/test.js',
  'docs/assets/js/nuage_magique/bootstrap.js',
  'docs/assets/js/nuage_magique/nuage.js',
  'docs/assets/js/nuage_magique/text_particles.js',
  'docs/assets/js/animated-text.js',
  'docs/assets/js/jquery-lite-compat.js',
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
