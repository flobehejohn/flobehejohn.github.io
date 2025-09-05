// assets/js/pages/crea_en_cours.js
// Module de page idempotent (init/destroy) — compatible PJAX
// Aligné sur la structure de assets/js/pages/holon.js

(function (window, document) {
    'use strict';
  
    const NS = 'CreaEnCours';
    const API = { init, destroy };
    let state = null;
  
    // Utils
    const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  
    function ensurePausedByPolicy() {
      const meta = document.querySelector('meta[name="audio-policy"][content="pause"]');
      if (!meta) return;
      try {
        if (window.Player && typeof window.Player.pause === 'function') {
          window.Player.pause();
          return;
        }
        window.dispatchEvent(new CustomEvent('audio:policy:pause', { detail: { source: 'crea_en_cours' } }));
      } catch {}
    }
  
    function bindVideoFrameSeek(root) {
      // Affiche ~3e frame à l'ouverture (24fps ≈ 0.125s)
      const videos = qsa('.carte-lecteur-video video', root);
      const frameTime = 0.125;
  
      const onLoaded = (v) => {
        if (Math.abs(v.currentTime - frameTime) > 0.01) {
          try { v.currentTime = frameTime; } catch {}
        }
      };
  
      const listeners = [];
      videos.forEach(v => {
        const lm = () => onLoaded(v);
        v.addEventListener('loadedmetadata', lm);
        const t = setTimeout(() => onLoaded(v), 150);
        listeners.push({ v, lm, t });
      });
  
      return () => {
        listeners.forEach(({ v, lm, t }) => {
          v.removeEventListener('loadedmetadata', lm);
          clearTimeout(t);
        });
      };
    }
  
    function init(root) {
      if (state) destroy();
      if (!root) root = document.querySelector('main[data-pjax-root][data-page="crea_en_cours"]');
      if (!root) return;
  
      ensurePausedByPolicy();
      const unbindVideos = bindVideoFrameSeek(root);
  
      state = { root, unbindVideos };
      root.dataset.pageReady = 'crea_en_cours';
    }
  
    function destroy() {
      if (!state) return;
      try { state.unbindVideos && state.unbindVideos(); } catch {}
      if (state.root) delete state.root.dataset.pageReady;
      state = null;
    }
  
    // Expose global pour page-hub / fallbacks
    window[NS] = API;
  
  })(window, document);
  