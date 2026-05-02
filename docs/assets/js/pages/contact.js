// assets/js/pages/contact.js
// Page Contact — fallback statique Google Maps sans appel externe avant clé + consentement explicite.

(function (window, document) {
    'use strict';
  
    const NS  = 'ContactPage';
    const API = { init, destroy };
    let state = null;
  
    const TAG = '%c[Contact]';
    const CSS = 'background:#0b1f2a;color:#8bf0ff;font-weight:700;padding:2px 6px;border-radius:3px';
    const OK  = 'background:#0c2a1a;color:#77ffcc;font-weight:700;padding:2px 6px;border-radius:3px';
    const BAD = 'background:#2b1d1d;color:#ffb3b3;font-weight:700;padding:2px 6px;border-radius:3px';
    const log  = (...a) => console.log(TAG, CSS, ...a);
    const info = (...a) => console.info(TAG, CSS, ...a);
    const warn = (...a) => console.warn(TAG, CSS, ...a);
    const err  = (...a) => console.error(TAG, CSS, ...a);
  
    const qs  = (s, r=document) => r.querySelector(s);
  
    const CENTER = { lat: 48.8636, lng: 2.4432 };
    const ZOOM   = 14;

    function ensureAudit() {
      window.__CONTACT_AUDIT__ = window.__CONTACT_AUDIT__ || {
        initialized: false,
        mapFallbackControlled: false,
        mapsExternalCallsBlockedWithoutConsent: true,
        consent: false,
        hasMapsKey: false
      };
      return window.__CONTACT_AUDIT__;
    }

    function hasExplicitMapsConsent() {
      try {
        return window.__CONTACT_MAPS_CONSENT__ === true
          || localStorage.getItem('contact:maps-consent') === '1'
          || document.documentElement.dataset.mapsConsent === 'true';
      } catch {
        return window.__CONTACT_MAPS_CONSENT__ === true;
      }
    }
  
    async function ensureGMaps(key) {
      const audit = ensureAudit();
      audit.hasMapsKey = /^G-[A-Z0-9]+$/.test(key) === false && Boolean(key);
      audit.consent = hasExplicitMapsConsent();

      if (!key) throw new Error('GMAPS_MISSING_KEY');
      if (!audit.consent) throw new Error('GMAPS_MISSING_CONSENT');

      if (window.google && window.google.maps) {
        info('%cGoogle Maps déjà présent', OK);
        return window.google.maps;
      }
  
      if (!window.__GMAPS_PROMISE__) {
        info('Chargement Google Maps après consentement explicite…');
        window.__GMAPS_PROMISE__ = new Promise((resolve, reject) => {
          const cb = '__CONTACT_MAP_CB__';
          window[cb] = () => {
            try { resolve(window.google.maps); }
            catch (e) { reject(e); }
            finally { try { delete window[cb]; } catch {}
            }
          };
          const s = document.createElement('script');
          s.id   = 'gmaps-js';
          s.src  = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${cb}`;
          s.async = true; s.defer = true;
          s.onerror = () => reject(new Error('GMAPS_NETWORK'));
          document.head.appendChild(s);
        });
      }
      return window.__GMAPS_PROMISE__;
    }
  
    function revealEmail() {
      const span = qs('#emailSafe');
      if (!span) return;
      const full = `${span.dataset.user}@${span.dataset.domain}`;
      const a = document.createElement('a');
      a.href = `mailto:${full}`;
      a.textContent = full;
      a.rel = 'nofollow';
      span.replaceWith(a);
      info('%cE-mail révélé (anti-bot)', OK);
    }
  
    function setupMailForm() {
      const form     = qs('#contactForm');
      if (!form) return () => {};
      const btn      = qs('#submitBtn', form);
      const spinner  = qs('#submitSpinner', form);
      const msgBox   = qs('#messages', form);
  
      const setStatus = (type, html) => { if (msgBox) msgBox.innerHTML = `<div class="alert alert-${type}" role="status">${html}</div>`; };
  
      function buildMailto(name, email, message) {
        const to = 'florian.behejohn@hotmail.fr';
        const subject = encodeURIComponent(`Contact site — ${name || 'Sans nom'}`);
        const body = encodeURIComponent(`${message || ''}\n\n— ${name || ''} (${email || ''})\n[${new Date().toLocaleString()}]`);
        return `mailto:${to}?subject=${subject}&body=${body}`;
      }
  
      const onSubmit = (ev) => {
        ev.preventDefault();
        if (!form.checkValidity()) {
          form.classList.add('was-validated');
          setStatus('warning', 'Veuillez corriger les champs requis.');
          return;
        }
  
        const name    = qs('#name', form)?.value?.trim();
        const email   = qs('#email', form)?.value?.trim();
        const message = qs('#message', form)?.value?.trim();
  
        btn.disabled = true; spinner?.classList?.remove('d-none');
        setStatus('info', 'Préparation de votre e-mail…');
  
        try {
          const mailto = buildMailto(name, email, message);
          info('%cOuverture client mail…', OK, { to: 'florian.behejohn@hotmail.fr' });
          window.location.href = mailto;
          setStatus('success', 'Votre logiciel e-mail devrait s’ouvrir. Merci !');
        } catch (e) {
          err('%cMailto échoué', BAD, e);
          setStatus('danger', 'Impossible d’ouvrir votre client e-mail. Copiez le message et envoyez-le manuellement.');
        } finally {
          btn.disabled = false; spinner?.classList?.add('d-none');
        }
      };
  
      form.addEventListener('submit', onSubmit);
      return () => form.removeEventListener('submit', onSubmit);
    }

    function mountStaticMapFallback(reason = 'GMAPS_MISSING_CONSENT') {
      const audit = ensureAudit();
      audit.mapFallbackControlled = true;
      audit.mapsExternalCallsBlockedWithoutConsent = true;
      audit.reason = reason;

      const container = qs('#gmap');
      const statusBox = qs('#mapStatus');
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${CENTER.lat},${CENTER.lng}`;

      if (container) {
        container.dataset.fallbackControlled = 'true';
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        container.innerHTML = `
          <div>
            <p class="mb-3 fw-semibold">Carte désactivée : ouvrir dans Google Maps</p>
            <a class="btn btn-outline-secondary btn-sm" target="_blank" rel="noopener noreferrer" href="${mapsUrl}">Ouvrir dans Google Maps</a>
          </div>`;
      }

      const directions = qs('#mapDirections');
      if (directions) {
        directions.href = mapsUrl;
        directions.target = '_blank';
        directions.rel = 'noopener noreferrer';
      }

      if (statusBox) {
        statusBox.textContent = reason === 'GMAPS_MISSING_KEY'
          ? 'Carte désactivée : aucune clé Google Maps explicite.'
          : 'Carte désactivée : consentement Google Maps non donné.';
      }
      warn('%cGoogle Maps fallback contrôlé', BAD, { code: reason });
      return () => {};
    }
  
    function mountMap(googleMaps) {
      const container = qs('#gmap');
      const statusBox = qs('#mapStatus');
      if (!container) {
        warn('%cContainer carte indisponible', BAD);
        return () => {};
      }
  
      const map = new googleMaps.Map(container, {
        center: CENTER,
        zoom: ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
      });
  
      const marker = new googleMaps.Marker({
        position: CENTER, map,
        title: 'Florian Behejohn — Montreuil'
      });
  
      const infoWindow = new googleMaps.InfoWindow({
        content: `<strong>Florian Behejohn</strong><br>Paris — France`
      });
      marker.addListener('click', () => infoWindow.open({ map, anchor: marker }));
  
      const btnCenter = qs('#mapRecenter');
      const onCenter  = () => { map.setCenter(CENTER); map.setZoom(ZOOM); };
      if (btnCenter) btnCenter.addEventListener('click', onCenter);
  
      const directions = qs('#mapDirections');
      if (directions) directions.href = `https://www.google.com/maps/dir/?api=1&destination=${CENTER.lat},${CENTER.lng}`;
  
      statusBox && (statusBox.textContent = 'Carte Google Maps chargée après consentement explicite.');
      info('%cCarte initialisée', OK, { center: CENTER, zoom: ZOOM });
  
      return () => {
        try { if (btnCenter) btnCenter.removeEventListener('click', onCenter); } catch {}
        info('%cCarte démontée', OK);
      };
    }
  
    async function init() {
      if (state?.mounted) return warn('%cInit ignoré (déjà monté)', BAD);
  
      const root = qs('main[data-page="contact"]');
      if (!root) return;
      const key  = qs('meta[name="gmaps-key"]')?.content?.trim() || '';
      const unsubs = [];
      const abortCtl = new AbortController();
      const audit = ensureAudit();
  
      revealEmail();
      const unsubForm = setupMailForm();
      if (typeof unsubForm === 'function') unsubs.push(unsubForm);
  
      try {
        const gmaps = await ensureGMaps(key);
        const unsubMap = mountMap(gmaps);
        if (typeof unsubMap === 'function') unsubs.push(unsubMap);
      } catch (e) {
        const code = e && e.message ? e.message : 'GMAPS_UNAVAILABLE';
        const unsubFallback = mountStaticMapFallback(code);
        if (typeof unsubFallback === 'function') unsubs.push(unsubFallback);
      }
  
      audit.initialized = true;
      state = { mounted: true, abortCtl, unsubs };
      log('%cinit()', OK, { page: 'contact' });
    }
  
    function destroy() {
      if (!state?.mounted) return;
      state.abortCtl?.abort?.();
      state.unsubs?.forEach(fn => { try { fn(); } catch {} });
      state = null;
      log('%cdestroy()', OK);
    }
  
    window[NS] = API;
    window.contact = API;
  
    if (document.querySelector('main[data-page="contact"]')) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
      } else {
        init();
      }
    }
  
    window.addEventListener('pjax:ready',  () => document.querySelector('main[data-page="contact"]') && init());
    window.addEventListener('pjax:before', () => document.querySelector('main[data-page="contact"]') && destroy());
    window.addEventListener('beforeunload', destroy);
  
  })(window, document);


function ensureMapDirectionsAnchor() {
  if (document.getElementById('mapDirections')) return;

  const mapContainer =
    document.querySelector('[data-map-fallback]') ||
    document.querySelector('.map-fallback') ||
    document.querySelector('#map') ||
    document.querySelector('[class*="map"]');

  if (!mapContainer) return;

  const link = document.createElement('a');
  link.id = 'mapDirections';
  link.href = 'https://www.google.com/maps/search/?api=1&query=Paris%2C%20France';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Carte désactivée : ouvrir dans Google Maps';
  link.dataset.privacyFallback = 'google-maps';

  mapContainer.appendChild(link);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureMapDirectionsAnchor, { once: true });
} else {
  ensureMapDirectionsAnchor();
}
