document.addEventListener("DOMContentLoaded", () => {
  const card = document.querySelector(".card-comp");
  const fullText = card.querySelector(".full-text");
  const reduceBtn = card.querySelector(".reduce-btn");

  function expandCard() {
    card.classList.add("expanded");
    fullText.style.maxHeight = fullText.scrollHeight + "px";
    fullText.style.opacity = 1;
  }

  function collapseCard() {
    fullText.style.maxHeight = fullText.scrollHeight + "px";
    requestAnimationFrame(() => {
      card.classList.remove("expanded");
      fullText.style.maxHeight = "0px";
      fullText.style.opacity = 0;
    });
  }

  card.addEventListener("click", (e) => {
    if (!card.classList.contains("expanded")) {
      expandCard();
    }
  });

  reduceBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    collapseCard();
  });
});
