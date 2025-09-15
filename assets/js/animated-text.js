// assets/js/animated-text.js
// Découpe les textes en <span class="anim-word"> et anime à l'apparition.
// Compatible PJAX : s'initialise au DOM Ready ET à chaque pjax:ready,
// sans double-traiter les éléments (marquage data-*) et avec un seul observer.

(() => {
  'use strict';

  let observer = null;

  function getObserver() {
    if (observer) return observer;
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const block = entry.target;
        if (!entry.isIntersecting) return;

        // Anime chaque mot une seule fois
        const words = block.querySelectorAll('.anim-word');
        if (!words.length) return;

        // Si déjà animé (ex: on revient dessus), ne rejoue pas
        if (block.dataset.animPlayed === '1') {
          observer.unobserve(block);
          return;
        }

        words.forEach((word, i) => {
          // Petit délai échelonné (rapide)
          setTimeout(() => word.classList.add('anim-in'), i * 15);
        });

        block.dataset.animPlayed = '1';
        observer.unobserve(block);
      });
    }, { threshold: 0.1 });
    return observer;
  }

  function wrapWordsIn(block) {
    // Marqueur de bloc (évite re-wrap)
    if (block.dataset.animProcessed === '1') return;

    block.querySelectorAll('h1,h2,h3,p,li').forEach((el) => {
      // Ne pas re-traiter si déjà wrap
      if (el.dataset.animWrapped === '1' || el.querySelector('.anim-word')) return;

      const raw = (el.textContent || '').trim();
      if (!raw) { el.dataset.animWrapped = '1'; return; }

      const parts = raw.split(/\s+/);
      el.textContent = '';
      parts.forEach((word, i) => {
        const span = document.createElement('span');
        span.className = 'anim-word';
        span.textContent = word;
        el.appendChild(span);
        if (i < parts.length - 1) el.appendChild(document.createTextNode(' '));
      });

      el.dataset.animWrapped = '1';
    });

    block.dataset.animProcessed = '1';
  }

  function init(container = document) {
    const root = (container instanceof Element) ? container : document;
    const obs = getObserver();

    // Ne prendre que les blocs à l'intérieur du container (important avec PJAX)
    root.querySelectorAll('.animated-text').forEach((block) => {
      wrapWordsIn(block);
      // (Ré)observe le bloc si l'animation n'a pas encore été jouée
      if (block.dataset.animPlayed !== '1') obs.observe(block);
    });
  }

  function teardown(container = document) {
    if (!observer) return;
    const root = (container instanceof Element) ? container : document;
    root.querySelectorAll('.animated-text').forEach((block) => {
      try { observer.unobserve(block); } catch {}
    });
    // On ne disconnect pas globalement l'observer pour laisser vivre les autres pages.
    // Si tu veux forcer un reset global : observer.disconnect(); observer = null;
  }

  // 1) Premier chargement
  document.addEventListener('DOMContentLoaded', () => init(document));

  // 2) À chaque navigation PJAX
  document.addEventListener('pjax:ready', (e) => {
    init(e.detail?.container || document);
  });

  // (Optionnel) Expose pour un hub de page
  window.initAnimatedText = window.initAnimatedText || init;
  window.teardownAnimatedText = window.teardownAnimatedText || teardown;
})();
