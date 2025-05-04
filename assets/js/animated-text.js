// Attendre que le DOM soit compl�tement charg� avant d'ex�cuter le script
document.addEventListener("DOMContentLoaded", function () {
  // S�lectionne tous les conteneurs contenant du texte � animer
  const textBlocks = document.querySelectorAll(".animated-text");

  // ------------------------------------------------------------
  // 1) D�coupage du texte en mots individuels dans des <span>
  // ------------------------------------------------------------

  textBlocks.forEach((block) => {
    // Trouver tous les �l�ments de texte pertinents (titres, paragraphes, listes)
    const innerElements = block.querySelectorAll("h1, h2, h3, p, li");

    innerElements.forEach((el) => {
      // R�cup�rer le texte original et supprimer les espaces inutiles
      const text = el.textContent.trim();
      // Vider le contenu de l'�l�ment avant de le reconstruire
      el.textContent = "";

      // D�couper le texte en mots individuels
      const words = text.split(/\s+/);

      // Pour chaque mot, cr�er un <span> avec une classe d'animation
      words.forEach((word, i) => {
        const span = document.createElement("span");
        span.classList.add("anim-word"); // Ajouter la classe pour l'animation
        span.textContent = word;
        el.appendChild(span);

        // Ajouter un espace entre les mots (sauf pour le dernier)
        if (i < words.length - 1) {
          el.appendChild(document.createTextNode(" "));
        }
      });
    });
  });

  // ------------------------------------------------------------
  // 2) Animation des mots lorsqu'ils entrent ou sortent de l'�cran
  // ------------------------------------------------------------

  // Configuration de l'observation d'apparition des �l�ments (seuil de visibilit� 10%)
  const options = {
    threshold: 0.1,
  };

  // Cr�ation d'un Observer pour surveiller les �l�ments en viewport
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const container = entry.target;
      const animWords = container.querySelectorAll(".anim-word");

      if (entry.isIntersecting) {
        // Si l'�l�ment devient visible, animer chaque mot progressivement
        animWords.forEach((word, i) => {
          word.classList.remove("anim-out"); // Supprimer toute classe de sortie
          setTimeout(() => {
            word.classList.add("anim-in"); // Ajouter l'animation d'apparition
          }, i * 50); // D�lai progressif de 50ms par mot
        });
      } else {
        // Si l'�l�ment sort du viewport, on applique l'effet de disparition
        animWords.forEach((word) => {
          word.classList.remove("anim-in");
          word.classList.add("anim-out");
        });
      }
    });
  }, options);

  // Activer l'observation pour tous les blocs de texte anim�s
  textBlocks.forEach((block) => {
    observer.observe(block);
  });

  // ------------------------------------------------------------
  // 3) Gestion du clic sur un mot pour un effet lumineux temporaire (glow)
  // ------------------------------------------------------------

  document.body.addEventListener("click", function (e) {
    // V�rifie si l'�l�ment cliqu� est un mot anim�
    if (e.target.classList.contains("anim-word")) {
      const word = e.target;
      // Ajoute un effet "glow" temporaire au mot
      word.classList.add("click-glow");

      // Retire l'effet apr�s 500ms
      setTimeout(() => {
        word.classList.remove("click-glow");
      }, 500);
    }
  });
});
