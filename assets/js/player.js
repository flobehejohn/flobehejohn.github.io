// /assets/js/player.js
// ✅ Lecteur modal "simple" — idempotent & safe : ne plante pas si certains éléments sont absents.
// ✅ Continue la lecture même si la modale est fermée (on ne force pas .pause()).
// ✅ Tous les bindings sont protégés (le script peut être inclus sur toutes les pages sans erreur).

(function () {
  'use strict';

  // Évite double-init si ce script est exécuté plusieurs fois (PJAX, rechargements partiels…)
  if (window.__PLAYER_MODAL__?.initialized) return;
  window.__PLAYER_MODAL__ = window.__PLAYER_MODAL__ || {};
  window.__PLAYER_MODAL__.initialized = true;

  document.addEventListener('DOMContentLoaded', () => {
    // Récupération *safe* des éléments (peuvent être absents selon la page)
    const modal       = document.getElementById('audioPlayerModal');
    const openBtn     = document.getElementById('openAudioPlayer');
    const closeBtn    = document.getElementById('closePlayerModal');

    const player      = document.getElementById('audioPlayer');
    const playBtn     = document.getElementById('toggleBtn');
    const stopBtn     = document.getElementById('stopBtn');
    const nextBtn     = document.getElementById('nextBtn');
    const prevBtn     = document.getElementById('prevBtn');
    const progress    = document.getElementById('progress');
    const volume      = document.getElementById('volume');
    const trackTitle  = document.getElementById('trackTitle');
    const cover       = document.getElementById('cover');
    const infoPanel   = document.getElementById('infoPanel');
    const timeDisplay = document.getElementById('timeDisplay');

    // Si le <audio> n’est pas présent, on n’initialise pas le lecteur ici.
    if (!player) {
      console.warn('[player.js] #audioPlayer absent — init ignoré sur cette page');
      return;
    }

    // Utils : attach safe
    const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts || false);

    let playlist   = [];
    let trackIndex = 0;

    async function loadPlaylist() {
      try {
        const res = await fetch('/assets/js/playlist.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error('Playlist vide ou invalide');

        playlist = data;
        trackIndex = Math.floor(Math.random() * playlist.length);
        setTrack(trackIndex, false);
      } catch (error) {
        console.error('[player.js] Playlist introuvable :', error);
      }
    }

    function setTrack(i, play = true) {
      if (!playlist.length) return;
      trackIndex = (i + playlist.length) % playlist.length;

      const t = playlist[trackIndex];
      try { player.src = t.src; } catch {}
      if (trackTitle) trackTitle.textContent = t.title || '';
      try {
        const img = cover?.querySelector('img');
        if (img && t.cover) img.src = t.cover;
      } catch {}

      if (play) {
        player.play().catch(() => {});
      }
      if (playBtn)  playBtn.classList.toggle('playing', play);
      if (cover)    cover.classList.toggle('playing', play);
      if (infoPanel) infoPanel.classList.toggle('open', play);
    }

    // Play/Pause (cohérent avec l’UI) — uniquement si le bouton existe
    on(playBtn, 'click', () => {
      if (player.paused) player.play().catch(() => {});
      else player.pause();
    });

    // Réactions du lecteur → classes UI
    on(player, 'play', () => {
      playBtn?.classList.add('playing');
      cover?.classList.add('playing');
      infoPanel?.classList.add('open');
    });

    on(player, 'pause', () => {
      playBtn?.classList.remove('playing');
      cover?.classList.remove('playing');
      infoPanel?.classList.remove('open');
    });

    // Stop: remet à 0 (si bouton présent)
    on(stopBtn, 'click', () => {
      player.pause();
      try { player.currentTime = 0; } catch {}
      playBtn?.classList.remove('playing');
      cover?.classList.remove('playing');
      infoPanel?.classList.remove('open');
    });

    // Suivant / Précédent
    on(nextBtn, 'click', () => setTrack(trackIndex + 1));
    on(prevBtn, 'click', () => setTrack(trackIndex - 1));

    // Progression + affichage du temps
    on(player, 'timeupdate', () => {
      if (player.duration && progress) {
        const v = (player.currentTime / player.duration) * 100;
        if (!Number.isNaN(v)) progress.value = String(v);
      }
      if (timeDisplay) {
        const m = Math.floor(player.currentTime / 60);
        const s = Math.floor(player.currentTime % 60).toString().padStart(2, '0');
        timeDisplay.textContent = `${m}:${s}`;
      }
    });

    on(progress, 'input', (e) => {
      if (!player.duration) return;
      const raw = e.target.valueAsNumber ?? parseFloat(e.target.value);
      if (Number.isFinite(raw)) {
        player.currentTime = (Math.max(0, Math.min(100, raw)) / 100) * player.duration;
      }
    });

    on(volume, 'input', (e) => {
      const v = e.target.valueAsNumber ?? parseInt(e.target.value, 10);
      if (Number.isFinite(v)) player.volume = Math.max(0, Math.min(1, v / 100));
    });

    // Fin de piste → piste suivante (si bouton/playlist)
    on(player, 'ended', () => setTrack(trackIndex + 1));

    // Ouverture / fermeture modale (si markup présent)
    on(openBtn, 'click', () => { if (modal) modal.style.display = 'flex'; });
    on(closeBtn, 'click', () => {
      if (!modal) return;
      modal.style.display = 'none';
      // ❌ ne PAS pauser ici : on laisse l’audio continuer
    });

    // GO
    loadPlaylist();
  });
})();
