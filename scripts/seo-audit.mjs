import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const docsDir = join(root, 'docs');
const pages = ['index.html', 'portfolio_florian_b.html', 'parcours.html', 'contact.html'];
const failures = [];
const analyticsLoaderPattern = /src="(?:\.\.\/)*assets\/js\/analytics\.js"/i;

function read(relativePath) {
  const fullPath = join(docsDir, relativePath);
  if (!existsSync(fullPath)) {
    failures.push(`missing built page: ${relativePath}`);
    return '';
  }
  return readFileSync(fullPath, 'utf-8');
}

for (const page of pages) {
  const html = read(page);
  if (!html) continue;

  if (!/<title>.+<\/title>/i.test(html)) failures.push(`${page}: missing title`);
  if (!/meta\s+name="description"/i.test(html)) failures.push(`${page}: missing meta description`);
  if (!/link\s+rel="canonical"/i.test(html)) failures.push(`${page}: missing canonical`);
  if (!/meta\s+name="robots"/i.test(html)) failures.push(`${page}: missing robots meta`);
  if (!analyticsLoaderPattern.test(html)) failures.push(`${page}: analytics hook not injected`);
  if (/linkedin\.com\/in\/tonprofil/i.test(html)) failures.push(`${page}: placeholder LinkedIn still present`);
}

if (failures.length) {
  console.error('[seo-audit] FAIL');
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log('[seo-audit] OK');
