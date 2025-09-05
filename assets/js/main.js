document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".magic-grid .card-comp");

  if (!cards.length) {
    console.warn("❌ Aucune carte détectée dans .magic-grid !");
    return;
  }

  console.log(`🎯 ${cards.length} cartes détectées dans .magic-grid`);

  cards.forEach((card, index) => {
    const fullText = card.querySelector(".full-text");
    const closeBtn = card.querySelector(".close-btn");

    if (!fullText || !closeBtn) {
      console.error(
        `⚠️ Carte ${index + 1} mal configurée : vérifie ".full-text" ou ".close-btn"`,
      );
      return;
    }

    // Fonction d'ouverture
    const openCard = () => {
      // Ferme les autres cartes
      cards.forEach((c, i) => {
        if (i !== index) {
          c.classList.remove(
            "expanded",
            "scintillate",
            "show-close",
            "opening-sibling",
          );
          c.querySelector(".full-text").style.maxHeight = null;
        }
      });

      // Ouvre la carte cliquée
      card.classList.add("expanded", "scintillate", "show-close");
      fullText.style.display = "block";
      requestAnimationFrame(() => {
        fullText.style.maxHeight = fullText.scrollHeight + "px";
        fullText.style.opacity = 1;
      });

      // Effet plastique sur les autres cartes
      cards.forEach((c, i) => {
        if (i !== index) c.classList.add("opening-sibling");
      });
    };

    // Fonction de fermeture
    const closeCard = (event) => {
      event.stopPropagation();
      card.classList.remove("expanded", "scintillate", "show-close");
      fullText.style.maxHeight = null;
      fullText.style.opacity = 0;

      // Enlever effet plastique des autres cartes
      cards.forEach((c) => c.classList.remove("opening-sibling"));
    };

    // Écouteurs d'événements
    card.addEventListener("click", openCard);
    closeBtn.addEventListener("click", closeCard);
  });

  // Option : démo auto au chargement
  setTimeout(() => cards[0]?.click(), 800);
});
