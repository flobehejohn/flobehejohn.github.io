// assets/js/modal-guard.js
// Garde & purge universelles des modales (Bootstrap + custom) — PJAX-safe
// - Idempotent : ré-entrant, sans effet de bord si déjà fermé
// - Ne s’attache à aucun event ; on exporte juste 2 fonctions
// - Couvre : .modal Bootstrap, backdrops, offcanvas, <dialog>, modale audio (#audioPlayerModal / #responsiveWrapper),
//            modales overlay custom (#cv-modal, .modal-overlay), scroll-lock & styles transitoires

'use strict';

/** Utilitaire : masque un élément avec a11y propre */
function hideEl(el) {
  if (!el || !(el instanceof Element)) return;
  try {
    el.classList.remove('show', 'open', 'is-open', 'active');
    el.setAttribute('aria-hidden', 'true');
    // Nettoyage style d’affichage
    el.style.display = 'none';
  } catch {}
}

/** Utilitaire : supprime un nœud du DOM en silence */
function removeNode(n) {
  if (!n) return;
  try { n.remove(); } catch {}
}

/** Purge des scroll-locks et styles globaux */
function clearScrollLocks() {
  try {
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
    document.documentElement.style.removeProperty('overflow'); // au cas où une lib l’ait posé
  } catch {}
}

/** Ferme toutes les modales Bootstrap standards éventuellement “show” */
function closeBootstrapModals() {
  try {
    // Modales
    document.querySelectorAll('.modal.show').forEach((m) => {
      try {
        const inst = window.bootstrap?.Modal?.getInstance?.(m);
        if (inst) inst.hide();
      } catch {}
      hideEl(m);
      // Si structure Bootstrap, on peut vider un .modal-body dynamique pour éviter des fuites mémoire
      const body = m.querySelector('.modal-body');
      if (body) body.innerHTML = '';
    });

    // Offcanvas éventuels
    document.querySelectorAll('.offcanvas.show').forEach((o) => {
      try {
        const inst = window.bootstrap?.Offcanvas?.getInstance?.(o);
        inst?.hide?.();
      } catch {}
      hideEl(o);
    });

    // Backdrops résiduels
    document.querySelectorAll('.modal-backdrop, .offcanvas-backdrop').forEach(removeNode);
  } catch {}
}

/** Ferme les modales custom de ton site (audio, CV, overlays génériques) */
function closeCustomModals() {
  try {
    // Modale audio & wrapper persistant
    const audioModal = document.getElementById('audioPlayerModal');
    const wrapper    = document.getElementById('responsiveWrapper');
    hideEl(audioModal);
    if (wrapper) {
      wrapper.classList.remove('is-open', 'open', 'show', 'active');
      wrapper.style.display = 'none';
      wrapper.setAttribute('aria-hidden', 'true');
    }

    // Modale CV (globale, hors PJAX) + overlays génériques
    // (#cv-modal et .modal-overlay existent dans index.html)
    document.querySelectorAll('#cv-modal, .modal-overlay').forEach((el) => {
      // Vide le contenu injecté s’il y en a (ex: iframe/pdf, skill cards)
      const body = el.querySelector('.modal-body');
      if (body) body.innerHTML = '';
      hideEl(el);
    });

    // Modale “skill” si présente
    const skillModal = document.getElementById('skill-modal') || document.getElementById('skillModal');
    hideEl(skillModal);

    // Dialog natifs HTML s’ils sont “open”
    document.querySelectorAll('dialog[open]').forEach((d) => {
      try { d.close(); } catch {}
      hideEl(d);
    });
  } catch {}
}

/** Ferme tout ce qui ressemble à une modale / overlay, retire backdrops & scroll-locks. */
export function closeAllModals() {
  // 1) Bootstrap & backdrops
  closeBootstrapModals();

  // 2) Custom de ton projet (audio, CV, overlays skill)
  closeCustomModals();

  // 3) Scroll locks & styles transitoires
  clearScrollLocks();
}

/** Alias pratique quand tu veux brancher cette garde sur un hook PJAX (before) */
export function onPJAXBefore() {
  closeAllModals();
}
