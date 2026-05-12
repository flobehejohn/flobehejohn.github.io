/**
 * ========================================================
 * 🎧 BOUTON FLOTTANT DU LECTEUR AUDIO — SINGLETON TOGGLE
 * PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V3_LAYOUT
 *
 * Contrat certifié :
 * - clic 1 sur #openAudioPlayer => ouverture
 * - clic 2 sur #openAudioPlayer => fermeture
 * - clic 3 sur #openAudioPlayer => réouverture
 * - layout lisible desktop/mobile : timecode, volume musique,
 *   volume sound design, contrôles, aucun chevauchement bloquant.
 * ========================================================
 */
(() => {
  'use strict';

  const CONTRACT_VERSION = 'PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V3_LAYOUT';
  const ROOT_DATA_KEY = 'audioModalOpen';
  const STYLE_ID = 'pr6-audio-modal-layout-style-v3';
  const SOUND_VOLUME_KEY = 'pr6:site-sound-design-volume:v1';

  const SELECTORS = {
    button: '#openAudioPlayer',
    modal: '#audioPlayerModal',
    wrapper: '#responsiveWrapper',
    audio: '#audioPlayer',
    close: '#closePlayerModal',
    controls: '.controls',
    radio: '.radio',
  };

  function toArray(nodes) {
    return Array.prototype.slice.call(nodes || []);
  }

  function first(selector) {
    return document.querySelector(selector);
  }

  function nodes() {
    return {
      button: first(SELECTORS.button),
      modal: first(SELECTORS.modal),
      wrapper: first(SELECTORS.wrapper),
      audio: first(SELECTORS.audio),
      close: first(SELECTORS.close),
      controls: first(SELECTORS.controls),
      radio: first(SELECTORS.radio),
    };
  }

  function visible(node) {
    if (!node || node.nodeType !== 1) return false;

    try {
      const element = node;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.parseFloat(style.opacity || '1') > 0.05
        && rect.width > 0
        && rect.height > 0;
    } catch (_) {
      return false;
    }
  }

  function injectLayoutCss() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* PR6_AUDIO_MODAL_LAYOUT_V3 */
      #responsiveWrapper.pr6-audio-layout-certified,
      #responsiveWrapper[data-pr6-audio-layout="certified"] {
        position: fixed !important;
        left: 50% !important;
        right: auto !important;
        bottom: clamp(12px, 3vh, 28px) !important;
        width: min(760px, calc(100vw - 32px)) !important;
        min-width: min(320px, calc(100vw - 32px)) !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: calc(100vh - 32px) !important;
        transform: translateX(-50%) !important;
        transform-origin: bottom center !important;
        z-index: 9999 !important;
        box-sizing: border-box !important;
        isolation: isolate !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified *,
      #responsiveWrapper[data-pr6-audio-layout="certified"] * {
        box-sizing: border-box !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .audio-player-modal,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .audio-player-modal {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        display: flex !important;
        align-items: stretch !important;
        justify-content: center !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .modal-content-player,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .modal-content-player {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: calc(100vh - 40px) !important;
        overflow: auto !important;
        display: block !important;
        border-radius: 18px !important;
        background: linear-gradient(145deg, rgba(25, 31, 38, 0.98), rgba(8, 12, 18, 0.98)) !important;
        border: 1px solid rgba(95, 191, 249, 0.28) !important;
        box-shadow: 0 18px 42px rgba(0, 0, 0, 0.55), 0 0 26px rgba(95, 191, 249, 0.22) !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .radio,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .radio {
        width: 100% !important;
        height: auto !important;
        min-height: 240px !important;
        padding: clamp(18px, 3vw, 28px) !important;
        padding-top: clamp(42px, 6vw, 54px) !important;
        display: grid !important;
        grid-template-columns: minmax(112px, 156px) minmax(0, 1fr) !important;
        gap: clamp(18px, 3vw, 28px) !important;
        align-items: center !important;
        overflow: visible !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .cover,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .cover {
        width: clamp(104px, 18vw, 150px) !important;
        height: clamp(104px, 18vw, 150px) !important;
        justify-self: center !important;
        align-self: center !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .controls,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .controls {
        width: 100% !important;
        min-width: 0 !important;
        display: grid !important;
        grid-template-rows: auto auto auto auto auto !important;
        gap: 12px !important;
        align-items: stretch !important;
        justify-items: stretch !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .buttons,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .buttons {
        display: flex !important;
        flex-wrap: wrap !important;
        justify-content: center !important;
        align-items: center !important;
        gap: clamp(10px, 2vw, 16px) !important;
        width: 100% !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .button,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .button {
        width: clamp(46px, 9vw, 60px) !important;
        height: clamp(46px, 9vw, 60px) !important;
        min-width: 46px !important;
        flex: 0 0 auto !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .progress,
      #responsiveWrapper.pr6-audio-layout-certified input.progress,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .progress,
      #responsiveWrapper[data-pr6-audio-layout="certified"] input.progress {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        min-height: 28px !important;
        margin: 0 !important;
        display: block !important;
        order: unset !important;
        background: transparent !important;
        overflow: visible !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .volume,
      #responsiveWrapper.pr6-audio-layout-certified input.volume,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .volume,
      #responsiveWrapper[data-pr6-audio-layout="certified"] input.volume {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        display: block !important;
        margin: 0 !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified input[type="range"],
      #responsiveWrapper[data-pr6-audio-layout="certified"] input[type="range"] {
        width: 100% !important;
        min-width: 0 !important;
        height: 28px !important;
        accent-color: #5fbff9 !important;
        cursor: pointer !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified input[type="range"]::-webkit-slider-runnable-track,
      #responsiveWrapper[data-pr6-audio-layout="certified"] input[type="range"]::-webkit-slider-runnable-track {
        height: 8px !important;
        border-radius: 999px !important;
        background: linear-gradient(90deg, rgba(95, 191, 249, 0.95), rgba(62, 232, 181, 0.95)) !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified input[type="range"]::-moz-range-track,
      #responsiveWrapper[data-pr6-audio-layout="certified"] input[type="range"]::-moz-range-track {
        height: 8px !important;
        border-radius: 999px !important;
        background: linear-gradient(90deg, rgba(95, 191, 249, 0.95), rgba(62, 232, 181, 0.95)) !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified input[type="range"]::-moz-range-thumb,
      #responsiveWrapper[data-pr6-audio-layout="certified"] input[type="range"]::-moz-range-thumb {
        width: 18px !important;
        height: 18px !important;
        border: 2px solid rgba(255, 255, 255, 0.92) !important;
        border-radius: 50% !important;
        background: #5fbff9 !important;
        box-shadow: 0 0 12px rgba(95, 191, 249, 0.75) !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified input[type="range"]::-webkit-slider-thumb,
      #responsiveWrapper[data-pr6-audio-layout="certified"] input[type="range"]::-webkit-slider-thumb {
        width: 18px !important;
        height: 18px !important;
        border: 2px solid rgba(255, 255, 255, 0.92) !important;
        border-radius: 50% !important;
        background: #5fbff9 !important;
        box-shadow: 0 0 12px rgba(95, 191, 249, 0.75) !important;
        margin-top: -5px !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .timecode,
      #responsiveWrapper.pr6-audio-layout-certified .time-display,
      #responsiveWrapper.pr6-audio-layout-certified .timecode-counter,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .timecode,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .time-display,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .timecode-counter {
        width: 100% !important;
        display: block !important;
        font-size: clamp(0.88rem, 2.5vw, 1.12rem) !important;
        line-height: 1.35 !important;
        text-align: center !important;
        color: #d9f7ff !important;
        -webkit-text-fill-color: currentColor !important;
        text-shadow: 0 0 8px rgba(95, 191, 249, 0.55) !important;
        white-space: nowrap !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .pr6-audio-control-row,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .pr6-audio-control-row {
        width: 100% !important;
        display: grid !important;
        grid-template-columns: minmax(112px, 0.34fr) minmax(160px, 1fr) minmax(46px, auto) !important;
        gap: 10px !important;
        align-items: center !important;
        min-width: 0 !important;
        padding: 9px 10px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-radius: 12px !important;
        background: rgba(255, 255, 255, 0.035) !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .pr6-audio-control-label,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .pr6-audio-control-label {
        min-width: 0 !important;
        font-size: clamp(0.78rem, 2vw, 0.92rem) !important;
        font-weight: 700 !important;
        color: rgba(230, 248, 255, 0.92) !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .pr6-audio-control-value,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .pr6-audio-control-value {
        min-width: 42px !important;
        text-align: right !important;
        font-size: 0.82rem !important;
        font-variant-numeric: tabular-nums !important;
        color: rgba(217, 247, 255, 0.88) !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .close-button,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .close-button {
        top: 8px !important;
        right: 12px !important;
        width: 34px !important;
        height: 34px !important;
        font-size: 30px !important;
        line-height: 30px !important;
        z-index: 10002 !important;
      }

      #responsiveWrapper.pr6-audio-layout-certified .drag-bar,
      #responsiveWrapper[data-pr6-audio-layout="certified"] .drag-bar {
        width: 48px !important;
        height: 42px !important;
        z-index: 10001 !important;
      }

      @media screen and (max-width: 720px) {
        #responsiveWrapper.pr6-audio-layout-certified,
        #responsiveWrapper[data-pr6-audio-layout="certified"] {
          width: calc(100vw - 20px) !important;
          bottom: 10px !important;
        }

        #responsiveWrapper.pr6-audio-layout-certified .radio,
        #responsiveWrapper[data-pr6-audio-layout="certified"] .radio {
          grid-template-columns: 1fr !important;
          gap: 14px !important;
          padding: 44px 14px 16px !important;
        }

        #responsiveWrapper.pr6-audio-layout-certified .cover,
        #responsiveWrapper[data-pr6-audio-layout="certified"] .cover {
          width: 96px !important;
          height: 96px !important;
        }

        #responsiveWrapper.pr6-audio-layout-certified .pr6-audio-control-row,
        #responsiveWrapper[data-pr6-audio-layout="certified"] .pr6-audio-control-row {
          grid-template-columns: 1fr !important;
          gap: 6px !important;
        }

        #responsiveWrapper.pr6-audio-layout-certified .pr6-audio-control-value,
        #responsiveWrapper[data-pr6-audio-layout="certified"] .pr6-audio-control-value {
          text-align: left !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getContractState() {
    return document.documentElement.dataset[ROOT_DATA_KEY] === 'true';
  }

  function setContractState(open) {
    document.documentElement.dataset[ROOT_DATA_KEY] = open ? 'true' : 'false';
  }

  function clampVolume(value) {
    const numeric = Number.parseFloat(String(value));

    if (!Number.isFinite(numeric)) return 0.7;

    return Math.max(0, Math.min(1, numeric));
  }

  function readSoundDesignVolume() {
    try {
      const stored = window.localStorage ? window.localStorage.getItem(SOUND_VOLUME_KEY) : null;
      return clampVolume(stored == null ? 0.7 : stored);
    } catch (_) {
      return 0.7;
    }
  }

  function publishSoundDesignVolume(value, source) {
    const volume = clampVolume(value);

    try {
      if (window.localStorage) {
        window.localStorage.setItem(SOUND_VOLUME_KEY, String(volume));
      }
    } catch (_) {}

    window.__SITE_SOUND_DESIGN_VOLUME__ = volume;
    document.documentElement.style.setProperty('--site-sound-design-volume', String(volume));

    try {
      window.dispatchEvent(new CustomEvent('pr6:sound-design-volume', {
        detail: { volume, source: source || 'audio-modal' },
      }));
    } catch (_) {}

    return volume;
  }

  function ensureControlRow(input, labelText, className) {
    if (!input || !input.parentNode) return null;
    if (input.closest('.pr6-audio-control-row')) return input.closest('.pr6-audio-control-row');

    const row = document.createElement('div');
    row.className = 'pr6-audio-control-row ' + className;
    row.dataset.pr6AudioControlRow = className;

    const label = document.createElement('label');
    label.className = 'pr6-audio-control-label';
    label.textContent = labelText;

    if (input.id) {
      label.setAttribute('for', input.id);
    }

    const value = document.createElement('output');
    value.className = 'pr6-audio-control-value';
    value.textContent = input.type === 'range' && input.max === '1'
      ? Math.round(Number.parseFloat(input.value || '0') * 100) + '%'
      : '';

    input.parentNode.insertBefore(row, input);
    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(value);

    input.addEventListener('input', () => {
      value.textContent = input.max === '1'
        ? Math.round(Number.parseFloat(input.value || '0') * 100) + '%'
        : '';
    });

    return row;
  }

  function ensureSoundDesignVolume() {
    const current = nodes();
    const controls = current.controls || current.radio || current.wrapper;

    if (!controls) return null;

    let slider = document.getElementById('siteSoundDesignVolume');

    if (!slider) {
      const row = document.createElement('div');
      row.className = 'pr6-audio-control-row pr6-sound-design-volume-row';
      row.dataset.pr6AudioControlRow = 'sound-design-volume';

      const label = document.createElement('label');
      label.className = 'pr6-audio-control-label';
      label.setAttribute('for', 'siteSoundDesignVolume');
      label.textContent = 'Sound design du site';

      slider = document.createElement('input');
      slider.id = 'siteSoundDesignVolume';
      slider.className = 'pr6-sound-design-volume';
      slider.type = 'range';
      slider.min = '0';
      slider.max = '1';
      slider.step = '0.01';
      slider.value = String(readSoundDesignVolume());
      slider.setAttribute('aria-label', 'Volume du sound design du site');

      const output = document.createElement('output');
      output.className = 'pr6-audio-control-value';
      output.setAttribute('for', 'siteSoundDesignVolume');
      output.textContent = Math.round(readSoundDesignVolume() * 100) + '%';

      row.appendChild(label);
      row.appendChild(slider);
      row.appendChild(output);
      controls.appendChild(row);
    }

    slider.value = String(publishSoundDesignVolume(slider.value || readSoundDesignVolume(), 'sync'));

    if (!slider.dataset.pr6SoundDesignVolumeBound) {
      slider.dataset.pr6SoundDesignVolumeBound = '1';
      slider.addEventListener('input', () => {
        const volume = publishSoundDesignVolume(slider.value, 'input');
        const output = slider.closest('.pr6-audio-control-row')?.querySelector('.pr6-audio-control-value');
        if (output) output.textContent = Math.round(volume * 100) + '%';
      });
    }

    return slider;
  }

  function normalizeExistingControls() {
    const current = nodes();
    const wrapper = current.wrapper;

    if (!wrapper) return;

    wrapper.classList.add('pr6-audio-layout-certified');
    wrapper.dataset.pr6AudioLayout = 'certified';

    const progressInput = wrapper.querySelector('.progress input[type="range"], input.progress[type="range"], input[type="range"][id*="progress" i], input[type="range"][id*="seek" i]');
    if (progressInput) {
      progressInput.classList.add('pr6-timecode-range');
      progressInput.setAttribute('aria-label', progressInput.getAttribute('aria-label') || 'Position de lecture');
      ensureControlRow(progressInput, 'Timecode', 'pr6-timecode-row');
    }

    const musicVolumeInput = wrapper.querySelector('.volume input[type="range"], input.volume[type="range"], input[type="range"][id*="volume" i]:not(#siteSoundDesignVolume)');
    if (musicVolumeInput) {
      musicVolumeInput.classList.add('pr6-music-volume-range');
      musicVolumeInput.setAttribute('aria-label', musicVolumeInput.getAttribute('aria-label') || 'Volume musique');
      ensureControlRow(musicVolumeInput, 'Volume musique', 'pr6-music-volume-row');
    }

    ensureSoundDesignVolume();
  }

  function measureLayout() {
    const current = nodes();
    const wrapper = current.wrapper;

    if (!wrapper) {
      return {
        layoutReady: false,
        overflowCount: 0,
        overlapCount: 0,
        soundDesignVolumePresent: false,
      };
    }

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const elements = toArray(wrapper.querySelectorAll('.pr6-audio-control-row, .buttons, .cover, .close-button'))
      .filter(visible);

    const overflowCount = elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -4 || rect.right > viewportWidth + 4;
    }).length;

    let overlapCount = 0;
    for (let i = 0; i < elements.length; i += 1) {
      const a = elements[i].getBoundingClientRect();
      for (let j = i + 1; j < elements.length; j += 1) {
        const b = elements[j].getBoundingClientRect();
        const horizontal = a.left < b.right - 3 && a.right > b.left + 3;
        const vertical = a.top < b.bottom - 3 && a.bottom > b.top + 3;
        if (horizontal && vertical) overlapCount += 1;
      }
    }

    const soundDesignVolume = document.getElementById('siteSoundDesignVolume');
    const ranges = toArray(wrapper.querySelectorAll('input[type="range"]'));
    const readableRanges = ranges.filter((range) => {
      const rect = range.getBoundingClientRect();
      return rect.width >= 120 && rect.height >= 20;
    }).length;

    return {
      layoutReady: Boolean(wrapper.classList.contains('pr6-audio-layout-certified')),
      overflowCount,
      overlapCount,
      rangeCount: ranges.length,
      readableRangeCount: readableRanges,
      soundDesignVolumePresent: Boolean(soundDesignVolume),
      soundDesignVolume: readSoundDesignVolume(),
      wrapperWidth: Math.round(wrapper.getBoundingClientRect().width),
      viewportWidth,
    };
  }

  function isOpen() {
    const state = getContractState();
    const current = nodes();

    return Boolean(
      state
      || current.wrapper?.classList?.contains('is-open')
      || current.modal?.classList?.contains('is-open')
      || current.modal?.classList?.contains('show')
      || visible(current.wrapper)
      || visible(current.modal)
    );
  }

  function writeAudit(open, source, error) {
    try {
      const current = nodes();
      const layout = measureLayout();

      window.__AUDIO_MODAL_TOGGLE_AUDIT__ = Object.assign(
        {},
        window.__AUDIO_MODAL_TOGGLE_AUDIT__ || {},
        layout,
        {
          version: CONTRACT_VERSION,
          ready: true,
          open: Boolean(open),
          source: source || 'unknown',
          buttonCount: document.querySelectorAll(SELECTORS.button).length,
          modalCount: document.querySelectorAll(SELECTORS.modal).length,
          wrapperCount: document.querySelectorAll(SELECTORS.wrapper).length,
          audioCount: document.querySelectorAll(SELECTORS.audio).length,
          hasAudioApp: Boolean(window.AudioApp),
          audioAppInitialized: Boolean(window.AudioApp && window.AudioApp.initialized === true),
          buttonExpanded: current.button ? current.button.getAttribute('aria-expanded') : null,
          lastError: error ? (error.message || String(error)) : null,
          updatedAt: new Date().toISOString(),
        }
      );
    } catch (_) {}
  }

  function syncButton(open) {
    const current = nodes();
    const button = current.button;

    if (!button) return;

    try {
      button.classList.toggle('active', Boolean(open));
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.setAttribute('aria-controls', 'audioPlayerModal');
      button.setAttribute('type', button.getAttribute('type') || 'button');
    } catch (_) {}
  }

  function showDom() {
    const current = nodes();

    injectLayoutCss();
    normalizeExistingControls();

    try {
      if (current.wrapper) {
        current.wrapper.style.display = 'flex';
        current.wrapper.style.visibility = 'visible';
        current.wrapper.style.opacity = '1';
        current.wrapper.classList.add('is-open', 'pr6-audio-layout-certified');
        current.wrapper.dataset.pr6AudioLayout = 'certified';
        current.wrapper.setAttribute('aria-hidden', 'false');
      }

      if (current.modal) {
        current.modal.style.display = 'flex';
        current.modal.style.visibility = 'visible';
        current.modal.style.opacity = '1';
        current.modal.classList.add('is-open');
        current.modal.setAttribute('aria-hidden', 'false');
      }
    } catch (_) {}
  }

  function hideDom() {
    const current = nodes();

    try {
      if (current.wrapper) {
        current.wrapper.style.display = 'none';
        current.wrapper.classList.remove('is-open');
        current.wrapper.setAttribute('aria-hidden', 'true');
      }

      if (current.modal) {
        current.modal.style.display = 'none';
        current.modal.classList.remove('show', 'is-open');
        current.modal.setAttribute('aria-hidden', 'true');
      }
    } catch (_) {}
  }

  async function ensureSingletonReady() {
    try {
      const current = nodes();
      const needsInit =
        (!window.AudioApp || window.AudioApp.initialized !== true)
        && Boolean(current.audio);

      if (!needsInit) return;

      await new Promise((resolve, reject) => {
        const existing = toArray(document.scripts).find((script) => {
          return /\/assets\/js\/player-singleton\.js/.test(script.src || '');
        });

        if (existing && window.AudioApp) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = '/assets/js/player-singleton.js?v=' + Date.now();
        script.async = false;
        script.onload = () => resolve();
        script.onerror = (event) => reject(event);
        document.head.appendChild(script);
      });
    } catch (error) {
      writeAudit(isOpen(), 'ensure-singleton-error', error);
    }
  }

  async function openAudioModal(source) {
    setContractState(true);
    showDom();
    syncButton(true);

    try {
      await ensureSingletonReady();

      if (window.AudioApp && typeof window.AudioApp.open === 'function') {
        window.AudioApp.open();
      }
    } catch (error) {
      writeAudit(true, source || 'open-error', error);
    }

    setContractState(true);
    showDom();
    syncButton(true);
    writeAudit(true, source || 'open');
    return true;
  }

  async function closeAudioModal(source) {
    try {
      if (window.AudioApp && typeof window.AudioApp.close === 'function') {
        window.AudioApp.close();
      } else if (window.AudioApp && typeof window.AudioApp.hide === 'function') {
        window.AudioApp.hide();
      }
    } catch (error) {
      writeAudit(false, source || 'close-audioapp-error', error);
    }

    setContractState(false);
    hideDom();
    syncButton(false);
    writeAudit(false, source || 'close');
    return false;
  }

  async function toggleAudioModal(source) {
    return isOpen()
      ? closeAudioModal(source || 'button-toggle-close')
      : openAudioModal(source || 'button-toggle-open');
  }

  function isToggleTarget(event) {
    const target = event && event.target;

    if (!target || !target.closest) return false;

    return Boolean(target.closest(SELECTORS.button));
  }

  function isCloseTarget(event) {
    const target = event && event.target;

    if (!target || !target.closest) return false;

    return Boolean(target.closest(SELECTORS.close));
  }

  function onDocumentClick(event) {
    if (isToggleTarget(event)) {
      event.preventDefault();
      event.stopPropagation();

      toggleAudioModal('button-click').catch((error) => {
        writeAudit(isOpen(), 'button-click-error', error);
      });

      return;
    }

    if (isCloseTarget(event)) {
      event.preventDefault();
      event.stopPropagation();

      closeAudioModal('close-button').catch((error) => {
        writeAudit(false, 'close-button-error', error);
      });
    }
  }

  function dedupe(selector) {
    const found = toArray(document.querySelectorAll(selector));

    if (found.length <= 1) return;

    found.slice(1).forEach((node) => {
      try {
        node.remove();
      } catch (_) {}
    });
  }

  function dedupeAudioRuntime() {
    dedupe(SELECTORS.button);
    dedupe(SELECTORS.audio);
  }

  function syncInitialState() {
    injectLayoutCss();
    normalizeExistingControls();

    const currentOpen = getContractState();

    if (currentOpen) {
      showDom();
      syncButton(true);
      writeAudit(true, 'sync-open');
    } else {
      hideDom();
      syncButton(false);
      writeAudit(false, 'sync-closed');
    }
  }

  function init() {
    dedupeAudioRuntime();
    syncInitialState();
  }

  if (!window.__PR6_AUDIO_MODAL_TOGGLE_BOUND__) {
    window.__PR6_AUDIO_MODAL_TOGGLE_BOUND__ = true;

    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('touchend', onDocumentClick, { capture: true, passive: false });
    document.addEventListener('pointerup', (event) => {
      if (event.pointerType !== 'mouse') {
        onDocumentClick(event);
      }
    }, true);

    document.addEventListener('pjax:before', () => {
      closeAudioModal('pjax-before').catch(() => {});
    });

    document.addEventListener('pjax:ready', () => {
      window.setTimeout(init, 0);
      window.setTimeout(init, 120);
    });

    window.addEventListener('load', init);
    window.addEventListener('resize', () => {
      window.clearTimeout(window.__PR6_AUDIO_MODAL_LAYOUT_RESIZE_TIMER__);
      window.__PR6_AUDIO_MODAL_LAYOUT_RESIZE_TIMER__ = window.setTimeout(() => {
        normalizeExistingControls();
        writeAudit(isOpen(), 'resize');
      }, 120);
    });
  }

  window.__PR6_AUDIO_MODAL_TOGGLE__ = {
    version: CONTRACT_VERSION,
    init,
    isOpen,
    open: () => openAudioModal('api-open'),
    close: () => closeAudioModal('api-close'),
    toggle: () => toggleAudioModal('api-toggle'),
    layout: () => {
      injectLayoutCss();
      normalizeExistingControls();
      writeAudit(isOpen(), 'api-layout');
      return measureLayout();
    },
    getSoundDesignVolume: readSoundDesignVolume,
    setSoundDesignVolume: (value) => publishSoundDesignVolume(value, 'api-set'),
  };

  window.initFloatingAudio = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  const observer = new MutationObserver(() => {
    window.clearTimeout(window.__PR6_AUDIO_MODAL_TOGGLE_OBSERVER_TIMER__);
    window.__PR6_AUDIO_MODAL_TOGGLE_OBSERVER_TIMER__ = window.setTimeout(init, 80);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
