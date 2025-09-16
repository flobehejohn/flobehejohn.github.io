// scripts/build-docs.mjs
// Construit un bundle minimal dans ./docs pour GitHub Pages
// - Copie uniquement les pages et assets requis
// - Exclut les ressources lourdes/inutiles

import { mkdirSync, rmSync, readFileSync, writeFileSync, copyFileSync, cpSync } from 'fs';
import { dirname, join } from 'path';

const root = process.cwd();
const outDir = join(root, 'docs');

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function cleanOutDir() {
  try { rmSync(outDir, { recursive: true, force: true }); } catch {}
  ensureDir(outDir);
}

function copy(src, dst) {
  const fullSrc = join(root, src);
  const fullDst = join(outDir, dst || src);
  ensureDir(dirname(fullDst));
  copyFileSync(fullSrc, fullDst);
}

function copyList(list) {
  list.forEach(([src, dst]) => copy(src, dst));
}

function transformHtml(srcPath, transforms = []) {
  const full = join(root, srcPath);
  let html = readFileSync(full, 'utf-8');
  for (const [pattern, repl] of transforms) {
    html = html.replace(pattern, repl);
  }
  // Inject minimal style-guard before </body> for GitHub Pages
  const guard = `\n<script>(function(){try{var isDotnet=(document.body&&document.body.getAttribute('data-page')==='dotnet_demo');if(!isDotnet){document.querySelectorAll('link[rel="stylesheet"][href*="/assets/css/dotnet.css"]').forEach(function(l){l.parentNode&&l.parentNode.removeChild(l);});document.body&&document.body.classList&&document.body.classList.remove('preload');}}catch(e){/* ignore */}})();</script>`;
  html = html.replace(/\s*<\/body>/i, `${guard}\n</body>`);
  const dst = join(outDir, srcPath);
  ensureDir(dirname(dst));
  writeFileSync(dst, html, 'utf-8');
}

function build() {
  cleanOutDir();

  // 1) Pages HTML (avec petites transformations pour alléger)
  transformHtml('index.html', [
    [/\n\s*<script type="module" src="\/assets\/js\/nuage_magique\/test\.js"><\/script>/g, ''],
  ]);
  transformHtml('portfolio_florian_b.html', [
    [/\n\s*<script type="module" src="\/assets\/js\/nuage_magique\/test\.js"><\/script>/g, ''],
  ]);
  transformHtml('parcours.html');
  transformHtml('contact.html');

  // 2) CSS requis
  copyList([
    ['assets/css/theme.min.css'],
    ['assets/css/swatch.bundle.css'],
    ['assets/css/fixes.css'],
    ['assets/css/carte_magique.css'],
    ['assets/css/style_audio_player.css'],
    ['assets/css/skill-card-modal.css'],
    ['assets/css/bootstrap.min.css'],
    // .NET demo specific styles
    ['assets/css/dotnet.css'],
  ]);

  // 3) JS requis (noyau + UI + vendors légers)
  copyList([
    // vendors the pages expect (local bundle)
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
    ['assets/vendor/imagesloaded.pkgd.min.js'],
    ['assets/vendor/isotope.pkgd.min.js'],
    ['assets/js/playlist.json'],
  ]);

  // 3.b) JS pages spécifiques (dotnet demo)
  ensureDir(join(outDir, 'assets/js/pages'));
  copy('assets/js/pages/dotnet_boot.js');
  copy('assets/js/pages/dotnet_demo.js');

  // 3.c) Nuage magique (utilisé par certaines pages et par app_dotnet)
  try { cpSync(join(root, 'assets/js/nuage_magique'), join(outDir, 'assets/js/nuage_magique'), { recursive: true }); } catch {}

  // 4) Fonts/icônes nécessaires (FontAwesome bundle complet par simplicité)
  copy('assets/fonts/fontawesome/css/all.min.css');
  copy('assets/fonts/fontawesome/webfonts/fa-solid-900.woff2');
  copy('assets/fonts/fontawesome/webfonts/fa-regular-400.woff2');
  copy('assets/fonts/fontawesome/webfonts/fa-brands-400.woff2');
  // (si autres variantes nécessaires, les ajouter ici)

  // 5) Images minimales (logos, favicons, portrait)
  copyList([
    ['assets/images/log_zim.jpg'],
    ['assets/images/log_zim.webp'],
    ['assets/images/platine.jpg'],
    ['assets/images/platine.webp'],
    ['assets/images/favicon.ico'],
    ['assets/images/favicons/favicon.ico'],
    ['assets/images/people/moi_.png'],
    ['assets/images/people/moi_.webp'],
  ]);

  // 6) SVG/ICONS utilisés par les cartes compétences
  // On copie tout le dossier svg-icons (léger) et quelques svg nécessaires
  copy('svg-icons/outline-icons.svg');
  ensureDir(join(outDir, 'assets/images/svg'));
  // Si certains SVG spécifiques sont référencés, les ajouter ici (ex: adobe-logo.svg, etc.)

  // 7) PDF CV si utilisé
  copy('assets/images/cv/florian_cv.pdf');

  // 8) Démo .NET (copie complète du dossier projet dist + helpers)
  try {
    cpSync(join(root, 'assets/portfolio/Projet_dotnet'), join(outDir, 'assets/portfolio/Projet_dotnet'), { recursive: true });
  } catch {
    // fallback: copier au minimum les fichiers essentiels si cpSync indisponible
    copy('assets/portfolio/Projet_dotnet/app_dotnet.html');
    copy('assets/portfolio/Projet_dotnet/config.js');
    copy('assets/portfolio/Projet_dotnet/normalize-requests.js');
    try {
      ensureDir(join(outDir, 'assets/portfolio/Projet_dotnet/dist/assets'));
      copy('assets/portfolio/Projet_dotnet/dist/index.html');
      copy('assets/portfolio/Projet_dotnet/dist/config.js');
      copy('assets/portfolio/Projet_dotnet/dist/normalize-requests.js');
      copy('assets/portfolio/Projet_dotnet/dist/assets/index-Bpjn-eMl.js');
      copy('assets/portfolio/Projet_dotnet/dist/assets/index-C7ORl4QR.css');
    } catch {}
  }

  console.log('[build-docs] Bundle minimal généré dans ./docs');
}

build();
