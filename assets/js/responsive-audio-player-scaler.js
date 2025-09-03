/**
 * ==========================================================
 * 🎧 RESPONSIVE AUDIO PLAYER SCALER — PJAX friendly
 * - S'initialise une seule fois
 * - Recalcule à chaque navigation PJAX + resize
 * - Tolérant si les éléments ne sont pas présents
 * ==========================================================
 */
(() => {
  'use strict';

  let boundOnce = false;

  function scalePlayer() {
    const wrapper = document.getElementById('responsiveWrapper');
    if (!wrapper) return; // rien à faire si le lecteur n'est pas dans le DOM

    // Le modal peut ne pas exister selon les pages → fallback sur wrapper
    const modal = wrapper.querySelector('.audio-player-modal') || wrapper;

    const originalWidth = 750; // largeur de référence (700 + marges)
    const viewportWidth =
      Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);

    // Facteur d’échelle borné entre 0.5 et 0.667
    let scaleFactor = Math.min(viewportWidth / originalWidth, 0.667);
    scaleFactor = Math.max(scaleFactor, 0.5);

    // Applique l’échelle + recentrage horizontal (suppose left:50% en CSS)
    wrapper.style.transform = `translateX(-50%) scale(${scaleFactor})`;

    // Ajustement adaptatif de la taille du texte (si présents)
    const minFontSize = 11;
    const trackTitle = modal.querySelector('#trackTitle');
    const time = modal.querySelector('.time');

    if (trackTitle) {
      trackTitle.style.fontSize =
        `${Math.max(minFontSize, (16 * scaleFactor) / 0.667)}px`;
    }
    if (time) {
      time.style.fontSize =
        `${Math.max(minFontSize, (14 * scaleFactor) / 0.667)}px`;
    }
  }

  function init(container = document) {
    // On initialise une seule fois les listeners globaux (resize)
    if (!boundOnce) {
      boundOnce = true;
      window.addEventListener('resize', scalePlayer, { passive: true });
    }
    // Recalcule immédiatement (après DOM ready / après PJAX)
    // Utilise rAF pour laisser le layout se stabiliser
    requestAnimationFrame(scalePlayer);
  }

  // Premier chargement
  document.addEventListener('DOMContentLoaded', () => init(document));

  // À chaque navigation PJAX (contenu remplacé)
  document.addEventListener('pjax:ready', (e) => {
    init(e.detail?.container || document);
  });

  // (Optionnel) expose une API si tu veux déclencher manuellement
  window.initAudioPlayerScaler = window.initAudioPlayerScaler || init;
  window.destroyAudioPlayerScaler = window.destroyAudioPlayerScaler || (() => {
    if (!boundOnce) return;
    window.removeEventListener('resize', scalePlayer);
    boundOnce = false;
  });
})();