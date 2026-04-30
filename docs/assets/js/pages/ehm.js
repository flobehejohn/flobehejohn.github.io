// assets/js/pages/ehm.js
// Module de page idempotent (init/destroy) — compatible PJAX
// Aligné avec Holon/CreaEnCours : pause audio globale + vignette stable + overlays posters
// Version : robuste PJAX + logs lisibles (Firefox/Chromium)

(function (window, document) {
  'use strict';

  const NS = 'Ehm';
  const TAG = '%c[Ehm]';
  const CSS = 'background:#0b1f2a;color:#8bf0ff;font-weight:700;padding:2px 6px;border-radius:3px';
  const OK  = 'background:#0c2a1a;color:#77ffcc;font-weight:700;padding:2px 6px;border-radius:3px';
  const WARN = 'background:#2b1d1d;color:#ffb3b3;font-weight:700;padding:2px 6px;border-radius:3px';

  const qsa = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));

  let state = null;
  const log = (...a) => console.log(TAG, CSS, ...a);
  const ok  = (...a) => console.log(TAG, OK,  ...a);
  const warn = (...a) => console.warn(TAG, WARN, ...a);

  /* ==========================
     Respecter la meta audio-policy
     ========================== */
  function ensurePausedByPolicy() {
    try {
      const meta = document.head.querySelector('meta[name="audio-policy"]');
      const policy = meta ? (meta.getAttribute('content') || '').toLowerCase() : '';
      if (policy === 'pause') {
        log('audio-policy = pause → tentative de pause du player global');
        try {
          const P = window.Player || window.AudioApp || window.PlayerSingleton || window.player;
          if (P && typeof P.pause === 'function') {
            P.pause();
            ok('Player global: pause() appelée');
            return;
          }
        } catch (e) {
          warn('pause via API a échoué', e);
        }
        // fallback : dispatch event pour que le singleton écoute et pause
        try {
          window.dispatchEvent(new CustomEvent('audio:policy:pause', { detail: { source: NS } }));
          ok('Event audio:policy:pause dispatché');
        } catch (e) {
          warn('dispatch audio:policy:pause failed', e);
        }
      } else {
        log('audio-policy ≠ pause (valeur=', policy, ') → pas d\'action');
      }
    } catch (e) {
      warn('ensurePausedByPolicy erreur', e);
    }
  }

  /* ==========================
     bindVideoFrameSeek
     - assure que la 3e frame (~0.125s) est positionnée
     - gère les cas où loadedmetadata est déjà passé (readyState)
     - écoute loadedmetadata + loadeddata
     ========================== */
  function bindVideoFrameSeek(root) {
    const videos = qsa('.carte-lecteur-video video', root);
    const frameTime = 0.125;
    const listeners = [];

    function onLoaded(v) {
      try {
        // si la position est déjà proche, skip
        if (Math.abs((v.currentTime || 0) - frameTime) <= 0.01) {
          log('video readyState', v.readyState, 'currentTime déjà proche de', frameTime);
          return;
        }
        // certains navigateurs demandent un load() si src vient d'être injecté
        try { v.load(); } catch (e) { /* noop */ }
        try {
          v.currentTime = frameTime;
          log('video currentTime réglé sur', frameTime, 'pour', v);
        } catch (errSet) {
          // certains navigateurs bloquent set currentTime avant metadata complet
          warn('v.currentTime set failed, will retry on seeked', errSet);
          const onSeeked = () => {
            try { v.currentTime = frameTime; } catch (e) { warn('retry set currentTime failed', e); }
            v.removeEventListener('seeked', onSeeked);
          };
          v.addEventListener('seeked', onSeeked, { once: true });
        }
      } catch (e) {
        warn('onLoaded failed', e);
      }
    }

    videos.forEach(v => {
      const lm = () => onLoaded(v);
      const ld = () => onLoaded(v); // alias pour loadeddata

      v.addEventListener('loadedmetadata', lm);
      v.addEventListener('loadeddata', ld);

      // sécurité : si aucun event (déjà passé ou edge case), tenter après 250ms
      const t = setTimeout(() => {
        try {
          onLoaded(v);
        } catch (e) { warn('timeout onLoaded failed', e); }
      }, 250);

      // tentative immédiate quand readyState >= HAVE_METADATA
      try {
        if (v.readyState >= 1) {
          log('video readyState >= 1 → appel immédiat onLoaded');
          onLoaded(v);
        }
      } catch (e) { warn('readyState check failed', e); }

      listeners.push({ v, lm, ld, t });
    });

    return () => {
      listeners.forEach(({ v, lm, ld, t }) => {
        try { v.removeEventListener('loadedmetadata', lm); } catch {}
        try { v.removeEventListener('loadeddata', ld); } catch {}
        clearTimeout(t);
      });
      ok('unbindVideoFrameSeek completed (listeners removed)', listeners.length);
    };
  }

  /* ==========================
     bindPosterOverlays
     - overlay cliquable visible quand video paused / ended
     - gère la Promise renvoyée par play() (autoplay / restrictions)
     ========================== */
  function bindPosterOverlays(root) {
    const medias = qsa('.carte-lecteur-video-media', root);
    const unbinds = [];

    medias.forEach(container => {
      try {
        const video  = container.querySelector('video');
        const poster = container.querySelector('.video-poster-overlay');
        if (!video || !poster) return;

        // initial state
        try { poster.classList.toggle('is-hidden', !video.paused); } catch (e) {}

        const onPosterClick = (ev) => {
          ev && ev.preventDefault && ev.preventDefault();
          try {
            const playResult = video.play();
            if (playResult && typeof playResult.then === 'function') {
              playResult.then(() => {
                ok('video.play() promise resolved (poster click)');
              }).catch(err => {
                warn('video.play() rejected (poster click)', err);
              });
            }
          } catch (e) {
            warn('video.play() thrown (poster click)', e);
          }
        };

        const onPlay  = () => { try { poster.classList.add('is-hidden'); } catch (e) {} };
        const onPause = () => { try { poster.classList.remove('is-hidden'); } catch (e) {} };
        const onEnd   = () => { try { poster.classList.remove('is-hidden'); } catch (e) {} };
        const onMeta  = () => { try { if (video.paused) poster.classList.remove('is-hidden'); } catch (e) {} };

        poster.addEventListener('click', onPosterClick);
        video.addEventListener('play',  onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnd);
        video.addEventListener('loadedmetadata', onMeta);
        video.addEventListener('loadeddata', onMeta);

        unbinds.push(() => {
          try { poster.removeEventListener('click', onPosterClick); } catch {}
          try { video.removeEventListener('play', onPlay); } catch {}
          try { video.removeEventListener('pause', onPause); } catch {}
          try { video.removeEventListener('ended', onEnd); } catch {}
          try { video.removeEventListener('loadedmetadata', onMeta); } catch {}
          try { video.removeEventListener('loadeddata', onMeta); } catch {}
        });

      } catch (e) {
        warn('bindPosterOverlays per-item failed', e);
      }
    });

    return () => {
      unbinds.forEach(off => {
        try { off(); } catch (e) { warn('unbind poster overlay failed', e); }
      });
      ok('unbindPosterOverlays completed (count=' + unbinds.length + ')');
    };
  }

  /* ==========================
     API : init / destroy
     - idempotent : init() appelle destroy() si nécessaire
     - compatible PJAX : root par défaut = main[data-pjax-root][data-page="ehm"]
     ========================== */
  function init(root) {
    try {
      if (state) {
        log('init() appelé alors que state existait → destruction préalable');
        try { destroy(); } catch (e) { warn('destroy pré-init failed', e); }
      }

      if (!root) {
        root = document.querySelector('main[data-pjax-root][data-page="ehm"]');
      }
      if (!root) {
        warn('init() : root introuvable, abort');
        return;
      }

      log('init() démarrage pour root', root);

      ensurePausedByPolicy();

      const unbindSeek   = bindVideoFrameSeek(root);
      const unbindPoster = bindPosterOverlays(root);

      state = { root, unbindSeek, unbindPoster, startedAt: Date.now() };

      try { root.dataset.pageReady = 'ehm'; } catch (e) {}

      ok('Ehm init OK — listeners attachés (videos/posters).');
    } catch (e) {
      warn('init() erreur', e);
    }
  }

  function destroy() {
    try {
      if (!state) {
        log('destroy() appelé mais state déjà nul — skip');
        return;
      }
      log('destroy() démarrage pour root', state.root);

      try { state.unbindSeek && state.unbindSeek(); } catch (e) { warn('unbindSeek failed', e); }
      try { state.unbindPoster && state.unbindPoster(); } catch (e) { warn('unbindPoster failed', e); }

      try { if (state.root) delete state.root.dataset.pageReady; } catch (e) {}

      state = null;
      ok('Ehm destroy OK — état nettoyé');
    } catch (e) {
      warn('destroy general error', e);
    }
  }

  // Expose global pour page-hub / fallbacks
  try {
    window[NS] = { init, destroy };
    log('exposé global -> window.' + NS);
  } catch (e) {
    warn('exposition globale failed', e);
  }

})(window, document);
