// /assets/js/draggable-audio-player.js
// 🎧 Lecteur "draggable" sur desktop uniquement. Safe si éléments absents.
// Idempotent : n’attache pas deux fois les mêmes listeners.

(function () {
  'use strict';

  if (window.__DRAG_PLAYER__?.initialized) return;
  window.__DRAG_PLAYER__ = window.__DRAG_PLAYER__ || {};
  window.__DRAG_PLAYER__.initialized = true;

  document.addEventListener('DOMContentLoaded', () => {
    const wrapper    = document.getElementById('responsiveWrapper'); // conteneur principal
    const dragBar    = document.getElementById('dragBar');           // poignée
    const mediaQuery = window.matchMedia('(max-width: 768px)');

    if (!wrapper || !dragBar) {
      console.warn('[drag] responsiveWrapper/dragBar absent — drag ignoré sur cette page');
      return;
    }

    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    const startDrag = (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      const rect = wrapper.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      wrapper.dataset.prevTransform = getComputedStyle(wrapper).transform;
      document.body.style.userSelect = 'none';
      dragBar.style.cursor = 'grabbing';
    };

    const drag = (e) => {
      if (!isDragging) return;
      wrapper.style.left = `${e.clientX - offsetX}px`;
      wrapper.style.top  = `${e.clientY - offsetY}px`;
      wrapper.style.bottom = '';
      wrapper.style.right  = '';
      wrapper.style.transform = wrapper.dataset.prevTransform || 'translateX(-50%)';
      wrapper.style.position = 'fixed';
    };

    const stopDrag = () => {
      isDragging = false;
      document.body.style.userSelect = '';
      dragBar.style.cursor = 'grab';
    };

    function enableDrag() {
      dragBar.style.cursor = 'grab';
      dragBar.addEventListener('mousedown', startDrag);
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('mousemove', drag);
    }

    function disableDrag() {
      dragBar.style.cursor = 'default';
      dragBar.removeEventListener('mousedown', startDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('mousemove', drag);

      // Repositionne proprement le lecteur en bas-centre
      wrapper.style.top = '';
      wrapper.style.right = '';
      wrapper.style.left = '50%';
      wrapper.style.bottom = '20px';
      wrapper.style.transform = 'translateX(-50%) scale(1)';
      wrapper.style.position = 'fixed';
    }

    function updateDragBehavior() {
      if (mediaQuery.matches) disableDrag(); // mobile
      else enableDrag();                     // desktop
    }

    // Init + écoute le changement de breakpoint
    updateDragBehavior();
    // (API moderne) — fallback non nécessaire ici, Chrome/FF/Edge ok
    mediaQuery.addEventListener('change', updateDragBehavior);
  });
})();
