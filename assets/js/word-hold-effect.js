// assets/js/word-hold-effect.js
// Effet "hold" sur .anim-word — compatible PJAX (init au DOMReady + pjax:ready)

(() => {
  const HOLD_MS = 500;                 // durée avant d'ajouter .held
  const timers = new WeakMap();        // stocke les timeouts par élément

  function bindWord(word) {
    if (!word || word.__heldBound) return; // garde anti-doublon par élément
    word.__heldBound = true;

    const start = () => {
      // (ré)arme le timer
      const old = timers.get(word);
      if (old) clearTimeout(old);
      const id = setTimeout(() => word.classList.add('held'), HOLD_MS);
      timers.set(word, id);
    };

    const clear = () => {
      const id = timers.get(word);
      if (id) clearTimeout(id);
      timers.delete(word);
      word.classList.remove('held');
    };

    // Souris
    word.addEventListener('mousedown', start);
    word.addEventListener('mouseup', clear);
    word.addEventListener('mouseleave', clear);

    // Tactile (passive pour ne pas bloquer le scroll)
    word.addEventListener('touchstart', start, { passive: true });
    word.addEventListener('touchend', clear,   { passive: true });
    word.addEventListener('touchcancel', clear, { passive: true });

    // Sécurité : si l’élément disparaît (PJAX), le timeout devient inoffensif,
    // car le nœud est détruit et le WeakMap libérera l’entrée.
  }

  function init(container = document) {
    const root = (container instanceof Element) ? container : document;
    // on cible UNIQUEMENT le contenu nouvellement injecté (ou le doc au 1er load)
    root.querySelectorAll('.anim-word').forEach(bindWord);
  }

  // 1) Chargement initial
  document.addEventListener('DOMContentLoaded', () => init(document));

  // 2) Après chaque navigation PJAX
  document.addEventListener('pjax:ready', (e) => {
    init(e.detail?.container || document);
  });

  // (Optionnel) expo pour debug / relance manuelle
  window.initAnimWord = window.initAnimWord || init;
})();
