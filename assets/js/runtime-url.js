// assets/js/runtime-url.js
// Central resolver for localhost, GitHub Pages and RawGitHack preview base paths.
(function initRuntimeUrl(global) {
  'use strict';

  const VERSION = '20260425.1';
  const APP_PAGE_NAMES = new Set(['index.html', 'portfolio_florian_b.html', 'parcours.html', 'contact.html']);

  function ensureTrailingSlash(value) {
    return value.endsWith('/') ? value : `${value}/`;
  }

  function stripLeadingSlash(value) {
    return String(value || '').replace(/^\/+/, '');
  }

  function isHashOnly(value) {
    return String(value || '').startsWith('#');
  }

  function isExternal(value) {
    return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(String(value || ''));
  }

  function splitPathSuffix(value) {
    const match = String(value || '').match(/^([^?#]*)([?#].*)?$/);
    return { path: match?.[1] || '', suffix: match?.[2] || '' };
  }

  function computeBaseHref(locationLike = global.location) {
    const origin = locationLike?.origin || '';
    const pathname = locationLike?.pathname || '/';
    const host = locationLike?.hostname || '';
    const rawGitHackBase = pathname.match(/^\/[^/]+\/[^/]+\/preview\/[^/]+\//);

    if (/raw\.githack\.com$/i.test(host) && rawGitHackBase) {
      return `${origin}${rawGitHackBase[0]}`;
    }

    return ensureTrailingSlash(origin || '/');
  }

  function baseHref() {
    return computeBaseHref(global.location);
  }

  function sanitizeAppPath(value) {
    const { path, suffix } = splitPathSuffix(value);
    const cleaned = stripLeadingSlash(path)
      .replace(/^\.\//, '')
      .replace(/^flobehejohn\/flobehejohn\.github\.io\/preview\/[^/]+\//, '')
      .replace(/^assets\/portfolio\/([^/]+)\/assets\//, 'assets/')
      .replace(/^assets\/portfolio\/([^/]+)\/(portfolio_florian_b|parcours|contact|index)\.html$/, '$2.html');
    return `${cleaned}${suffix}`;
  }

  function asset(path) {
    if (!path || isHashOnly(path)) return path;
    if (isExternal(path) && !String(path).startsWith('/')) return String(path);
    return new URL(sanitizeAppPath(path), baseHref()).href;
  }

  function page(path = 'index.html') {
    if (!path || isHashOnly(path)) return path;
    if (isExternal(path) && !String(path).startsWith('/')) return String(path);
    const cleaned = sanitizeAppPath(path || 'index.html') || 'index.html';
    return new URL(cleaned, baseHref()).href;
  }

  function appPathFromUrl(url) {
    const absolute = new URL(url, global.location.href);
    const base = new URL(baseHref());
    if (absolute.origin !== base.origin) return null;

    let appPath = absolute.pathname;
    if (appPath.startsWith(base.pathname)) {
      appPath = appPath.slice(base.pathname.length);
    } else {
      appPath = stripLeadingSlash(appPath);
    }

    return `${appPath}${absolute.search}${absolute.hash}`;
  }

  function normalizeInternalHref(href) {
    if (!href || isHashOnly(href) || /^(?:mailto:|tel:|data:|blob:|javascript:)/i.test(href)) return href;

    let absolute;
    try {
      absolute = new URL(href, global.location.href);
    } catch {
      return href;
    }

    const base = new URL(baseHref());
    if (absolute.origin !== base.origin) return href;

    let appPath = appPathFromUrl(absolute.href) || '';
    const { path, suffix } = splitPathSuffix(appPath);
    const leaf = path.split('/').filter(Boolean).pop() || 'index.html';

    if (APP_PAGE_NAMES.has(leaf)) return page(`${leaf}${suffix}`);
    if (/^(?:assets|svg-icons)\//.test(path)) return asset(`${path}${suffix}`);
    if (/(?:^|\/)assets\//.test(path)) return asset(`${path.replace(/^.*?(assets\/)/, '$1')}${suffix}`);

    return page(`${path || 'index.html'}${suffix}`);
  }

  function isInternalAppUrl(url) {
    try {
      return appPathFromUrl(url) !== null;
    } catch {
      return false;
    }
  }

  function fromCurrentScriptAssetBase() {
    const script = document.currentScript;
    if (!script?.src) return baseHref();
    const match = script.src.match(/^(.*?\/assets\/js\/)runtime-url\.js(?:[?#].*)?$/);
    return match ? new URL('../../', match[1]).href : baseHref();
  }

  const api = Object.freeze({
    version: VERSION,
    baseHref,
    asset,
    page,
    normalizeInternalHref,
    isInternalAppUrl,
    fromCurrentScriptAssetBase,
    _computeBaseHref: computeBaseHref
  });

  global.AppRuntimeUrl = api;
  global.__APP_RUNTIME_URL_AUDIT__ = {
    version: VERSION,
    baseHref: baseHref(),
    currentHref: global.location?.href || ''
  };
})(window);
