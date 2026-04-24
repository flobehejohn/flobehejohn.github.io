// scripts/build-docs.mjs
// Construit un bundle minimal dans ./docs pour GitHub Pages
// - Copie uniquement les pages et assets requis
// - Exclut les ressources lourdes/inutiles
// - Injecte les hooks analytics et quelques garde-fous SEO dans le HTML publié

import {
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
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
  try {
    rmSync(outDir, { recursive: true, force: true });
  } catch {
    void 0;
  }
  ensureDir(outDir);
}

function copy(src, dst) {
  const fullSrc = join(root, src);
  const fullDst = join(outDir, dst || src);
  ensureDir(dirname(fullDst));
  copyFileSync(fullSrc, fullDst);
}

function copyIfExists(src, dst) {
  const fullSrc = join(root, src);
  if (!existsSync(fullSrc)) return;
  copy(src, dst);
}

function copyList(list) {
  list.forEach(([src, dst]) => copy(src, dst));
}

function ensureRobotsMeta(html) {
  if (/name="robots"/i.test(html)) return html;
  return html.replace(/\s*<\/head>/i, `  <meta name="robots" content="index,follow">\n</head>`);
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

  // 1) Pages HTML (avec petites transformations pour alléger)
  const removeNuageMagicBoot = [/\n\s*<script type="module" src="\/assets\/js\/nuage_magique\/test\.js"><\/script>/g, ''];

  transformHtml('index.html', [removeNuageMagicBoot]);
  transformHtml('portfolio_florian_b.html', [removeNuageMagicBoot]);
  transformHtml('parcours.html');
  transformHtml('contact.html');

  // 2) SEO / publication
  copyIfExists('robots.txt');
  copyIfExists('sitemap.xml');
  copyIfExists('.nojekyll');

  // 3) CSS requis
  copyList([
    ['assets/css/theme.min.css'],
    ['assets/css/swatch.bundle.css'],
    ['assets/css/fixes.css'],
    ['assets/css/carte_magique.css'],
    ['assets/css/style_audio_player.css'],
    ['assets/css/skill-card-modal.css'],
    ['assets/css/bootstrap.min.css'],
    ['assets/css/dotnet.css']
  ]);

  // 4) JS requis (noyau + UI + vendors légers)
  copyList([
    ['assets/js/packages.min.js'],
    ['assets/js/theme.min.js'],
    ['assets/js/navbar.js'],
    ['assets/js/pjax-router.js'],
    ['assets/js/player-singleton.js'],
    ['assets/js/page-hub.js'],
    ['assets/js/smartresize-patch.js'],
    ['assets/js/animated-text.js'],
    ['assets/js/magic-photo.js'],
    ['assets/js/word-hold-effect.js'],
    ['assets/js/hover-menu-config.js'],
    ['assets/js/script.js'],
    ['assets/js/modal.js'],
    ['assets/js/cv-modal-handler.js'],
    ['assets/js/floating-audio-toggle.js'],
    ['assets/js/responsive-audio-player-scaler.js'],
    ['assets/js/draggable-audio-player.js'],
    ['assets/js/portfolio-grid.js'],
    ['assets/js/isotope-skill-grid.js'],
    ['assets/js/skill-card.js'],
    ['assets/js/skill-card-modal.js'],
    ['assets/js/skill-modal-handler.js'],
    ['assets/js/skill-modal-scroll-handler.js'],
    ['assets/js/contact-mailto.js'],
    ['assets/js/analytics.js'],
    ['assets/js/usage-signals.js'],
    ['assets/vendor/imagesloaded.pkgd.min.js'],
    ['assets/vendor/isotope.pkgd.min.js'],
    ['assets/js/playlist.json'],
    ['assets/audio/auto_radio/js/playlist.json']
  ]);

  // 5) JS pages spécifiques (dotnet demo)
  ensureDir(join(outDir, 'assets/js/pages'));
  copy('assets/js/pages/dotnet_boot.js');
  copy('assets/js/pages/dotnet_demo.js');

  // 6) Nuage magique (utilisé par certaines pages et par app_dotnet)
  try {
    cpSync(join(root, 'assets/js/nuage_magique'), join(outDir, 'assets/js/nuage_magique'), { recursive: true });
  } catch {
    void 0;
  }

  // 7) Fonts/icônes nécessaires
  copy('assets/fonts/fontawesome/css/all.min.css');
  copy('assets/fonts/fontawesome/webfonts/fa-solid-900.woff2');
  copy('assets/fonts/fontawesome/webfonts/fa-regular-400.woff2');
  copy('assets/fonts/fontawesome/webfonts/fa-brands-400.woff2');

  // 8) Images minimales
  copyList([
    ['assets/images/log_zim.jpg'],
    ['assets/images/log_zim.webp'],
    ['assets/images/platine.jpg'],
    ['assets/images/platine.webp'],
    ['assets/images/favicon.ico'],
    ['assets/images/favicons/favicon.ico'],
    ['assets/images/people/moi_.png'],
    ['assets/images/people/moi_.webp']
  ]);

  // 9) SVG/ICONS utilisés par les cartes compétences
  copy('svg-icons/outline-icons.svg');
  ensureDir(join(outDir, 'assets/images/svg'));

  // 10) PDF CV si utilisé
  copyIfExists('assets/images/cv/florian_cv.pdf');

  // 11) Démo .NET (copie complète du dossier projet dist + helpers)
  try {
    cpSync(join(root, 'assets/portfolio/Projet_dotnet'), join(outDir, 'assets/portfolio/Projet_dotnet'), { recursive: true });
  } catch {
    copyIfExists('assets/portfolio/Projet_dotnet/app_dotnet.html');
    copyIfExists('assets/portfolio/Projet_dotnet/config.js');
    copyIfExists('assets/portfolio/Projet_dotnet/normalize-requests.js');
    try {
      ensureDir(join(outDir, 'assets/portfolio/Projet_dotnet/dist/assets'));
      copyIfExists('assets/portfolio/Projet_dotnet/dist/index.html');
      copyIfExists('assets/portfolio/Projet_dotnet/dist/config.js');
      copyIfExists('assets/portfolio/Projet_dotnet/dist/normalize-requests.js');
      copyIfExists('assets/portfolio/Projet_dotnet/dist/assets/index-Bpjn-eMl.js');
      copyIfExists('assets/portfolio/Projet_dotnet/dist/assets/index-C7ORl4QR.css');
    } catch {
      void 0;
    }
  }

  console.log('[build-docs] Bundle minimal généré dans ./docs');
}

build();
