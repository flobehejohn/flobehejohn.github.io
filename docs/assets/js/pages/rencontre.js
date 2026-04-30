// /assets/js/pages/rencontre.js
// Module page-scopé pour la page "rencontre"
// - idempotent (boot une seule fois)
// - PJAX-friendly (expose init(container) et destroy())
// - force la 3e image des vidéos (frame ~0.125s) au chargement
// - gère l'interaction avec le player-global (player-singleton) : pause pendant lecture vidéo + reprise ensuite
(function (root) {
    'use strict';
  
    /* ----------------------------- État module ----------------------------- */
    let booted = false;
    const removers = [];                   // pile de fonctions de cleanup (removeEventListener, clearTimeout, etc.)
    const trackedVideos = new WeakSet();   // anti-repeat pour le seek initial
    let globalPausedByThis = false;        // sait si c’est nous qui avons pausé le player global
  
    /* -------------------------- Helpers listeners -------------------------- */
    function addListener(el, ev, fn, opts) {
      if (!el || !ev || !fn) return () => {};
      el.addEventListener(ev, fn, opts || false);
      const remover = () => {
        try { el.removeEventListener(ev, fn, opts || false); } catch {}
      };
      removers.push(remover);
      return remover;
    }
  
    /* --------------- Player global : pause / resume si présent ------------- */
    function getGlobalPlayer() {
      try {
        return root.PlayerSingleton || root.playerSingleton || root.Player || root.player || null;
      } catch { return null; }
    }
  
    function tryPauseGlobalPlayer() {
      try {
        const P = getGlobalPlayer();
        if (!P) return false;
  
        if (typeof P.getState === 'function' && typeof P.pause === 'function') {
          const s = P.getState();
          if (s === 'playing' || s === 'running') { P.pause(); return true; }
          return false;
        }
        if (typeof P.pause === 'function') { P.pause(); return true; }
        if (typeof P.suspend === 'function') { P.suspend(); return true; }
  
        if (P.audioElement && typeof P.audioElement.pause === 'function') {
          P.audioElement.pause(); return true;
        }
        return false;
      } catch { return false; }
    }
  
    function tryResumeGlobalPlayer() {
      try {
        const P = getGlobalPlayer();
        if (!P) return false;
  
        if (typeof P.getState === 'function' && typeof P.play === 'function') {
          const s = P.getState();
          if (s === 'paused' || s === 'suspended' || s === 'idle') { P.play(); return true; }
          return false;
        }
        if (typeof P.play === 'function') { P.play(); return true; }
        if (typeof P.resume === 'function') { P.resume(); return true; }
  
        if (P.audioElement && typeof P.audioElement.play === 'function') {
          try { P.audioElement.play(); } catch {}
          return true;
        }
        return false;
      } catch { return false; }
    }
  
    /* ---------------------------- Seek frame 3 ----------------------------- */
    // Force l’affichage sur ~0.125s (3e frame typique) une fois les métadonnées dispo
    function seekStableFrame(video) {
      if (!video || trackedVideos.has(video)) return;
      trackedVideos.add(video);
  
      const frameTime = 0.125;
  
      function safeSeek() {
        try {
          if (typeof video.currentTime === 'number' && Math.abs(video.currentTime - frameTime) > 0.01) {
            video.currentTime = frameTime;
          }
        } catch { /* no-op */ }
      }
  
      if (video.readyState >= 1) safeSeek(); // metadata dispo
  
      addListener(video, 'loadedmetadata', safeSeek, { once: true });
      addListener(video, 'canplay',        safeSeek, { once: true });
  
      const t = setTimeout(safeSeek, 150);  // fallback Safari iOS & cas capricieux
      removers.push(() => clearTimeout(t));
    }
  
    /* ------------------- Liaison play/pause <-> player global -------------- */
    function bindVideoPlaybackControls(video) {
      if (!video) return;
  
      const onPlay = () => {
        try {
          if (!globalPausedByThis) {
            const did = tryPauseGlobalPlayer();
            if (did) globalPausedByThis = true;
          }
        } catch {}
        try { video.setAttribute('data-playing', 'true'); } catch {}
      };
  
      const onPauseOrEnded = (evt) => {
        try { video.removeAttribute('data-playing'); } catch {}
        const shouldResume = evt && evt.type === 'ended';
        if (shouldResume && globalPausedByThis) {
          const resumed = tryResumeGlobalPlayer();
          if (resumed) globalPausedByThis = false;
        }
      };
  
      addListener(video, 'play',  onPlay);
      addListener(video, 'pause', onPauseOrEnded);
      addListener(video, 'ended', onPauseOrEnded);
  
      // UX: si l’utilisateur scrube, on retire juste l’attribut
      addListener(video, 'seeking', () => { try { video.removeAttribute('data-playing'); } catch {} });
    }
  
    /* ------------------------------- INIT ---------------------------------- */
    // container = <main data-pjax-root data-page="rencontre"> (fourni par page-hub) ou auto-sélection
    function init(container) {
      if (booted) return;
      booted = true;
  
      const rootEl = container || document.querySelector('main[data-pjax-root][data-page="rencontre"]');
      if (!rootEl) {
        console.warn('[Rencontre] init: container introuvable');
        return;
      }
  
      try {
        // Pause du player global à l’entrée de page
        try {
          const did = tryPauseGlobalPlayer();
          if (did) {
            globalPausedByThis = true;
            try { console.info('[Rencontre] Player global pausé'); } catch {}
          }
        } catch {}
  
        // 1) Sélectionne les vidéos de la page
        const videos = Array.from(rootEl.querySelectorAll('.carte-lecteur-video video'));
  
        videos.forEach((video) => {
          try { video.setAttribute('data-page', 'rencontre'); } catch {}
  
          // 🚫 ANTI DOUBLE-BINDING
          // - Si un composant tiers (ex: components/video-card.js) a déjà posé un flag __vc_init
          //   et que ce n’est PAS le nôtre, on SKIP totalement pour éviter conflits.
          if (video.__vc_init && video.__vc_init_by && video.__vc_init_by !== 'rencontre') {
            return;
          }
          // - Si le flag existe sans provenance (par prudence), on SKIP aussi.
          if (video.__vc_init && !video.__vc_init_by) {
            return;
          }
  
          // ✅ Nous initialisons → posons un flag nominatif
          try {
            video.__vc_init = true;
            video.__vc_init_by = 'rencontre';
          } catch {}
  
          // Seek initial + binder les handlers lecture/pause
          seekStableFrame(video);
          bindVideoPlaybackControls(video);
        });
  
        // 2) Si l’onglet perd le focus, on met en pause les vidéos en cours (UX)
        const onVisibility = () => {
          if (document.hidden) {
            Array.from(rootEl.querySelectorAll('.carte-lecteur-video video')).forEach(v => {
              try { if (!v.paused) v.pause(); } catch {}
            });
          }
        };
        addListener(document, 'visibilitychange', onVisibility);
  
        // 3) Mobile UX : refermer le menu Bootstrap après clic sur un lien interne
        const navLinks = rootEl.querySelectorAll('#main-navbar .nav-link');
        navLinks.forEach(link => {
          addListener(link, 'click', () => {
            try {
              const collapseEl = document.querySelector('#main-navbar.collapse.show') || document.querySelector('#main-navbar');
              if (!collapseEl) return;
  
              if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
                try {
                  const bs = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, { toggle: false });
                  bs.hide();
                } catch {
                  collapseEl.classList.remove('show');
                }
              } else {
                collapseEl.classList.remove('show');
              }
            } catch {}
          });
        });
  
        // 4) Petit hook debug
        root.Rencontre = root.Rencontre || {};
        root.Rencontre.__meta = { bootedAt: new Date().toISOString(), videos: videos.length };
  
      } catch (err) {
        console.warn('[Rencontre] init error', err);
      }
    }
  
    /* ------------------------------ DESTROY -------------------------------- */
    function destroy() {
      // Reprise du player global si nous l’avions pausé
      if (globalPausedByThis) {
        tryResumeGlobalPlayer();
        globalPausedByThis = false;
      }
  
      // Retire tous les listeners/timeout enregistrés
      while (removers.length) {
        try {
          const fn = removers.pop();
          if (typeof fn === 'function') fn();
        } catch {}
      }
  
      // Nettoie UNIQUEMENT les flags posés par CE module
      try {
        const rootEl = document.querySelector('main[data-pjax-root][data-page="rencontre"]') || document;
        rootEl.querySelectorAll('.carte-lecteur-video video').forEach(v => {
          try {
            if (v.__vc_init_by === 'rencontre') {
              delete v.__vc_init;
              delete v.__vc_init_by;
            }
          } catch {}
        });
      } catch {}
  
      // Optionnel : vider le WeakSet (pas nécessaire fonctionnellement)
      // (on laisse le GC faire son travail)
  
      booted = false;
      if (root.Rencontre && root.Rencontre.__meta) delete root.Rencontre.__meta;
    }
  
    /* ----------------------- Exposition & Auto-boot ------------------------ */
    root.Rencontre = root.Rencontre || { init, destroy };
    root.Pages = root.Pages || {};
    root.Pages.rencontre = root.Pages.rencontre || { init, destroy };
  
    // Auto-boot si DOM déjà prêt et qu’on est sur la page (fallback direct-load)
    if (document.readyState !== 'loading') {
      const el = document.querySelector('main[data-pjax-root][data-page="rencontre"]');
      if (el) init(el);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        const el = document.querySelector('main[data-pjax-root][data-page="rencontre"]');
        if (el) init(el);
      }, { once: true });
    }
  })(window);
  