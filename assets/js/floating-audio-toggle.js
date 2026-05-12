/**
 * ========================================================
 * 🎧 BOUTON FLOTTANT DU LECTEUR AUDIO — SINGLETON TOGGLE
 * PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V2
 *
 * Contrat certifié :
 * - clic 1 sur #openAudioPlayer => ouverture
 * - clic 2 sur #openAudioPlayer => fermeture
 * - clic 3 sur #openAudioPlayer => réouverture
 *
 * Le contrôleur est global et délégué afin de survivre aux remplacements PJAX,
 * aux duplications temporaires et aux réinitialisations du PlayerSingleton.
 * ========================================================
 */
(() => {
  'use strict';

  const CONTRACT_VERSION = 'PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V2';
  const ROOT_DATA_KEY = 'audioModalOpen';

  const SELECTORS = {
    button: '#openAudioPlayer',
    modal: '#audioPlayerModal',
    wrapper: '#responsiveWrapper',
    audio: '#audioPlayer',
    close: '#closePlayerModal',
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

  function getContractState() {
    return document.documentElement.dataset[ROOT_DATA_KEY] === 'true';
  }

  function setContractState(open) {
    document.documentElement.dataset[ROOT_DATA_KEY] = open ? 'true' : 'false';
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

      window.__AUDIO_MODAL_TOGGLE_AUDIT__ = Object.assign(
        {},
        window.__AUDIO_MODAL_TOGGLE_AUDIT__ || {},
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

    try {
      if (current.wrapper) {
        current.wrapper.style.display = 'flex';
        current.wrapper.style.visibility = 'visible';
        current.wrapper.style.opacity = '1';
        current.wrapper.classList.add('is-open');
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
  }

  window.__PR6_AUDIO_MODAL_TOGGLE__ = {
    version: CONTRACT_VERSION,
    init,
    isOpen,
    open: () => openAudioModal('api-open'),
    close: () => closeAudioModal('api-close'),
    toggle: () => toggleAudioModal('api-toggle'),
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
