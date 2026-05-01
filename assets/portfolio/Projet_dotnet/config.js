// Base API (Azure Container Apps)
window.API_BASE_URL = "https://gestioncommandesapi.agreeablepebble-e135b62f.westeurope.azurecontainerapps.io";
// Probe utile pour la latence (endpoint API réel)
window.API_PROBE_URL = "/api/Commandes";

// Dev helper: active un proxy CORS seulement en local (127.0.0.1/localhost)
// pour contourner les erreurs "CORS Missing Allow Origin" durant le dev.
// En prod (GitHub Pages), on le désactive.
(function(){
  function getEnvOrigin(){
    try { if (location && location.origin && location.origin !== 'null') return location.origin; } catch {}
    try { if (window.parent && window.parent.location && window.parent.location.origin && window.parent.location.origin !== 'null') return window.parent.location.origin; } catch {}
    try { if (document && document.referrer) { const u=new URL(document.referrer); return u.origin; } } catch {}
    return '';
  }
  var envOrigin = getEnvOrigin();
  var isLocal = /^(http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)/i.test(envOrigin);
  // Depuis que l’API .NET est configurée avec CORS (origines autorisées),
  // aucun proxy n’est nécessaire, y compris en local.
  // On garde la possibilité d’activer un proxy à la demande via querystring ?proxy=<url>.
  var forced = '';
  try {
    var q = new URLSearchParams(location.search);
    forced = (q.get('proxy') || '').trim();
  } catch {}
  window.API_CORS_PROXY = forced || ""; // vide par défaut (pas de proxy)
})();
