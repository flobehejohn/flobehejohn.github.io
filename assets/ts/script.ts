declare var Isotope: any;

document.addEventListener("DOMContentLoaded", () => {
  const isoGrid = document.querySelector(".grid") as HTMLElement;

  if (isoGrid) {
    const iso = new Isotope(isoGrid, {
      itemSelector: ".grid-item",
      layoutMode: "fitRows",
      getSortData: {
        rating: (itemElem: HTMLElement): number => {
          const rating = itemElem.getAttribute("data-rating");
          return rating ? parseFloat(rating) : 0;
        },
      },
    });

    document.querySelectorAll(".filters button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const filterValue = btn.getAttribute("data-filter") || "*";
        iso.arrange({ filter: filterValue });
      });
    });

    document.querySelectorAll(".sorters button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sortByValue =
          btn.getAttribute("data-sort-by") || "original-order";
        const sortAscending = btn.getAttribute("data-sort-order") !== "desc";
        iso.arrange({ sortBy: sortByValue, sortAscending: sortAscending });
      });
    });
  }

  document.querySelectorAll(".card-comp").forEach((card) => {
    const expandBtn = card.querySelector(".expand-btn") as HTMLElement;
    const reduceBtn = card.querySelector(".reduce-btn") as HTMLElement;
    const fullText = card.querySelector(".full-text") as HTMLElement;

    fullText.style.display = "none";
    fullText.style.opacity = "0";
    expandBtn.style.display = "block";

    expandBtn.onclick = () => {
      fullText.style.display = "block";
      requestAnimationFrame(() => (fullText.style.opacity = "1"));
      expandBtn.style.display = "none";
    };

    reduceBtn.onclick = () => {
      fullText.style.opacity = "0";
      setTimeout(() => {
        fullText.style.display = "none";
        expandBtn.style.display = "block";
      }, 300);
    };
  });
});
