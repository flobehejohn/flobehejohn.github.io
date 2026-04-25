import { createServer } from 'http';
import { existsSync, readFileSync, statSync } from 'fs';
import { extname, join, normalize } from 'path';

const root = join(process.cwd(), 'docs');
const port = Number(process.env.PORT || 4173);
const strictPreviewBase = process.env.STRICT_PREVIEW_BASE === '1';
const previewBasePath = normalizePreviewBasePath(
  process.env.PREVIEW_BASE_PATH || '/flobehejohn/flobehejohn.github.io/preview/refactor-live/'
);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf'
};

function normalizePreviewBasePath(value) {
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function toDocRelativePath(urlPath) {
  const decoded = decodeURIComponent(urlPath);

  if (strictPreviewBase) {
    if (decoded === previewBasePath.slice(0, -1)) return '/index.html';
    if (!decoded.startsWith(previewBasePath)) return null;
    const insidePreview = decoded.slice(previewBasePath.length);
    return insidePreview.length === 0 ? '/index.html' : `/${insidePreview}`;
  }

  return decoded === '/' ? '/index.html' : decoded;
}

function resolvePath(urlPath) {
  const docRelativePath = toDocRelativePath(urlPath);
  if (docRelativePath === null) return null;

  const safePath = normalize(docRelativePath).replace(/^([.][.][/\\])+/, '');
  let target = join(root, safePath === '/' ? '/index.html' : safePath);

  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, 'index.html');
  }

  return target;
}

createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  const target = resolvePath(url.pathname);

  if (!target || !existsSync(target)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = extname(target).toLowerCase();
  const contentType = contentTypes[ext] || 'application/octet-stream';
  const body = readFileSync(target);
  res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
  res.end(body);
}).listen(port, '127.0.0.1', () => {
  const suffix = strictPreviewBase ? ` strictBase=${previewBasePath}` : '';
  console.log(`[serve-docs] http://127.0.0.1:${port}${suffix}`);
});
