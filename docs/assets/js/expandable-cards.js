/**
 * 📌 Gestion des cartes extensibles (expandable cards)
 *
 * Ce script permet :
 * - D'afficher du contenu supplémentaire dans une carte (expansion)
 * - De masquer ce contenu sur demande (réduction)
 * - De gérer dynamiquement l'affichage des boutons "Voir plus" et "Voir moins"
 */

document.addEventListener("DOMContentLoaded", function () {
  // Sélectionne toutes les cartes ayant la classe .card-comp
  const cards = document.querySelectorAll(".card-comp");

  cards.forEach((card) => {
    // Sélection des boutons et du texte caché à l'intérieur de chaque carte
    const expandBtn = card.querySelector(".expand-btn"); // Bouton "Voir plus"
    const reduceBtn = card.querySelector(".reduce-btn"); // Bouton "Voir moins"
    const fullText = card.querySelector(".full-text"); // Contenu complet de la carte

    // 🌟 Cache le texte complet par défaut pour éviter l'affichage immédiat
    fullText.style.display = "none";

    /**
     * 📌 Fonction pour ouvrir (déployer) la carte et afficher le texte caché
     */
    expandBtn.addEventListener("click", function () {
      fullText.style.display = "block"; // Affiche le texte complet
      expandBtn.style.display = "none"; // Cache le bouton "Voir plus"
      reduceBtn.style.display = "inline-block"; // Affiche le bouton "Voir moins"
      card.classList.add("expanded"); // Ajoute une classe CSS pour animer si nécessaire
    });

    /**
     * 📌 Fonction pour fermer (réduire) la carte et cacher le texte
     */
    reduceBtn.addEventListener("click", function () {
      fullText.style.display = "none"; // Cache le texte complet
      expandBtn.style.display = "inline-block"; // Réaffiche le bouton "Voir plus"
      reduceBtn.style.display = "none"; // Cache le bouton "Voir moins"
      card.classList.remove("expanded"); // Retire la classe CSS
    });
  });
});
