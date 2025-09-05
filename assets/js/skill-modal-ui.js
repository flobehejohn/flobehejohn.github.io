/**
 * 📌 Fonction pour créer dynamiquement la structure HTML de la modale "Skill Modal"
 *
 * Cette fonction injecte une boîte modale dans le DOM si elle n'existe pas encore.
 * La modale contient :
 *  - Un overlay pour détecter les clics en dehors de la boîte de dialogue
 *  - Un conteneur pour afficher le contenu détaillé de la carte de compétence
 *  - Un bouton de fermeture (×)
 */
function createSkillModal() {
  // Vérifie si la modale existe déjà pour éviter les doublons
  if (document.getElementById("skill-modal")) return;

  // Création de l'élément div principal pour la modale
  const modalOverlay = document.createElement("div");
  modalOverlay.id = "skill-modal";
  modalOverlay.classList.add("modal-overlay");

  // Ajout d'un événement pour fermer la modale lorsqu'on clique sur l'overlay
  modalOverlay.addEventListener("click", closeSkillModal);

  // Création du conteneur interne de la modale
  const modalContent = document.createElement("div");
  modalContent.classList.add("modal-content");

  // Empêche la fermeture de la modale lorsqu'on clique à l'intérieur du contenu
  modalContent.addEventListener("click", (event) => event.stopPropagation());

  // Création du bouton de fermeture (×)
  const closeButton = document.createElement("span");
  closeButton.classList.add("close-btn");
  closeButton.innerHTML = "&times;"; // Symbole de fermeture
  closeButton.addEventListener("click", closeSkillModal); // Fermeture au clic

  // Création du conteneur pour le contenu dynamique de la modale
  const modalBody = document.createElement("div");
  modalBody.classList.add("modal-body");

  // Ajout des éléments enfants à la modale
  modalContent.appendChild(closeButton);
  modalContent.appendChild(modalBody);
  modalOverlay.appendChild(modalContent);

  // Ajout de la modale complète au body du document
  document.body.appendChild(modalOverlay);
}

/**
 * 📌 Fonction pour fermer la modale en la masquant
 *
 * Cette fonction définit `display: none` pour masquer la modale
 * lorsqu'on clique sur l'overlay ou sur le bouton de fermeture.
 */
function closeSkillModal() {
  const modal = document.getElementById("skill-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

/**
 * 📌 Fonction pour ouvrir la modale
 *
 * - Vérifie si la modale existe, sinon elle est créée dynamiquement
 * - Affiche la modale en changeant son `display`
 */
function openSkillModal() {
  createSkillModal(); // Crée la modale si elle n'existe pas encore
  document.getElementById("skill-modal").style.display = "flex"; // Affiche la modale
}

// Génération automatique de la modale au chargement du DOM
document.addEventListener("DOMContentLoaded", createSkillModal);
