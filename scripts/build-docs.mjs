// scripts/build-docs.mjs
// Construit le bundle ./docs pour GitHub Pages.
// Stratégie conservatrice : préserver toute l'arborescence assets pour ne pas casser
// les contenus legacy profonds (Three.js, audio, musicam, nuage magique, synthé,
// pages portfolio, images, logos, fonts, vendors), puis transformer les pages racines.

import {
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  cpSync
} from 'fs';
import { dirname, join } from 'path';

const root = process.cwd();
const outDir = join(root, 'docs');
const HTML_ANALYTICS_SNIPPET = '\n<script src="/assets/js/analytics.js" defer data-analytics-mode="queue-only"></script>';
const BUILD_STAMP = '<meta name="x-build-origin" content="scripts/build-docs.mjs">';

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function cleanOutDir() {
  rmSync(outDir, { recursive: true, force: true });
  ensureDir(outDir);
}

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

function ensureRobotsMeta(html) {
  if (/name="robots"/i.test(html)) return html;
  return html.replace(/\s*<\/head>/i, '  <meta name="robots" content="index,follow">\n</head>');
}

function ensureBuildStamp(html) {
  if (/name="x-build-origin"/i.test(html)) return html;
  return html.replace(/\s*<\/head>/i, `  ${BUILD_STAMP}\n</head>`);
}

function ensureAnalyticsHook(html) {
  if (/src="\/assets\/js\/analytics\.js"/i.test(html)) return html;
  return html.replace(/\s*<\/body>/i, `${HTML_ANALYTICS_SNIPPET}\n</body>`);
}

function stripPlaceholderLinkedIn(html) {
  return html
    .replace(/\s*"https:\/\/www\.linkedin\.com\/in\/tonprofil",?\s*/g, '')
    .replace(/,\s*\]/g, ']');
}

function injectStyleGuard(html) {
  const guard = `\n<script>(function(){try{var isDotnet=(document.body&&document.body.getAttribute('data-page')==='dotnet_demo');if(!isDotnet){document.querySelectorAll('link[rel="stylesheet"][href*="/assets/css/dotnet.css"]').forEach(function(l){l.parentNode&&l.parentNode.removeChild(l);});document.body&&document.body.classList&&document.body.classList.remove('preload');}}catch(e){/* ignore */}})();</script>`;
  return html.replace(/\s*<\/body>/i, `${guard}\n</body>`);
}

function transformHtml(srcPath, transforms = []) {
  const full = join(root, srcPath);
  let html = readFileSync(full, 'utf-8');

  for (const [pattern, repl] of transforms) {
    html = html.replace(pattern, repl);
  }

  html = stripPlaceholderLinkedIn(html);
  html = ensureRobotsMeta(html);
  html = ensureBuildStamp(html);
  html = ensureAnalyticsHook(html);
  html = injectStyleGuard(html);

  const dst = join(outDir, srcPath);
  ensureDir(dirname(dst));
  writeFileSync(dst, html, 'utf-8');
}

function build() {
  cleanOutDir();

  // 1) Préserver l'intégralité des contenus legacy et médias.
  copyTreeIfExists('assets');
  copyTreeIfExists('svg-icons');

  // 2) Pages HTML publiques, avec transformations légères et traçables.
  const removeNuageMagicBoot = [/\n\s*<script type="module" src="\/assets\/js\/nuage_magique\/test\.js"><\/script>/g, ''];

  transformHtml('index.html', [removeNuageMagicBoot]);
  transformHtml('portfolio_florian_b.html', [removeNuageMagicBoot]);
  transformHtml('parcours.html');
  transformHtml('contact.html');

  // 3) SEO / publication.
  copyFileIfExists('robots.txt');
  copyFileIfExists('sitemap.xml');
  copyFileIfExists('.nojekyll');

  console.log('[build-docs] Bundle conservateur généré dans ./docs');
}

build();
