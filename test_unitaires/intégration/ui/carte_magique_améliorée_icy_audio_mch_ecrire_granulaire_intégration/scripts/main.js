import {
  playOpenSound,
  playCloseSound,
  playTypingClick,
  playHoverSound,
  initAudio,
} from "./audioFunctions.js";

import { typeWriter } from "./animationHelpers.js";

document.addEventListener("DOMContentLoaded", () => {
  initAudio();

  const cards = [...document.querySelectorAll(".card-comp")];
  const stateMap = new Map(); // stocke état open/fermé
  const originalTexts = new Map(); // stocke texte initial

  cards.forEach((card, index) => {
    const textEl = card.querySelector(".magic-text");
    const closeBtn = card.querySelector(".close-btn");

    // On garde le HTML initial avec les balises <strong>
    const originalText = textEl.innerHTML;
    originalTexts.set(card, originalText);
    stateMap.set(card, false); // état initial : fermé

    card.addEventListener("click", () => {
      const isOpen = stateMap.get(card);

      if (!isOpen) {
        card.classList.add("expanded", "scintillate");
        playOpenSound();
        textEl.innerHTML = "";

        // Effet plastique sur la carte voisine
        const isPair = index % 2 === 0;
        const neighbor = isPair ? cards[index + 1] : cards[index - 1];

        if (neighbor) {
          neighbor.classList.add("opening-sibling");
          setTimeout(() => neighbor.classList.remove("opening-sibling"), 700);
        }

        // Animation texte ultra fluide
        typeWriter(
          textEl,
          originalText,
          () => {
            card.classList.add("show-close");
          },
          1.25,
        ); // vitesse ralentie pour lisibilité

        setTimeout(() => card.classList.remove("scintillate"), 700);
        stateMap.set(card, true);
      }
    });

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      const isOpen = stateMap.get(card);
      if (isOpen) {
        playCloseSound();
        card.classList.remove("expanded", "show-close");
        textEl.innerHTML = originalTexts.get(card);
        stateMap.set(card, false);
      }
    });

    // Hover et interaction
    card.addEventListener("mouseenter", playHoverSound);
    card.addEventListener("mouseover", playTypingClick);
  });
});
