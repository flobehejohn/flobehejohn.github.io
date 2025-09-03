// assets/js/pages/holon.js
// Module de page idempotent (init/destroy) pour HOLON — compatible PJAX

(function (window, document) {
    'use strict';
  
    const NS = 'Holon';
    const API = { init, destroy };
    let state = null;
  
    // --- Utils
    const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  
    function ensurePausedByPolicy() {
      // Si la meta audio-policy="pause" est présente, on tente de mettre en pause le lecteur global s'il existe
      const meta = document.querySelector('meta[name="audio-policy"][content="pause"]');
      if (!meta) return;
      try {
        // 1) API connue ?
        if (window.Player && typeof window.Player.pause === 'function') {
          window.Player.pause();
          return;
        }
        // 2) Broadcast d’un event, au cas où ton singleton écoute
        window.dispatchEvent(new CustomEvent('audio:policy:pause', { detail: { source: 'holon' } }));
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
        // sécurité timeout léger
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
      // idempotent : si déjà initialisé, on démonte d'abord
      if (state) destroy();
  
      if (!root) root = document.querySelector('main[data-pjax-root][data-page="holon"]');
      if (!root) return;
  
      ensurePausedByPolicy();
  
      const unbindVideos = bindVideoFrameSeek(root);
  
      state = { root, unbindVideos };
      // marquer l'état pour debug
      root.dataset.pageReady = 'holon';
    }
  
    function destroy() {
      if (!state) return;
      try {
        state.unbindVideos && state.unbindVideos();
      } catch {}
      if (state.root) delete state.root.dataset.pageReady;
      state = null;
    }
  
    // Expose global pour page-hub / fallbacks
    window[NS] = API;
  
  })(window, document);
  