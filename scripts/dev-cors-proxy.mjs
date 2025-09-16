// Lightweight CORS proxy for local dev
// Usage:
//   PORT=8787 ALLOW_ORIGIN=http://127.0.0.1:5500 node scripts/dev-cors-proxy.mjs
//   Then set window.API_CORS_PROXY = "http://127.0.0.1:8787"
//
// Accepts requests like: http://127.0.0.1:8787/https://api.example.com/path?x=1
// Handles preflight (OPTIONS) and forwards all methods. Adds permissive CORS headers.

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 8787);
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const ALLOW_METHODS = process.env.ALLOW_METHODS || 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD';
const ALLOW_HEADERS = process.env.ALLOW_HEADERS || '*,Content-Type,Authorization,X-Requested-With';

const agentHttp = new http.Agent({ keepAlive: true });
const agentHttps = new https.Agent({ keepAlive: true });

function setCors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
  res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
  res.setHeader('Access-Control-Expose-Headers', '*');
  res.setHeader('Vary', 'Origin');
}

function send(res, status, body = '', headers = {}) {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.statusCode = status;
  res.end(body);
}

async function handle(req, res) {
  try {
    const origin = req.headers.origin || ALLOW_ORIGIN;
    setCors(res, origin);

    // Health check
    if (req.url === '/' || req.url === '/__health') {
      return send(res, 200, 'ok');
    }

    // Preflight
    if (req.method === 'OPTIONS') {
      return send(res, 204);
    }

    // Expect full target URL after leading slash
    const raw = (req.url || '').slice(1); // remove leading '/'
    if (!raw || !/^https?:\/\//i.test(raw)) {
      return send(res, 400, 'Bad request: expected absolute URL after /');
    }

    const target = new URL(raw);
    const controller = new AbortController();
    req.on('close', () => controller.abort());

    // Build headers for upstream: copy but strip hop-by-hop & origin
    const fwdHeaders = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      const key = k.toLowerCase();
      if (['connection','keep-alive','transfer-encoding','upgrade','host','origin'].includes(key)) continue;
      if (Array.isArray(v)) fwdHeaders.set(k, v.join(', '));
      else if (typeof v === 'string') fwdHeaders.set(k, v);
    }

    const method = req.method || 'GET';
    let body = undefined;
    if (!['GET','HEAD'].includes(method)) {
      // Buffer request body (simple, robust)
      body = await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(Buffer.from(c)));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });
    }

    const upstream = await fetch(target, {
      method,
      headers: fwdHeaders,
      body,
      redirect: 'manual',
      signal: controller.signal,
      // pick agent
      dispatcher: target.protocol === 'http:' ? agentHttp : agentHttps
    });

    // Copy status and headers
    res.statusCode = upstream.status;
    upstream.headers.forEach((v, k) => {
      // do not forward hop-by-hop headers
      if (['connection','keep-alive','transfer-encoding','upgrade'].includes(k.toLowerCase())) return;
      res.setHeader(k, v);
    });
    // Re-apply CORS over upstream headers
    setCors(res, origin);

    // Pipe body
    if (upstream.body) {
      const reader = upstream.body.getReader();
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) { res.end(); return; }
        res.write(Buffer.from(value));
        return pump();
      });
      await pump();
    } else {
      res.end();
    }
  } catch (e) {
    const msg = e && e.message ? String(e.message) : 'proxy error';
    send(res, 502, msg);
  }
}

http.createServer(handle).listen(PORT, () => {
  console.log(`[dev-cors-proxy] listening on http://127.0.0.1:${PORT}`);
});

