import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { extname, join } from 'path';

const root = process.cwd();
const source = join(root, 'docs');
const target = join(root, 'preview-dist');
const editable = new Set(['.html', '.js', '.css']);

function rewriteHtml(content) {
  return content
    .replaceAll('/assets/', 'assets/')
    .replaceAll('/svg-icons/', 'svg-icons/')
    .replaceAll('href="/"', 'href="index.html"')
    .replaceAll('href="/index.html"', 'href="index.html"')
    .replaceAll('href="/portfolio_florian_b.html"', 'href="portfolio_florian_b.html"')
    .replaceAll('href="/parcours.html"', 'href="parcours.html"')
    .replaceAll('href="/contact.html"', 'href="contact.html"');
}

function rewriteJs(content) {
  return content
    .replaceAll("'/assets/", "'assets/")
    .replaceAll('"/assets/', '"assets/')
    .replaceAll('`/assets/', '`assets/')
    .replaceAll("'/svg-icons/", "'svg-icons/")
    .replaceAll('"/svg-icons/', '"svg-icons/')
    .replaceAll('`/svg-icons/', '`svg-icons/');
}

function rewriteCss(content) {
  return content
    .replaceAll('url(/assets/images/', 'url(../images/')
    .replaceAll('url("/assets/images/', 'url("../images/')
    .replaceAll("url('/assets/images/", "url('../images/")
    .replaceAll('url(/assets/fonts/', 'url(../fonts/')
    .replaceAll('url("/assets/fonts/', 'url("../fonts/')
    .replaceAll("url('/assets/fonts/", "url('../fonts/");
}

function rewriteByType(path, content) {
  const ext = extname(path).toLowerCase();
  if (ext === '.html') return rewriteHtml(content);
  if (ext === '.js') return rewriteJs(content);
  if (ext === '.css') return rewriteCss(content);
  return content;
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }

    if (!editable.has(extname(path))) continue;

    const before = readFileSync(path, 'utf-8');
    const after = rewriteByType(path, before);
    if (after !== before) writeFileSync(path, after, 'utf-8');
  }
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
walk(target);
writeFileSync(join(target, '.nojekyll'), '\n', 'utf-8');
console.log('[build-preview] generated preview-dist');
