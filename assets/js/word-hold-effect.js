// Attendre que le DOM soit complètement chargé avant d'exécuter le script
document.addEventListener("DOMContentLoaded", function () {
  // Sélectionner tous les mots animés qui ont la classe "anim-word"
  const words = document.querySelectorAll(".anim-word");

  // Parcourir tous les mots animés
  words.forEach((word) => {
    let holdTimeout; // Variable pour stocker le délai d'activation de l'effet

    /**
     * 📌 Événement "mousedown" (clic maintenu sur un mot)
     * - Si l'utilisateur maintient le clic pendant 500ms, on applique l'effet "held"
     */
    word.addEventListener("mousedown", function () {
      holdTimeout = setTimeout(() => {
        word.classList.add("held"); // Ajoute la classe qui déclenche l'effet
      }, 500); // Délai de 500ms avant d'ajouter l'effet
    });

    /**
     * 📌 Événement "mouseup" (relâchement du clic)
     * - Dès que l'utilisateur relâche le clic, on annule l'effet "held"
     */
    word.addEventListener("mouseup", function () {
      clearTimeout(holdTimeout); // Annule le délai si le clic est relâché avant 500ms
      word.classList.remove("held"); // Supprime la classe "held" immédiatement
    });

    /**
     * 📌 Événement "mouseleave" (sortie de la souris hors du mot)
     * - Si l'utilisateur quitte le mot avec la souris avant la fin du délai, l'effet est annulé
     */
    word.addEventListener("mouseleave", function () {
      clearTimeout(holdTimeout); // Empêche l'effet si la souris sort du mot avant 500ms
      word.classList.remove("held"); // Supprime l'effet si déjà appliqué
    });
  });
});
