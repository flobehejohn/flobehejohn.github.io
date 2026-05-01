// ✅ Script robuste pour gestion du bouton d'ouverture/fermeture du lecteur audio

// Ne pas mélanger la logique d'ouverture dans deux fichiers différents
// On centralise ici tout dans un seul bloc cohérent

document.addEventListener("DOMContentLoaded", () => {
  const playerWrapper = document.getElementById("responsiveWrapper");
  const toggleButton = document.getElementById("openAudioPlayer");
  const closeBtn = document.getElementById("closePlayerModal");
  const audio = document.getElementById("audioPlayer");

  // ✅ Masquer au démarrage (déjà fait en CSS si nécessaire)
  playerWrapper.style.display = "none";
  let isPlayerVisible = false;

  // ✅ Fonction d'affichage du lecteur audio
  function showPlayer() {
    playerWrapper.style.display = "flex";
    playerWrapper.classList.add("is-open");
    toggleButton.classList.add("active");
    isPlayerVisible = true;
  }

  // ✅ Fonction de masquage du lecteur audio
  function hidePlayer() {
    playerWrapper.style.display = "none";
    playerWrapper.classList.remove("is-open");
    toggleButton.classList.remove("active");
    isPlayerVisible = false;
  }

  // ✅ Toggle général
  function togglePlayerVisibility() {
    isPlayerVisible ? hidePlayer() : showPlayer();
  }

  // ✅ Clic sur l'icône flottante
  toggleButton.addEventListener("click", togglePlayerVisibility);

  // ✅ Clic sur le bouton de fermeture
  if (closeBtn) {
    closeBtn.addEventListener("click", hidePlayer);
  }

  // ✅ Gérer halo lumineux et taille sur état lecture
  audio.addEventListener("play", () => {
    toggleButton.classList.add("playing", "large");
  });

  audio.addEventListener("pause", () => {
    toggleButton.classList.remove("playing");
  });

  audio.addEventListener("ended", () => {
    toggleButton.classList.remove("playing");
  });

  // ✅ Réinitialiser taille / état visuel à chaque ouverture
  showPlayer();
  hidePlayer();
});
