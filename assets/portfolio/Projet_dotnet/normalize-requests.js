// assets/portfolio/Projet_dotnet/normalize-requests.js
// Normalisation des requêtes vers l'API pour contextes normaux ET about:srcdoc.
// - Réécrit SEULEMENT les URL d'API (/api/...) vers API_BASE
// - Ignore les requêtes HTML (Accept: text/html)
// - Patch fetch, XHR et (option) axios
// - Unpatch auto sur pjax:before / pagehide

(function () {
  'use strict';

  const TAG = '[normalize-requests]';
  // Source de vérité pour la base API: priorités -> window.API_BASE_URL > window.API_BASE > fallback constant
  const API_BASE = (function(){
    try {
      const v = (window.API_BASE_URL || window.API_BASE || '').trim();
      if (v) return v.replace(/\/+$/, '');
    } catch {}
    return 'https://gestioncommandesapi.agreeablepebble-e135b62f.westeurope.azurecontainerapps.io';
  })();
  // Optionnel: proxy CORS (Cloudflare Worker ou autre). Exemple: 'https://votre-worker.workers.dev'
  const API_CORS_PROXY = (function(){ try { return (window.API_CORS_PROXY || '').trim(); } catch { return ''; } })();
  const apiHost = (() => { try { return new URL(API_BASE).host; } catch { return ''; } })();

  if (window.__NORMALIZE_REQUESTS_PATCHED__) {
    console.info(`${TAG} déjà actif — skip`);
    return;
  }

  const origFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  const origXHROpen = window.XMLHttpRequest && XMLHttpRequest.prototype.open;
  let axiosReqInterceptorId = null;

  // --- Helpers ---------------------------------------------------------------

  function normalizeApiPath(pathname) {
    if (!pathname) return pathname;
    let p = String(pathname);
    p = p.replace(/\/api\/commandes/gi, '/api/Commandes')
         .replace(/(\/api\/Commandes){2,}(\/?)/g, '/api/Commandes$2');
    return p;
  }

  function isApiUrlLike(raw) {
    if (!raw) return false;
    if (typeof raw === 'string') {
      // Ignorer swagger pour éviter du bruit et des proxys qui bloquent l'HTML
      if (/\/swagger(\/|$)/i.test(raw)) return false;
      // Cas API: /api/... ou absolu http(s)://*/api/...
      if (/^\/api\//i.test(raw)) return true;
      if (/^https?:\/\/[^/]+\/api\//i.test(raw)) return true;
      return false;
    }
    try {
      const s = String(raw);
      return isApiUrlLike(s);
    } catch { return false; }
  }

  function isHtmlRequest(input, init) {
    // Cherche Accept: text/html dans init.headers OU dans la Request
    const getFromHeaders = (h) => {
      if (!h) return '';
      try {
        if (typeof Headers !== 'undefined' && h instanceof Headers) return h.get('Accept') || '';
        if (typeof h === 'object') {
          for (const k of Object.keys(h)) { if (k.toLowerCase() === 'accept') return String(h[k] || ''); }
        }
      } catch {}
      return '';
    };
    try {
      let accept = '';
      if (init?.headers) accept = getFromHeaders(init.headers);
      if (!accept && typeof Request !== 'undefined' && input instanceof Request) accept = getFromHeaders(input.headers);
      return typeof accept === 'string' && accept.toLowerCase().includes('text/html');
    } catch { return false; }
  }

  function toAbsolute(url) {
    // Ne PAS s'appuyer sur about:srcdoc comme base → utiliser location.origin si possible,
    // sinon retourner l'URL telle quelle (les tests regex gèrent déjà).
    try {
      if (typeof url !== 'string') url = String(url || '');
    } catch { url = ''; }
    if (!url) return url;

    if (/^https?:\/\//i.test(url)) return url; // déjà absolue
    try {
      // location.origin peut être 'null' dans srcdoc → fallback sur parent origin si accessible
      const base = (location && location.origin && location.origin !== 'null')
        ? location.origin
        : (window.parent && window.parent.location && window.parent.location.origin !== 'null'
            ? window.parent.location.origin
            : '');
      if (base) return new URL(url, base).href;
    } catch {}
    return url; // fallback (sera traité par isApiUrlLike)
  }

  function mapToApi(url) {
    // Construit l'URL finale vers API_BASE en conservant path/search/hash
    try {
      // Si url est relative /api/..., fabrique l'absolue pour parser proprement le path
      const abs = toAbsolute(url);
      let u;
      try { u = new URL(abs); }
      catch { return API_BASE.replace(/\/+$/, '') + normalizeApiPath(url); }

      const path = normalizeApiPath(u.pathname || '');
      let target = API_BASE.replace(/\/+$/, '') + path + (u.search || '') + (u.hash || '');
      if (API_CORS_PROXY) {
        // Proxy CORS: on route via proxy (qui doit ré-émettre les bons en-têtes CORS)
        try {
          const prox = API_CORS_PROXY.replace(/\/+$/, '');
          target = prox + '/' + encodeURI(target);
        } catch {}
      }
      return target;
    } catch {
      // Fallback minimal
      let t = API_BASE.replace(/\/+$/, '') + normalizeApiPath(String(url || ''));
      if (API_CORS_PROXY) {
        try { t = API_CORS_PROXY.replace(/\/+$/, '') + '/' + encodeURI(t); } catch {}
      }
      return t;
    }
  }

  // --- fetch patch -----------------------------------------------------------

  if (origFetch) {
    function patchedFetch(input, init) {
      try {
        // Request instance
        if (typeof Request !== 'undefined' && input instanceof Request) {
          const req = input;
          const url = req.url || '';
          const wantsHtml = isHtmlRequest(req, init || req);
          // Pour swagger, on réécrit quand même (même si Accept text/html)
        const forceRewrite = false; // swagger ignoré
          if (isApiUrlLike(url) && (!wantsHtml || forceRewrite)) {
            const target = mapToApi(url);
            let next = new Request(target, req); // conserve méthode/headers/body
            if (init) next = new Request(next, init); // merge override
            console.info(`${TAG} fetch rewrite →`, url, '→', target);
            return origFetch(next);
          }
          // sinon, on passe la main (en respectant init si fourni)
          return init ? origFetch(new Request(req, init)) : origFetch(req);
        }

        // URL string / URL-like
        const urlStr = (typeof input === 'string') ? input : (input && input.url) || '';
        const wantsHtml = isHtmlRequest(input, init);
        const forceRewrite = false; // swagger ignoré
        if (isApiUrlLike(urlStr) && (!wantsHtml || forceRewrite)) {
          const target = mapToApi(urlStr);
          console.info(`${TAG} fetch rewrite →`, urlStr, '→', target);
          return origFetch(target, init);
        }
        return origFetch(input, init);
      } catch (e) {
        console.warn(`${TAG} fetch patch error → fallback original`, e);
        return origFetch(input, init);
      }
    }
    patchedFetch.__isPatched = true;
    patchedFetch.__orig = origFetch;
    window.fetch = patchedFetch;
  }

  // --- XHR.patch -------------------------------------------------------------

  if (origXHROpen) {
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      try {
        if (isApiUrlLike(url)) {
          const target = mapToApi(url);
          console.info(`${TAG} XHR rewrite →`, url, '→', target);
          return origXHROpen.call(this, method, target, ...rest);
        }
        return origXHROpen.call(this, method, url, ...rest);
      } catch (e) {
        console.warn(`${TAG} XHR patch error → fallback original`, e);
        return origXHROpen.call(this, method, url, ...rest);
      }
    };
    XMLHttpRequest.prototype.open.__isPatched = true;
    XMLHttpRequest.prototype.open.__orig = origXHROpen;
  }

  // --- axios (optionnel mais utile) ------------------------------------------

  try {
    if (window.axios?.interceptors?.request) {
      axiosReqInterceptorId = window.axios.interceptors.request.use(function(cfg){
        try {
          // Ne pas toucher aux requêtes HTML explicites
          const wantsHtml = cfg.headers && (
            (cfg.headers.get && cfg.headers.get('Accept')) ||
            cfg.headers.Accept || cfg.headers.accept || ''
          );
          const acceptIsHtml = typeof wantsHtml === 'string' && wantsHtml.toLowerCase().includes('text/html');

          const rawUrl = cfg.url || '';
          if (!acceptIsHtml && isApiUrlLike(rawUrl)) {
            const target = mapToApi(rawUrl);
            cfg.baseURL = '';           // neutralise un baseURL éventuel
            cfg.url = target;           // fixe l’URL absolue finale
            console.info(`${TAG} axios rewrite →`, rawUrl, '→', target);
          }
        } catch (e) { /* silent */ }
        return cfg;
      });
    }
  } catch { /* ignore */ }

  // --- Unpatch ---------------------------------------------------------------

  function unpatch() {
    try {
      if (window.fetch?.__isPatched && window.fetch.__orig) window.fetch = window.fetch.__orig;
    } catch {}
    try {
      const op = XMLHttpRequest.prototype.open;
      if (op?.__isPatched && op.__orig) XMLHttpRequest.prototype.open = op.__orig;
    } catch {}
    try {
      if (axiosReqInterceptorId != null && window.axios?.interceptors?.request?.eject) {
        window.axios.interceptors.request.eject(axiosReqInterceptorId);
        axiosReqInterceptorId = null;
      }
    } catch {}
    if (window.__NORMALIZE_REQUESTS_PATCHED__) {
      console.info(`${TAG} unpatch complet`);
      window.__NORMALIZE_REQUESTS_PATCHED__ = false;
    }
  }

  window.addEventListener('pjax:before', unpatch, { once: true });
  window.addEventListener('pagehide',    unpatch, { once: true });

  // Flag global
  window.__NORMALIZE_REQUESTS_PATCHED__ = true;
  console.info(`${TAG} actif →`, API_BASE);
})();
