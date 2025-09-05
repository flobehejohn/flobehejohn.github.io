/* shell-guards.js
   Idempotent guard pour :
   - Shell unique (navbar + modals)
   - Nettoyage des body-locks (modal-open / overflow:hidden)
   - Toggle audio persistant (localStorage)
   - Contract PJAX simple : chaque page expose init() / destroy() via ShellHub
*/
(function () {
  if (window.__SHELL_GUARD_LOADED__) return;
  window.__SHELL_GUARD_LOADED__ = true;

  // ---- Helpers ----
  function safe(q, root) { try { root = root || document; return root.querySelector(q); } catch(e) { return null; } }
  function safes(q, root) { try { root = root || document; return Array.from(root.querySelectorAll(q)); } catch(e) { return []; } }

  // ---- Clear body locks (idempotent) ----
  function clearBodyLocks() {
    try {
      // Remove bootstrap modal-open + inline overflow hidden
      document.body.classList.remove('modal-open');
      if (document.body.style && document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
      }
      // data attributes used as counters (custom implementations)
      if (document.body.dataset._scrollLockCount) {
        delete document.body.dataset._scrollLockCount;
      }
      if (document.body.dataset._prevOverflow) {
        delete document.body.dataset._prevOverflow;
      }
      if (document.body.dataset._prevPaddingRight) {
        delete document.body.dataset._prevPaddingRight;
      }
      // ensure no inline style left over on html element either
      if (document.documentElement && document.documentElement.style && document.documentElement.style.overflow === 'hidden') {
        document.documentElement.style.overflow = '';
      }
    } catch (e) { console.warn('[shell-guards] clearBodyLocks failed', e); }
  }

  // ---- Single global modals housekeeping ----
  function dedupeGlobalModals() {
    try {
      const modalIds = ['audioPlayerModal','cv-modal'];
      modalIds.forEach(id => {
        const nodes = safes('#' + id);
        if (nodes.length > 1) {
          // keep first, remove others
          for (let i = 1; i < nodes.length; i++) nodes[i].remove();
        }
      });
    } catch (e) { console.warn('[shell-guards] dedupeGlobalModals', e); }
  }

  // ---- Audio toggle (persistence) ----
  const AUDIO_KEY = '__SHELL_AUDIO_MUTED__';
  function initAudioToggle() {
    try {
      const audio = safe('audio[data-audio="global"], #global-audio');
      if (!audio) return;
      // restore previous state
      const muted = localStorage.getItem(AUDIO_KEY) === '1';
      audio.muted = muted;
      // expose API
      window.ShellAudio = {
        toggle: function() {
          audio.muted = !audio.muted;
          localStorage.setItem(AUDIO_KEY, audio.muted ? '1' : '0');
          window.dispatchEvent(new CustomEvent('shell:audio:toggle', { detail: { muted: audio.muted }}));
          return audio.muted;
        },
        setMuted: function(m) {
          audio.muted = !!m;
          localStorage.setItem(AUDIO_KEY, audio.muted ? '1' : '0');
          window.dispatchEvent(new CustomEvent('shell:audio:set', { detail: { muted: audio.muted }}));
        }
      };
      // Listen for external toggles (safe multi-tab)
      window.addEventListener('storage', function(e) {
        if (e.key === AUDIO_KEY) {
          audio.muted = e.newValue === '1';
        }
      });
    } catch (e) { console.warn('[shell-guards] initAudioToggle', e); }
  }

  // ---- Simple PJAX contract / registry for pages ----
  window.ShellHub = window.ShellHub || {};
  // page modules should call: ShellHub.register('pageName', { init: fn, destroy: fn })
  window.ShellHub.register = function(name, obj) {
    if (!name || !obj) return;
    window.ShellHub[name] = obj;
  };

  // Trigger safe hooks that page modules can listen to
  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch(e) {}
  }

  // ---- Auto init on load and pjax events ----
  document.addEventListener('DOMContentLoaded', function() {
    clearBodyLocks();
    dedupeGlobalModals();
    initAudioToggle();
    emit('shell:ready');
  });

  // Common events used by many PJAX implementations
  window.addEventListener('pjax:beforeReplace', function(){ clearBodyLocks(); emit('pjax:beforeReplace'); });
  window.addEventListener('pjax:success', function(){ clearBodyLocks(); emit('pjax:success'); });
  window.addEventListener('pjax:complete', function(){ clearBodyLocks(); initAudioToggle(); emit('pjax:complete'); });

  // Also tolerate custom event names used locally
  window.addEventListener('page:destroy', function(){ clearBodyLocks(); emit('page:destroy'); });
  window.addEventListener('page:init', function(){ initAudioToggle(); emit('page:init'); });

  // Expose utility
  window.ShellGuards = {
    clearBodyLocks: clearBodyLocks,
    initAudioToggle: initAudioToggle,
    dedupeGlobalModals: dedupeGlobalModals
  };
})();