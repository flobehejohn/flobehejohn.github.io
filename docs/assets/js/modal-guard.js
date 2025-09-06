export function closeAllModals() {
  // Ferme les modales Bootstrap 5 si présent
  if (window.bootstrap) {
    document.querySelectorAll(".modal.show").forEach(el => {
      const inst = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
      inst.hide();
    });
  }
  // Filets de sécurité
  document.querySelectorAll(".modal").forEach(el => el.classList.remove("show"));
  document.body.classList.remove("modal-open");
}
