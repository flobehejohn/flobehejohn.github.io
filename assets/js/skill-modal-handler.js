/**
 * 📌 Fonction pour afficher la carte de compétence (skill-card) en surimpression dans une modale
 *
 * Cette fonction prend en paramètre une carte de compétence et affiche son contenu
 * dans une fenêtre modale en récupérant :
 *  - Le titre de la carte
 *  - La description de la compétence
 *  - Les étoiles de notation
 *  - Les logos associés à la compétence
 *
 * @param {HTMLElement} card - L'élément HTML représentant la carte de compétence
 */
function openSkillModal(card) {
  const modal = document.getElementById("skill-modal"); // Sélection de la modale
  const modalBody = modal.querySelector(".modal-body"); // Récupération du contenu de la modale

  // Extraction des informations de la carte sélectionnée
  const skillTitle = card.querySelector("h3").textContent; // Récupérer le titre
  const skillDescription = card.querySelector("p").textContent; // Récupérer la description
  const skillRating = card.querySelector(".rating-stars").innerHTML; // Récupérer les étoiles

  // Récupération et construction des logos en HTML
  const logos = card.querySelectorAll(".software-logos img");
  let logosHTML = "";

  logos.forEach((logo) => {
    logosHTML += `<img src="${logo.src}" alt="${logo.alt}" class="modal-logo">`;
  });

  // Insère le contenu extrait dans la modale
  modalBody.innerHTML = `
        <div class="software-logos">${logosHTML}</div>
        <h3>${skillTitle}</h3>
        <p>${skillDescription}</p>
        <div class="rating-stars">${skillRating}</div>
    `;

  // Affichage de la modale en la rendant visible
  modal.style.display = "flex";
}

/**
 * 📌 Fonction pour fermer la modale
 *
 * Cette fonction masque la modale en lui appliquant un display "none".
 */
function closeSkillModal() {
  document.getElementById("skill-modal").style.display = "none";
}

/**
 * 📌 Ajout d'un gestionnaire d'événements au chargement de la page
 *
 * - Sélectionne toutes les cartes de compétences (skill-cards)
 * - Ajoute un événement `click` à chaque carte pour afficher la modale correspondante
 */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".skill-card").forEach((card) => {
    card.addEventListener("click", function () {
      openSkillModal(this); // Ouvre la modale en passant la carte sélectionnée
    });
  });
});
