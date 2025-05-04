document.addEventListener("DOMContentLoaded", function () {
  var isoGrid = document.querySelector(".grid");
  if (isoGrid) {
    var iso_1 = new Isotope(isoGrid, {
      itemSelector: ".grid-item",
      layoutMode: "fitRows",
      getSortData: {
        rating: function (itemElem) {
          var rating = itemElem.getAttribute("data-rating");
          return rating ? parseFloat(rating) : 0;
        },
      },
    });
    document.querySelectorAll(".filters button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var filterValue = btn.getAttribute("data-filter") || "*";
        iso_1.arrange({ filter: filterValue });
      });
    });
    document.querySelectorAll(".sorters button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var sortByValue = btn.getAttribute("data-sort-by") || "original-order";
        var sortAscending = btn.getAttribute("data-sort-order") !== "desc";
        iso_1.arrange({ sortBy: sortByValue, sortAscending: sortAscending });
      });
    });
  }

  document.querySelectorAll(".card-comp").forEach(function (card) {
    var expandBtn = card.querySelector(".expand-btn");
    var reduceBtn = card.querySelector(".reduce-btn");
    var fullText = card.querySelector(".full-text");
    fullText.style.display = "none";
    fullText.style.opacity = "0";
    expandBtn.style.display = "block";
    expandBtn.onclick = function () {
      fullText.style.display = "block";
      requestAnimationFrame(function () {
        fullText.style.opacity = "1";
      });
      expandBtn.style.display = "none";
    };
    reduceBtn.onclick = function () {
      fullText.style.opacity = "0";
      setTimeout(function () {
        fullText.style.display = "none";
        expandBtn.style.display = "block";
      }, 300);
    };
  });

  // Correction navbar : suppression totale des effets de scroll
  window.addEventListener("scroll", function () {
    // Rien � ex�cuter ici : Neutralisation compl�te de l'effet scroll navbar
  });

  // Retire explicitement la classe scrolled au chargement
  document.querySelector(".navbar-sticky").classList.remove("scrolled");
});
