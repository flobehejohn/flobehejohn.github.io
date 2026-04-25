import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const docs = join(root, 'docs');
const failures = [];

const requiredPaths = [
  'assets/js/nuage_magique/nuage.js',
  'assets/js/nuage_magique/text_particles.js',
  'assets/js/nuage_magique/test.js',
  'assets/portfolio/nuage_magique/nuage_magique_def.html',
  'assets/portfolio/projet_musicam/projet_musicam.html',
  'assets/portfolio/projet_synth/main_synth_fm.html',
  'assets/portfolio/Projet_dotnet/app_dotnet.html',
  'assets/audio/auto_radio/js/playlist.json',
  'assets/images/log_zim.jpg',
  'assets/images/log_zim.webp',
  'assets/images/people/moi_.png',
  'assets/images/people/moi_.webp',
  'assets/vendor/isotope.pkgd.min.js',
  'assets/vendor/imagesloaded.pkgd.min.js',
  'svg-icons/outline-icons.svg'
];

for (const relativePath of requiredPaths) {
  const fullPath = join(docs, relativePath);
  if (!existsSync(fullPath)) failures.push(`missing: ${relativePath}`);
}

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) count += countFiles(fullPath);
    else count += 1;
  }
  return count;
}

const portfolioFileCount = countFiles(join(docs, 'assets/portfolio'));
const jsFileCount = countFiles(join(docs, 'assets/js'));
const imageFileCount = countFiles(join(docs, 'assets/images'));

if (portfolioFileCount < 10) failures.push(`portfolio file count too low: ${portfolioFileCount}`);
if (jsFileCount < 20) failures.push(`js file count too low: ${jsFileCount}`);
if (imageFileCount < 10) failures.push(`image file count too low: ${imageFileCount}`);

if (failures.length) {
  console.error('[content-inventory-audit] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('[content-inventory-audit] OK');
console.log(`[content-inventory-audit] portfolioFiles=${portfolioFileCount}`);
console.log(`[content-inventory-audit] jsFiles=${jsFileCount}`);
console.log(`[content-inventory-audit] imageFiles=${imageFileCount}`);
