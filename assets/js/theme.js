document.addEventListener("DOMContentLoaded", function () {
  var navbar = document.querySelector(".navbar-sticky");
  var toggleButton = document.querySelector(".navbar-toggle");
  var navbarMenu = document.querySelector(".navbar-collapse");

  if (navbar) {
    // Ajout de la classe "fixed-navbar" pour assurer que la navbar reste visible et en place
    navbar.classList.add("fixed-navbar");

    // Gestion propre du scroll
    window.addEventListener("scroll", function () {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      if (scrollTop > 50) {
        navbar.classList.add("scrolled");
        // Éviter l'effet de transparence de la navbar
        navbar.style.backgroundColor = "rgba(255, 255, 255, 0.98)";
      } else {
        navbar.classList.remove("scrolled");
        // Fixe la couleur de fond lorsque l'utilisateur est en haut de la page
        navbar.style.backgroundColor = "rgba(255, 255, 255, 0.98)";
      }
    });

    // Gestion du mode clair/sombre automatique
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
    ) {
      navbar.classList.add("light-mode");
    }
  }

  // Gestion du menu mobile (hamburger)
  if (toggleButton && navbarMenu) {
    toggleButton.addEventListener("click", function () {
      navbarMenu.classList.toggle("active");
      document.body.classList.toggle("menu-open");

      setTimeout(() => {
        navbarMenu.classList.add("animated");
      }, 10);
    });

    document.addEventListener("click", function (event) {
      // Si l'utilisateur clique en dehors du menu, on le ferme
      if (
        !navbarMenu.contains(event.target) &&
        !toggleButton.contains(event.target)
      ) {
        navbarMenu.classList.remove("active");
        document.body.classList.remove("menu-open");
      }
    });
  }
});
