// assets/js/player-singleton.js
// Lecteur audio persistant (singleton) + reprise après reload + compat PJAX.
// Version consolidée : setPlayerSrcSafely(), playWithRetry(), diagnostics, playlist,
// locks scroll idempotents, preserveAudio flag pour ignorer pause PJAX,
// expose window.AudioApp (feature-rich) et window.PlayerSingleton (façade).
//
// ⚠️ Sauvegarde une copie avant remplacement.

(function (window, document) {
  'use strict';

  /* =========================
     Utils scroll-lock idempotents
     ========================= */
  function lockBodyScroll() {
    const b = document.body;
    const current = Math.max(0, parseInt(b.dataset._scrollLockCount || '0', 10));
    const next = current + 1;
    b.dataset._scrollLockCount = String(next);

    if (next === 1) {
      b.dataset._prevOverflow = b.style.overflow || '';
      b.dataset._prevPaddingRight = b.style.paddingRight || '';
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) b.style.paddingRight = `${scrollbarWidth}px`;
      b.style.overflow = 'hidden';
      console.debug('[player-singleton] lockBodyScroll applied (count=1)');
    } else {
      console.debug('[player-singleton] lockBodyScroll increment (count=%s)', next);
    }
  }
  function unlockBodyScroll() {
    const b = document.body;
    const current = Math.max(0, parseInt(b.dataset._scrollLockCount || '0', 10));
    const next = Math.max(0, current - 1);

    if (next === 0) {
      b.style.overflow = b.dataset._prevOverflow || '';
      b.style.paddingRight = b.dataset._prevPaddingRight || '';
      delete b.dataset._prevOverflow;
      delete b.dataset._prevPaddingRight;
      delete b.dataset._scrollLockCount;
      console.debug('[player-singleton] unlockBodyScroll fully removed');
    } else {
      b.dataset._scrollLockCount = String(next);
      console.debug('[player-singleton] unlockBodyScroll decremented (count=%s)', next);
    }
  }
  window.__utils = window.__utils || {};
  window.__utils.lockBodyScroll = window.__utils.lockBodyScroll || lockBodyScroll;
  window.__utils.unlockBodyScroll = window.__utils.unlockBodyScroll || unlockBodyScroll;

  // CSS runtime pour stabiliser le scrollbar (évite layout shift)
  (function(){
    try {
      if (!document.getElementById('player-scroll-fallback-styles')) {
        const css = `
          html { scrollbar-gutter: stable; }
          @supports not (scrollbar-gutter: stable) { html { overflow-y: scroll; } }
        `;
        const st = document.createElement('style');
        st.id = 'player-scroll-fallback-styles';
        st.appendChild(document.createTextNode(css));
        document.head && document.head.appendChild(st);
      }
    } catch(e) { console.warn('[player-singleton] failed injecting scrollbar CSS', e); }
  })();

  /* =========================
     Bloc principal (idempotent)
     ========================= */
  (function() {
    const TAG = '[player-singleton]';
    const TAG_OV = '[player-singleton][overlay]';
    const isFirefox = typeof navigator !== 'undefined' && /Firefox\/\d+/i.test(navigator.userAgent);

    function log(...a) { if (isFirefox) console.info(TAG, '(Firefox)', ...a); else console.info(TAG, ...a); }
    function debug(...a) { if (isFirefox) console.debug(TAG, '(Firefox)', ...a); else console.debug(TAG, ...a); }
    function warn(...a) { if (isFirefox) console.warn(TAG, '(Firefox)', ...a); else console.warn(TAG, ...a); }
    function err(...a)  { if (isFirefox) console.error(TAG, '(Firefox)', ...a); else console.error(TAG, ...a); }

    // Idempotence : ne pas ré-init si déjà présent
    if (window.AudioApp && window.AudioApp.initialized) {
      log('déjà initialisé — skip');
      // still ensure PlayerSingleton façade is present and linked
    }

    // Helper breakpoint
    function isDesktop() { return window.innerWidth >= 992; }
    function ensureBodyUnblockedOnDesktop() {
      const b = document.body; if (!b) return;
      if (b.style.overflow === 'hidden') b.style.overflow = '';
      if (b.style.paddingRight && !b.dataset?._scrollLockCount) b.style.paddingRight = '';
    }

    /* ------------------------------------------------------------------------
       DOM refs (safe)
    ------------------------------------------------------------------------ */
    const player       = document.getElementById('audioPlayer');
    const playBtn      = document.getElementById('toggleBtn');
    const stopBtn      = document.getElementById('stopBtn');
    const nextBtn      = document.getElementById('nextBtn');
    const prevBtn      = document.getElementById('prevBtn');
    const progress     = document.getElementById('progress');
    const volume       = document.getElementById('volume');
    const timeDisplay  = document.getElementById('timeDisplay');
    const trackTitle   = document.getElementById('trackTitle');
    const cover        = document.getElementById('cover');
    const infoPanel    = document.getElementById('infoPanel');
    const logo         = document.querySelector('.navbar-brand img');
    const toggleButton = document.getElementById('openAudioPlayer');
    const modalEl      = document.getElementById('audioPlayerModal');
    const closeBtn     = document.getElementById('closePlayerModal');
    const dragBar      = document.getElementById('dragBar');
    const wrapperEl    = document.getElementById('responsiveWrapper');

    if (!player) {
      warn(`${TAG} #audioPlayer absent — singleton non initialisé sur cette page`);
      // Provide a minimal PlayerSingleton façade even if there's no DOM player
      exposeFacade(null);
      // still expose minimal AudioApp to avoid errors elsewhere
      window.AudioApp = window.AudioApp || {};
      Object.assign(window.AudioApp, { initialized: false });
      return;
    }

    /* ============================
       Overlay / Poster suppression
       - inject CSS override (idempotent)
       - remove poster attributes
       - remove overlay DOM nodes if present
       - observe insertions par MutationObserver (PJAX)
    ============================ */

    function injectOverlayHideCSS() {
      try {
        if (document.getElementById('player-overlay-hide-styles')) return;
        const css = `
          /* Cacher le grand bouton overlay / poster des players vendors (MediaElement etc.) */
          .mejs-overlay-play,
          .mejs-overlay-button,
          .mejs-poster .mejs-playpause-button,
          .mejs-layer .mejs-playpause-button,
          .mejs-poster { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }

          /* Si la couche vient d'un autre vendor */
          .player-overlay, .audio-overlay { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }

          /* Garde les contrôles de la timeline / bouton small play */
          .mejs-controls, .mejs-controls * { visibility: visible !important; opacity: 1 !important; }
        `;
        const st = document.createElement('style');
        st.id = 'player-overlay-hide-styles';
        st.appendChild(document.createTextNode(css));
        document.head && document.head.appendChild(st);
        debug(TAG_OV, 'CSS override injected');
      } catch (e) {
        warn(TAG_OV, 'failed to inject overlay hide CSS', e);
      }
    }

    function removePosterAttributes(el) {
      try {
        if (!el) el = player;
        if (!el) return;
        // remove common attributes/data that create posters
        if (el.hasAttribute && el.hasAttribute('poster')) { el.removeAttribute('poster'); debug(TAG_OV, 'removed poster attribute from audio element'); }
        if (el.dataset && el.dataset.poster) { delete el.dataset.poster; debug(TAG_OV, 'removed data-poster'); }
        // remove inline poster sources
        const imgs = el.querySelectorAll ? el.querySelectorAll('img[poster], img[data-poster]') : [];
        imgs.forEach(i => { try { i.remove(); } catch(e){} });
      } catch (e) { warn(TAG_OV, 'removePosterAttributes error', e); }
    }

    function removeOverlayDOM() {
      try {
        const selectors = [
          '.mejs-overlay-play',
          '.mejs-overlay-button',
          '.mejs-poster',
          '.mejs-layer .mejs-playpause-button',
          '.player-overlay',
          '.audio-overlay'
        ];
        const nodes = document.querySelectorAll(selectors.join(','));
        if (!nodes || nodes.length === 0) { debug(TAG_OV, 'no overlay nodes found'); return; }
        nodes.forEach(n => {
          try {
            // prefer hide over remove if other code expects node (avoid breaking)
            n.style.display = 'none';
            n.style.visibility = 'hidden';
            // try to remove if safe
            if (n.parentNode) try { n.parentNode.removeChild(n); debug(TAG_OV, 'overlay node removed', n); } catch(e){ debug(TAG_OV, 'overlay node hide only', e); }
          } catch(e) { debug(TAG_OV, 'failed to remove overlay node', e); }
        });
      } catch (e) { warn(TAG_OV, 'removeOverlayDOM error', e); }
    }

    // Sweep agressif pendant un court laps de temps pour blindage total
    function hardOverlaySweep(durationMs = 800, everyMs = 80) {
      try {
        if (window._playerOverlaySweepId) return; // déjà en cours
        const startedAt = Date.now();
        const tick = () => {
          try { removeOverlayDOM(); removePosterAttributes(); } catch {}
          if (Date.now() - startedAt >= durationMs) {
            if (window._playerOverlaySweepId) {
              clearInterval(window._playerOverlaySweepId);
              window._playerOverlaySweepId = 0;
            }
          }
        };
        window._playerOverlaySweepId = setInterval(tick, Math.max(30, everyMs));
        // premier passage immédiat
        tick();
        debug(TAG_OV, 'hardOverlaySweep started (duration=%sms, step=%sms)', durationMs, everyMs);
      } catch (e) { warn(TAG_OV, 'hardOverlaySweep error', e); }
    }

    function setupOverlayGuard() {
      injectOverlayHideCSS();
      removePosterAttributes();
      removeOverlayDOM();
      // blindage court et agressif pour rattraper les insertions tardives
      hardOverlaySweep(900, 75);

      // observe for late insertions (PJAX / vendor init)
      try {
        if (window._playerOverlayObserver) {
          debug(TAG_OV, 'overlay MutationObserver already present — skipping re-create');
          return;
        }
        const obs = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.type === 'childList' && (m.addedNodes && m.addedNodes.length)) {
              // If any added node matches overlay pattern -> remove/hide them
              for (const n of m.addedNodes) {
                if (!(n instanceof HTMLElement)) continue;
                if (n.matches && (n.matches('.mejs-overlay-play, .mejs-overlay-button, .mejs-poster, .player-overlay, .audio-overlay') ||
                    n.querySelector && (n.querySelector('.mejs-overlay-play, .mejs-overlay-button, .mejs-poster, .player-overlay, .audio-overlay')))) {
                  debug(TAG_OV, 'overlay node added -> removing/hiding', n);
                  try { n.style.display = 'none'; n.style.visibility = 'hidden'; } catch(e){}
                  try { if (n.parentNode) n.parentNode.removeChild(n); } catch(e){ debug(TAG_OV, 'unable to remove added overlay node', e); }
                }
              }
            }
            // attribute changes (poster attribute added)
            if (m.type === 'attributes' && m.target && m.target instanceof HTMLElement) {
              const t = m.target;
              if (t.hasAttribute && t.hasAttribute('poster')) {
                debug(TAG_OV, 'poster attribute detected on element -> removing', t);
                try { t.removeAttribute('poster'); } catch(e){}
              }
              if (t.dataset && t.dataset.poster) {
                debug(TAG_OV, 'data-poster detected -> deleting', t);
                try { delete t.dataset.poster; } catch(e){}
              }
            }
          }
        });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['poster'] });
        window._playerOverlayObserver = obs;
        debug(TAG_OV, 'overlay MutationObserver attached');
      } catch (e) {
        warn(TAG_OV, 'failed to attach overlay MutationObserver', e);
      }
    }

    // Nettoyage "dur" (forcé) — appelé avant navigation PJAX / déchargement
    function hardOverlayCleanup() {
      try {
        if (window._playerOverlaySweepId) { try { clearInterval(window._playerOverlaySweepId); } catch {} window._playerOverlaySweepId = 0; }
        if (window._playerOverlayObserver && window._playerOverlayObserver.disconnect) {
          try { window._playerOverlayObserver.disconnect(); } catch {}
          window._playerOverlayObserver = null;
        }
        removePosterAttributes();
        removeOverlayDOM();
        // remove custom poster overlays used on some project pages
        try {
          document.querySelectorAll('.video-poster-overlay').forEach(n => { try { n.remove(); } catch {} });
        } catch {}
        // remove mejs containers created for page-scoped players (but keep the global audio player)
        try {
          const root = document.querySelector('main[data-pjax-root]');
          if (root) {
            root.querySelectorAll('.mejs-container').forEach(el => {
              try {
                if (!el.contains(document.getElementById('audioPlayer'))) el.remove();
              } catch {}
            });
          }
        } catch {}
        // supprimer les modales locales à la page (mais conserver les globales hors <main>)
        try {
          const root = document.querySelector('main[data-pjax-root]');
          if (root) {
            root.querySelectorAll('.modal-overlay').forEach(n => { try { n.remove(); } catch {} });
          }
        } catch {}
        // Forcer la libération des verrous de scroll si aucun modal ouvert
        try {
          const b = document.body;
          if (b) {
            delete b.dataset._scrollLockCount;
            delete b.dataset._prevOverflow;
            delete b.dataset._prevPaddingRight;
            b.style.overflow = '';
            b.style.paddingRight = '';
          }
        } catch {}
        debug(TAG_OV, 'hardOverlayCleanup executed');
      } catch (e) { warn(TAG_OV, 'hardOverlayCleanup error', e); }
    }

    /* ------------------------------------------------------------------------
       Optionnel : si MediaElementPlayer est présent, instancier sans poster/overlay
       (safely : ne pas créer plusieurs instances)
    ------------------------------------------------------------------------ */
    function safeInitMediaElementPlayer() {
      try {
        if (typeof MediaElementPlayer === 'undefined') {
          debug('MediaElementPlayer not present — skipping vendor instantiation');
          return;
        }
        // Avoid double-init: check for a wrapper or data attribute
        const already = player.dataset && player.dataset._mediaelement_init;
        if (already) { debug('mediaelement already initialized (data flag)'); return; }

        // Best-effort options to keep controls but remove poster behaviour
        const opts = {
          features: ['playpause','current','duration','progress','volume'], // smaller feature set
          alwaysShowControls: true,
          // disable showing poster on start if vendor supports option
          // showPosterOnStart: false, // some versions support it - keep commented for safety
          // responsive: true,
          // enableAutosize: false,
          // set pluginPath empty to avoid plugin lookups that are irrelevant for audio-only
          pluginPath: '',
          // success callback for debugging
          success: function(mediaElement, originalNode) {
            try {
              debug('MediaElementPlayer success callback: mediaElement ready', mediaElement, originalNode);
              // remove residual attributes
              if (originalNode && originalNode.removeAttribute) originalNode.removeAttribute('poster');
            } catch(e){ debug('mediaelement success callback error', e); }
          }
        };

        // instantiate (wrap in try/catch)
        try {
          // some vendor impl expect a wrapper or ID
          new MediaElementPlayer(player, opts);
          if (player.dataset) player.dataset._mediaelement_init = '1';
          debug('MediaElementPlayer instantiated (safe options)');
        } catch (e) {
          warn('MediaElementPlayer instantiation failed', e);
        }
      } catch (e) {
        warn('safeInitMediaElementPlayer error', e);
      }
    }

    // Apply overlay guard immediately (idempotent)
    setupOverlayGuard();
    // Try vendor instantiation after guard
    safeInitMediaElementPlayer();

    // Also call overlay guard on critical events (PJAX, DOM ready)
    window.addEventListener('DOMContentLoaded', () => { setupOverlayGuard(); safeInitMediaElementPlayer(); });
    document.addEventListener('pjax:ready', () => { setupOverlayGuard(); safeInitMediaElementPlayer(); });
    window.addEventListener('pageshow', () => { setupOverlayGuard(); safeInitMediaElementPlayer(); });
    // Hard cleanup juste avant navigation
    document.addEventListener('pjax:before', () => { hardOverlayCleanup(); });
    window.addEventListener('beforeunload', () => { hardOverlayCleanup(); });

    /* ------------------------------------------------------------------------
       Safe helpers to avoid accessing player when null
    ------------------------------------------------------------------------ */
    function isPlayerAvailable() { return !!player; }
    function isPlaying() {
      try {
        if (!isPlayerAvailable()) return false;
        return !player.paused && !player.ended && (player.currentTime || 0) > 0;
      } catch (e) {
        warn('isPlaying() error', e);
        return false;
      }
    }
    function safeGetCurrentSrc() {
      try { return isPlayerAvailable() ? (player.currentSrc || player.src || '') : ''; } catch { return ''; }
    }
    function safeGetCurrentTime() {
      try { return isPlayerAvailable() ? (player.currentTime || 0) : 0; } catch { return 0; }
    }
    function safeSetCurrentTime(t) {
      try { if (!isPlayerAvailable()) return; if (typeof t === 'number' && !Number.isNaN(t)) player.currentTime = t; } catch (e) { warn('safeSetCurrentTime failed', e); }
    }
    function safePause() {
      try {
        if (!isPlayerAvailable()) {
          warn('safePause() called but #audioPlayer not found — ignoring');
          return;
        }
        try { player.pause(); } catch (e) { warn('player.pause() failed', e); }
      } catch (e) {
        warn('safePause error', e);
      }
    }

    /* ------------------------------------------------------------------------
       Helpers robustes : setPlayerSrcSafely / playWithRetry + diagnostics
    ------------------------------------------------------------------------ */
    function setPlayerSrcSafely(src) {
      try {
        if (!isPlayerAvailable()) { warn('setPlayerSrcSafely: player absent'); return; }
        const cur = safeGetCurrentSrc();
        if (!src) { player.removeAttribute('src'); try{player.load();}catch{} return; }
        // Normalise et encode l'URL si besoin (espaces, accents)
        let next = String(src || '').trim();
        try {
          // Si c'est une URL absolue valide, on l'utilise telle quelle
          const u = new URL(next, window.location.origin);
          next = u.href;
        } catch {
          try { next = encodeURI(next); } catch {}
        }
        if (cur && (cur === next || cur === src)) return;
        safePause();
        try {
          player.setAttribute('crossorigin','anonymous');
          try { player.crossOrigin = 'anonymous'; } catch {}
          try { player.setAttribute('playsinline',''); } catch {}
          player.src = next;
          player.load();
        } catch (e) {
          try { player.setAttribute('src', next); player.load(); } catch (e2) { warn('set src failed', e, e2); }
        }
        // after setting src ensure overlay removed (in case vendor created poster)
        removePosterAttributes(player);
        removeOverlayDOM();
      } catch (err) { warn('setPlayerSrcSafely error', err); }
    }

    async function playWithRetry(attempts = 3, delayMs = 300) {
      if (!isPlayerAvailable()) { warn('playWithRetry: player absent'); return false; }
      for (let i = 0; i < attempts; i++) {
        try {
          await player.play();
          debug('play() succeeded (attempt %s)', i+1);
          return true;
        } catch (e) {
          warn('play() attempt %s failed:', i+1, e);
          if (i === attempts - 1) return false;
          await new Promise(r => setTimeout(r, delayMs * (i + 1)));
        }
      }
      return false;
    }

    // Diagnostics audio utiles
    player.addEventListener('error', (ev) => {
      const code = (player.error && player.error.code) || 'unknown';
      err('audio error', code, ev);
    });
    player.addEventListener('stalled', () => warn('stalled event'));
    player.addEventListener('suspend', () => warn('suspend event'));
    player.addEventListener('waiting', () => debug('waiting for data'));

    /* ------------------------------------------------------------------------
       Policy meta (snapshot/reprise cross-PJAX)
    ------------------------------------------------------------------------ */
    const KEY_FORCED = 'audioForcedState';
    function pauseForPolicy() {
      try {
        const wasPlaying = isPlaying();
        const snap = { src: safeGetCurrentSrc(), t: safeGetCurrentTime(), wasPlaying };
        try { sessionStorage.setItem(KEY_FORCED, JSON.stringify(snap)); } catch {}
        safePause();
      } catch (e) { warn('pauseForPolicy error', e); }
    }
    async function resumeIfForcedAllowed() {
      try {
        let raw; try { raw = sessionStorage.getItem(KEY_FORCED); } catch {}
        if (!raw) return;
        let s; try { s = JSON.parse(raw); } catch { s = null; }
        if (!s || !s.wasPlaying) { try { sessionStorage.removeItem(KEY_FORCED); } catch {}; return; }
        try {
          if (s.src) setPlayerSrcSafely(s.src);
          if (s.t)   safeSetCurrentTime(s.t);
          const ok = await playWithRetry(3, 300);
          if (!ok) warn('reprise refusée par le navigateur (policy/autoplay)');
        } finally {
          try { sessionStorage.removeItem(KEY_FORCED); } catch {}
        }
      } catch (e) { warn('resumeIfForcedAllowed error', e); }
    }
    function applyAudioPolicy() {
      const meta = document.querySelector('meta[name="audio-policy"]');
      const p = meta ? (meta.content || '').toLowerCase() : 'allow';
      if (p === 'pause' || p === 'mute' || p === 'block') pauseForPolicy();
      else resumeIfForcedAllowed();
    }
    window.addEventListener('DOMContentLoaded', applyAudioPolicy);
    document.addEventListener('pjax:ready',   applyAudioPolicy);
    window.addEventListener('pageshow',       applyAudioPolicy);

    /* ------------------------------------------------------------------------
       Session state
    ------------------------------------------------------------------------ */
    let playlist = [];
    let trackIndex = 0;
    let playlistReady = false;

    let _lastSave = 0;
    const SAVE_MS = 800;
    function throttleSave(fn) {
      const now = (performance && performance.now) ? performance.now() : Date.now();
      if (now - _lastSave > SAVE_MS) { _lastSave = now; try { fn(); } catch (e) { err('throttleSave error', e); } }
    }

    function restoreSession() {
      try {
        const raw = sessionStorage.getItem('audioState');
        if (!raw) return false;
        const s = JSON.parse(raw);
        const src   = s.src || '';
        const time  = typeof s.time === 'number' ? s.time : (typeof s.t === 'number' ? s.t : 0);
        const play  = typeof s.playing === 'boolean' ? s.playing : (typeof s.paused === 'boolean' ? !s.paused : false);
        const vol   = typeof s.volume === 'number' ? s.volume : undefined;
        const index = typeof s.index  === 'number' ? s.index  : undefined;
        const title = s.title || '';
        const coverSrc = s.coverSrc || '';
        const autoAdvance = typeof s.autoAdvance === 'boolean' ? s.autoAdvance : true;

        if (index !== undefined) trackIndex = index;
        if (src) setPlayerSrcSafely(src);
        if (vol !== undefined && isPlayerAvailable()) {
          try { player.volume = Math.max(0, Math.min(1, vol)); } catch(e) { warn('restore volume failed', e); }
          if (volume) volume.value = String(Math.round((vol || 0) * 100));
        }
        if (trackTitle && title) trackTitle.textContent = title;
        const img = cover?.querySelector('img'); if (img && coverSrc) img.src = coverSrc;

        try { sessionStorage.setItem('audio_auto_advance', JSON.stringify(autoAdvance)); } catch {}

        const setTime = (t) => { if (t && t > 0.2) safeSetCurrentTime(t); };
        if (isPlayerAvailable() && player.readyState >= 1) setTime(time);
        else if (isPlayerAvailable()) {
          const once = () => { player.removeEventListener('loadedmetadata', once); setTime(time); };
          player.addEventListener('loadedmetadata', once);
        }

        if (play) {
          playWithRetry(3, 300).then((ok) => {
            if (!ok) { warn('restoreSession → play refusé'); return; }
            playBtn?.classList.add('playing');
            cover?.classList.add('playing');
            infoPanel?.classList.add('open');
            toggleButton?.classList.add('playing', 'large');
            logo?.classList.add('glow-on-play');
          });
        }
        log('session restaurée (index=%s, src=%s, autoAdvance=%s)', trackIndex, src, autoAdvance);
        return true;
      } catch (e) { err('restoreSession failed', e); return false; }
    }

    function saveSession(force = false) {
      const doSave = () => {
        const st = {
          src: safeGetCurrentSrc(),
          time: safeGetCurrentTime(),
          volume: (isPlayerAvailable() ? player.volume : 0),
          playing: isPlaying(),
          index: trackIndex,
          title: trackTitle?.textContent || '',
          coverSrc: cover?.querySelector('img')?.src || '',
          autoAdvance: getAutoAdvance()
        };
        try { sessionStorage.setItem('audioState', JSON.stringify(st)); } catch (e) { warn('saveSession failed', e); }
      };
      if (force) { try { doSave(); } catch (e) { warn('forced save error', e); } ; return; }
      throttleSave(doSave);
    }
    window.addEventListener('beforeunload', () => saveSession(true));

    /* ------------------------------------------------------------------------
       Playlist loading
    ------------------------------------------------------------------------ */
    const PLAYLIST_CANDIDATES = [
      '/assets/audio/auto_radio/js/playlist.json',
      '/assets/audio/auto_radio/js/playlist.json'
    ];
    async function fetchFirstOk(urls) {
      let lastErr;
      for (const u of urls) {
        try {
          debug('fetching playlist candidate:', u);
          const res = await fetch(u, { cache: 'force-cache' });
          if (res.ok) {
            log('playlist chargée depuis', u);
            return res.json();
          }
          lastErr = new Error(`HTTP ${res.status} on ${u}`);
        } catch (e) { lastErr = e; }
      }
      throw lastErr || new Error('Aucun chemin playlist disponible');
    }
    async function loadPlaylist() {
      try {
        const data = await fetchFirstOk(PLAYLIST_CANDIDATES);
        if (!Array.isArray(data) || data.length === 0) throw new Error('Playlist vide ou mal formée.');
        playlist = data;
        playlistReady = true;
        log('playlist prête (count=%s)', playlist.length);

        const hadState = !!sessionStorage.getItem('audioState');
        if (!hadState) {
          trackIndex = Math.floor(Math.random() * playlist.length);
          setTrack(trackIndex, false); // préremplir UI sans autoplay
        } else {
          const t = playlist[trackIndex];
          if (t) {
            if (trackTitle && !trackTitle.textContent) trackTitle.textContent = t.title || '';
            const img = cover?.querySelector('img');
            if (img && (!img.src || img.src.startsWith('data:'))) img.src = t.cover || img.src;
          }
        }
        // After playlist loaded ensure overlays removed (some vendors initialize on load)
        setupOverlayGuard();
      } catch (error) {
        err('Erreur playlist :', error);
        if (trackTitle) trackTitle.textContent = 'Erreur de chargement de la playlist.';
      }
    }

    /* ------------------------------------------------------------------------
       Auto-advance toggle
    ------------------------------------------------------------------------ */
    const AUTO_ADV_KEY = 'audio_auto_advance';
    function getAutoAdvance() {
      try {
        const raw = sessionStorage.getItem(AUTO_ADV_KEY);
        if (raw === null) return true; // default ON
        return JSON.parse(raw);
      } catch { return true; }
    }
    function setAutoAdvance(v) {
      try { sessionStorage.setItem(AUTO_ADV_KEY, JSON.stringify(Boolean(v))); } catch {}
    }

    /* ------------------------------------------------------------------------
       setTrack, advance, error/ended handlers
    ------------------------------------------------------------------------ */
    function setTrack(i, play = true) {
      if (!playlistReady || !playlist[i]) {
        warn('setTrack called but playlist not ready or index invalid (i=%s)', i);
        return;
      }
      trackIndex = i;
      const track = playlist[i];
      const newSrc = track?.src || '';
      log('setTrack -> index=%s title="%s" src=%s', i, track?.title || 'n/a', newSrc);

      setPlayerSrcSafely(newSrc);

      if (trackTitle) trackTitle.textContent = track?.title || '';
      const img = cover?.querySelector('img');
      if (img && track?.cover) img.src = track.cover;

      if (!play) { saveSession(true); return; }

      const startPlay = () => {
        // Nudge: certaines plateformes demandent un léger décalage au démarrage
        try { if (player.currentTime === 0) player.currentTime = 0.0001; } catch {}
        try { player.muted = false; } catch {}
        playWithRetry(4, 350).then((ok) => {
          if (ok) {
            log('lecture démarrée (index=%s)', trackIndex);
            playBtn?.classList.add('playing');
            cover?.classList.add('playing');
            infoPanel?.classList.add('open');
            toggleButton?.classList.add('playing', 'large');
            logo?.classList.add('glow-on-play');
            saveSession(true);
          } else {
            err('échec de lecture après retries — on passe à la piste suivante');
            if (playlist && playlist.length > 1) {
              const nextIndex = (trackIndex + 1) % playlist.length;
              setTimeout(() => setTrack(nextIndex, true), 200);
            } else {
              saveSession(true);
            }
          }
        });
      };

      if (player.readyState >= 2) {
        startPlay();
      } else {
        const once = () => { player.removeEventListener('canplay', once); startPlay(); };
        player.addEventListener('canplay', once, { once: true });
        // Fallback timer au cas où canplay tarde
        setTimeout(() => { try { player.removeEventListener('canplay', once); } catch{} startPlay(); }, 1200);
      }
    }

    function advanceToNextTrack() {
      if (!playlistReady || !playlist.length) { debug('advanceToNextTrack: playlist not ready'); return; }
      trackIndex = (trackIndex + 1) % playlist.length;
      log('advanceToNextTrack -> newIndex=%s', trackIndex);
      setTrack(trackIndex, true);
    }
    function advanceToPrevTrack() {
      if (!playlistReady || !playlist.length) { debug('advanceToPrevTrack: playlist not ready'); return; }
      trackIndex = (trackIndex - 1 + playlist.length) % playlist.length;
      log('advanceToPrevTrack -> newIndex=%s', trackIndex);
      setTrack(trackIndex, true);
    }

    function onEndedHandler() {
      log('event: ended (index=%s)', trackIndex);
      toggleButton?.classList.remove('playing', 'large');
      logo?.classList.remove('glow-on-play');
      if (getAutoAdvance()) {
        advanceToNextTrack();
      } else {
        log('auto-advance disabled — arrêt sur la piste courante');
        saveSession(true);
      }
    }
    function onErrorHandler(ev) {
      warn('event: error on audio element', ev, player.error);
      setTimeout(() => {
        if (playlist && playlist.length) {
          const nextIndex = (trackIndex + 1) % playlist.length;
          log('skipping to next due to error -> %s', nextIndex);
          setTrack(nextIndex, true);
        }
      }, 250);
    }

    try { player.removeEventListener('ended', onEndedHandler); } catch {}
    try { player.removeEventListener('error', onErrorHandler); } catch {}
    player.addEventListener('ended', onEndedHandler);
    player.addEventListener('error', onErrorHandler);

    /* ------------------------------------------------------------------------
       Controls bindings
    ------------------------------------------------------------------------ */
    async function ensurePlaylistReadyAndTrack() {
      try {
        if (!playlistReady || !playlist?.length) {
          await loadPlaylist();
        }
        if (!player.src && playlistReady && playlist.length) {
          if (!(trackIndex >= 0 && trackIndex < playlist.length)) {
            trackIndex = Math.floor(Math.random() * playlist.length);
          }
          setTrack(trackIndex, false);
        }
      } catch (e) { warn('ensurePlaylistReadyAndTrack error', e); }
    }

    const onToggle = async () => {
      await ensurePlaylistReadyAndTrack();
      if (!isPlayerAvailable()) { warn('toggle requested but player absent'); return; }
      if (player.paused) {
        // Nudge certains navigateurs pour éviter un premier play silencieux
        try { if (player.currentTime === 0) player.currentTime = 0.0001; } catch {}
        try { player.muted = false; } catch {}
        const ok = await playWithRetry(3, 300);
        if (ok) {
          playBtn?.classList.add('playing');
          cover?.classList.add('playing');
          infoPanel?.classList.add('open');
          toggleButton?.classList.add('playing', 'large');
          logo?.classList.add('glow-on-play');
          playBtn?.setAttribute('aria-pressed', 'true');
          saveSession();
          log('action: play');
        } else {
          err('play() rejected from toggle');
          if (playlistReady && playlist.length) setTrack(trackIndex, true);
        }
      } else {
        safePause();
        playBtn?.classList.remove('playing');
        cover?.classList.remove('playing');
        infoPanel?.classList.remove('open');
        toggleButton?.classList.remove('playing', 'large');
        logo?.classList.remove('glow-on-play');
        playBtn?.setAttribute('aria-pressed', 'false');
        saveSession();
        log('action: pause');
      }
    };
    playBtn?.addEventListener('click', onToggle);

    const onStop = () => {
      if (!playlistReady && !player.src) return;
      safePause();
      try { safeSetCurrentTime(0); } catch {}
      playBtn?.classList.remove('playing');
      cover?.classList.remove('playing');
      infoPanel?.classList.remove('open');
      toggleButton?.classList.remove('playing', 'large');
      logo?.classList.remove('glow-on-play');
      saveSession(true);
      log('action: stop');
    };
    stopBtn?.addEventListener('click', onStop);

    nextBtn?.addEventListener('click', advanceToNextTrack);
    prevBtn?.addEventListener('click', advanceToPrevTrack);

    player.addEventListener('timeupdate', () => {
      if (isPlayerAvailable() && player.duration && progress) {
        const v = (player.currentTime / player.duration) * 100;
        if (!Number.isNaN(v)) progress.value = String(v);
      }
      if (timeDisplay && isPlayerAvailable()) {
        const m = Math.floor(player.currentTime / 60);
        const s = Math.floor(player.currentTime % 60).toString().padStart(2, '0');
        timeDisplay.textContent = `${m}:${s}`;
      }
      saveSession(); // throttled
    });
    progress?.addEventListener('input', (e) => {
      if (!isPlayerAvailable() || !player.duration) return;
      const raw = e.target.valueAsNumber ?? parseFloat(e.target.value);
      if (Number.isFinite(raw)) safeSetCurrentTime((Math.max(0, Math.min(100, raw)) / 100) * player.duration);
      saveSession();
    });

    if (isPlayerAvailable() && typeof player.volume === 'number' && !Number.isNaN(player.volume)) {
      if (volume && typeof volume.value === 'string' && volume.value !== '') {
        const v = parseInt(volume.value, 10);
        if (Number.isFinite(v)) player.volume = Math.max(0, Math.min(1, v / 100));
      }
    }
    volume?.addEventListener('input', (e) => {
      const v = e.target.valueAsNumber ?? parseInt(e.target.value, 10);
      if (Number.isFinite(v) && isPlayerAvailable()) { player.volume = Math.max(0, Math.min(1, v / 100)); saveSession(); }
    });

    player.addEventListener('play', () => {
      toggleButton?.classList.add('playing', 'large');
      logo?.classList.add('glow-on-play');
      playBtn?.classList.add('playing');
      cover?.classList.add('playing');
      infoPanel?.classList.add('open');
      playBtn?.setAttribute('aria-pressed', 'true');
      saveSession();
    });
    player.addEventListener('pause', () => {
      toggleButton?.classList.remove('playing', 'large');
      logo?.classList.remove('glow-on-play');
      playBtn?.classList.remove('playing');
      cover?.classList.remove('playing');
      infoPanel?.classList.remove('open');
      playBtn?.setAttribute('aria-pressed', 'false');
      saveSession();
    });

    /* ------------------------------------------------------------------------
       Modal open/close + drag
    ------------------------------------------------------------------------ */
    function openModal() {
      if (!modalEl) return;
      if (wrapperEl) wrapperEl.style.display = 'block';
      modalEl.classList.add('open', 'show', 'is-open');
      modalEl.style.display = 'flex';
      modalEl.setAttribute('aria-hidden', 'false');
      // Ne pas bloquer le scroll de la page pour le lecteur audio (UX mobile)
      // Pas de body.modal-open ici; laisser le scroll global actif.
      ensureBodyUnblockedOnDesktop();
    }
    function closeModal() {
      if (!modalEl) return;
      modalEl.classList.remove('open', 'show', 'is-open');
      modalEl.style.display = 'none';
      modalEl.setAttribute('aria-hidden', 'true');
      if (wrapperEl) wrapperEl.style.display = 'none';

      setTimeout(() => {
        const selector = '.modal-overlay, .audio-player-modal, [role="dialog"]';
        const anyOpen = Array.from(document.querySelectorAll(selector)).some(x => x?.classList?.contains('show'));
        if (!anyOpen) {
          if (!isDesktop()) {
            window.__utils?.unlockBodyScroll?.() ?? (() => { document.body.style.overflow=''; document.body.style.paddingRight=''; })();
          } else {
            ensureBodyUnblockedOnDesktop();
          }
        }
      }, 20);
    }
    toggleButton?.addEventListener('click', (e) => {
      e?.preventDefault();
      if (modalEl && (modalEl.classList.contains('show') || modalEl.style.display === 'flex')) {
        closeModal();
      } else {
        openModal();
      }
    });
    closeBtn?.addEventListener('click',    (e) => { e?.preventDefault(); closeModal(); });
    wrapperEl?.addEventListener('click',   (e) => { if (e.target === wrapperEl) closeModal(); });
    document.addEventListener('keydown',   (e) => { if (e.key === 'Escape' && modalEl?.classList.contains('show')) closeModal(); });

    (function enableDrag() {
      if (!dragBar || !modalEl) return;
      let dragging = false, startX=0, startY=0, startLeft=0, startTop=0;
      dragBar.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        const rect = modalEl.getBoundingClientRect();
        startLeft = rect.left; startTop = rect.top;
        document.body.classList.add('dragging');
      });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        modalEl.style.left = `${startLeft + dx}px`;
        modalEl.style.top  = `${startTop  + dy}px`;
        modalEl.style.position = 'fixed';
      });
      window.addEventListener('mouseup', () => {
        dragging = false;
        document.body.classList.remove('dragging');
      });
    })();

    /* ------------------------------------------------------------------------
       Observe modals pour synchroniser verrous
    ------------------------------------------------------------------------ */
    (function observeModals() {
      const selector = '.modal-overlay, .audio-player-modal, [role="dialog"]';
      function process(el){
        const mo = new MutationObserver(muts => {
          muts.forEach(m => {
            if (m.type === 'attributes' && m.attributeName === 'class') {
              const open = el.classList && el.classList.contains('show');
              if (open) {
                if (!isDesktop()) window.__utils?.lockBodyScroll?.();
                else ensureBodyUnblockedOnDesktop();
              } else {
                if (!isDesktop()) {
                  setTimeout(()=> {
                    const anyOpen = Array.from(document.querySelectorAll(selector)).some(x => x?.classList?.contains('show'));
                    if (!anyOpen) window.__utils?.unlockBodyScroll?.();
                  }, 20);
                } else {
                  ensureBodyUnblockedOnDesktop();
                }
              }
            }
          });
        });
        mo.observe(el, { attributes: true, attributeFilter: ['class'] });
      }
      document.querySelectorAll(selector).forEach(process);
      const bodyObserver = new MutationObserver(muts => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (!(n instanceof HTMLElement)) continue;
            if (n.matches?.(selector)) process(n);
            n.querySelectorAll?.(selector).forEach(process);
          }
        }
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });

      let lastDesktop = isDesktop();
      window.addEventListener('resize', () => {
        const cur = isDesktop();
        if (cur && !lastDesktop) ensureBodyUnblockedOnDesktop();
        lastDesktop = cur;
      });
    })();

    /* ------------------------------------------------------------------------
       Init : restore puis charge playlist
    ------------------------------------------------------------------------ */
    const hadSession = restoreSession();
    loadPlaylist();

    /* ------------------------------------------------------------------------
       preserveAudio flag (global) - protect from PJAX pause commands
       expose via AudioApp API and PlayerSingleton
    ------------------------------------------------------------------------ */
    let preserveAudio = false; // si true -> on IGNORE demandes automatiques de pause
    function setPreserveAudio(v = true) { preserveAudio = !!v; log('preserveAudio ->', preserveAudio); }
    function getPreserveAudio() { return !!preserveAudio; }

    /* ------------------------------------------------------------------------
       External pause event handlers (respect preserveAudio)
    ------------------------------------------------------------------------ */
    function onPjaxRequestPauseAudio(ev) {
      try {
        const detail = ev?.detail || {};
        const reqPreserve = !!detail.preserveAudio;
        if (reqPreserve || preserveAudio) {
          log('pause request ignored (preserveAudio=%s || detail.preserveAudio=%s)', preserveAudio, reqPreserve);
          return;
        }
        log('pjax:requestPauseAudio -> snapshot+pause');
        const wasPlaying = isPlaying();
        const snap = { src: safeGetCurrentSrc(), t: safeGetCurrentTime(), wasPlaying };
        try { sessionStorage.setItem(KEY_FORCED, JSON.stringify(snap)); } catch {}
        safePause();
      } catch (e) {
        warn('onPjaxRequestPauseAudio error', e);
      }
    }
    function onLegacyPlayerPauseRequest(ev) {
      try {
        const detail = ev?.detail || {};
        const reqPreserve = !!detail.preserveAudio;
        if (reqPreserve || preserveAudio) {
          log('legacy pause-request ignored (preserveAudio=%s || detail.preserveAudio=%s)', preserveAudio, reqPreserve);
          return;
        }
        log('player:pause-request -> snapshot+pause');
        const wasPlaying = isPlaying();
        const snap = { src: safeGetCurrentSrc(), t: safeGetCurrentTime(), wasPlaying };
        try { sessionStorage.setItem(KEY_FORCED, JSON.stringify(snap)); } catch {}
        safePause();
      } catch (e) {
        warn('onLegacyPlayerPauseRequest error', e);
      }
    }

    // Bind event listeners (passive where safe)
    try {
      document.addEventListener('pjax:requestPauseAudio', onPjaxRequestPauseAudio, { passive: true });
      document.addEventListener('player:pause-request', onLegacyPlayerPauseRequest, { passive: true });
    } catch (e) {
      warn('failed to bind pause events', e);
    }

    /* ------------------------------------------------------------------------
       Expose API (AudioApp rich) + minimal PlayerSingleton façade
    ------------------------------------------------------------------------ */
    window.AudioApp = window.AudioApp || {};
    Object.assign(window.AudioApp, {
      initialized: true,
      next: advanceToNextTrack,
      prev: advanceToPrevTrack,
      playPause: onToggle,
      stop: onStop,
      setTrack,
      open: openModal,
      close: closeModal,
      toggleAutoAdvance: function(val) {
        if (typeof val === 'boolean') { setAutoAdvance(val); }
        else { setAutoAdvance(!getAutoAdvance()); }
        log('autoAdvance set -> %s', getAutoAdvance());
        saveSession(true);
      },
      getAutoAdvance: getAutoAdvance,
      setPreserveAudio,
      getPreserveAudio,
      snapshot: function(){ 
        const wasPlaying = isPlaying();
        const snap = { src: safeGetCurrentSrc(), t: safeGetCurrentTime(), wasPlaying };
        try { sessionStorage.setItem(KEY_FORCED, JSON.stringify(snap)); } catch {}
        log('snapshot saved via AudioApp', snap);
        return snap;
      },
      resumeFromSnapshot: async function(){ return await resumeIfForcedAllowed(); },
      pause: safePause,
      _debug: () => ({ playlistReady, trackIndex, playlistLen: playlist.length, src: safeGetCurrentSrc(), playerReadyState: (isPlayerAvailable() ? player.readyState : -1), preserveAudio }),
    });

    // Minimal PlayerSingleton façade for compatibility (play/pause/toggle/setPreserveAudio/snapshot/resume)
    function exposeFacade(elem) {
      // If already defined, extend if missing methods
      if (window.PlayerSingleton && window.PlayerSingleton.__isPlayerSingleton) {
        // ensure linkage to AudioApp where appropriate
        try {
          if (window.AudioApp) {
            window.PlayerSingleton.resumeFromSnapshot = window.AudioApp.resumeFromSnapshot;
            window.PlayerSingleton.snapshot = window.AudioApp.snapshot;
            window.PlayerSingleton.setPreserveAudio = window.AudioApp.setPreserveAudio;
            window.PlayerSingleton.getPreserveAudio = window.AudioApp.getPreserveAudio;
            window.PlayerSingleton.pause = window.AudioApp.pause;
          }
        } catch {}
        return;
      }

      const facade = {
        __isPlayerSingleton: true,
        bind: function() { /* no-op: UI binds already done */ return player || null; },
        createAndBind: function(opts = {}) { console.warn('createAndBind called but DOM player exists'); return player; },
        play: async function() { return await playWithRetry(3, 300); },
        pause: function() { 
          // defensive
          safePause();
        },
        toggle: function(){ onToggle(); },
        snapshot: function(){ 
          const wasPlaying = isPlaying();
          const snap = { src: safeGetCurrentSrc(), t: safeGetCurrentTime(), wasPlaying };
          try { sessionStorage.setItem(KEY_FORCED, JSON.stringify(snap)); } catch {}
          return snap;
        },
        resumeFromSnapshot: async function(){ return await resumeIfForcedAllowed(); },
        setPreserveAudio: setPreserveAudio,
        getPreserveAudio: getPreserveAudio,
        setAutoResumeAllowed: function(v = true) { /* no-op in this impl */ log('setAutoResumeAllowed ->', !!v); },
        rebind: function(){ /* minimal */ },
        getElement: function(){ return player; }
      };
      window.PlayerSingleton = facade;
      log('PlayerSingleton façade exposée ✔');
    }

    // expose facade now
    exposeFacade();

    log('initialisation complete (autoAdvance=%s)', getAutoAdvance());
  })();

})(window, document);
