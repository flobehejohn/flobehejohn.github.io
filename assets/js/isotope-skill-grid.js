/**
 * ========================================================
 * 🧠 ISOTOPE GRID POUR SKILL-CARDS (version stable)
 * → Utilise layoutMode: 'fitRows' pour une grille fluide CSS
 * → Gère le filtrage, le tri et le recalcul responsive
 * ========================================================
 */

document.addEventListener("DOMContentLoaded", function () {
  const grid = document.querySelector(".grid-wrapper");
  if (!grid) return;

  // ✅ Initialisation stable avec layoutMode: 'fitRows'
  const iso = new Isotope(grid, {
    itemSelector: ".grid-item",
    layoutMode: "fitRows", // ← Grille fluide (sans position:absolute)
    getSortData: {
      rating: "[data-rating] parseFloat",
    },
  });

  // 🎛️ Filtres de catégories (audio, code, régie, etc.)
  document.querySelectorAll(".filters .btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filterValue = btn.getAttribute("data-filter");
      iso.arrange({ filter: filterValue });
    });
  });

  // 🪄 Tri dynamique par note
  document.querySelectorAll(".sorters .btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sortBy = btn.getAttribute("data-sort-by");
      const sortOrder = btn.getAttribute("data-sort-order") === "asc";
      iso.arrange({ sortBy, sortAscending: sortOrder });
    });
  });

  // 🌀 Re-layout si la taille de la fenêtre change
  window.addEventListener("resize", () => iso.layout());

  // ✅ Re-layout une fois que toutes les images sont chargées
  imagesLoaded(grid, () => {
    iso.layout();
  });
});
