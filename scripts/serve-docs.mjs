import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const docsRoot = path.resolve(repoRoot, 'docs');

const port = Number(process.env.PORT || process.env.DOCS_PORT || 4173);
const strictPreviewBase = process.env.STRICT_PREVIEW_BASE === '1';
const rawPreviewBasePath = process.env.PREVIEW_BASE_PATH || '/';

function normalizeBasePath(value) {
  const parts = String(value || '')
    .trim()
    .split('/')
    .filter(Boolean);

  return parts.length > 0 ? `/${parts.join('/')}/` : '/';
}

const previewBasePath = normalizeBasePath(rawPreviewBasePath);

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toDocRelativePath(pathname) {
  let current = String(pathname || '/');

  if (strictPreviewBase && previewBasePath !== '/' && current.startsWith(previewBasePath)) {
    current = '/' + current.slice(previewBasePath.length);
  }

  if (current === '/' || current === '') {
    return 'index.html';
  }

  const parts = current
    .split('/')
    .filter(Boolean)
    .map(safeDecode);

  return parts.join('/');
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };

  return types[ext] || 'application/octet-stream';
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(text);
}

function resolveStaticFile(requestUrl) {
  const relative = toDocRelativePath(requestUrl.pathname);
  let absolute = path.resolve(docsRoot, relative);

  const normalizedDocsRoot = docsRoot.toLowerCase();
  const normalizedAbsolute = absolute.toLowerCase();

  if (
    normalizedAbsolute !== normalizedDocsRoot &&
    !normalizedAbsolute.startsWith(normalizedDocsRoot + path.sep.toLowerCase())
  ) {
    return { status: 403, file: null };
  }

  if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
    absolute = path.join(absolute, 'index.html');
  }

  if (!fs.existsSync(absolute)) {
    return { status: 404, file: null };
  }

  return { status: 200, file: absolute };
}

const server = http.createServer((request, response) => {
  if (!request.url) {
    sendText(response, 400, 'Bad request');
    return;
  }

  const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`);
  const resolved = resolveStaticFile(requestUrl);

  if (resolved.status !== 200 || !resolved.file) {
    sendText(response, resolved.status, 'Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypeFor(resolved.file),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });

  fs.createReadStream(resolved.file).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  const strict = strictPreviewBase ? ` strictBase=${previewBasePath}` : '';
  console.log(`[serve-docs] http://127.0.0.1:${port}${strict}`);
});
