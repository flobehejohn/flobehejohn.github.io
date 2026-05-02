// assets/js/pages/dotnet_url_guard.js
// Certified URL adapter loaded before dotnet_boot.js.
(function dotnetUrlGuard(window) {
  'use strict';

  function resolveBase() {
    const rel = 'assets/portfolio/Projet_dotnet/';
    if (window.AppRuntimeUrl && typeof window.AppRuntimeUrl.asset === 'function') {
      return window.AppRuntimeUrl.asset(rel);
    }
    return new URL(rel, window.location.origin + '/').href;
  }

  const appBase = resolveBase();
  window.DOTNET_APP_BASE = appBase;
  window.__DOTNET_AUDIT__ = Object.assign(window.__DOTNET_AUDIT__ || {}, {
    appBase,
    urlGuard: true,
    fallbackControlled: false,
    forbiddenRawGitHackRoot: appBase.startsWith('https://raw.githack.com/assets/')
  });

  if (window.__DOTNET_AUDIT__.forbiddenRawGitHackRoot) {
    window.__DOTNET_AUDIT__.fallbackControlled = true;
    console.warn('[DotNetUrlGuard] invalid app base detected', appBase);
  } else {
    console.info('[DotNetUrlGuard] app base', appBase);
  }
})(window);
