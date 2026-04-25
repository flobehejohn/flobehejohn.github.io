(() => {
  'use strict';

  const VERSION = '20260425.mobile-debug.1';
  const DEBUG_PARAM = 'rawgithack';
  const MAX_RECORDS = 140;
  const params = new URLSearchParams(window.location.search);
  const active = params.get('debug') === DEBUG_PARAM;

  if (!active) {
    window.__RAWGITHACK_MOBILE_AUDIT__ = Object.freeze({
      active: false,
      version: VERSION,
      reason: 'add ?debug=rawgithack to enable the read-only mobile audit panel'
    });
    return;
  }

  const startedAt = new Date().toISOString();
  const observedResources = new Set();
  const renderState = { scheduled: false, panel: null, body: null, minimized: false };

  const fatalConsolePatterns = [
    /ReferenceError/i,
    /TypeError/i,
    /SyntaxError/i,
    /export declarations may only appear at top level of a module/i,
    /spécificateur .* était un spécificateur simple/i,
    /bare specifier/i,
    /blocked because of a disallowed MIME type/i,
    /type MIME interdit/i,
    /Failed to load module script/i,
    /Échec du chargement pour le module/i,
    /Aucune police n’a pu être chargée/i,
    /MIME.*text\/html/i
  ];

  const watchedUrlPatterns = [
    { key: 'nuageNestedAssets', pattern: /\/assets\/portfolio\/nuage_magique\/assets\//i },
    { key: 'dotnetNestedAssets', pattern: /\/assets\/portfolio\/Projet_dotnet\/assets\//i },
    { key: 'rawGithackOriginAssets', pattern: /^https:\/\/raw\.githack\.com\/assets\//i },
    { key: 'mapsApi', pattern: /maps\.googleapis\.com/i },
    { key: 'googleMapsEmbed', pattern: /google\.com\/maps(?:\/embed|\?|$)/i },
    { key: 'ga4Real', pattern: /googletagmanager\.com\/gtag\/js\?id=G-|google-analytics\.com\/g\/collect|\/collect\?/i },
    { key: 'rawGithackAdNetwork', pattern: /(?:carbonads|ethicalads|srv\.carbonads|server\.ethicalads|media\.ethicalads)/i }
  ];

  const localAssetPattern = /(?:\/assets\/|\/css\/|\/js\/|\/fonts\/|\/portfolio\/|\/svg-icons\/)/i;

  const state = {
    active: true,
    version: VERSION,
    startedAt,
    href: sanitizeUrl(window.location.href),
    privacy: {
      readOnly: true,
      externalTransmissions: 0,
      queryStringsRedacted: true,
      clipboardOnlyOnUserGesture: true,
      storage: 'memory/sessionStorage'
    },
    counters: {
      fatalErrors: 0,
      consoleErrors: 0,
      unhandledRejections: 0,
      localAssetFailures: 0,
      suspiciousRequests: 0,
      mapsRequests: 0,
      ga4RealRequests: 0,
      badPreviewPrefixes: 0,
      resourceElementErrors: 0,
      abortedLocalRequests: 0
    },
    records: {
      fatalErrors: [],
      consoleErrors: [],
      unhandledRejections: [],
      localAssetFailures: [],
      suspiciousRequests: [],
      resourceElementErrors: [],
      resources: []
    },
    globals: {}
  };

  function now() {
    return new Date().toISOString();
  }

  function looksLikeUrl(value) {
    return /^(?:https?:)?\/\//i.test(value) || /^\/?(?:assets|css|js|fonts|portfolio|svg-icons)\//i.test(value);
  }

  function redactString(value) {
    const asString = String(value);
    const withoutEmails = asString.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]');
    return withoutEmails.replace(/(key|token|id|email|mail|q)=([^&#\s]+)/gi, '$1=[redacted]');
  }

  function sanitizeUrl(value) {
    if (!value) return '';
    const redacted = redactString(value);
    try {
      const url = new URL(redacted, window.location.href);
      const keepDebug = url.searchParams.get('debug') === DEBUG_PARAM ? '?debug=rawgithack' : '';
      return `${url.origin}${url.pathname}${keepDebug}`;
    } catch {
      return redacted.split('?')[0].split('#')[0];
    }
  }

  function safeText(value) {
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    if (typeof value === 'string') return redactString(value);
    if (value && typeof value === 'object') {
      try { return redactString(JSON.stringify(value)); } catch { return Object.prototype.toString.call(value); }
    }
    return redactString(String(value));
  }

  function safeClone(value, depth = 0) {
    if (depth > 4) return '[depth-limit]';
    if (value == null) return value;
    if (typeof value === 'string') return looksLikeUrl(value) ? sanitizeUrl(value) : redactString(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 40).map((entry) => safeClone(entry, depth + 1));
    if (typeof value === 'object') {
      const result = {};
      for (const [key, entry] of Object.entries(value).slice(0, 80)) result[key] = safeClone(entry, depth + 1);
      return result;
    }
    return redactString(String(value));
  }

  function pushRecord(bucket, record) {
    const list = state.records[bucket];
    if (!Array.isArray(list)) return;
    list.push({ time: now(), ...record });
    if (list.length > MAX_RECORDS) list.splice(0, list.length - MAX_RECORDS);
    persistSnapshot();
    scheduleRender();
  }

  function classifyUrl(rawUrl, meta = {}) {
    const url = sanitizeUrl(rawUrl);
    if (!url) return;

    const matchingPatterns = watchedUrlPatterns.filter(({ pattern }) => pattern.test(url));
    if (matchingPatterns.length > 0) {
      for (const { key } of matchingPatterns) {
        if (key === 'mapsApi' || key === 'googleMapsEmbed') state.counters.mapsRequests += 1;
        if (key === 'ga4Real') state.counters.ga4RealRequests += 1;
        if (key === 'nuageNestedAssets' || key === 'dotnetNestedAssets' || key === 'rawGithackOriginAssets') state.counters.badPreviewPrefixes += 1;
      }
      state.counters.suspiciousRequests += 1;
      pushRecord('suspiciousRequests', {
        url,
        reason: matchingPatterns.map(({ key }) => key).join(','),
        ...safeClone(meta)
      });
    }

    if (localAssetPattern.test(url) && Number(meta.status) >= 400) {
      state.counters.localAssetFailures += 1;
      pushRecord('localAssetFailures', { url, ...safeClone(meta) });
    }
  }

  function scanPerformanceResources() {
    for (const entry of performance.getEntriesByType('resource')) {
      const name = entry.name;
      if (observedResources.has(name)) continue;
      observedResources.add(name);
      const url = sanitizeUrl(name);
      pushRecord('resources', {
        url,
        initiatorType: entry.initiatorType || 'unknown',
        transferSize: Number(entry.transferSize || 0),
        durationMs: Math.round(Number(entry.duration || 0))
      });
      classifyUrl(name, { source: 'performance', initiatorType: entry.initiatorType || 'unknown' });
    }
  }

  function collectGlobals() {
    state.globals = safeClone({
      appRuntimeUrl: window.__APP_RUNTIME_URL_AUDIT__ || null,
      pageHub: window.__PAGE_HUB_AUDIT__ || null,
      contact: window.__CONTACT_AUDIT__ || null,
      dotnet: window.__DOTNET_AUDIT__ || null,
      nuage: window.__NUAGE_AUDIT__ || null,
      player: window.PlayerSingleton ? { facadePresent: true } : null,
      audioCount: document.querySelectorAll('audio').length,
      currentAudioSrc: document.querySelector('audio')?.currentSrc || ''
    });
  }

  function snapshot() {
    scanPerformanceResources();
    collectGlobals();
    return safeClone({
      ...state,
      href: sanitizeUrl(window.location.href),
      readyState: document.readyState,
      generatedAt: now()
    });
  }

  function persistSnapshot() {
    try {
      sessionStorage.setItem('__RAWGITHACK_MOBILE_AUDIT__', JSON.stringify(snapshot()));
    } catch {
      // sessionStorage may be unavailable; the in-memory audit remains authoritative.
    }
  }

  function isFatalText(text) {
    return fatalConsolePatterns.some((pattern) => pattern.test(text));
  }

  function installConsoleProbe() {
    const originalError = console.error.bind(console);
    console.error = (...args) => {
      const text = args.map(safeText).join(' ');
      state.counters.consoleErrors += 1;
      pushRecord('consoleErrors', { text });
      if (isFatalText(text)) {
        state.counters.fatalErrors += 1;
        pushRecord('fatalErrors', { source: 'console.error', text });
      }
      originalError(...args);
    };
  }

  function installWindowErrorProbe() {
    window.addEventListener('error', (event) => {
      const target = event.target;
      const resourceUrl = target && target !== window && (target.currentSrc || target.src || target.href);
      if (resourceUrl) {
        const url = sanitizeUrl(resourceUrl);
        state.counters.resourceElementErrors += 1;
        pushRecord('resourceElementErrors', { url, tagName: target.tagName || 'unknown' });
        if (localAssetPattern.test(url)) {
          state.counters.localAssetFailures += 1;
          pushRecord('localAssetFailures', { url, source: 'resource-error', tagName: target.tagName || 'unknown' });
        }
        classifyUrl(resourceUrl, { source: 'resource-error' });
        return;
      }

      const text = safeText(event.message || event.error || 'window error');
      state.counters.fatalErrors += 1;
      pushRecord('fatalErrors', { source: 'window.error', text });
    }, true);

    window.addEventListener('unhandledrejection', (event) => {
      const text = safeText(event.reason || 'unhandled rejection');
      state.counters.unhandledRejections += 1;
      state.counters.fatalErrors += 1;
      pushRecord('unhandledRejections', { text });
      pushRecord('fatalErrors', { source: 'unhandledrejection', text });
    });
  }

  function installFetchProbe() {
    if (typeof window.fetch !== 'function') return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const rawUrl = args[0] instanceof Request ? args[0].url : String(args[0] || '');
      classifyUrl(rawUrl, { source: 'fetch:request' });
      try {
        const response = await originalFetch(...args);
        classifyUrl(response.url || rawUrl, {
          source: 'fetch:response',
          status: response.status,
          contentType: response.headers?.get?.('content-type') || ''
        });
        return response;
      } catch (error) {
        const text = safeText(error);
        if (/NS_BINDING_ABORTED/i.test(text) && localAssetPattern.test(sanitizeUrl(rawUrl))) {
          state.counters.abortedLocalRequests += 1;
        } else if (localAssetPattern.test(sanitizeUrl(rawUrl))) {
          state.counters.localAssetFailures += 1;
          pushRecord('localAssetFailures', { url: sanitizeUrl(rawUrl), source: 'fetch:error', text });
        }
        throw error;
      }
    };
  }

  function installXhrProbe() {
    if (!window.XMLHttpRequest) return;
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
      this.__rawgithackMobileDebugUrl = String(url || '');
      this.__rawgithackMobileDebugMethod = String(method || 'GET');
      classifyUrl(url, { source: 'xhr:open', method: this.__rawgithackMobileDebugMethod });
      this.addEventListener('loadend', () => {
        classifyUrl(this.responseURL || this.__rawgithackMobileDebugUrl, {
          source: 'xhr:loadend',
          method: this.__rawgithackMobileDebugMethod,
          status: this.status
        });
      }, { once: true });
      return originalOpen.call(this, method, url, ...rest);
    };
  }

  function installBeaconProbe() {
    if (typeof navigator.sendBeacon !== 'function') return;
    const originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      classifyUrl(url, { source: 'sendBeacon', bytes: data?.size || data?.length || 0 });
      return originalBeacon(url, data);
    };
  }

  function installPerformanceProbe() {
    scanPerformanceResources();
    if (typeof PerformanceObserver !== 'function') return;
    try {
      const observer = new PerformanceObserver(() => scanPerformanceResources());
      observer.observe({ entryTypes: ['resource'] });
    } catch {
      // Older mobile engines may not support resource observers.
    }
  }

  function statusText() {
    const c = state.counters;
    if (c.fatalErrors || c.localAssetFailures || c.badPreviewPrefixes || c.mapsRequests || c.ga4RealRequests) return 'FAIL';
    if (c.suspiciousRequests || c.consoleErrors) return 'WATCH';
    return 'OK';
  }

  function scheduleRender() {
    if (renderState.scheduled) return;
    renderState.scheduled = true;
    requestAnimationFrame(() => {
      renderState.scheduled = false;
      renderPanel();
    });
  }

  async function copySnapshot() {
    const text = JSON.stringify(snapshot(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      renderPanel('copied');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      renderPanel('copied-fallback');
    }
  }

  function createPanel() {
    if (renderState.panel || !document.body) return;
    const style = document.createElement('style');
    style.textContent = `
      [data-rawgithack-mobile-debug] { position: fixed; z-index: 2147483647; left: 8px; right: 8px; bottom: 8px; max-height: 68vh; overflow: auto; border: 1px solid rgba(255,255,255,.22); border-radius: 12px; background: rgba(8,10,16,.94); color: #f4f7ff; font: 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, sans-serif; box-shadow: 0 12px 32px rgba(0,0,0,.45); backdrop-filter: blur(8px); }
      [data-rawgithack-mobile-debug] header { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border-bottom: 1px solid rgba(255,255,255,.14); }
      [data-rawgithack-mobile-debug] strong { font-weight:700; }
      [data-rawgithack-mobile-debug] button { border: 1px solid rgba(255,255,255,.2); border-radius: 999px; background:#132038; color:#fff; padding:4px 8px; font: inherit; }
      [data-rawgithack-mobile-debug] .rmd-body { padding:8px 10px; }
      [data-rawgithack-mobile-debug] .rmd-grid { display:grid; grid-template-columns: 1fr 1fr; gap:4px 8px; }
      [data-rawgithack-mobile-debug] .rmd-row { display:flex; justify-content:space-between; gap:8px; border-bottom:1px dotted rgba(255,255,255,.1); padding:2px 0; }
      [data-rawgithack-mobile-debug] .rmd-ok { color:#75ffba; } [data-rawgithack-mobile-debug] .rmd-watch { color:#ffe08a; } [data-rawgithack-mobile-debug] .rmd-fail { color:#ff9c9c; }
      [data-rawgithack-mobile-debug] code { display:block; white-space:pre-wrap; word-break:break-word; color:#c9dcff; margin-top:6px; max-height:120px; overflow:auto; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('section');
    panel.setAttribute('data-rawgithack-mobile-debug', 'true');
    panel.innerHTML = '<header><strong>RawGitHack mobile audit</strong><span></span></header><div class="rmd-body"></div>';
    document.body.appendChild(panel);
    renderState.panel = panel;
    renderState.body = panel.querySelector('.rmd-body');
    panel.querySelector('header span').innerHTML = '<button type="button" data-rmd-copy>Copy JSON</button> <button type="button" data-rmd-min>Min</button>';
    panel.querySelector('[data-rmd-copy]').addEventListener('click', () => copySnapshot());
    panel.querySelector('[data-rmd-min]').addEventListener('click', () => {
      renderState.minimized = !renderState.minimized;
      renderPanel();
    });
  }

  function renderPanel(lastAction = '') {
    createPanel();
    if (!renderState.body) return;
    collectGlobals();
    const c = state.counters;
    const status = statusText();
    const statusClass = status === 'OK' ? 'rmd-ok' : status === 'WATCH' ? 'rmd-watch' : 'rmd-fail';
    if (renderState.minimized) {
      renderState.body.innerHTML = `<div class="rmd-row"><span>Status</span><strong class="${statusClass}">${status}</strong></div>`;
      return;
    }
    const latest = [
      ...state.records.fatalErrors,
      ...state.records.localAssetFailures,
      ...state.records.suspiciousRequests,
      ...state.records.resourceElementErrors
    ].slice(-8);
    renderState.body.innerHTML = `
      <div class="rmd-row"><span>Status</span><strong class="${statusClass}">${status}</strong></div>
      <div class="rmd-grid">
        <div>Fatal JS: <strong>${c.fatalErrors}</strong></div>
        <div>Local assets: <strong>${c.localAssetFailures}</strong></div>
        <div>Bad prefixes: <strong>${c.badPreviewPrefixes}</strong></div>
        <div>Maps: <strong>${c.mapsRequests}</strong></div>
        <div>GA4 real: <strong>${c.ga4RealRequests}</strong></div>
        <div>Audio tags: <strong>${state.globals.audioCount || 0}</strong></div>
      </div>
      <div class="rmd-row"><span>Privacy</span><strong class="rmd-ok">read-only / no external send</strong></div>
      ${lastAction ? `<div class="rmd-row"><span>Action</span><strong>${lastAction}</strong></div>` : ''}
      <code>${latest.map((entry) => `${entry.time || ''} ${entry.source || entry.reason || ''} ${entry.url || entry.text || ''}`).join('\n') || 'No blocking signal captured yet.'}</code>
    `;
  }

  installConsoleProbe();
  installWindowErrorProbe();
  installFetchProbe();
  installXhrProbe();
  installBeaconProbe();
  installPerformanceProbe();

  window.__RAWGITHACK_MOBILE_AUDIT__ = {
    active: true,
    version: VERSION,
    snapshot,
    copySnapshot,
    state
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createPanel();
      renderPanel();
    }, { once: true });
  } else {
    createPanel();
    renderPanel();
  }

  window.addEventListener('load', () => {
    scanPerformanceResources();
    renderPanel();
  }, { once: true });
})();
