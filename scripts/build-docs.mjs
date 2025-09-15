// scripts/build-docs.mjs
// Construit un bundle minimal dans ./docs pour GitHub Pages
// - Copie uniquement les pages et assets requis
// - Exclut les ressources lourdes/inutiles

import { mkdirSync, rmSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
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
    ['assets/css/bootstrap.min.css'],
  ]);

  // 3) JS requis (noyau + UI + vendors légers)
  copyList([
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
    ['assets/js/contact-mailto.js'],
    ['assets/vendor/imagesloaded.pkgd.min.js'],
    ['assets/vendor/isotope.pkgd.min.js'],
    ['assets/js/playlist.json'],
  ]);

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

  console.log('[build-docs] Bundle minimal généré dans ./docs');
}

build();

