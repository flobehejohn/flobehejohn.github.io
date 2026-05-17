/**
 * ========================================================
 * 🎧 BOUTON FLOTTANT DU LECTEUR AUDIO — CANONICAL COMPACT
 * PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V15_CANONICAL_COMPACT
 *
 * Contrat :
 * - clic 1 sur #openAudioPlayer => ouverture ;
 * - clic 2 sur #openAudioPlayer => fermeture ;
 * - clic 3 sur #openAudioPlayer => réouverture ;
 * - proportions proches du lecteur initial ;
 * - conservation de #progress et #volume ;
 * - ajout unique de #siteSoundDesignVolume ;
 * - aucun doublon de lignes/sliders lisibles ;
 * - API de mesure pour certification Playwright.
 * ========================================================
 */
(() => {
  'use strict';

  const VERSION = 'PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V15_CANONICAL_COMPACT';
  const STYLE_ID = 'pr6-audio-modal-v15-canonical-compact-style';
  const STATE_KEY = 'audioModalOpen';
  const SOUND_VOLUME_KEY = 'pr6.siteSoundDesignVolume.v15';

  let lastTouchAt = 0;
  let observerTimer = 0;
  let syncTimer = 0;

  const SELECTORS = {
    button: '#openAudioPlayer',
    wrapper: '#responsiveWrapper',
    modal: '#audioPlayerModal',
    modalContent: '.modal-content-player',
    radio: '.radio',
    cover: '.cover',
    controls: '.controls',
    buttons: '.buttons',
    progress: '#progress',
    volume: '#volume',
    timeDisplay: '#timeDisplay',
    close: '#closePlayerModal',
    audio: '#audioPlayer',
    canonicalRows: '#pr6AudioCanonicalRows',
    sound: '#siteSoundDesignVolume',
  };

  function q(selector, root = document) {
    return root.querySelector(selector);
  }

  function qa(selector, root = document) {
    return Array.prototype.slice.call(root.querySelectorAll(selector));
  }

  function nodes() {
    return {
      button: q(SELECTORS.button),
      wrapper: q(SELECTORS.wrapper),
      modal: q(SELECTORS.modal),
      modalContent: q(SELECTORS.modalContent),
      radio: q(SELECTORS.radio),
      cover: q(SELECTORS.cover),
      controls: q(SELECTORS.controls),
      buttons: q(SELECTORS.buttons),
      progress: q(SELECTORS.progress),
      volume: q(SELECTORS.volume),
      timeDisplay: q(SELECTORS.timeDisplay),
      close: q(SELECTORS.close),
      audio: q(SELECTORS.audio),
      rows: q(SELECTORS.canonicalRows),
      sound: q(SELECTORS.sound),
    };
  }

  function visible(node) {
    if (!node || node.nodeType !== 1) return false;

    try {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();

      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.parseFloat(style.opacity || '1') > 0.05
        && rect.width > 0
        && rect.height > 0;
    } catch (_) {
      return false;
    }
  }

  function clamp01(value, fallback = 0) {
    const parsed = Number.parseFloat(String(value));

    if (!Number.isFinite(parsed)) return fallback;

    return Math.max(0, Math.min(1, parsed));
  }

  function readSoundVolume() {
    try {
      return clamp01(window.localStorage.getItem(SOUND_VOLUME_KEY), 0.7);
    } catch (_) {
      return 0.7;
    }
  }

  function writeSoundVolume(value) {
    const next = clamp01(value, 0.7);

    try {
      window.localStorage.setItem(SOUND_VOLUME_KEY, String(next));
    } catch (_) {}

    try {
      document.documentElement.style.setProperty('--site-sound-design-volume', String(next));
      window.dispatchEvent(new CustomEvent('pr6:sound-design-volume', {
        detail: { value: next, source: VERSION },
      }));
    } catch (_) {}

    return next;
  }

  function setState(open) {
    try {
      document.documentElement.dataset[STATE_KEY] = open ? 'true' : 'false';
    } catch (_) {}
  }

  function stateOpen() {
    return document.documentElement.dataset[STATE_KEY] === 'true';
  }

  function injectStyle() {
    const previous = document.getElementById(STYLE_ID);

    if (previous) previous.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* PR6_AUDIO_MODAL_V15_CANONICAL_COMPACT_STYLE */
      #responsiveWrapper.pr6-audio-v15-compact {
        position: fixed !important;
        left: 50% !important;
        right: auto !important;
        bottom: clamp(14px, 4vh, 42px) !important;
        transform: translateX(-50%) !important;
        z-index: 9999 !important;
        width: min(540px, calc(100vw - 28px)) !important;
        max-width: calc(100vw - 28px) !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: min(230px, calc(100vh - 28px)) !important;
        box-sizing: border-box !important;
        isolation: isolate !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact,
      #responsiveWrapper.pr6-audio-v15-compact * {
        box-sizing: border-box !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact #audioPlayerModal {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: transparent !important;
        border: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .modal-content-player {
        position: relative !important;
        width: 100% !important;
        min-height: 146px !important;
        max-height: min(230px, calc(100vh - 28px)) !important;
        overflow: hidden !important;
        border-radius: 16px !important;
        border: 1px solid rgba(120, 190, 235, 0.22) !important;
        background:
          radial-gradient(circle at 48% 50%, rgba(255,255,255,0.08), transparent 35%),
          linear-gradient(145deg, rgba(22, 28, 34, 0.95), rgba(8, 12, 17, 0.97)) !important;
        box-shadow: 0 14px 34px rgba(0,0,0,0.42), 0 0 18px rgba(95,191,249,0.16) !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .radio {
        width: 100% !important;
        min-height: 146px !important;
        display: grid !important;
        grid-template-columns: 116px minmax(0, 1fr) !important;
        gap: 14px !important;
        align-items: center !important;
        padding: 16px 16px 14px 18px !important;
        background: transparent !important;
        box-shadow: none !important;
        overflow: hidden !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .cover {
        width: 94px !important;
        height: 94px !important;
        min-width: 94px !important;
        max-width: 94px !important;
        justify-self: center !important;
        align-self: center !important;
        margin: 0 !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .controls {
        position: static !important;
        width: 100% !important;
        min-width: 0 !important;
        display: grid !important;
        grid-template-rows: 36px auto !important;
        gap: 8px !important;
        align-items: stretch !important;
        overflow: visible !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .buttons {
        width: 100% !important;
        height: 36px !important;
        min-height: 36px !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        gap: 8px !important;
        margin: 0 !important;
        padding: 0 !important;
        transform: none !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .button,
      #responsiveWrapper.pr6-audio-v15-compact button.button {
        width: 36px !important;
        height: 36px !important;
        min-width: 36px !important;
        min-height: 36px !important;
        max-width: 36px !important;
        max-height: 36px !important;
        border-radius: 999px !important;
        flex: 0 0 36px !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact #closePlayerModal {
        position: absolute !important;
        top: 10px !important;
        right: 12px !important;
        z-index: 3 !important;
        width: 26px !important;
        height: 26px !important;
        line-height: 26px !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact #pr6AudioCanonicalRows {
        width: 100% !important;
        min-width: 0 !important;
        display: grid !important;
        grid-template-rows: repeat(3, 24px) !important;
        gap: 5px !important;
        align-items: stretch !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-row {
        width: 100% !important;
        min-width: 0 !important;
        height: 24px !important;
        display: grid !important;
        grid-template-columns: 72px minmax(120px, 1fr) 44px !important;
        gap: 8px !important;
        align-items: center !important;
        padding: 0 !important;
        margin: 0 !important;
        border: 0 !important;
        background: transparent !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-label,
      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-value {
        display: block !important;
        overflow: hidden !important;
        white-space: nowrap !important;
        text-overflow: ellipsis !important;
        color: rgba(235, 248, 255, 0.95) !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        line-height: 1 !important;
        text-shadow: 0 1px 2px rgba(0,0,0,0.65) !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-value {
        text-align: right !important;
        font-variant-numeric: tabular-nums !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-range-cell {
        min-width: 0 !important;
        width: 100% !important;
        display: flex !important;
        align-items: center !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact input[type="range"] {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: 16px !important;
        min-height: 16px !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        accent-color: #5fbff9 !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact input[type="range"]::-webkit-slider-runnable-track {
        height: 4px !important;
        border-radius: 999px !important;
        background: linear-gradient(90deg, rgba(95,191,249,0.96), rgba(82,224,188,0.92)) !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact input[type="range"]::-webkit-slider-thumb {
        width: 13px !important;
        height: 13px !important;
        margin-top: -5px !important;
        border-radius: 999px !important;
        box-shadow: 0 0 10px rgba(95,191,249,0.55) !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact #timeDisplay {
        display: none !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .volume-container {
        display: contents !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .volume-container > *:not(#volume) {
        display: none !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .progress-container,
      #responsiveWrapper.pr6-audio-v15-compact .sliders,
      #responsiveWrapper.pr6-audio-v15-compact .track,
      #responsiveWrapper.pr6-audio-v15-compact .track-info {
        display: contents !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact [id^="audio"][id*="Readable"],
      #responsiveWrapper.pr6-audio-v15-compact [id^="pr6Audio"][id*="Readable"] {
        display: none !important;
      }

      @media (max-width: 620px) {
        #responsiveWrapper.pr6-audio-v15-compact {
          width: min(430px, calc(100vw - 18px)) !important;
          bottom: 10px !important;
        }

        #responsiveWrapper.pr6-audio-v15-compact .radio {
          grid-template-columns: 86px minmax(0, 1fr) !important;
          gap: 10px !important;
          padding: 14px 12px 12px 12px !important;
        }

        #responsiveWrapper.pr6-audio-v15-compact .cover {
          width: 74px !important;
          height: 74px !important;
          min-width: 74px !important;
          max-width: 74px !important;
        }

        #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-row {
          grid-template-columns: 58px minmax(72px, 1fr) 36px !important;
          gap: 6px !important;
        }

        #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-label,
        #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-value {
          font-size: 10px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function removeDuplicate(selector) {
    qa(selector).slice(1).forEach((node) => {
      try {
        node.remove();
      } catch (_) {}
    });
  }

  function removeLegacyArtifacts() {
    [
      '[id^="pr6Audio"][id*="Readable"]',
      '[id^="audio"][id*="Readable"]',
      '[id^="audio"][id$="ReadableRow"]',
      '[id^="pr6Audio"][id$="ReadableRow"]',
    ].forEach((selector) => {
      qa(selector).forEach((node) => {
        try {
          node.remove();
        } catch (_) {}
      });
    });
  }

  function ensureRangeAttrs(input, min, max, step, value) {
    if (!input) return;

    try {
      input.setAttribute('type', 'range');
      input.setAttribute('min', String(min));
      input.setAttribute('max', String(max));
      input.setAttribute('step', String(step));

      if (!input.value) {
        input.value = String(value);
      }
    } catch (_) {}
  }

  function formatTime(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const minutes = Math.floor(safe / 60);
    const rest = safe % 60;

    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function row(id, label, input, valueId) {
    const item = document.createElement('div');
    item.id = id;
    item.className = 'pr6-audio-row';

    const labelNode = document.createElement('span');
    labelNode.className = 'pr6-audio-label';
    labelNode.textContent = label;

    const cell = document.createElement('div');
    cell.className = 'pr6-audio-range-cell';

    const valueNode = document.createElement('span');
    valueNode.id = valueId;
    valueNode.className = 'pr6-audio-value';
    valueNode.textContent = '0%';

    cell.appendChild(input);
    item.appendChild(labelNode);
    item.appendChild(cell);
    item.appendChild(valueNode);

    return item;
  }

  function ensureCanonicalRows() {
    const current = nodes();

    if (!current.controls || !current.progress || !current.volume) {
      return;
    }

    removeLegacyArtifacts();

    qa(SELECTORS.canonicalRows).slice(1).forEach((node) => node.remove());

    let stack = q(SELECTORS.canonicalRows);

    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'pr6AudioCanonicalRows';
      stack.className = 'pr6-audio-canonical-rows';
    }

    ensureRangeAttrs(current.progress, 0, 100, 1, current.progress.value || 0);
    ensureRangeAttrs(current.volume, 0, 1, 0.01, current.volume.value || 1);

    let sound = q(SELECTORS.sound);

    if (!sound) {
      sound = document.createElement('input');
      sound.id = 'siteSoundDesignVolume';
      sound.className = 'pr6-site-sound-design-volume';
      sound.value = String(readSoundVolume());
    }

    ensureRangeAttrs(sound, 0, 1, 0.01, readSoundVolume());

    sound.oninput = () => {
      const value = writeSoundVolume(sound.value);
      const valueNode = q('#pr6SoundDesignValue');

      if (valueNode) {
        valueNode.textContent = `${Math.round(value * 100)}%`;
      }
    };

    stack.innerHTML = '';
    stack.appendChild(row('pr6TimeRow', 'Timecode', current.progress, 'pr6TimeValue'));
    stack.appendChild(row('pr6MusicRow', 'Volume', current.volume, 'pr6MusicValue'));
    stack.appendChild(row('pr6DesignRow', 'FX', sound, 'pr6SoundDesignValue'));

    current.controls.appendChild(stack);

    updateValues();
  }

  function updateValues() {
    const current = nodes();

    try {
      const timeValue = q('#pr6TimeValue');
      const musicValue = q('#pr6MusicValue');
      const soundValue = q('#pr6SoundDesignValue');

      if (timeValue) {
        const fromDisplay = current.timeDisplay && current.timeDisplay.textContent
          ? current.timeDisplay.textContent.trim()
          : '';

        const fromAudio = current.audio ? formatTime(current.audio.currentTime || 0) : '0:00';
        timeValue.textContent = fromDisplay || fromAudio;
      }

      if (musicValue && current.volume) {
        musicValue.textContent = `${Math.round(clamp01(current.volume.value, 1) * 100)}%`;
      }

      if (soundValue && current.sound) {
        soundValue.textContent = `${Math.round(clamp01(current.sound.value, 0.7) * 100)}%`;
      }
    } catch (_) {}
  }

  /* PR6_AUDIO_MODAL_TITLE_TRANSPORT_SEPARATION_V16 */
  function injectTitleSafeCss() {
    const styleId = 'pr6-audio-modal-title-transport-separation-v16-style';
    const previous = document.getElementById(styleId);

    if (previous) previous.remove();

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* PR6_AUDIO_MODAL_TITLE_TRANSPORT_SEPARATION_V16_STYLE */
      #responsiveWrapper.pr6-audio-v15-compact {
        max-height: min(284px, calc(100vh - 28px)) !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .modal-content-player {
        min-height: 178px !important;
        max-height: min(284px, calc(100vh - 28px)) !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .radio {
        min-height: 178px !important;
        grid-template-columns: 116px minmax(0, 1fr) !important;
        gap: 14px !important;
        padding: 16px 16px 14px 18px !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .controls {
        display: grid !important;
        grid-template-rows: 24px 36px auto !important;
        gap: 6px !important;
        align-items: stretch !important;
        overflow: visible !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-track-title {
        grid-row: 1 !important;
        display: block !important;
        position: static !important;
        justify-self: center !important;
        align-self: center !important;
        width: min(100%, calc(100% - 62px)) !important;
        max-width: calc(100% - 62px) !important;
        height: 22px !important;
        min-height: 22px !important;
        max-height: 22px !important;
        margin: 0 auto !important;
        padding: 0 6px !important;
        overflow: hidden !important;
        white-space: nowrap !important;
        text-overflow: ellipsis !important;
        line-height: 22px !important;
        text-align: center !important;
        color: #5fbff9 !important;
        -webkit-text-fill-color: #5fbff9 !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        letter-spacing: 0.01em !important;
        text-shadow: 0 0 8px rgba(95, 191, 249, 0.42) !important;
        pointer-events: none !important;
        z-index: 2 !important;
        transform: none !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .buttons {
        grid-row: 2 !important;
        align-self: center !important;
        justify-self: center !important;
        position: static !important;
        z-index: 3 !important;
        transform: none !important;
        margin: 0 !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact #pr6AudioCanonicalRows {
        grid-row: 3 !important;
        align-self: start !important;
        margin-top: 1px !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact #closePlayerModal {
        z-index: 5 !important;
      }

      @media (max-width: 560px) {
        #responsiveWrapper.pr6-audio-v15-compact {
          width: min(390px, calc(100vw - 20px)) !important;
        }

        #responsiveWrapper.pr6-audio-v15-compact .radio {
          grid-template-columns: 86px minmax(0, 1fr) !important;
          min-height: 174px !important;
          padding: 14px 12px 12px 12px !important;
          gap: 10px !important;
        }

        #responsiveWrapper.pr6-audio-v15-compact .cover {
          width: 78px !important;
          height: 78px !important;
          min-width: 78px !important;
          max-width: 78px !important;
        }

        #responsiveWrapper.pr6-audio-v15-compact .controls {
          grid-template-rows: 24px 34px auto !important;
          gap: 5px !important;
        }

        #responsiveWrapper.pr6-audio-v15-compact .button,
        #responsiveWrapper.pr6-audio-v15-compact button.button {
          width: 34px !important;
          height: 34px !important;
          min-width: 34px !important;
          min-height: 34px !important;
          max-width: 34px !important;
          max-height: 34px !important;
          flex-basis: 34px !important;
        }

        #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-track-title {
          width: min(100%, calc(100% - 54px)) !important;
          max-width: calc(100% - 54px) !important;
          font-size: 12px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function textOf(node) {
    return node && node.textContent ? String(node.textContent).trim() : '';
  }

  function audioFileName(current) {
    try {
      const raw = current.audio && (current.audio.currentSrc || current.audio.src)
        ? current.audio.currentSrc || current.audio.src
        : '';

      const clean = decodeURIComponent(String(raw).split('/').pop() || '').replace(/\?.*$/, '');

      return clean || 'Lecture audio';
    } catch (_) {
      return 'Lecture audio';
    }
  }

  function findTrackTitleCandidate(current) {
    const wrapper = current.wrapper;

    if (!wrapper) return null;

    const selectors = [
      '.pr6-audio-track-title',
      '#trackTitle',
      '#trackName',
      '#songTitle',
      '#songName',
      '#currentTrack',
      '#currentSong',
      '#nowPlaying',
      '#playerTitle',
      '.track-title',
      '.track-name',
      '.song-title',
      '.song-name',
      '.current-track',
      '.current-song',
      '.now-playing',
      '.player-title',
      '.audio-title',
      '.marquee',
      '.ticker',
      '.track-display'
    ];

    for (const selector of selectors) {
      const candidate = wrapper.querySelector(selector);

      if (candidate && !candidate.closest('#pr6AudioCanonicalRows') && !candidate.closest('.buttons')) {
        return candidate;
      }
    }

    const fileName = audioFileName(current).toLowerCase();

    const textCandidates = qa('*', wrapper)
      .filter((node) => {
        if (!node || node.closest('#pr6AudioCanonicalRows') || node.closest('.buttons')) return false;

        const text = textOf(node);
        const lower = text.toLowerCase();

        if (!text || text.length < 6) return false;
        if (/^(temps|musique|design|volume|sound|0:00|100%|70%|1%)$/i.test(text)) return false;

        return lower.includes('.mp3')
          || lower.includes(fileName)
          || /\.(mp3|wav|ogg|m4a|flac)/i.test(text);
      })
      .sort((a, b) => textOf(b).length - textOf(a).length);

    return textCandidates[0] || null;
  }

  function normalizeTrackTitleLayer() {
    const current = nodes();

    if (!current.wrapper || !current.controls) return null;

    qa('.pr6-audio-track-title', current.wrapper).slice(1).forEach((node) => {
      try {
        node.remove();
      } catch (_) {}
    });

    let title = findTrackTitleCandidate(current);

    if (!title) {
      title = document.createElement('div');
      title.textContent = audioFileName(current);
    }

    title.classList.add('pr6-audio-track-title');
    title.setAttribute('data-pr6-audio-title', 'v16-separated');
    title.setAttribute('aria-live', 'polite');

    if (!textOf(title)) {
      title.textContent = audioFileName(current);
    }

    try {
      current.controls.insertBefore(title, current.buttons || current.controls.firstChild);
    } catch (_) {}

    return title;
  }









































  function harden() {
injectStyle();


    injectTitleSafeCss();
removeDuplicate(SELECTORS.button);
    removeDuplicate(SELECTORS.wrapper);
    removeDuplicate(SELECTORS.modal);
    removeDuplicate(SELECTORS.audio);

    const current = nodes();

    if (!current.wrapper || !current.modal) {
      writeAudit(false, 'harden-missing-dom', 'missing wrapper/modal');
      return false;
    }

    try {
      current.wrapper.classList.add('pr6-audio-v15-compact');
      current.wrapper.dataset.pr6AudioLayout = 'v15-canonical-compact';

      current.modal.classList.add('pr6-audio-modal-v15');
      current.modal.dataset.pr6AudioModal = 'v15-canonical-compact';

      if (current.modalContent) {
        current.modalContent.classList.add('pr6-audio-modal-content-v15');
      }

      if (current.button) {
        current.button.setAttribute('type', current.button.getAttribute('type') || 'button');
        current.button.setAttribute('aria-controls', 'audioPlayerModal');
        current.button.setAttribute('aria-expanded', stateOpen() ? 'true' : 'false');
      }
    } catch (_) {}

    ensureCanonicalRows();

    normalizeTrackTitleLayer();
syncDom(stateOpen(), 'harden-sync', false);

    return true;
}

  function syncDom(open, source, write = true) {
    const current = nodes();

    try {
      if (current.wrapper) {
        current.wrapper.style.display = open ? 'flex' : 'none';
        current.wrapper.style.visibility = open ? 'visible' : 'hidden';
        current.wrapper.style.opacity = open ? '1' : '0';
        current.wrapper.classList.toggle('is-open', Boolean(open));
        current.wrapper.setAttribute('aria-hidden', open ? 'false' : 'true');
      }

      if (current.modal) {
        current.modal.style.display = open ? 'flex' : 'none';
        current.modal.style.visibility = open ? 'visible' : 'hidden';
        current.modal.style.opacity = open ? '1' : '0';
        current.modal.classList.toggle('is-open', Boolean(open));
        current.modal.classList.toggle('show', Boolean(open));
        current.modal.setAttribute('aria-hidden', open ? 'false' : 'true');
      }

      if (current.button) {
        current.button.classList.toggle('active', Boolean(open));
        current.button.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    } catch (_) {}

    updateValues();

    if (write) {
      writeAudit(open, source || 'sync');
    }
  }

  function writeAudit(open, source, error) {
    try {
      window.__AUDIO_MODAL_TOGGLE_AUDIT__ = {
        version: VERSION,
        ready: true,
        open: Boolean(open),
        source: source || 'unknown',
        layout: layout(),
        lastError: error ? String(error.message || error) : null,
        updatedAt: new Date().toISOString(),
      };
    } catch (_) {}
  }

  function open(source = 'open') {
    setState(true);
    harden();
    syncDom(true, source);
    return Promise.resolve(true);
  }

  function close(source = 'close') {
    setState(false);
    harden();
    syncDom(false, source);
    return Promise.resolve(false);
  }

  function toggle(source = 'toggle') {
    return stateOpen() ? close(`${source}:close`) : open(`${source}:open`);
  }

  function rectOf(node) {
    if (!node) {
      return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
    }

    const rect = node.getBoundingClientRect();

    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  function widthOf(node) {
    if (!node || !visible(node)) return 0;

    return Math.round(node.getBoundingClientRect().width);
  }

  function layout() {
    const current = nodes();
    const wrapperRect = rectOf(current.wrapper);
    const modalRect = rectOf(current.modal);
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    const checked = [
      current.wrapper,
      current.modal,
      current.rows,
      current.progress,
      current.volume,
      current.sound,
    ].filter(Boolean);

    const overflowCount = checked.filter((node) => {
      const rect = node.getBoundingClientRect();

      return rect.left < -1
        || rect.top < -1
        || rect.right > viewportWidth + 1
        || rect.bottom > viewportHeight + 1;
    }).length;

    return {
      version: VERSION,
      open: stateOpen(),
      wrapperVisible: visible(current.wrapper),
      modalVisible: visible(current.modal),
      wrapperWidth: Math.round(wrapperRect.width),
      wrapperHeight: Math.round(wrapperRect.height),
      modalWidth: Math.round(modalRect.width),
      modalHeight: Math.round(modalRect.height),
      viewportWidth,
      viewportHeight,
      rangeCount: qa('#pr6AudioCanonicalRows input[type="range"]').length,
      rowCount: qa('#pr6AudioCanonicalRows .pr6-audio-row').length,
      legacyReadableCount:
        qa('[id^="pr6Audio"][id*="Readable"]').length
        + qa('[id^="audio"][id*="Readable"]').length
        + qa('[id^="audio"][id$="ReadableRow"]').length,
      buttonCount: qa(SELECTORS.button).length,
      wrapperCount: qa(SELECTORS.wrapper).length,
      modalCount: qa(SELECTORS.modal).length,
      timecodeWidth: widthOf(current.progress),
      musicWidth: widthOf(current.volume),
      soundWidth: widthOf(current.sound),
      overflowCount,
      lastError: window.__AUDIO_MODAL_TOGGLE_AUDIT__?.lastError || null,
    };
  }

  function onDocumentPointer(event) {
    const target = event && event.target;

    if (!target || !target.closest) return;

    const isTouch = event.type === 'touchend' || event.pointerType === 'touch';

    if (isTouch) {
      lastTouchAt = Date.now();
    } else if (event.type === 'click' && Date.now() - lastTouchAt < 550) {
      return;
    }

    if (target.closest(SELECTORS.button)) {
      event.preventDefault();
      event.stopPropagation();

      toggle('button').catch((error) => {
        writeAudit(stateOpen(), 'button-error', error);
      });

      return;
    }

    if (target.closest(SELECTORS.close)) {
      event.preventDefault();
      event.stopPropagation();

      close('close-button').catch((error) => {
        writeAudit(false, 'close-error', error);
      });
    }
  }

  function bindInputSync() {
    const current = nodes();

    [current.progress, current.volume, current.sound, current.audio].filter(Boolean).forEach((node) => {
      if (node.__pr6AudioV15Bound) return;

      node.__pr6AudioV15Bound = true;

      ['input', 'change', 'timeupdate', 'loadedmetadata'].forEach((type) => {
        try {
          node.addEventListener(type, updateValues);
        } catch (_) {}
      });
    });
  }

  function scheduleHarden(delay = 0) {
    window.clearTimeout(observerTimer);
    observerTimer = window.setTimeout(() => {
      harden();
      bindInputSync();
    }, delay);
  }

  function init() {
    if (!document.body) return;

    if (!document.documentElement.dataset[STATE_KEY]) {
      setState(false);
    }

    harden();
    bindInputSync();

    window.clearInterval(syncTimer);
    syncTimer = window.setInterval(updateValues, 1000);
  }

  if (!window.__PR6_AUDIO_MODAL_V15_BOUND__) {
    window.__PR6_AUDIO_MODAL_V15_BOUND__ = true;

    document.addEventListener('click', onDocumentPointer, true);
    document.addEventListener('touchend', onDocumentPointer, { capture: true, passive: false });
    document.addEventListener('pointerup', (event) => {
      if (event.pointerType !== 'mouse') {
        onDocumentPointer(event);
      }
    }, true);

    document.addEventListener('pjax:before', () => {
      close('pjax-before').catch(() => {});
    });

    document.addEventListener('pjax:ready', () => {
      scheduleHarden(0);
      scheduleHarden(160);
    });

    window.addEventListener('load', () => scheduleHarden(0));

    /* PR6_AUDIO_MODAL_V26_NO_MUTATION_OBSERVER_FOR_LAYOUT */
    window.setTimeout(() => scheduleHarden(0), 0);
    window.setTimeout(() => scheduleHarden(320), 320);
    window.setTimeout(() => scheduleHarden(900), 900);
}

  window.__PR6_AUDIO_MODAL_TOGGLE__ = {
    version: VERSION,
    init,
    harden,
    layout,
    isOpen: stateOpen,
    open: () => open('api-open'),
    close: () => close('api-close'),
    toggle: () => toggle('api-toggle'),
  };

  window.initFloatingAudio = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

/* PR6_AUDIO_MODAL_TITLE_MARQUEE_PLAYBOUND_V28_FINAL_CSS_STABLE_START */
;(() => {
  'use strict';

  const VERSION = 'PR6_AUDIO_MODAL_TITLE_MARQUEE_PLAYBOUND_V28_FINAL_CSS_STABLE';
  const STYLE_ID = 'pr6-audio-title-marquee-v28-final-css-style';
  const STATE_KEY = 'audioModalOpen';
  const UNIT_COUNT = 4;

  let forcedUntil = 0;

  function q(selector, root = document) {
    return root.querySelector(selector);
  }

  function qa(selector, root = document) {
    return Array.prototype.slice.call(root.querySelectorAll(selector));
  }

  function isVisible(node) {
    if (!node) return false;

    try {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();

      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.parseFloat(style.opacity || '1') > 0.05
        && rect.width > 0
        && rect.height > 0;
    } catch (_) {
      return false;
    }
  }

  function nodes() {
    return {
      button: q('#openAudioPlayer'),
      wrapper: q('#responsiveWrapper'),
      modal: q('#audioPlayerModal'),
      controls: q('#responsiveWrapper .controls'),
      buttons: q('#responsiveWrapper .buttons'),
      progress: q('#progress'),
      volume: q('#volume'),
      sound: q('#siteSoundDesignVolume'),
      timeDisplay: q('#timeDisplay'),
      audio: q('#audioPlayer'),
      title: q('#responsiveWrapper .pr6-audio-track-title'),
    };
  }

  function removeOldTitleStyles() {
    qa('style[id^="pr6-audio-title-marquee-"]').forEach((style) => {
      if (style.id !== STYLE_ID) {
        try { style.remove(); } catch (_) {}
      }
    });
  }

  function injectCss() {
    removeOldTitleStyles();

    const old = document.getElementById(STYLE_ID);

    if (old) {
      old.remove();
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* PR6_AUDIO_MODAL_TITLE_MARQUEE_V28_FINAL_CSS_STYLE */

      @keyframes pr6AudioTitleMarqueeV28 {
        0% {
          transform: translate3d(0, 0, 0);
        }
        100% {
          transform: translate3d(var(--pr6-title-marquee-distance, -460px), 0, 0);
        }
      }

      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-track-title {
        grid-row: 1 !important;
        display: none !important;
        align-items: center !important;
        justify-content: stretch !important;
        position: relative !important;
        overflow: hidden !important;
        width: min(100%, calc(100% - 62px)) !important;
        max-width: calc(100% - 62px) !important;
        min-width: 0 !important;
        height: 23px !important;
        min-height: 23px !important;
        max-height: 23px !important;
        margin: 0 auto 5px auto !important;
        padding: 0 22px !important;
        color: #5fbff9 !important;
        -webkit-text-fill-color: #5fbff9 !important;
        background: rgba(0, 0, 0, 0.72) !important;
        border: 1px solid rgba(95, 191, 249, 0.18) !important;
        border-radius: 999px !important;
        pointer-events: none !important;
        z-index: 8 !important;
        opacity: 0 !important;
        visibility: hidden !important;
        mask-image: linear-gradient(90deg, transparent 0, black 16px, black calc(100% - 16px), transparent 100%);
        -webkit-mask-image: linear-gradient(90deg, transparent 0, black 16px, black calc(100% - 16px), transparent 100%);
      }

      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-track-title.is-title-playing-v28 {
        display: flex !important;
        opacity: 1 !important;
        visibility: visible !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-track-title:not(.is-title-playing-v28),
      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-track-title:not(.is-title-playing-v28) * {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-track-title-viewport {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: 23px !important;
        line-height: 23px !important;
        overflow: hidden !important;
        position: relative !important;
        white-space: nowrap !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-track-title-text {
        display: inline-flex !important;
        align-items: center !important;
        width: max-content !important;
        min-width: max-content !important;
        max-width: none !important;
        height: 23px !important;
        line-height: 23px !important;
        white-space: nowrap !important;
        transform: translate3d(0, 0, 0);
        will-change: transform !important;
        animation: none;
      }

      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-track-title-text.is-running-v28 {
        animation-name: pr6AudioTitleMarqueeV28 !important;
        animation-duration: var(--pr6-title-marquee-duration, 62s) !important;
        animation-timing-function: linear !important;
        animation-iteration-count: infinite !important;
        animation-delay: 0s !important;
        animation-direction: normal !important;
        animation-fill-mode: none !important;
        animation-play-state: running !important;
      }

      #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-title-marquee-unit {
        flex: 0 0 auto !important;
        display: inline-block !important;
        min-width: var(--pr6-title-marquee-unit-width, 460px) !important;
        padding-right: 60px !important;
        color: #5fbff9 !important;
        -webkit-text-fill-color: #5fbff9 !important;
        font-size: 12.5px !important;
        font-weight: 700 !important;
        letter-spacing: 0.01em !important;
        text-shadow: 0 0 8px rgba(95, 191, 249, 0.45) !important;
      }

      @media (max-width: 560px) {
        #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-track-title {
          width: min(100%, calc(100% - 54px)) !important;
          max-width: calc(100% - 54px) !important;
          height: 22px !important;
          min-height: 22px !important;
          max-height: 22px !important;
          padding: 0 18px !important;
        }

        #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-track-title-viewport,
        #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-track-title-text {
          height: 22px !important;
          line-height: 22px !important;
        }

        #responsiveWrapper.pr6-audio-v15-compact .pr6-audio-title-marquee-unit {
          font-size: 12px !important;
          padding-right: 44px !important;
          min-width: var(--pr6-title-marquee-unit-width, 340px) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function decodeFileName(raw) {
    try {
      return decodeURIComponent(String(raw || '').split('/').pop() || '').replace(/\?.*$/, '');
    } catch (_) {
      return String(raw || '').split('/').pop() || '';
    }
  }

  function audioFileName() {
    try {
      const audio = q('#audioPlayer');
      const raw = audio && (audio.currentSrc || audio.src) ? audio.currentSrc || audio.src : '';
      return decodeFileName(raw);
    } catch (_) {
      return '';
    }
  }

  function normalizeTitle(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text || audioFileName() || 'Lecture audio en cours';
  }

  function currentTitle(options) {
    const opts = options || {};

    if (opts.title && String(opts.title).trim()) {
      return normalizeTitle(opts.title);
    }

    return normalizeTitle(audioFileName());
  }

  function audioPlaying() {
    try {
      const audio = q('#audioPlayer');

      return Boolean(audio && audio.paused !== true && audio.ended !== true);
    } catch (_) {
      return false;
    }
  }

  function shouldShow() {
    return audioPlaying() || Date.now() < forcedUntil;
  }

  function directTextCount(node) {
    return Array.prototype.slice.call(node?.childNodes || [])
      .filter((child) => child.nodeType === Node.TEXT_NODE && String(child.textContent || '').trim())
      .length;
  }

  function ensureTitleStructure(sourceText) {
    const current = nodes();

    if (!current.wrapper || !current.controls) {
      return null;
    }

    qa('#responsiveWrapper .pr6-audio-track-title').slice(1).forEach((node) => {
      try { node.remove(); } catch (_) {}
    });

    let title = q('#responsiveWrapper .pr6-audio-track-title');

    if (!title) {
      title = document.createElement('div');
      title.className = 'pr6-audio-track-title';
    }

    try {
      current.controls.insertBefore(title, current.buttons || current.controls.firstChild);
    } catch (_) {
      try { current.controls.appendChild(title); } catch (_) {}
    }

    const previousTrack = title.querySelector('.pr6-audio-track-title-text');
    const stableUid = previousTrack?.dataset?.pr6StableTrackUid || '';
    const mustRebuild =
      directTextCount(title) > 0
      || !title.querySelector('.pr6-audio-track-title-viewport')
      || !title.querySelector('.pr6-audio-track-title-text');

    if (mustRebuild) {
      title.innerHTML = '';

      const viewport = document.createElement('span');
      viewport.className = 'pr6-audio-track-title-viewport';

      const track = document.createElement('span');
      track.className = 'pr6-audio-track-title-text';

      if (stableUid) {
        track.dataset.pr6StableTrackUid = stableUid;
      }

      viewport.appendChild(track);
      title.appendChild(viewport);
    }

    const viewport = title.querySelector('.pr6-audio-track-title-viewport');
    const track = title.querySelector('.pr6-audio-track-title-text');

    if (!track.dataset.pr6StableTrackUid) {
      track.dataset.pr6StableTrackUid = 'track-' + Math.random().toString(16).slice(2) + '-' + Date.now();
    }

    title.classList.add('is-marquee', 'is-marquee-v28');
    title.classList.remove(
      'is-marquee-v17',
      'is-marquee-v18',
      'is-marquee-v19',
      'is-marquee-v20',
      'is-marquee-v21',
      'is-marquee-v22',
      'is-marquee-v23',
      'is-marquee-v24',
      'is-marquee-v25',
      'is-marquee-v26',
      'is-marquee-v27'
    );

    title.dataset.pr6TitleMarqueeVersion = 'v28';
    title.dataset.pr6TitleSourceText = sourceText;
    title.setAttribute('data-pr6-title-marquee', 'v28-final-css-stable');
    title.setAttribute('aria-label', sourceText);
    title.setAttribute('title', sourceText);
    title.setAttribute('aria-live', 'polite');

    qa('.pr6-audio-title-marquee-unit', track).slice(UNIT_COUNT).forEach((node) => {
      try { node.remove(); } catch (_) {}
    });

    while (track.querySelectorAll('.pr6-audio-title-marquee-unit').length < UNIT_COUNT) {
      const unit = document.createElement('span');
      unit.className = 'pr6-audio-title-marquee-unit';
      track.appendChild(unit);
    }

    qa('.pr6-audio-title-marquee-unit', track).forEach((unit) => {
      if (unit.textContent !== sourceText) {
        unit.textContent = sourceText;
      }
    });

    return { title, viewport, track };
  }

  function stopTrack(track) {
    if (!track) return;

    try {
      track.classList.remove('is-running-v28');
      track.style.animation = 'none';
      track.style.transform = 'translate3d(0, 0, 0)';
      track.dataset.pr6TitleMarqueeTick = '';
    } catch (_) {}
  }

  function hide() {
    forcedUntil = 0;

    try {
      const title = q('#responsiveWrapper .pr6-audio-track-title');
      const track = title?.querySelector('.pr6-audio-track-title-text');

      stopTrack(track);

      if (title) {
        title.classList.remove('is-title-playing-v28', 'is-title-playing-v27', 'is-title-playing-v26', 'is-title-playing-v25');
        title.dataset.pr6TitleMarqueeTicker = 'stopped';
        title.setAttribute('aria-hidden', 'true');
        /* PR6_AUDIO_TITLE_V28_INLINE_VISIBILITY_HIDE_START */
        title.style.setProperty('display', 'none', 'important');
        title.style.setProperty('visibility', 'hidden', 'important');
        title.style.setProperty('opacity', '0', 'important');
        /* PR6_AUDIO_TITLE_V28_INLINE_VISIBILITY_HIDE_END */
      }
    } catch (_) {}
  }

  function measureAndRun(title, viewport, track) {
    window.requestAnimationFrame(() => {
      try {
        if (!title || !viewport || !track || !shouldShow()) {
          hide();
          return;
        }

        const first = track.querySelector('.pr6-audio-title-marquee-unit');

        if (!first) return;

        const viewportWidth = Math.max(120, viewport.clientWidth || viewport.getBoundingClientRect().width || 0);
        const textWidth = Math.max(160, first.scrollWidth || first.getBoundingClientRect().width || 0);
        const unitWidth = Math.max(viewportWidth + 130, textWidth + 60, 420);
        const distance = -1 * Math.ceil(unitWidth);
        const duration = Math.max(52000, Math.min(90000, Math.ceil(unitWidth * 125)));

        qa('.pr6-audio-title-marquee-unit', track).forEach((unit) => {
          unit.style.setProperty('--pr6-title-marquee-unit-width', unitWidth + 'px');
        });

        track.style.setProperty('--pr6-title-marquee-distance', distance + 'px');
        track.style.setProperty('--pr6-title-marquee-duration', (duration / 1000) + 's');
        track.style.animation = '';
        track.classList.add('is-running-v28');

        title.dataset.pr6TitleMarqueeDistance = String(distance);
        title.dataset.pr6TitleMarqueeDurationMs = String(duration);
        title.dataset.pr6TitleMarqueeTicker = 'running';
        title.dataset.pr6TitleMarqueeEngine = 'css-animation-v28';
      } catch (_) {}
    });
  }

  function show(options) {
    const opts = options || {};

    if (opts.forcePlaying) {
      forcedUntil = Date.now() + 120000;
    }

    injectCss();

    if (!shouldShow()) {
      hide();
      return null;
    }

    const sourceText = currentTitle(opts);
    const structure = ensureTitleStructure(sourceText);

    if (!structure) return null;

    const { title, viewport, track } = structure;

    title.classList.add('is-title-playing-v28', 'is-title-playing-v27');
    title.classList.remove('is-title-playing-v26', 'is-title-playing-v25');
    title.dataset.pr6TitleMarqueeTicker = 'running';
    title.setAttribute('aria-hidden', 'false');
    /* PR6_AUDIO_TITLE_V28_INLINE_VISIBILITY_SHOW_START */
    title.style.setProperty('display', 'flex', 'important');
    title.style.setProperty('visibility', 'visible', 'important');
    title.style.setProperty('opacity', '1', 'important');
    /* PR6_AUDIO_TITLE_V28_INLINE_VISIBILITY_SHOW_END */

    measureAndRun(title, viewport, track);

    /* PR6_AUDIO_TITLE_V28_OWNERSHIP_DEBOUNCE_START */
    [0, 80, 280, 700].forEach((delay) => {
      window.setTimeout(() => {
        try {
          removeOldTitleStyles();

          if (shouldShow() && title.classList.contains('is-title-playing-v28')) {
            title.classList.add('is-title-playing-v27');
            title.style.setProperty('display', 'flex', 'important');
            title.style.setProperty('visibility', 'visible', 'important');
            title.style.setProperty('opacity', '1', 'important');
          }
        } catch (_) {}
      }, delay);
    });
    /* PR6_AUDIO_TITLE_V28_OWNERSHIP_DEBOUNCE_END */

    return title;
  }

  function setOpen(open) {
    const current = nodes();

    document.documentElement.dataset[STATE_KEY] = open ? 'true' : 'false';

    try {
      if (current.wrapper) {
        current.wrapper.style.display = open ? 'grid' : 'none';
        current.wrapper.style.visibility = open ? 'visible' : 'hidden';
        current.wrapper.style.opacity = open ? '1' : '0';
        current.wrapper.classList.toggle('is-open', open);
        current.wrapper.setAttribute('aria-hidden', open ? 'false' : 'true');
      }

      if (current.modal) {
        current.modal.style.display = open ? 'flex' : 'none';
        current.modal.style.visibility = open ? 'visible' : 'hidden';
        current.modal.style.opacity = open ? '1' : '0';
        current.modal.classList.toggle('is-open', open);
        current.modal.classList.toggle('show', open);
        current.modal.setAttribute('aria-hidden', open ? 'false' : 'true');
      }

      if (current.button) {
        current.button.setAttribute('aria-expanded', open ? 'true' : 'false');
        current.button.classList.toggle('active', open);
      }
    } catch (_) {}

    if (!open) {
      hide();
    }

    return open;
  }

  function isOpen() {
    const current = nodes();

    return Boolean(
      document.documentElement.dataset[STATE_KEY] === 'true'
      || current.wrapper?.classList?.contains('is-open')
      || current.modal?.classList?.contains('is-open')
      || isVisible(current.wrapper)
      || isVisible(current.modal)
    );
  }

  function open() {
    return setOpen(true);
  }

  function close() {
    return setOpen(false);
  }

  function toggle() {
    return setOpen(!isOpen());
  }

  function layout() {
    const current = nodes();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    function width(node) {
      return Math.round(node?.getBoundingClientRect?.().width || 0);
    }

    const checked = [current.wrapper, current.modal, current.progress, current.volume, current.sound].filter(Boolean);
    const overflowCount = checked.filter((node) => {
      const rect = node.getBoundingClientRect();

      return rect.left < -1
        || rect.right > viewportWidth + 1
        || rect.top < -1
        || rect.bottom > viewportHeight + 1;
    }).length;

    return {
      version: VERSION,
      open: isOpen(),
      wrapperVisible: isVisible(current.wrapper),
      modalVisible: isVisible(current.modal),
      wrapperWidth: width(current.wrapper),
      wrapperHeight: Math.round(current.wrapper?.getBoundingClientRect?.().height || 0),
      modalWidth: width(current.modal),
      modalHeight: Math.round(current.modal?.getBoundingClientRect?.().height || 0),
      viewportWidth,
      viewportHeight,
      rangeCount: qa('#responsiveWrapper input[type="range"]').length,
      rowCount: qa('#pr6AudioCanonicalRows .pr6-audio-row, #responsiveWrapper .pr6-audio-row').length,
      buttonCount: qa('#openAudioPlayer').length,
      wrapperCount: qa('#responsiveWrapper').length,
      modalCount: qa('#audioPlayerModal').length,
      audioCount: qa('#audioPlayer').length,
      timecodeWidth: width(current.progress),
      musicWidth: width(current.volume),
      soundWidth: width(current.sound),
      overflowCount,
      lastError: null,
    };
  }

  function sync() {
    injectCss();

    if (shouldShow()) {
      show();
    } else {
      hide();
    }
  }

  function bind() {
    if (!window.__PR6_AUDIO_MODAL_V28_BOUND__) {
      window.__PR6_AUDIO_MODAL_V28_BOUND__ = true;

      document.addEventListener('play', sync, true);
      document.addEventListener('playing', sync, true);
      document.addEventListener('loadedmetadata', sync, true);
      document.addEventListener('loadeddata', sync, true);
      document.addEventListener('pause', hide, true);
      document.addEventListener('ended', hide, true);
      document.addEventListener('emptied', hide, true);
      document.addEventListener('abort', hide, true);
      document.addEventListener('pjax:before', hide);
      document.addEventListener('pjax:ready', () => window.setTimeout(sync, 120));

      document.addEventListener('click', (event) => {
        const target = event.target;

        if (target && target.closest && target.closest('#openAudioPlayer')) {
          window.setTimeout(() => {
            injectCss();
          }, 0);
        }

        const button = target && target.closest ? target.closest('button,[role="button"],a') : null;

        if (button) {
          const text = [
            button.textContent || '',
            button.getAttribute('aria-label') || '',
            button.getAttribute('title') || '',
            button.id || '',
            button.className || '',
          ].join(' ').toLowerCase();

          if (/\bstop\b|pause|arr[eê]t|fa-stop|fa-pause/.test(text)) {
            window.setTimeout(hide, 0);
            window.setTimeout(hide, 120);
          } else {
            window.setTimeout(sync, 220);
          }
        }
      }, true);
    }
  }

  window.__PR6_AUDIO_TITLE_MARQUEE_V28__ = {
    version: VERSION,
    show,
    apply: show,
    sync,
    hide,
    stop: hide,
    isPlaying: shouldShow,
    state: () => {
      const title = q('#responsiveWrapper .pr6-audio-track-title');
      const track = title?.querySelector('.pr6-audio-track-title-text');
      const style = track ? window.getComputedStyle(track) : null;

      return {
        version: VERSION,
        sourceText: title?.dataset?.pr6TitleSourceText || '',
        ticker: title?.dataset?.pr6TitleMarqueeTicker || '',
        durationMs: Number.parseInt(title?.dataset?.pr6TitleMarqueeDurationMs || '0', 10) || 0,
        trackUid: track?.dataset?.pr6StableTrackUid || '',
        animationName: style?.animationName || '',
        animationDuration: style?.animationDuration || '',
        transform: style?.transform || '',
        playingClass: Boolean(title?.classList?.contains('is-title-playing-v28')),
      };
    },
  };

  window.__PR6_AUDIO_MODAL_TOGGLE__ = Object.assign({}, window.__PR6_AUDIO_MODAL_TOGGLE__ || {}, {
    version: VERSION,
    open,
    close,
    toggle,
    isOpen,
    harden: injectCss,
    layout,
  });

  bind();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectCss();
      if (!shouldShow()) hide();
    }, { once: true });
  } else {
    injectCss();
    if (!shouldShow()) hide();
  }
})();
/* PR6_AUDIO_MODAL_TITLE_MARQUEE_PLAYBOUND_V28_FINAL_CSS_STABLE_END */
