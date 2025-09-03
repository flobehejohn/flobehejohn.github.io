// /assets/js/components/video-card.js
// Composant carte vidéo robuste : anti-double-init + debounce du toggle
// - Exporte : initSingleVideoCard(root), destroySingleVideoCard(root), initVideoCards(container)
// - Coopère avec d'autres modules (ex. /assets/js/pages/rencontre.js) via des flags nominés
// - PJAX-friendly : teardown propre pour éviter les fuites de listeners

/**
 * Initialise une carte vidéo unique.
 * @param {HTMLElement} root - Élément racine de la carte (contenant .carte-lecteur-video-media)
 */
export function initSingleVideoCard(root) {
    if (!root || !(root instanceof HTMLElement)) return;
  
    const mediaWrap = root.querySelector('.carte-lecteur-video-media');
    if (!mediaWrap) return;
  
    const video = mediaWrap.querySelector('video');
    if (!video) return;
  
    // --- ANTI DOUBLE-INIT ----------------------------------------------------
    // Si déjà initialisée par un autre composant, on skip (on ne touche rien).
    if (video.__vc_init && video.__vc_init_by && video.__vc_init_by !== 'video-card') return;
    // Si déjà initialisée (sans provenance) — on reste prudent => skip.
    if (video.__vc_init && !video.__vc_init_by) return;
    // Si déjà initialisée par NOUS — idempotent => skip.
    if (video.__vc_init_by === 'video-card') return;
  
    // Pose les flags nominés d'ownership
    try {
      video.__vc_init = true;
      video.__vc_init_by = 'video-card';
    } catch (e) {}
  
    // --- État interne (stocké sur la vidéo pour teardown aisé) --------------
    const state = video.__vc_state || (video.__vc_state = {});
    state.toggling = false;
    state.lastUserToggleAt = 0;  // horodatage du dernier toggle initié par l'utilisateur
    state.replayAttempts = 0;    // anti-boucle : 1 seule tentative de replay si pause externe
    state.detachFns = [];
  
    // --- Handlers ------------------------------------------------------------
  
    // Debounce & toggle play/pause
    const onClickToggle = async (ev) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  
      // Debounce anti double-clic / double-tap
      if (state.toggling) return;
      const now = (performance && performance.now) ? performance.now() : Date.now();
      if (now - (state.lastUserToggleAt || 0) < 130) return;
  
      state.toggling = true;
      state.lastUserToggleAt = now;
      state.replayAttempts = 0;
  
      try {
        if (video.paused) {
          await video.play().catch(() => {});    // évite les unhandled promise rejections
          root.classList.add('is-playing');
  
          // UX : pause toutes les autres vidéos (après ce play pour éviter les races)
          requestAnimationFrame(() => {
            document.querySelectorAll('video').forEach(v => {
              if (v !== video && !v.paused) {
                try { v.pause(); } catch (e) { /* no-op */ }
              }
            });
          });
        } else {
          video.pause();
          root.classList.remove('is-playing');
        }
      } catch (err) {
        console.warn('[video-card] toggle error', err);
      } finally {
        // petite fenêtre de relâche pour bloquer les rebonds matériels
        setTimeout(() => { state.toggling = false; }, 180);
      }
    };
  
    const onPlaying = () => {
      root.classList.add('is-playing');
    };
  
    const onPause = () => {
      root.classList.remove('is-playing');
  
      // Si une pause "externe" survient très peu de temps après un user-play,
      // tente une reprise unique et courte (atténue les conflits inter-handlers).
      const now = (performance && performance.now) ? performance.now() : Date.now();
      const delta = now - (state.lastUserToggleAt || 0);
      if (delta > 0 && delta < 450 && state.replayAttempts < 1) {
        state.replayAttempts++;
        setTimeout(() => {
          if (video.paused) {
            video.play().catch(() => {});
          }
        }, 80);
      }
    };
  
    const onError = (e) => {
      console.error('[video-card] video error', e);
    };
  
    const onVisibility = () => {
      if (document.hidden && !video.paused) {
        try { video.pause(); } catch {}
      }
    };
  
    // --- Binding des écouteurs (un seul endroit, jamais en double) ----------
    const playBtn = root.querySelector('.play-toggle');
    if (playBtn) {
      playBtn.addEventListener('click', onClickToggle, { passive: false });
      state.detachFns.push(() => playBtn.removeEventListener('click', onClickToggle));
    } else {
      mediaWrap.addEventListener('click', onClickToggle, { passive: false });
      state.detachFns.push(() => mediaWrap.removeEventListener('click', onClickToggle));
    }
  
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause',   onPause);
    video.addEventListener('error',   onError);
    state.detachFns.push(
      () => video.removeEventListener('playing', onPlaying),
      () => video.removeEventListener('pause',   onPause),
      () => video.removeEventListener('error',   onError)
    );
  
    document.addEventListener('visibilitychange', onVisibility);
    state.detachFns.push(() => document.removeEventListener('visibilitychange', onVisibility));
  }
  
  /**
   * Détruit proprement une carte vidéo initialisée par ce composant.
   * @param {HTMLElement} root - Élément racine de la carte.
   */
  export function destroySingleVideoCard(root) {
    if (!root || !(root instanceof HTMLElement)) return;
  
    const mediaWrap = root.querySelector('.carte-lecteur-video-media');
    const video = mediaWrap?.querySelector('video');
    if (!video) return;
  
    // Retire les écouteurs de cette instance si présents
    const state = video.__vc_state;
    if (state && Array.isArray(state.detachFns)) {
      // exécute tous les "detachers"
      while (state.detachFns.length) {
        const fn = state.detachFns.pop();
        try { typeof fn === 'function' && fn(); } catch {}
      }
    }
  
    // Nettoie les classes
    try { root.classList.remove('is-playing'); } catch {}
  
    // Supprime l'état interne
    try { delete video.__vc_state; } catch {}
  
    // Ne retire les flags globaux que si NOUS les avons posés
    try {
      if (video.__vc_init_by === 'video-card') {
        delete video.__vc_init;
        delete video.__vc_init_by;
      }
    } catch {}
  }
  
  /**
   * Convenience: initialise toutes les cartes présentes dans un conteneur.
   * @param {ParentNode} container - Ex: document ou un fragment PJAX
   */
  export function initVideoCards(container = document) {
    container.querySelectorAll('.carte-lecteur-video').forEach(card => {
      try { initSingleVideoCard(card); } catch (e) { /* no-op */ }
    });
  }
  