document.addEventListener("DOMContentLoaded", () => {
  const card = document.getElementById("magicCard");
  const fullText = card.querySelector(".full-text");
  const reduceBtn = card.querySelector(".reduce-btn");

  let animationFrame;
  let isExpanded = false;

  const expand = () => {
    card.classList.add("expanded");
    fullText.style.maxHeight = fullText.scrollHeight + "px";
    isExpanded = true;
  };

  const collapse = () => {
    fullText.style.maxHeight = fullText.scrollHeight + "px";
    requestAnimationFrame(() => {
      fullText.style.maxHeight = "0px";
      card.classList.remove("expanded");
    });
    isExpanded = false;
  };

  // Expansion au clic sur la carte
  card.addEventListener("click", (e) => {
    if (e.target === reduceBtn) return;
    if (!isExpanded) {
      expand();
    }
  });

  // Fermeture via bouton
  reduceBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    collapse();
  });
});
