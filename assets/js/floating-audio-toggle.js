/**
 * ========================================================
 * 🎧 GESTION DU BOUTON FLOTTANT DU LECTEUR AUDIO
 * - Affichage / masquage du lecteur (responsiveWrapper)
 * - Gestion des états visuels du bouton (halo, taille)
 * - Centralisation propre de la logique d’interaction
 * ========================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  // 🎯 Ciblage des éléments DOM
  const playerWrapper = document.getElementById("responsiveWrapper"); // Conteneur principal du lecteur
  const toggleButton = document.getElementById("openAudioPlayer"); // Bouton flottant pour ouvrir
  const closeBtn = document.getElementById("closePlayerModal"); // Bouton de fermeture dans le lecteur
  const audio = document.getElementById("audioPlayer"); // Balise <audio> elle-même

  // 🧼 Sécurité : ne rien faire si les éléments critiques sont manquants
  if (!playerWrapper || !toggleButton || !audio) return;

  // 🔒 Masquer au chargement (si pas déjà fait en CSS)
  playerWrapper.style.display = "none";

  // 🔄 État interne de visibilité
  let isPlayerVisible = false;

  /**
   * ✅ Fonction d’affichage du lecteur
   * - Affiche le conteneur
   * - Active les styles (halo, scale, etc.)
   */
  function showPlayer() {
    playerWrapper.style.display = "flex";
    playerWrapper.classList.add("is-open");
    toggleButton.classList.add("active");
    isPlayerVisible = true;
  }

  /**
   * ✅ Fonction de masquage du lecteur
   * - Cache complètement la modal
   * - Réinitialise l’état visuel du bouton
   */
  function hidePlayer() {
    playerWrapper.style.display = "none";
    playerWrapper.classList.remove("is-open");
    toggleButton.classList.remove("active");
    isPlayerVisible = false;
  }

  /**
   * 🔁 Fonction toggle (clic sur l’icône)
   */
  function togglePlayerVisibility() {
    isPlayerVisible ? hidePlayer() : showPlayer();
  }

  /**
   * 🎛️ Gestion des événements utilisateur
   */
  toggleButton.addEventListener("click", togglePlayerVisibility); // Ouverture via bouton flottant

  if (closeBtn) {
    closeBtn.addEventListener("click", hidePlayer); // Fermeture via bouton "X"
  }

  /**
   * ✨ État visuel en fonction de la lecture audio
   */
  audio.addEventListener("play", () => {
    toggleButton.classList.add("playing", "large"); // Halo et zoom
  });

  audio.addEventListener("pause", () => {
    toggleButton.classList.remove("playing"); // Arrêt halo
  });

  audio.addEventListener("ended", () => {
    toggleButton.classList.remove("playing"); // Reset à la fin du morceau
  });

  /**
   * 🎯 Reset initial (évite ouverture auto au démarrage)
   * Affiche puis masque instantanément le lecteur pour garantir un état propre
   */
  showPlayer();
  hidePlayer();
});
