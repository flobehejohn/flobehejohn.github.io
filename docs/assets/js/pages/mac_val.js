// assets/js/pages/mac_val.js
// Module de page idempotent (init/destroy) — compatible PJAX
// Gère les lecteurs audio custom, la pause du player global (selon meta audio-policy),
// exclusivité de lecture (un seul <audio> à la fois), et évite les doubles inits.
// + Compat shim : expose aussi Mac_val / mac_val pour les loaders hérités.
// Patch: utilise emitGlobalAudioPause(detail) pour éviter d'émettre une pause globale
//       durant une transition PJAX visual-only (window.__pjax_in_transition_to_visual_only).

(function (window, document) {
  'use strict';

  const NS  = 'MacVal';
  const API = { init, destroy };
  let state = null;

  // --- Logging chic (lisible dans Firefox/Chromium) -------------------------
  const TAG = '%c[MacVal]';
  const CSS = 'background:#0b1f2a;color:#8bf0ff;font-weight:700;padding:2px 6px;border-radius:3px';
  const OK  = 'background:#0c2a1a;color:#77ffcc;font-weight:700;padding:2px 6px;border-radius:3px';
  const BAD = 'background:#2b1d1d;color:#ffb3b3;font-weight:700;padding:2px 6px;border-radius:3px';

  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  /* --------------------------------------------------------------------------
     Helper: émission contrôlée d'un événement de pause globale
     - Si window.__pjax_in_transition_to_visual_only est true, on NE DISPATCH PAS
       l'event global pour prévenir la pause accidentelle du player global.
     - Sinon on dispatche l'event avec le détail fourni.
     - Logging visible pour debugging.
  -------------------------------------------------------------------------- */
  function emitGlobalAudioPause(detail = {}) {
    try {
      const inPJAXVisual = !!window.__pjax_in_transition_to_visual_only;
      if (inPJAXVisual) {
        // Nous sommes en transition PJAX "visual-only" -> NE PAS interrompre l'audio global.
        console.info(TAG, CSS, '[emitGlobalAudioPause] skip — pjax visual-only transition active', OK, detail);
        return false;
      }
      const ev = new CustomEvent('globalAudioPause', { detail });
      document.dispatchEvent(ev);
      console.info(TAG, CSS, '[emitGlobalAudioPause] dispatched globalAudioPause', OK, detail);
      return true;
    } catch (e) {
      console.warn(TAG, BAD, '[emitGlobalAudioPause] dispatch failed', CSS, e);
      return false;
    }
  }

  // --- Politique audio : si <meta name="audio-policy" content="pause"> ------
  // On utilise emitGlobalAudioPause() au lieu de dispatcher directement.
  function ensurePausedByPolicy() {
    const meta = document.querySelector('meta[name="audio-policy"]');
    if (!meta) return;
    const content = (meta.getAttribute('content') || '').toLowerCase();
    if (content !== 'pause' && content !== 'block' && content !== 'mute') return;

    try {
      // Essayer pause via player singleton si disponible (API polie)
      const P = window.PlayerSingleton || window.playerSingleton || window.player || window.Player || window.AudioApp;
      if (P && typeof P.pause === 'function') {
        try {
          P.pause();
          console.info(TAG, OK, 'policy → Player.pause() appelé (via singleton)', CSS);
          return;
        } catch (err) {
          console.warn(TAG, BAD, 'policy -> Player.pause() a échoué', CSS, err);
        }
      }
    } catch (e) {
      // continue to emit event if singleton not usable
    }

    // fallback: dispatch controlled global pause (respecte transition PJAX visual-only)
    emitGlobalAudioPause({ source: 'mac_val', reason: 'audio-policy' });
  }

  // --- Recolle un <audio> natif si un wrapper (ex: MediaElement.js) est présent
  function ensureAudio(player) {
    // 1) extraire un éventuel audio d'un conteneur mejs
    const mejsContainer = player.querySelector('.mejs-container');
    if (mejsContainer) {
      const innerAudio = mejsContainer.querySelector('audio');
      if (innerAudio) {
        try { player.appendChild(innerAudio); } catch {}
      }
      try { mejsContainer.remove(); } catch {}
    }
    // 2) audio direct ?
    let audio = player.querySelector('audio');
    if (!audio) {
      // 3) recrée depuis data-src
      const src = player.getAttribute('data-src');
      if (src) {
        audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.crossOrigin = 'anonymous';
        audio.setAttribute('playsinline', '');
        audio.setAttribute('data-mejs-disabled', 'true');
        const source = document.createElement('source');
        source.src = src;
        source.type = src.endsWith('.mp3') ? 'audio/mpeg' : (src.endsWith('.wav') ? 'audio/wav' : '');
        audio.appendChild(source);
        try { player.appendChild(audio); } catch {}
      }
    }
    return audio;
  }

  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // --- câblage d'un lecteur -------------------------------------------------
  function wirePlayer(player, allAudios) {
    // Anti-double init (utile si un script tiers ré-appelle init par mégarde)
    if (player.dataset.audioInit === '1') {
      console.debug(TAG, OK, 'skip (déjà initialisé)', CSS, player);
      const a = player.querySelector('audio');
      if (a) allAudios.push(a);
      return { audio: a || null, off: () => {} };
    }

    const btn   = player.querySelector('[data-role="toggle"]');
    const mute  = player.querySelector('[data-role="mute"]');
    const vol   = player.querySelector('.vol');
    const bar   = player.querySelector('.progress');
    const cur   = player.querySelector('[data-role="current"]');
    const dur   = player.querySelector('[data-role="duration"]');

    const audio = ensureAudio(player);
    if (!audio) {
      console.warn(TAG, BAD, 'Audio introuvable et aucune source data-src fournie', CSS, player);
      return { audio: null, off: () => {} };
    }

    allAudios.push(audio);
    player.dataset.audioInit = '1';
    if (!player.hasAttribute('tabindex')) player.setAttribute('tabindex', '0'); // a11y pour le handler clavier

    // helpers UI (toutes les sous-parties sont facultatives → on garde souple)
    const updateVolFill = () => {
      if (!vol) return;
      const pct = (parseFloat(vol.value || '0') * 100).toFixed(0) + '%';
      vol.style.setProperty('--_val', pct);
    };
    const setIcon = (isPlaying) => {
      if (!btn) return;
      btn.innerHTML = isPlaying
        ? '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"></path></svg>'
        : '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>';
    };

    updateVolFill();
    setIcon(false);

    const onLoadedMeta = () => { if (dur) dur.textContent = fmt(audio.duration); };
    const onBtnToggle  = () => { if (audio.paused) audio.play(); else audio.pause(); };
    const onPlay       = () => setIcon(true);
    const onPause      = () => setIcon(false);

    let rafId = null;
    const step = () => {
      if (!audio.paused) {
        if (bar) {
          const pct = (audio.currentTime / (audio.duration || 1)) * 100;
          bar.value = pct;
          bar.style.setProperty('--_val', pct.toFixed(2) + '%');
        }
        if (cur) cur.textContent = fmt(audio.currentTime);
        rafId = requestAnimationFrame(step);
      }
    };
    const onPlayStep  = () => { try { cancelAnimationFrame(rafId); } catch {} step(); };
    const onPauseStep = () => { try { cancelAnimationFrame(rafId); } catch {} };
    const onEnded     = () => { try { cancelAnimationFrame(rafId); } catch {} setIcon(false); };

    const onBarInput = () => {
      if (!bar) return;
      const t = (bar.value / 100) * (audio.duration || 0);
      audio.currentTime = t;
      if (cur) cur.textContent = fmt(audio.currentTime);
      bar.style.setProperty('--_val', bar.value + '%');
    };

    const onVolInput = () => {
      if (!vol) return;
      audio.volume = parseFloat(vol.value);
      audio.muted = audio.volume === 0 ? true : (audio.muted && audio.volume === 0);
      if (mute) {
        mute.innerHTML = audio.muted
          ? '<i class="fas fa-volume-mute" aria-hidden="true"></i>'
          : '<i class="fas fa-volume-up" aria-hidden="true"></i>';
      }
      updateVolFill();
    };

    const onMuteClick = () => {
      audio.muted = !audio.muted;
      if (!audio.muted && typeof audio.volume === 'number' && audio.volume === 0 && vol) {
        audio.volume = 0.5; vol.value = 0.5; updateVolFill();
      }
      if (mute) {
        mute.innerHTML = audio.muted
          ? '<i class="fas fa-volume-mute" aria-hidden="true"></i>'
          : '<i class="fas fa-volume-up" aria-hidden="true"></i>';
      }
    };

    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); btn?.click();
      } else if (e.key === 'ArrowRight') {
        audio.currentTime = Math.min((audio.currentTime || 0) + 5, audio.duration || 0);
      } else if (e.key === 'ArrowLeft') {
        audio.currentTime = Math.max((audio.currentTime || 0) - 5, 0);
      }
    };

    // --- Bind (tout est tolérant si des éléments UI manquent) ---------------
    audio.addEventListener('loadedmetadata', onLoadedMeta);
    if (btn)  btn.addEventListener('click', onBtnToggle);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlayStep);
    audio.addEventListener('pause', onPauseStep);
    audio.addEventListener('ended', onEnded);
    if (bar)  bar.addEventListener('input', onBarInput);
    if (vol)  vol.addEventListener('input', onVolInput);
    if (mute) mute.addEventListener('click', onMuteClick);
    player.addEventListener('keydown', onKey);

    // --- Unbind --------------------------------------------------------------
    const off = () => {
      try {
        audio.removeEventListener('loadedmetadata', onLoadedMeta);
        if (btn)  btn.removeEventListener('click', onBtnToggle);
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('play', onPlayStep);
        audio.removeEventListener('pause', onPauseStep);
        audio.removeEventListener('ended', onEnded);
        if (bar)  bar.removeEventListener('input', onBarInput);
        if (vol)  vol.removeEventListener('input', onVolInput);
        if (mute) mute.removeEventListener('click', onMuteClick);
        player.removeEventListener('keydown', onKey);
        cancelAnimationFrame(rafId);
      } catch {}
      // Libérer le flag d'init pour permettre une re-init propre après PJAX
      try { delete player.dataset.audioInit; } catch {}
    };

    return { audio, off };
  }

  // --- API public ------------------------------------------------------------
  function init(root) {
    // Idempotence : si déjà initialisé, on détruit proprement avant re-init
    if (state) destroy();
    if (!root) root = document.querySelector('main[data-pjax-root][data-page="mac_val"]');
    if (!root) { console.warn(TAG, BAD, 'root introuvable → abandon init', CSS); return; }

    console.log(TAG, CSS, 'init() sur', root);

    // respect policy meta if present (this function will use emitGlobalAudioPause internally)
    ensurePausedByPolicy();

    const players = qsa('.audio-player', root);
    const audios  = [];
    const offFns  = [];

    players.forEach(player => {
      const { audio, off } = wirePlayer(player, audios);
      if (typeof off === 'function') offFns.push(off);
      if (!audio) console.warn(TAG, BAD, 'player sans <audio> réel', CSS, player);
    });

    // Exclusivité : un seul audio joue à la fois
    const onPlayExclusive = (e) => {
      const self = e.currentTarget;
      audios.forEach(a => { if (a !== self && !a.paused) { try { a.pause(); } catch {} } });
    };
    audios.forEach(a => a.addEventListener('play', onPlayExclusive));

    state = { root, audios, offFns, onPlayExclusive };
    try { state.root.dataset.pageReady = 'mac_val'; } catch {}

    console.log(TAG, OK, `init OK: ${audios.length} lecteur(s) câblé(s)`, CSS);
  }

  function destroy() {
    if (!state) return;
    console.log(TAG, CSS, 'destroy()…');

    try {
      // 1) retirer les exclusivités et PAUSE
      state.audios.forEach(a => {
        try { a.removeEventListener('play', state.onPlayExclusive); } catch {}
        try { a.pause(); } catch {}
      });

      // 2) unbind UI/RAF + libérer flags data-audio-init
      state.offFns.forEach(off => { try { off(); } catch {} });

      // 3) marqueur de page
      if (state.root) { try { delete state.root.dataset.pageReady; } catch {} }

      // IMPORTANT: si un destroy souhaite demander une pause globale (ex: page leaving)
      // utilise emitGlobalAudioPause et laisse pjax-router décider du flag preserveAudio.
      // Exemple (commenté par défaut) :
      // emitGlobalAudioPause({ source:'mac_val', reason:'destroy' });

    } finally {
      state = null;
      console.log(TAG, OK, 'destroy terminé', CSS);
    }
  }

  // Expose (nom canonique)
  window[NS] = API;

  // --- Compat shim : expose aussi Mac_val / mac_val -------------------------
  try {
    window.Mac_val = window[NS];
    window.mac_val = window[NS];
    console.debug(TAG, OK, 'compat shim → Mac_val & mac_val aliases prêts', CSS);
  } catch {}

})(window, document);
