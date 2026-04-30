// /assets/js/pages/nuage_magique.js
// Contrôleur de page (non-module) pour "Nuage Magique"
//
// Rôles :
// - injecte le CSS (/assets/css/nuage_magique.css) si absent (+ évènement 'nuage:css-ready')
// - charge le module ESM (/assets/js/nuage_magique/test.js) si absent
// - lance NuageCloud.init(document) quand tout est prêt (idempotent)
// - expose window.NuageMagique.{boot, init, destroy} (API publique)
// - compatible navigation PJAX et navigation classique
// - journalisation détaillée pour diagnostiquer rapidement
//
(function () {
    'use strict';
  
    /* ========================================================================
     * LOGGING STYLÉ
     * ====================================================================== */
    const TAG  = '%c[NuagePage]';
    const CSS  = 'background:#102026;color:#46e6ff;font-weight:700;padding:2px 6px;border-radius:3px';
    const OK   = 'background:#0c2a1a;color:#77ffcc;font-weight:700;padding:2px 6px;border-radius:3px';
    const BAD  = 'background:#2b1d1d;color:#ffb3b3;font-weight:700;padding:2px 6px;border-radius:3px';
    const DBG  = () => (window.__NUAGE_PAGE_DEBUG__ ?? true);
  
    const log  = (m, ...a) => { if (DBG()) console.log( TAG+' '+m,  CSS, ...a); };
    const ok   = (m, ...a) => { if (DBG()) console.log( TAG+' '+m,  OK,  ...a); };
    const warn = (m, ...a) => { if (DBG()) console.warn(TAG+' '+m,  CSS, ...a); };
    const err  = (m, ...a) => { if (DBG()) console.error(TAG+' '+m, BAD,  ...a); };
    const grp  = (t) => { if (DBG()) { try { console.groupCollapsed(TAG+' '+t, CSS); } catch {} } };
    const end  = () => { if (DBG()) { try { console.groupEnd(); } catch {} } };
  
    /* ========================================================================
     * CONSTANTES
     * ====================================================================== */
    const CSS_HREF = '/assets/css/nuage_magique.css';
    const MOD_SRC  = '/assets/js/nuage_magique/test.js';
    const ROOT_SEL = 'main[data-pjax-root][data-page="nuage_magique"]';
  
    // Garde de statut
    if (window.__NUAGE_PAGE_READY__ === undefined) window.__NUAGE_PAGE_READY__ = false;
  
    // Pile de teardown (si le moteur souhaite nous enregistrer des callbacks)
    let teardownFns = [];
    function onTeardown(fn) { if (typeof fn === 'function') teardownFns.push(fn); }
    function runTeardown() {
      const n = teardownFns.length;
      if (n) grp(`Teardown interne (${n})`);
      while (teardownFns.length) {
        const fn = teardownFns.pop();
        try { fn(); } catch (e) { warn('Teardown handler a levé une erreur:', e); }
      }
      if (n) end();
    }
  
    /* ========================================================================
     * HELPERS
     * ====================================================================== */
    function samePath(href, targetPath) {
      try {
        const p = new URL(href, location.origin).pathname;
        return p === targetPath;
      } catch { return false; }
    }
    function getRoot() {
      return document.querySelector(ROOT_SEL);
    }
    function getPageId() {
      const main = document.querySelector('main[data-pjax-root]');
      return (main && main.getAttribute('data-page')) || '';
    }
  
    /* ========================================================================
     * CSS — chargement idempotent
     * ====================================================================== */
    function ensureCssOnce() {
      grp('ensureCssOnce()');
      try {
        const hasLink = Array
          .from(document.querySelectorAll('link[rel="stylesheet"]'))
          .some(l => samePath(l.href || '', CSS_HREF));
  
        let hasSheet = false;
        try {
          hasSheet = Array.from(document.styleSheets || [])
            .some(s => s.href && samePath(s.href, CSS_HREF));
        } catch { /* cross-origin → ignore */ }
  
        if (hasLink || hasSheet) {
          ok('CSS déjà présent → OK');
          // avertir le moteur que le CSS est prêt (utile pour stageFit)
          try { document.dispatchEvent(new CustomEvent('nuage:css-ready')); } catch {}
          end();
          return Promise.resolve(true);
        }
  
        return new Promise((res, rej) => {
          const ln = document.createElement('link');
          ln.id  = 'css-nuage-magique';
          ln.rel = 'stylesheet';
          ln.href = CSS_HREF + '?v=' + Date.now(); // anti-cache doux en PJAX
          ln.onload  = () => {
            ok('CSS chargé →', CSS_HREF);
            try { document.dispatchEvent(new CustomEvent('nuage:css-ready')); } catch {}
            end();
            res(true);
          };
          ln.onerror = (e) => { err('ÉCHEC chargement CSS :', CSS_HREF, e); end(); rej(e); };
          document.head.appendChild(ln);
          log('Injection CSS en cours…', ln.href);
        });
      } catch (e) {
        warn('ensureCssOnce() error', e);
        end();
        return Promise.resolve(false);
      }
    }
  
    /* ========================================================================
     * MODULE ESM (moteur) — chargement idempotent
     * ====================================================================== */
    function ensureModuleOnce() {
      grp('ensureModuleOnce()');
  
      if (window.NuageCloud && typeof window.NuageCloud.init === 'function') {
        ok('Moteur déjà présent (NuageCloud.init) → OK');
        end();
        return Promise.resolve(true);
      }
  
      let modTag = document.querySelector('script[type="module"][data-nuage-module="nuage"]');
      if (modTag) {
        log('Module déjà en cours d’injection — attente onload…');
        return new Promise((res) => {
          modTag.addEventListener('load', () => { ok('Module chargé (balise existante) → OK'); end(); res(true); }, { once: true });
        });
      }
  
      return new Promise((res, rej) => {
        modTag = document.createElement('script');
        modTag.type = 'module';
        modTag.dataset.nuageModule = 'nuage';
        modTag.src = MOD_SRC + '?v=' + Date.now();
        modTag.onload  = () => { ok('Module ESM chargé →', modTag.src); end(); res(true); };
        modTag.onerror = (e) => { err('ÉCHEC chargement module ESM :', MOD_SRC, e); end(); rej(e); };
        document.head.appendChild(modTag);
        log('Injection module ESM en cours…', modTag.src);
      });
    }
  
    /* ========================================================================
     * BOOT
     * ====================================================================== */
    async function boot() {
      // Garde de page
      const root = getRoot();
      if (!root) { warn('boot ignoré : racine PJAX absente (page non nuage ?)'); return; }
  
      if (window.__NUAGE_PAGE_READY__) {
        log('boot ignoré (déjà prêt)');
        return;
      }
  
      grp('boot()');
  
      // 1) CSS (évite stage à 0px / fit prématuré)
      try { await ensureCssOnce(); } catch {}
  
      // 2) Moteur
      await ensureModuleOnce();
      if (!window.NuageCloud?.init) {
        err('Moteur indisponible après ensureModuleOnce()');
        end();
        return;
      }
  
      // 3) Sélection des éléments de page (avec fallback global pour #cloud-bg)
      const el = {
        bg:     document.getElementById('cloud-bg') || root.querySelector('#cloud-bg'),
        stage:  root.querySelector('#cloud-stage'),
        input:  root.querySelector('#textInputCloud'),
        button: root.querySelector('#btnTextCloud')
      };
  
      if (!el.bg)    warn('#cloud-bg introuvable → aucun rendu canvas (le moteur peut toutefois fonctionner en fond si déjà initialisé globalement)');
      if (!el.stage) warn('#cloud-stage introuvable → fit/rect limités (le moteur utilisera fitToView en fallback)');
  
      // 4) Sanity-check de contexte
      const pageId = getPageId();
      log('Contexte page :', { pageId, hasBg: !!el.bg, hasStage: !!el.stage });
  
      // 5) Init du moteur (signature attendue : init(containerScope|document))
      try {
        await window.NuageCloud.init(document);
        ok('NuageCloud.init() → OK');
        window.__NUAGE_PAGE_READY__ = true;
      } catch (e) {
        err('Erreur pendant NuageCloud.init()', e);
        end();
        return;
      }
  
      // 6) Diagnostic post-boot : stage visible ?
      try {
        const st = el.stage;
        if (st) {
          const r = st.getBoundingClientRect();
          if (r.height <= 2 || r.width <= 2) {
            warn('Stage très petit après boot (h/w ≤ 2px) → le CSS n’a peut-être pas encore peint. (Le moteur refitera sur "nuage:css-ready" et aux prochaines mesures.)');
          } else {
            ok(`Stage visible : ${Math.round(r.width)}×${Math.round(r.height)}px`);
          }
        }
      } catch {}
  
      end();
    }
  
    /* ========================================================================
     * DESTROY
     * ====================================================================== */
    function destroy() {
      // Ne détruire QUE si on est/était réellement sur la page nuage
      const stillOnNuage = !!getRoot();
      if (!window.__NUAGE_PAGE_READY__ && !stillOnNuage) return;
  
      grp('destroy()');
  
      // 1) callbacks fournis par le moteur (rAF/timers/listeners…)
      runTeardown();
  
      // 2) Dissoudre poliment puis détruire
      try { window.NuageCloud?.setTextMode?.('dissolve'); } catch {}
      try { window.NuageCloud?.destroy?.(); } catch {}
  
      window.__NUAGE_PAGE_READY__ = false;
      ok('destroy() effectué');
      end();
    }
  
    /* ========================================================================
     * HOOKS NAVIGATION & LIFECYCLE
     * ====================================================================== */
  
    // En accès direct (sans PJAX) — lancé au 1er chargement
    document.addEventListener('DOMContentLoaded', () => {
      const page = getRoot();
      if (page) {
        log('DOMContentLoaded sur page nuage → boot()');
        boot();
      }
    }, { once: true });
  
    // Avec PJAX — à chaque arrivée de page
    document.addEventListener('pjax:ready', (e) => {
      const container = e.detail?.container || document;
      const page = container.querySelector && container.querySelector(ROOT_SEL);
      if (page) {
        log('pjax:ready sur page nuage → boot()');
        boot();
      }
    });
  
    // Avant navigation/remplacement PJAX — on détruit proprement si on quitte la page nuage
    const onBeforeNav = (evtName) => {
      if (document.querySelector(ROOT_SEL)) {
        log(`${evtName} → destroy()`);
        destroy();
      }
    };
    document.addEventListener('pjax:beforeReplace', () => onBeforeNav('pjax:beforeReplace'));
    document.addEventListener('pjax:before',        () => onBeforeNav('pjax:before'));
  
    // Filet sur navigation classique (reload / close)
    window.addEventListener('beforeunload', () => {
      if (document.querySelector(ROOT_SEL)) destroy();
    });
  
    // (optionnel) visibilité → utile pour corréler des pertes de frames avec tab caché
    document.addEventListener('visibilitychange', () => {
      log('visibilitychange →', document.visibilityState);
    });
  
    /* ========================================================================
     * API PUBLIQUE (pour page-hub.js ou usage manuel)
     * ====================================================================== */
    window.NuageMagique = Object.freeze({
      boot,        // alias init
      init: boot,  // compat maximale
      destroy
    });
  
  })();
  