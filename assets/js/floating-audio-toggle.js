/**
 * ========================================================
 * 🎧 BOUTON FLOTTANT DU LECTEUR AUDIO — COMPATIBLE PJAX
 * - Trouve ses éléments DANS le conteneur PJAX courant
 * - Se (re)branche à chaque pjax:ready
 * - Évite les doubles inits via un flag posé sur le container
 * ========================================================
 */
(() => {
  // Init (appelé au 1er chargement ET après chaque navigation PJAX)
  function init(container = document) {
    const root =
      container instanceof Element ? container : document.querySelector('main[data-pjax-root]') || document;

    // Exécute si l'UI du lecteur global est présente dans le DOM
    if (!(root instanceof Element)) return;

    // Déjà initialisé pour CE container ? (le flag disparaît quand PJAX remplace le <main>)
    if (root.__floatingAudioInit) return;
    root.__floatingAudioInit = true;

    // ——————————————————————————————————————————
    // Sélection des éléments (dans le container, avec fallback global)
    // ——————————————————————————————————————————
    const playerWrapper =
      root.querySelector('#responsiveWrapper') || document.getElementById('responsiveWrapper');
    const toggleButton =
      root.querySelector('#openAudioPlayer') || document.getElementById('openAudioPlayer');
    const closeBtn =
      root.querySelector('#closePlayerModal') || document.getElementById('closePlayerModal');
    const audio = root.querySelector('#audioPlayer') || document.getElementById('audioPlayer');

    // Sécurité : si l’un manque, on ne fait rien (ex. page sans lecteur)
    if (!playerWrapper || !toggleButton || !audio) return;

    // ——————————————————————————————————————————
    // État + helpers
    // ——————————————————————————————————————————
    let isPlayerVisible = false;

    function showPlayer() {
      playerWrapper.style.display = 'flex';
      playerWrapper.classList.add('is-open');
      toggleButton.classList.add('active');
      isPlayerVisible = true;
    }

    function hidePlayer() {
      playerWrapper.style.display = 'none';
      playerWrapper.classList.remove('is-open');
      toggleButton.classList.remove('active');
      isPlayerVisible = false;
    }

    function togglePlayerVisibility() {
      isPlayerVisible ? hidePlayer() : showPlayer();
    }

    // ——————————————————————————————————————————
    // Liaison des événements (pour CE container)
    // ——————————————————————————————————————————
    // Si PlayerSingleton est dispo → ouvrir la modale via son API (plus robuste)
    async function ensureSingletonReady() {
      // Si non initialisé mais UI présente → recharger le singleton à la volée
      try {
        const needsInit = (!window.AudioApp || window.AudioApp.initialized !== true) && !!document.getElementById('audioPlayer');
        if (needsInit) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = '/assets/js/player-singleton.js?v=' + Date.now();
            s.async = false;
            s.onload = () => resolve();
            s.onerror = (e) => reject(e);
            document.head.appendChild(s);
          });
        }
      } catch {}
    }

    toggleButton.addEventListener('click', async (e) => {
      e.preventDefault();
      await ensureSingletonReady();
      if (window.AudioApp && typeof window.AudioApp.open === 'function') {
        window.AudioApp.open();
      } else {
        togglePlayerVisibility();
      }
    });
    if (closeBtn) closeBtn.addEventListener('click', hidePlayer);

    const onPlay = () => { toggleButton.classList.add('playing', 'large'); };
    const onPause = () => { toggleButton.classList.remove('playing'); };
    const onEnded = () => { toggleButton.classList.remove('playing'); };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    // État initial propre
    hidePlayer();

    // (Optionnel) Teardown pour ce container (si jamais tu en as besoin)
    root.__floatingAudioTeardown = () => {
      toggleButton.removeEventListener('click', togglePlayerVisibility);
      if (closeBtn) closeBtn.removeEventListener('click', hidePlayer);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      delete root.__floatingAudioInit;
      delete root.__floatingAudioTeardown;
    };
  }

  // Premier chargement
  document.addEventListener('DOMContentLoaded', () => {
    init(document.querySelector('main[data-pjax-root]') || document);
  });

  // À chaque navigation PJAX
  document.addEventListener('pjax:ready', (e) => {
    init(e.detail?.container || document.querySelector('main[data-pjax-root]') || document);
  });

  // (Facultatif) si tu veux fermer l’UI juste avant de quitter la page courante
  document.addEventListener('pjax:before', () => {
    const root = document.querySelector('main[data-pjax-root]');
    root?.__floatingAudioTeardown?.();
  });

  // (Optionnel) exposer une API
  window.initFloatingAudio = init;
})();
