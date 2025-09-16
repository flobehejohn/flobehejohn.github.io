// cloudflare/cors-proxy-worker.js
// CORS proxy Worker (dev/prod) — prêt à déployer via Wrangler
// Appel côté client:
//   https://<worker-subdomain>.workers.dev/https://api.example.com/api/Commandes
// Gère OPTIONS (preflight), toutes méthodes, et ajoute les en-têtes CORS.

const ALLOWED_ORIGINS = [
  'https://flobehejohn.github.io',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:8080',
  'http://localhost:8080'
];
const ALLOWED_METHODS = ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'];
const ALLOWED_HEADERS = ['Origin','Range','Content-Type','Accept','Cache-Control','If-Modified-Since','If-None-Match','Authorization','X-Requested-With'];
const EXPOSE_HEADERS  = ['ETag','Content-Length','Accept-Ranges','Content-Range','Content-Type'];
const MAX_AGE = 86400;

function corsHeaders(origin, req) {
  const allow = (origin && ALLOWED_ORIGINS.includes(origin)) ? origin : '*';
  const reqHeaders = (req && req.headers && req.headers.get('Access-Control-Request-Headers')) || '';
  const allowHeaders = reqHeaders ? reqHeaders : ALLOWED_HEADERS.join(',');
  const reqMethod  = (req && req.headers && req.headers.get('Access-Control-Request-Method')) || '';
  const allowMethods = reqMethod ? reqMethod : ALLOWED_METHODS.join(',');
  const h = {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': allowMethods,
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Expose-Headers': EXPOSE_HEADERS.join(','),
    'Access-Control-Max-Age': String(MAX_AGE),
    'Access-Control-Allow-Credentials': 'false',
    'Vary': 'Origin'
  };
  const pna = req && req.headers && req.headers.get('Access-Control-Request-Private-Network');
  if (pna && pna.toLowerCase() === 'true') h['Access-Control-Allow-Private-Network'] = 'true';
  return h;
}

function badRequest(msg) {
  return new Response(msg || 'Bad Request', { status: 400 });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // Health
    if (url.pathname === '/' || url.pathname === '/__health') {
      return new Response('ok', { status: 200, headers: corsHeaders(origin, request) });
    }

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, request) });
    }

    // Expect absolute URL after '/'
    const targetRaw = url.pathname.slice(1) + (url.search || '');
    if (!/^https?:\/\//i.test(targetRaw)) return badRequest('Expected absolute URL after /');

    // Build upstream request
    const upstreamUrl = targetRaw;
    const headers = new Headers(request.headers);
    // Strip hop-by-hop and origin headers
    headers.delete('Origin');
    headers.delete('Host');
    headers.delete('Connection');
    headers.delete('Keep-Alive');
    headers.delete('Transfer-Encoding');
    headers.delete('Upgrade');

    const init = {
      method: request.method,
      headers,
      redirect: 'manual',
      body: ['GET','HEAD'].includes(request.method) ? undefined : request.body
    };

    let upstreamResp;
    try {
      upstreamResp = await fetch(upstreamUrl, init);
    } catch (e) {
      return new Response('Upstream fetch error', { status: 502, headers: corsHeaders(origin, request) });
    }

    // Clone response with CORS headers added
    const respHeaders = new Headers(upstreamResp.headers);
    const extra = corsHeaders(origin, request);
    for (const [k,v] of Object.entries(extra)) respHeaders.set(k, v);
    return new Response(upstreamResp.body, { status: upstreamResp.status, headers: respHeaders });
  }
};
