// Attendre le chargement complet du DOM avant d'ex�cuter le script
document.addEventListener("DOMContentLoaded", () => {
  // S�lectionner toutes les cartes de comp�tences (skill-cards)
  const skillCards = document.querySelectorAll(".skill-card");

  // S�lectionner la modale et son contenu
  const modal = document.getElementById("skill-modal");
  const modalBody = modal.querySelector(".modal-body");

  /**
   * Fonction qui g�n�re l'affichage des �toiles de notation
   * @param {HTMLElement} container - L'�l�ment HTML o� afficher les �toiles
   * @param {number} rating - Note actuelle (de 1 � 5)
   * @param {string} color - Couleur des �toiles (par d�faut dor�)
   */
  const renderStars = (container, rating, color = "#FFD700") => {
    container.innerHTML = ""; // Vider le contenu avant de rajouter les �toiles
    for (let i = 1; i <= 5; i++) {
      let star = document.createElement("i");
      star.className = i <= rating ? "fas fa-star" : "far fa-star"; // �toile pleine ou vide
      star.style.color = i <= rating ? color : "#ddd"; // Couleur dor�e pour les �toiles actives, gris sinon
      container.appendChild(star);
    }
  };

  // Parcourir toutes les cartes de comp�tences
  skillCards.forEach((card) => {
    const defaultRating = parseFloat(
      card.closest("[data-rating]").dataset.rating,
    ); // Note par d�faut
    const starsContainer = card.querySelector(".rating-stars"); // Conteneur des �toiles
    const customRating = card.querySelector(".custom-rating"); // Zone affichant la note personnalis�e
    const logos = card.querySelectorAll(".software-logos .logo"); // Ic�nes des logiciels/outils
    const ratings = JSON.parse(card.dataset.toolRatings); // Obtenir les notes associ�es aux outils

    // Initialiser l'affichage des �toiles avec la note par d�faut
    renderStars(starsContainer, defaultRating);

    /**
     * R�initialiser l'affichage � la note par d�faut lorsqu'on quitte une interaction avec un logo
     */
    const resetToDefault = () => {
      logos.forEach((l) => l.classList.remove("selected")); // D�s�lectionner les logos
      customRating.classList.remove("show"); // Masquer l'affichage de la note personnalis�e
      renderStars(starsContainer, defaultRating); // Remettre la note initiale
    };

    /**
     * Fonction qui affiche la modale avec les informations d�taill�es de la carte s�lectionn�e
     */
    const openSkillModal = () => {
      modalBody.innerHTML = `
                <div class="software-logos">${card.querySelector(".software-logos").innerHTML}</div>
                <h3>${card.querySelector("h3").textContent}</h3>
                <p>${card.querySelector("p").innerHTML}</p>
                <div class="rating-stars"></div>
                <div class="custom-rating"><span class="tool-name"></span></div>
            `;

      // S�lectionner les �l�ments dans la modale
      const modalStars = modalBody.querySelector(".rating-stars");
      const modalCustomRating = modalBody.querySelector(".custom-rating");
      const modalLogos = modalBody.querySelectorAll(".software-logos .logo");

      // Initialiser l'affichage des �toiles dans la modale
      renderStars(modalStars, defaultRating);
      modal.style.display = "flex"; // Afficher la modale

      // Ajouter un �v�nement de clic sur chaque logo dans la modale pour afficher sa note
      modalLogos.forEach((logo) => {
        logo.addEventListener("click", (e) => {
          e.stopPropagation(); // Emp�cher la fermeture involontaire
          modalLogos.forEach((l) => l.classList.remove("selected"));
          logo.classList.add("selected");

          const rating = ratings[logo.alt] || defaultRating;
          renderStars(modalStars, rating, "#FF0000"); // �toiles rouges pour la s�lection
          modalCustomRating.querySelector(".tool-name").textContent =
            `${logo.alt} (${rating}/5)`;
          modalCustomRating.classList.add("show");
        });
      });

      // Si on clique ailleurs que sur un logo, on r�initialise
      modalBody.addEventListener("click", (e) => {
        if (!e.target.classList.contains("logo")) {
          modalLogos.forEach((l) => l.classList.remove("selected"));
          renderStars(modalStars, defaultRating);
          modalCustomRating.classList.remove("show");
        }
      });
    };

    // Ajouter des interactions pour survol et clic sur les logos de chaque carte
    logos.forEach((logo) => {
      if (window.matchMedia("(hover:hover)").matches) {
        // Survol d'un logo : afficher sa note sp�cifique
        logo.addEventListener("mouseenter", () => {
          logos.forEach((l) => l.classList.remove("selected"));
          logo.classList.add("selected");

          const rating = ratings[logo.alt] || defaultRating;
          customRating.querySelector(".tool-name").textContent =
            `${logo.alt} (${rating}/5)`;
          customRating.classList.add("show");
          renderStars(starsContainer, rating, "#FF0000");
        });

        // Quand la souris quitte l'�l�ment, on r�initialise
        logo.addEventListener("mouseleave", resetToDefault);
      }

      // Clic sur un logo : afficher sa note
      logo.addEventListener("click", (e) => {
        e.stopPropagation();
        logos.forEach((l) => l.classList.remove("selected"));
        logo.classList.add("selected");

        const rating = ratings[logo.alt] || defaultRating;
        customRating.querySelector(".tool-name").textContent =
          `${logo.alt} (${rating}/5)`;
        customRating.classList.add("show");
        renderStars(starsContainer, rating, "#FF0000");
      });
    });

    // Clic sur la carte pour ouvrir la modale
    card.addEventListener("click", openSkillModal);
  });

  // Gestion de la fermeture de la modale
  const closeSkillModal = () => (modal.style.display = "none");

  // Fermer la modale si on clique en dehors de son contenu
  modal.addEventListener("click", closeSkillModal);
  modal
    .querySelector(".modal-content")
    .addEventListener("click", (e) => e.stopPropagation());
});
