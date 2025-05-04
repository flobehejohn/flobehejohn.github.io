/**
 * 📌 Variable globale pour stocker la position du scroll avant l'ouverture de la modale
 */
let lastScrollPosition = 0;

/**
 * 📌 Fonction pour afficher la carte de compétence (Skill Card) en surimpression
 *
 * Cette fonction :
 * - Sauvegarde la position du scroll avant ouverture de la modale
 * - Empêche le scroll de l'arrière-plan lorsque la modale est ouverte
 * - Récupère les informations de la carte (titre, description, étoiles, logos)
 * - Insère ces informations dans la modale et l'affiche
 *
 * @param {HTMLElement} card - L'élément HTML représentant la carte de compétence
 */
function openSkillModal(card) {
  const modal = document.getElementById("skill-modal"); // Sélection de la modale
  const modalBody = modal.querySelector(".modal-body"); // Récupération du contenu de la modale

  // Sauvegarde de la position actuelle du scroll pour restauration après fermeture
  lastScrollPosition = window.scrollY || document.documentElement.scrollTop;

  // Empêche le scroll de l'arrière-plan en ajoutant une classe CSS spécifique
  document.body.classList.add("modal-open");

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
 * 📌 Fonction pour fermer la modale et restaurer la position de défilement
 *
 * Cette fonction :
 * - Réactive le scroll de l'arrière-plan après fermeture
 * - Masque la modale en appliquant `display: none`
 * - Restaure la position du scroll pour éviter que l'utilisateur soit ramené en haut de la page
 */
function closeSkillModal() {
  const modal = document.getElementById("skill-modal");

  // Réactive le scroll de l'arrière-plan
  document.body.classList.remove("modal-open");

  // Masque la modale
  modal.style.display = "none";

  // Restaure la position de scroll après fermeture pour éviter un retour en haut
  window.scrollTo({ top: lastScrollPosition, behavior: "instant" });
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
