/**
 * 📌 Gestion de la modale pour afficher et télécharger le CV
 */
document.addEventListener("DOMContentLoaded", function () {
  const cvModal = document.getElementById("cv-modal");
  const openCvBtn = document.getElementById("open-cv-modal");
  const closeCvBtn = document.getElementById("close-cv-modal");

  /**
   * 📌 Fonction pour ouvrir la fenêtre modale du CV
   */
  function openCvModal() {
    cvModal.style.display = "flex"; // Affiche la modale
    document.body.classList.add("modal-open"); // Empêche le scroll de fond
  }

  /**
   * 📌 Fonction pour fermer la fenêtre modale du CV
   */
  function closeCvModal() {
    cvModal.style.display = "none"; // Cache la modale
    document.body.classList.remove("modal-open"); // Réactive le scroll de fond
  }

  // Événement : Ouverture de la modale
  openCvBtn.addEventListener("click", openCvModal);

  // Événement : Fermeture de la modale via le bouton (×)
  closeCvBtn.addEventListener("click", closeCvModal);

  // Fermer la modale en cliquant sur l’overlay
  cvModal.addEventListener("click", function (e) {
    if (e.target === cvModal) {
      closeCvModal();
    }
  });
});
