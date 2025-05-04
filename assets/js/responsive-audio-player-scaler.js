/**
 * ============================================
 * 🎧 RESPONSIVE AUDIO PLAYER SCALER
 * Ajuste dynamiquement l'échelle du lecteur audio modal
 * pour qu'il reste lisible, centré et proportionné sur tous les écrans.
 * ============================================
 */

function scalePlayer() {
  const wrapper = document.getElementById("responsiveWrapper");
  const modal = wrapper.querySelector(".audio-player-modal");

  const originalWidth = 750; // Largeur de référence (700px + marges latérales)
  const viewportWidth = window.innerWidth;

  // ✅ Calcul du facteur d’échelle en fonction de la largeur du viewport
  // Limite supérieure forcée à 0.667 (réduction par défaut à ~66%)
  let scaleFactor = Math.min(viewportWidth / originalWidth, 0.667);

  // ✅ Protection : limite inférieure pour éviter un lecteur trop petit
  scaleFactor = Math.max(scaleFactor, 0.5);

  // ✅ Application de l’échelle et recentrage horizontal
  wrapper.style.transform = `translateX(-50%) scale(${scaleFactor})`;

  // ✅ Ajustement adaptatif de la taille du texte
  const minFontSize = 11;
  const trackTitle = modal.querySelector("#trackTitle");
  const time = modal.querySelector(".time");

  // Calcul dynamique des tailles minimales pour éviter une lisibilité réduite
  trackTitle.style.fontSize = `${Math.max(minFontSize, (16 * scaleFactor) / 0.667)}px`;
  time.style.fontSize = `${Math.max(minFontSize, (14 * scaleFactor) / 0.667)}px`;
}

// ✅ Lancement de la fonction à chaque redimensionnement ou au chargement
window.addEventListener("resize", scalePlayer);
window.addEventListener("DOMContentLoaded", scalePlayer);
