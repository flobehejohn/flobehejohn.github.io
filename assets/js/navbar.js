"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ✅ Appliquer sticky dès le chargement
  document.querySelector(".navbar-sticky")?.classList.add("scrolled");

  // 🍔 Gestion du bouton hamburger
  const $navbarToggler = $(".navbar-toggler");
  const $mainNavbar = $("#main-navbar");

  $navbarToggler.on("click", function () {
    $(this).toggleClass("collapsed");
    $mainNavbar.collapse("toggle");
  });

  $(document).on("click", function (e) {
    if (
      !$mainNavbar.is(e.target) &&
      !$navbarToggler.is(e.target) &&
      $mainNavbar.has(e.target).length === 0 &&
      $navbarToggler.has(e.target).length === 0 &&
      $mainNavbar.hasClass("show")
    ) {
      $mainNavbar.collapse("hide");
      $navbarToggler.addClass("collapsed");
    }
  });

  // 🎯 Ajustement dynamique du titre
  const titleEl = document.querySelector(".site-title");
  const brandEl = document.querySelector(".navbar-brand");
  const audioEl = document.querySelector(".audio-player-nav-btn");
  const burgerEl = document.querySelector(".navbar-toggler");
  const containerEl = document.querySelector(".navbar .container");

  if (titleEl && brandEl && audioEl && burgerEl && containerEl) {
    const brandBox = brandEl.getBoundingClientRect();
    const audioWidth = audioEl.getBoundingClientRect().width;
    const burgerWidth = burgerEl.getBoundingClientRect().width;
    const containerWidth = containerEl.getBoundingClientRect().width;

    const available = containerWidth - (audioWidth + burgerWidth + 32); // Marge de confort
    const titleScrollWidth = titleEl.scrollWidth;

    if (titleScrollWidth > available) {
      // 🔧 Ajustement dynamique
      titleEl.style.maxWidth = `${Math.floor(available)}px`;
      titleEl.style.fontSize = "0.82rem";
      titleEl.style.overflow = "hidden";
      titleEl.style.textOverflow = "ellipsis";
      titleEl.style.whiteSpace = "nowrap";

      console.warn(
        `⚠️ Titre tronqué : ajusté dynamiquement à ${Math.floor(available)}px`,
      );
    } else {
      console.log("✅ Espace suffisant pour afficher le titre complet.");
      titleEl.style.maxWidth = "";
      titleEl.style.fontSize = "";
    }
  }
});
