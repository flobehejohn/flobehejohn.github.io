// assets/js/cv-modal-handler.js
// Version déléguée (PJAX-proof) + a11y + Escape. Un seul bind global.

(() => {
  const state = { bound: false };

  function getModal() { return document.getElementById('cv-modal'); }
  function getClose() { return document.getElementById('close-cv-modal'); }

  function openModal() {
    const m = getModal(); if (!m) return;
    m.style.display = 'flex';
    m.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }
  function closeModal() {
    const m = getModal(); if (!m) return;
    m.style.display = 'none';
    m.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function onDocClick(e) {
    const t = e.target;
    if (t.closest && t.closest('#open-cv-modal')) { e.preventDefault(); openModal(); return; }
    const m = getModal();
    if (m && t === m) { closeModal(); }
    if (t.id === 'close-cv-modal') { e.preventDefault(); closeModal(); }
  }

  function onKey(e) {
    if (e.key === 'Escape') closeModal();
  }

  function ensureBound() {
    if (state.bound) return;
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKey, false);
    state.bound = true;
  }

  // Premier chargement + après chaque PJAX : on s’assure juste que le bind existe (idempotent)
  document.addEventListener('DOMContentLoaded', ensureBound);
  document.addEventListener('pjax:ready', ensureBound);

  // API optionnelle
  window.initCvModal = ensureBound;
})();
