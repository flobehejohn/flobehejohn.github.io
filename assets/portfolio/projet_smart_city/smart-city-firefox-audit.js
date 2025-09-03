// smart-city-firefox-audit.js
// Usage: Open the Smart City page, then paste the content of this file into the Firefox Console (F12 -> Console).
// Or include it temporarily with: <script src="/smart-city-firefox-audit.js"></script>

(function () {
  const log  = (...a) => console.log('%c[SMART-CITY AUDIT]', 'color:#0aa;font-weight:700', ...a);
  const warn = (...a) => console.warn('%c[SMART-CITY AUDIT]', 'color:#c60;font-weight:700', ...a);
  const err  = (...a) => console.error('%c[SMART-CITY AUDIT]', 'color:#c00;font-weight:700', ...a);

  function pick(sel, root=document){ return (root instanceof Element ? root : document).querySelector(sel); }
  function all(sel, root=document){ return Array.from((root instanceof Element ? root : document).querySelectorAll(sel)); }

  const container = pick('main[data-pjax-root]') || document;
  const page = container?.getAttribute('data-page');
  const audioPolicy = container?.getAttribute('data-audio');

  log('Container:', container);
  log('data-page:', page, 'data-audio:', audioPolicy);

  // Check page-hub presence
  const hasPageHub = typeof window.applyAudioArbiter === 'function';
  log('page-hub present?', hasPageHub);
  const scripts = all('script[src]');
  const hasPHScriptTag = scripts.some(s => (s.src || '').includes('/assets/js/page-hub.js'));
  log('page-hub <script> tag detected?', hasPHScriptTag);

  // Check SmartCity module availability
  log('SmartCity module ?', typeof window.SmartCity, window.SmartCity);

  // Modal check
  const pubModal = pick('#publication-modal', container);
  const openPub  = pick('#open-publication-modal', container);
  const closePub = pick('#close-publication-modal', container);
  log('Modal elements:', { pubModal: !!pubModal, openBtn: !!openPub, closeBtn: !!closePub });

  // Try programmatic open/close
  if (pubModal && openPub && closePub) {
    const openEvt = new MouseEvent('click', { bubbles: true, cancelable: true });
    openPub.dispatchEvent(openEvt);
    const opened = pubModal.classList.contains('show');
    log('Modal opened after programmatic click?', opened);
    if (opened) {
      const closeEvt = new MouseEvent('click', { bubbles: true, cancelable: true });
      closePub.dispatchEvent(closeEvt);
      log('Modal closed again?', !pubModal.classList.contains('show'));
    }
  } else {
    warn('Modal missing or buttons not found inside the PJAX container.');
  }

  // Videos diagnostics
  const vids = all('.carte-lecteur-video video', container);
  if (!vids.length) warn('No .carte-lecteur-video <video> elements found.');

  vids.forEach((v, i) => {
    const info = {
      idx: i,
      readyState: v.readyState,      // 0..4
      networkState: v.networkState,  // 0..3
      src: v.currentSrc || v.src,
      canMp4: v.canPlayType ? v.canPlayType('video/mp4') : 'NA',
      error: v.error ? { code: v.error.code, message: v.error.message } : null
    };
    log('Video status:', info);

    // HEAD fetch to inspect headers (CORS, ranges, content-type)
    if (info.src) {
      fetch(info.src, { method: 'HEAD', mode: 'cors' })
        .then(r => {
          log(`HEAD ${info.src}`, {
            status: r.status,
            'content-type': r.headers.get('content-type'),
            'accept-ranges': r.headers.get('accept-ranges'),
            'access-control-allow-origin': r.headers.get('access-control-allow-origin'),
            'content-length': r.headers.get('content-length'),
          });
        })
        .catch(e => warn('HEAD fail:', e));
    }

    // Try seek preview frame
    const trySeek = () => {
      try { v.currentTime = 0.12; log(`Video[${i}] seek 0.12 OK`); }
      catch (e) { warn(`Video[${i}] seek 0.12 FAIL`, e); }
    };
    if (v.readyState >= 1) trySeek(); else v.addEventListener('loadedmetadata', trySeek, { once: true });

    // Try play() then pause()
    v.play().then(() => {
      log(`Video[${i}] play() OK`);
      v.pause();
    }).catch(e => warn(`Video[${i}] play() rejected`, e && e.name || e));
  });

  // Global audio
  const audio = document.getElementById('audioPlayer');
  if (audio) log('audioPlayer present, paused?:', audio.paused, 'muted:', audio.muted);
  else warn('audioPlayer not found (ok if no global player here).');

  // Quick advice based on findings
  if (!hasPageHub || !hasPHScriptTag) {
    warn('page-hub.js likely NOT loaded. Add: <script src="/assets/js/page-hub.js" defer></script>');
  }
  if (page !== 'smart_city') {
    warn('Container lacks data-page="smart_city" — targeted boot will not run.');
  }

  log('Done.');
})();