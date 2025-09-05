/**
 * 📌 Gestion des cartes de compétences (skill-card) et affichage des modales
 *
 * Ce script permet :
 * - D'afficher une modale contenant les détails d'une skill-card au clic
 * - De gérer l'affichage des étoiles de notation dynamiquement
 * - D'afficher la note spécifique d'un logiciel/tool lorsqu'on survole son logo
 * - De fermer la modale proprement lorsqu'on clique en dehors
 */

document.addEventListener("DOMContentLoaded", () => {
  // Sélectionne toutes les skill-cards
  const skillCards = document.querySelectorAll(".skill-card");
  // Sélectionne la modale de détail et son contenu
  const modal = document.getElementById("skill-modal");
  const modalBody = modal.querySelector(".modal-body");

  /**
   * 📌 Fonction pour générer l'affichage des étoiles en fonction d'une note donnée
   *
   * @param {HTMLElement} container - L'élément HTML où afficher les étoiles
   * @param {number} rating - Note actuelle (de 1 à 5)
   * @param {string} color - Couleur des étoiles (par défaut doré)
   */
  const renderStars = (container, rating, color = "#FFD700") => {
    container.innerHTML = ""; // Vide l'affichage précédent
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement("i");
      if (rating >= i)
        star.className = "fas fa-star"; // Étoile pleine
      else if (rating >= i - 0.5)
        star.className = "fas fa-star-half-alt"; // Demi-étoile
      else star.className = "far fa-star"; // Étoile vide
      star.style.color = color; // Définit la couleur des étoiles
      container.appendChild(star);
    }
  };

  // Parcourt toutes les skill-cards pour ajouter les interactions
  skillCards.forEach((card) => {
    const defaultRating = parseFloat(
      card.closest("[data-rating]").dataset.rating,
    ); // Note par défaut
    const starsContainer = card.querySelector(".rating-stars"); // Conteneur des étoiles
    const customRating = card.querySelector(".custom-rating"); // Zone d'affichage de la note spécifique
    const logos = card.querySelectorAll(".software-logos .logo"); // Logos des outils associés
    const ratings = JSON.parse(card.dataset.toolRatings); // Obtenir les notes des outils associés

    /**
     * 📌 Fonction pour réinitialiser l'affichage à la note par défaut
     */
    const resetToDefault = () => {
      logos.forEach((l) => l.classList.remove("selected")); // Désélectionner les logos
      customRating.classList.remove("show"); // Masquer l'affichage de la note personnalisée
      customRating.querySelector(".tool-name").textContent = ""; // Vider le texte
      renderStars(starsContainer, defaultRating); // Réafficher la note par défaut
    };

    /**
     * 📌 Fonction pour ouvrir la modale de détail d'une skill-card
     */
    const openSkillModal = () => {
      modalBody.innerHTML = `
                <div class="software-logos">${card.querySelector(".software-logos").innerHTML}</div>
                <h3>${card.querySelector("h3").textContent}</h3>
                <p>${card.querySelector("p").innerHTML}</p>
                <div class="rating-stars"></div>
                <div class="custom-rating"><span class="tool-name"></span></div>
            `;

      // Sélection des éléments dans la modale
      const modalStars = modalBody.querySelector(".rating-stars");
      const modalCustomRating = modalBody.querySelector(".custom-rating");
      const modalLogos = modalBody.querySelectorAll(".software-logos .logo");

      // Initialiser l'affichage des étoiles dans la modale
      renderStars(modalStars, defaultRating);
      modal.style.display = "flex"; // Afficher la modale

      // Ajoute un événement de clic sur chaque logo dans la modale pour afficher sa note
      modalLogos.forEach((logo) => {
        logo.addEventListener("click", (e) => {
          e.stopPropagation(); // Empêcher la fermeture involontaire
          modalLogos.forEach((l) => l.classList.remove("selected"));
          logo.classList.add("selected");

          const rating = ratings[logo.alt] || defaultRating;
          renderStars(modalStars, rating, "#FF0000"); // Étoiles rouges pour la sélection
          modalCustomRating.querySelector(".tool-name").textContent =
            `${logo.alt} (${rating}/5)`;
          modalCustomRating.classList.add("show");
        });
      });

      // Si on clique ailleurs que sur un logo, on réinitialise
      modalBody.addEventListener("click", (e) => {
        if (!e.target.classList.contains("logo")) {
          modalLogos.forEach((l) => l.classList.remove("selected"));
          renderStars(modalStars, defaultRating);
          modalCustomRating.classList.remove("show");
          modalCustomRating.querySelector(".tool-name").textContent = "";
        }
      });
    };

    // Initialisation de l'affichage des étoiles avec la note par défaut
    renderStars(starsContainer, defaultRating);

    /**
     * 📌 Gestion des interactions sur les logos des outils
     */
    if (window.matchMedia("(hover: hover)").matches) {
      logos.forEach((logo) => {
        // Survol d'un logo : affiche sa note spécifique
        logo.addEventListener("mouseenter", () => {
          logos.forEach((l) => l.classList.remove("selected"));
          logo.classList.add("selected");

          const rating = ratings[logo.alt] || defaultRating;
          renderStars(starsContainer, rating, "#FF0000"); // Étoiles rouges pour le survol
          customRating.querySelector(".tool-name").textContent =
            `${logo.alt} (${rating}/5)`;
          customRating.classList.add("show");
        });

        // Quitter le logo : on réinitialise l'affichage
        logo.addEventListener("mouseleave", resetToDefault);

        // Clic sur un logo : fixer la note affichée
        logo.addEventListener("click", (e) => {
          e.stopPropagation();
          logos.forEach((l) => l.classList.remove("selected"));
          logo.classList.add("selected");

          const rating = ratings[logo.alt] || defaultRating;
          renderStars(starsContainer, rating, "#FF0000");
          customRating.querySelector(".tool-name").textContent =
            `${logo.alt} (${rating}/5)`;
          customRating.classList.add("show");
        });
      });

      // Ouvre la modale au clic sur une carte
      card.addEventListener("click", openSkillModal);
    } else {
      card.addEventListener("click", openSkillModal);
    }
  });

  /**
   * 📌 Fonction pour fermer la modale
   */
  const closeSkillModal = () => (modal.style.display = "none");

  // Fermer la modale en cliquant sur l'overlay
  modal.addEventListener("click", closeSkillModal);
  modalBody.addEventListener("click", (e) => e.stopPropagation());
});
