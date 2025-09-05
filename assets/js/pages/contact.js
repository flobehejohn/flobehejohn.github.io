// assets/js/pages/contact.js
// Page Contact — Google Maps JS API + mailto — idempotent, PJAX-friendly, logs chics (Firefox/Chromium)

(function (window, document) {
    'use strict';
  
    const NS  = 'ContactPage';
    const API = { init, destroy };
    let state = null;
  
    // Logger homogène
    const TAG = '%c[Contact]';
    const CSS = 'background:#0b1f2a;color:#8bf0ff;font-weight:700;padding:2px 6px;border-radius:3px';
    const OK  = 'background:#0c2a1a;color:#77ffcc;font-weight:700;padding:2px 6px;border-radius:3px';
    const BAD = 'background:#2b1d1d;color:#ffb3b3;font-weight:700;padding:2px 6px;border-radius:3px';
    const log  = (...a) => console.log(TAG, CSS, ...a);
    const info = (...a) => console.info(TAG, CSS, ...a);
    const warn = (...a) => console.warn(TAG, CSS, ...a);
    const err  = (...a) => console.error(TAG, CSS, ...a);
  
    const qs  = (s, r=document) => r.querySelector(s);
    const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  
    // Carte : Montreuil
    const CENTER = { lat: 48.8636, lng: 2.4432 };
    const ZOOM   = 14;
  
    // Charge Google Maps (promesse unique globale, safe pour PJAX)
    async function ensureGMaps(key) {
      if (window.google && window.google.maps) {
        info('%cGoogle Maps déjà présent', OK);
        return window.google.maps;
      }
      if (!key) throw new Error('GMAPS_MISSING_KEY');
  
      if (!window.__GMAPS_PROMISE__) {
        info('Chargement Google Maps…');
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
  
    // Obfuscation e-mail → lien mailto
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
  
    // Générateur d’e-mail (mailto vers florian.behejohn@hotmail.fr)
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
  
    // Monte la carte Google
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
        content: `<strong>Florian Behejohn</strong><br>29 rue Émile Zola<br>93100 Montreuil`
      });
      marker.addListener('click', () => infoWindow.open({ map, anchor: marker }));
  
      const btnCenter = qs('#mapRecenter');
      const onCenter  = () => { map.setCenter(CENTER); map.setZoom(ZOOM); };
      if (btnCenter) btnCenter.addEventListener('click', onCenter);
  
      const directions = qs('#mapDirections');
      if (directions) directions.href = `https://www.google.com/maps/dir/?api=1&destination=${CENTER.lat},${CENTER.lng}`;
  
      statusBox && (statusBox.textContent = 'Carte Google Maps chargée ✅');
      info('%cCarte initialisée', OK, { center: CENTER, zoom: ZOOM });
  
      // Cleanup local
      return () => {
        try { if (btnCenter) btnCenter.removeEventListener('click', onCenter); } catch {}
        info('%cCarte démontée', OK);
      };
    }
  
    // INIT / DESTROY (PJAX-ready)
    async function init() {
      if (state?.mounted) return warn('%cInit ignoré (déjà monté)', BAD);
  
      const root = qs('main[data-page="contact"]');
      if (!root) return;
      const key  = qs('meta[name="gmaps-key"]')?.content?.trim() || '';
      const unsubs = [];
      const abortCtl = new AbortController();
  
      revealEmail();
      const unsubForm = setupMailForm();
      if (typeof unsubForm === 'function') unsubs.push(unsubForm);
  
      try {
        const gmaps = await ensureGMaps(key);
        const unsubMap = mountMap(gmaps);
        if (typeof unsubMap === 'function') unsubs.push(unsubMap);
      } catch (e) {
        err('%cÉchec Google Maps', BAD, e);
        const box = qs('#mapStatus');
        if (box) {
          if (e && e.message === 'GMAPS_MISSING_KEY') {
            box.innerHTML = `<span class="text-danger">Clé Google Maps absente. Ajoutez-la dans &lt;meta name="gmaps-key" content="…">&gt;.</span>`;
          } else {
            box.innerHTML = `<span class="text-warning">Impossible de charger Google Maps. <a target="_blank" rel="noopener" href="https://maps.google.com/?q=${CENTER.lat},${CENTER.lng}">Ouvrir la carte</a></span>`;
          }
        }
      }
  
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
  
    // Expose & auto-init hors PJAX
    window[NS] = API;
    window.contact = API; // alias éventuel
  
    if (document.querySelector('main[data-page="contact"]')) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
      } else {
        init();
      }
    }
  
    // Hooks PJAX si présents
    window.addEventListener('pjax:ready',  () => document.querySelector('main[data-page="contact"]') && init());
    window.addEventListener('pjax:before', () => document.querySelector('main[data-page="contact"]') && destroy());
    window.addEventListener('beforeunload', destroy);
  
  })(window, document);
  