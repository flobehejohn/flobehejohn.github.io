import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, cpSync } from 'fs';
import { dirname, join } from 'path';

const root = process.cwd();
const outDir = join(root, 'docs');
const htmlAnalyticsSnippet = '\n<script src="/assets/js/analytics.js" defer data-analytics-mode="queue-only"></script>';
const buildStamp = '<meta name="x-build-origin" content="scripts/build-docs.mjs">';
const nuageBootstrap = '<script type="module" src="/assets/js/nuage_magique/test.js"></script>';
const animatedTextScript = '<script src="/assets/js/animated-text.js" defer></script>';

function ensureDir(path) { mkdirSync(path, { recursive: true }); }
function cleanOutDir() { rmSync(outDir, { recursive: true, force: true }); ensureDir(outDir); }
function copyTreeIfExists(src, dst = src) {
  const fullSrc = join(root, src);
  if (!existsSync(fullSrc)) return;
  const fullDst = join(outDir, dst);
  ensureDir(dirname(fullDst));
  cpSync(fullSrc, fullDst, { recursive: true, force: true });
}
function copyFileIfExists(src, dst = src) {
  const fullSrc = join(root, src);
  if (!existsSync(fullSrc)) return;
  const fullDst = join(outDir, dst);
  ensureDir(dirname(fullDst));
  cpSync(fullSrc, fullDst, { force: true });
}
function beforeBody(html, snippet) {
  if (html.includes(snippet)) return html;
  return html.includes('</body>') ? html.replace(/\s*<\/body>/i, `\n${snippet}\n</body>`) : `${html}\n${snippet}\n`;
}
function ensureRobotsMeta(html) {
  return /name="robots"/i.test(html) ? html : html.replace(/\s*<\/head>/i, '  <meta name="robots" content="index,follow">\n</head>');
}
function ensureBuildStamp(html) {
  return /name="x-build-origin"/i.test(html) ? html : html.replace(/\s*<\/head>/i, `  ${buildStamp}\n</head>`);
}
function ensureAnalyticsHook(html) {
  return /src="\/assets\/js\/analytics\.js"/i.test(html) ? html : html.replace(/\s*<\/body>/i, `${htmlAnalyticsSnippet}\n</body>`);
}
function stripPlaceholderLinkedIn(html) {
  return html.replace(/\s*"https:\/\/www\.linkedin\.com\/in\/tonprofil",?\s*/g, '').replace(/,\s*\]/g, ']');
}
function injectStyleGuard(html) {
  const guard = `\n<script>(function(){try{var isDotnet=(document.body&&document.body.getAttribute('data-page')==='dotnet_demo');if(!isDotnet){document.querySelectorAll('link[rel="stylesheet"][href*="/assets/css/dotnet.css"]').forEach(function(l){l.parentNode&&l.parentNode.removeChild(l);});document.body&&document.body.classList&&document.body.classList.remove('preload');}}catch(e){/* ignore */}})();</script>`;
  return html.replace(/\s*<\/body>/i, `${guard}\n</body>`);
}
function preserveRichRuntime(srcPath, html) {
  let next = html;
  if (next.includes('id="cloud-bg"') && !next.includes('/assets/js/nuage_magique/test.js')) next = beforeBody(next, nuageBootstrap);
  if (/animated-text|anim-texte|anim-word|data-animate/.test(next) && !next.includes('/assets/js/animated-text.js')) next = beforeBody(next, animatedTextScript);
  if (srcPath === 'contact.html') next = next.split('\n').filter((line) => !line.includes('/assets/js/pages/mac_val.js')).join('\n');
  next = next.replaceAll(' crossorigin="anonymous"', '').replaceAll(" crossorigin='anonymous'", '');
  return next;
}
function transformHtml(srcPath) {
  const full = join(root, srcPath);
  let html = readFileSync(full, 'utf-8');
  html = stripPlaceholderLinkedIn(html);
  html = ensureRobotsMeta(html);
  html = ensureBuildStamp(html);
  html = ensureAnalyticsHook(html);
  html = injectStyleGuard(html);
  html = preserveRichRuntime(srcPath, html);
  const dst = join(outDir, srcPath);
  ensureDir(dirname(dst));
  writeFileSync(dst, html, 'utf-8');
}
function repairCopiedPlayer() {
  const playerPath = join(outDir, 'assets/js/player-singleton.js');
  if (!existsSync(playerPath)) return;
  let player = readFileSync(playerPath, 'utf-8');
  player = player.replaceAll("player.setAttribute('crossorigin','anonymous');", "player.removeAttribute('crossorigin');");
  player = player.replaceAll("player.crossOrigin = 'anonymous';", "player.crossOrigin = null;");
  writeFileSync(playerPath, player, 'utf-8');
}
function build() {
  cleanOutDir();
  copyTreeIfExists('assets');
  copyTreeIfExists('svg-icons');
  transformHtml('index.html');
  transformHtml('portfolio_florian_b.html');
  transformHtml('parcours.html');
  transformHtml('contact.html');
  repairCopiedPlayer();
  copyFileIfExists('robots.txt');
  copyFileIfExists('sitemap.xml');
  copyFileIfExists('.nojekyll');
  console.log('[build-docs] Bundle conservateur généré dans ./docs');
}
build();
