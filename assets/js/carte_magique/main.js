import { typeWriter } from "./animationHelpers.js";
import {
  initAudio,
  playCloseSound,
  playHoverSound,
  playOpenSound,
  playTypingClick,
} from "./audioFunctions.js";

// ⚡️ Version ultra-compatible avec .mgc-* (magic grid, card, etc.)
document.addEventListener("DOMContentLoaded", () => {
  initAudio();

  // ➔ Sélectionne toutes les cartes selon le nouveau nommage
  const cards = [...document.querySelectorAll(".mgc-card")];
  const stateMap = new Map(); // stocke état open/fermé
  const originalTexts = new Map(); // stocke texte initial

  cards.forEach((card, index) => {
    // Sélectionne le bon texte et le bouton selon le nouveau nommage
    const textEl = card.querySelector(".mgc-magic-text");
    const closeBtn = card.querySelector(".mgc-close-btn");

    // Stocke le texte HTML initial (avec <strong>)
    const originalText = textEl.innerHTML;
    originalTexts.set(card, originalText);
    stateMap.set(card, false); // état initial : fermé

    card.addEventListener("click", () => {
      const isOpen = stateMap.get(card);

      if (!isOpen) {
        card.classList.add("mgc-expanded", "mgc-scintillate");
        playOpenSound();
        textEl.innerHTML = "";

        // Effet plastique sur la carte voisine (même logique)
        const isPair = index % 2 === 0;
        const neighbor = isPair ? cards[index + 1] : cards[index - 1];

        if (neighbor) {
          neighbor.classList.add("mgc-opening-sibling");
          setTimeout(() => neighbor.classList.remove("mgc-opening-sibling"), 700);
        }

        // Animation machine à écrire fluide
        typeWriter(
          textEl,
          originalText,
          () => {
            card.classList.add("mgc-show-close");
          },
          1.25 // vitesse adaptée
        );

        setTimeout(() => card.classList.remove("mgc-scintillate"), 700);
        stateMap.set(card, true);
      }
    });

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      const isOpen = stateMap.get(card);
      if (isOpen) {
        playCloseSound();
        card.classList.remove("mgc-expanded", "mgc-show-close");
        textEl.innerHTML = originalTexts.get(card);
        stateMap.set(card, false);
      }
    });

    // Hover et interaction sonore
    card.addEventListener("mouseenter", playHoverSound);
    card.addEventListener("mouseover", playTypingClick);
  });
});
