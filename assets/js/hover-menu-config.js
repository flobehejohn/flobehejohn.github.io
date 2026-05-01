// assets/js/hover-menu-config.js
(() => {
  'use strict';

  // Namespace global sûr
  const OXY = (window.oxyThemeData = window.oxyThemeData || {});
  OXY.hoverMenu = OXY.hoverMenu || { hoverActive: false };

  // On garde la structure "pattern PJAX" :
  // - init(container) est rappelé à chaque navigation
  // - on évite les doubles attaches d'écouteurs globaux avec un garde
  let listenersBound = false;

  function applyState(active) {
    active = !!active;
    OXY.hoverMenu.hoverActive = active;

    const docEl = document.documentElement;
    docEl.classList.toggle('hover-menu-on', active);
    docEl.classList.toggle('hover-menu-off', !active);
  }

  // Déduit l'état depuis l'attribut data-hover-menu du container (si présent)
  function inferActiveFrom(container) {
    const root = (container instanceof Element) ? container : document.body;
    const attr =
      root.getAttribute?.('data-hover-menu') ||
      document.body.getAttribute('data-hover-menu');

    if (!attr) return null;
    const v = String(attr).trim().toLowerCase();
    if (['on','true','1','enable','enabled','oui','actif','active'].includes(v))  return true;
    if (['off','false','0','disable','disabled','non','inactif','inactive'].includes(v)) return false;
    return null;
  }

  function bindGlobalOnce() {
    if (listenersBound) return;
    listenersBound = true;

    // (Espace réservé) : si un jour tu veux ajouter des listeners globaux pour le menu,
    // fais-le ici. Ils ne seront attachés qu’une seule fois.
    // Exemple : rien à faire pour l’instant.
  }

  function init(container = document) {
    bindGlobalOnce();

    // Si la page cible exprime une préférence via data-hover-menu, on l’applique.
    // Sinon on réapplique simplement l’état courant (utile après PJAX pour rétablir les classes).
    const inferred = inferActiveFrom(container);
    if (inferred === null) {
      applyState(OXY.hoverMenu.hoverActive);
    } else {
      applyState(inferred);
    }
  }

  // Expose un setter public pour piloter dynamiquement
  OXY.setHoverMenuActive = function(active) { applyState(active); };

  // Premier chargement
  document.addEventListener('DOMContentLoaded', () => init(document));

  // Rechargement logique après chaque navigation PJAX
  document.addEventListener('pjax:ready', (e) => {
    init(e.detail?.container || document);
  });

  // (Optionnel) Expose l’init si tu veux le rappeler manuellement
  window.initHoverMenuConfig = window.initHoverMenuConfig || init;
})();