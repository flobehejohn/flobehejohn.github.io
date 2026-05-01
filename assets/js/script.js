(() => {
    "use strict";
  
    // Script "accueil" compatible PJAX
    // - Inits locaux sur le container PJAX courant
    // - Listeners globaux montés une seule fois (délégation)
    // - Isotope ré-initialisé après chaque navigation
    // - Expose init/teardown pour un page-hub éventuel
  
    let globalBound = false;
  
    function init(container = document) {
      const root = (container instanceof Element) ? container : document;
  
      // 1) ISOTOPE (grille portfolio)
      const isoGrid = root.querySelector(".grid");
      if (isoGrid && typeof Isotope !== "undefined") {
        if (!isoGrid.__iso) {
          const iso = new Isotope(isoGrid, {
            itemSelector: ".grid-item",
            layoutMode: "fitRows",
            getSortData: {
              rating: (itemElem) => {
                const rating = itemElem.getAttribute("data-rating");
                return rating ? parseFloat(rating) : 0;
              },
            },
          });
          isoGrid.__iso = iso;
  
          // Relayout quand les images se chargent (si imagesLoaded dispo)
          try {
            if (typeof imagesLoaded === "function") {
              imagesLoaded(isoGrid, () => iso.layout());
            }
          } catch (_) {}
        } else {
          // Si déjà présent (rare), on force un layout
          try { isoGrid.__iso.layout(); } catch (_) {}
        }
      }
  
      // 2) CARTES COMPÉTENCES (état initial + évite multi-bind)
      root.querySelectorAll(".card-comp").forEach((card) => {
        if (card.__compInit) return;
        card.__compInit = true;
  
        const expandBtn = card.querySelector(".expand-btn");
        const reduceBtn = card.querySelector(".reduce-btn");
        const fullText  = card.querySelector(".full-text");
  
        if (fullText) {
          fullText.style.display = "none";
          fullText.style.opacity = "0";
        }
        if (expandBtn) expandBtn.style.display = "block";
      });
  
      // 3) LISTENERS GLOBAUX (montés une seule fois, délégation)
      if (!globalBound) {
        globalBound = true;
  
        document.addEventListener("click", (evt) => {
          const btn = evt.target.closest("button");
          if (!btn) return;
  
          // a) Filtres (Isotope)
          if (btn.closest(".filters")) {
            const filterValue = btn.getAttribute("data-filter") || "*";
            const grid = document.querySelector(".grid");
            const iso  = grid?.__iso;
            if (iso) iso.arrange({ filter: filterValue });
            return;
          }
  
          // b) Tris (Isotope)
          if (btn.closest(".sorters")) {
            const sortByValue   = btn.getAttribute("data-sort-by") || "original-order";
            const sortAscending = btn.getAttribute("data-sort-order") !== "desc";
            const grid = document.querySelector(".grid");
            const iso  = grid?.__iso;
            if (iso) iso.arrange({ sortBy: sortByValue, sortAscending });
            return;
          }
  
          // c) Cartes compétences (expand/reduce)
          const card = btn.closest(".card-comp");
          if (!card) return;
  
          const expandBtn = card.querySelector(".expand-btn");
          const reduceBtn = card.querySelector(".reduce-btn");
          const fullText  = card.querySelector(".full-text");
  
          if (btn === expandBtn) {
            if (fullText) {
              fullText.style.display = "block";
              requestAnimationFrame(() => { fullText.style.opacity = "1"; });
            }
            if (expandBtn) expandBtn.style.display = "none";
            return;
          }
  
          if (btn === reduceBtn) {
            if (fullText) {
              fullText.style.opacity = "0";
              setTimeout(() => {
                fullText.style.display = "none";
                if (expandBtn) expandBtn.style.display = "block";
              }, 300);
            }
            return;
          }
        }, true);
      }
    }
  
    // Premier chargement
    document.addEventListener("DOMContentLoaded", () => init(document));
  
    // À chaque navigation PJAX
    document.addEventListener("pjax:ready", (e) => {
      init(e.detail?.container || document);
    });
  
    // (Optionnel) expose init/destroy pour un "page-hub"
    window.initSkillGrid = window.initSkillGrid || init;
    window.teardownSkillGrid = window.teardownSkillGrid || function () {
      const grid = document.querySelector(".grid");
      const iso  = grid?.__iso;
      if (iso && typeof iso.destroy === "function") {
        iso.destroy();
        grid.__iso = null;
      }
    };
  })();
  