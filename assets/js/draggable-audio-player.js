/**
 * ============================================
 * 🎧 DRAGGABLE AUDIO PLAYER
 * Permet de déplacer manuellement le lecteur audio sur grand écran
 * Comporte une désactivation automatique sur mobile (< 768px)
 * ============================================
 */

document.addEventListener("DOMContentLoaded", () => {
  const wrapper = document.getElementById("responsiveWrapper"); // Conteneur principal du lecteur
  const dragBar = document.getElementById("dragBar"); // Barre à utiliser comme poignée de déplacement
  const mediaQuery = window.matchMedia("(max-width: 768px)"); // Ciblage mobile

  let isDragging = false; // État du glissement
  let offsetX = 0,
    offsetY = 0; // Décalage entre la souris et le coin du conteneur

  /**
   * ✅ Active le déplacement du lecteur (version desktop uniquement)
   */
  function enableDrag() {
    dragBar.style.cursor = "grab";
    dragBar.addEventListener("mousedown", startDrag);
    document.addEventListener("mouseup", stopDrag);
    document.addEventListener("mousemove", drag);
  }

  /**
   * ❌ Désactive le déplacement en mode mobile ou à la demande
   */
  function disableDrag() {
    dragBar.style.cursor = "default";
    dragBar.removeEventListener("mousedown", startDrag);
    document.removeEventListener("mouseup", stopDrag);
    document.removeEventListener("mousemove", drag);

    // Repositionne proprement le lecteur en bas-centre
    wrapper.style.bottom = "20px";
    wrapper.style.left = "50%";
    wrapper.style.top = "";
    wrapper.style.right = "";
    wrapper.style.transform = "translateX(-50%) scale(1)";
  }

  /**
   * 🔓 Au clic sur la dragBar : mémorise le point de départ
   */
  function startDrag(e) {
    if (e.button !== 0) return; // Ne réagit qu’au clic gauche
    isDragging = true;
    const rect = wrapper.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    wrapper.dataset.prevTransform = getComputedStyle(wrapper).transform; // Sauvegarde du transform initial
    document.body.style.userSelect = "none"; // Empêche la sélection de texte
  }

  /**
   * ✋ Pendant le glissement : applique la position en temps réel
   */
  function drag(e) {
    if (!isDragging) return;
    wrapper.style.left = `${e.clientX - offsetX}px`;
    wrapper.style.top = `${e.clientY - offsetY}px`;
    wrapper.style.bottom = ""; // Annule l’ancrage bas
    wrapper.style.transform =
      wrapper.dataset.prevTransform || "translateX(-50%)";
  }

  /**
   * 🛑 Fin du glissement
   */
  function stopDrag() {
    isDragging = false;
    document.body.style.userSelect = "";
  }

  /**
   * 🔁 Active ou désactive le drag selon la taille d’écran
   */
  function updateDragBehavior() {
    if (mediaQuery.matches) {
      disableDrag(); // Mobile : désactivé
    } else {
      enableDrag(); // Desktop : activé
    }
  }

  // Réagit automatiquement au changement de taille d’écran
  mediaQuery.addEventListener("change", updateDragBehavior);

  // État initial au chargement
  updateDragBehavior();
});
