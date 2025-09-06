// assets/js/navbar.js
// Navbar robuste & PJAX-safe : auto-close (clic lien / clic hors / Échap),
// synchronisation du toggler (Bootstrap 5), mise à jour .active, guards anti-double-binding,
// correction auto d'IDs dupliqués pour #main-navbar.

/* global bootstrap */
(() => {
  'use strict';

  const NAVBAR_ID = 'main-navbar';
  const NAVBAR_TOGGLER_SEL = '.navbar-toggler';
  let globalsBound = false;

  // ————————————————————————————————————————————————
  // Utils
  const q  = (sel, ctx = document) => ctx.querySelector(sel);
  const qa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const hasBS = () => (typeof bootstrap !== 'undefined' && bootstrap?.Collapse);

  // Corrige les IDs dupliqués : seul le <div.collapse.navbar-collapse> doit porter #main-navbar
  function ensureUniqueNavbarId() {
    const nodes = qa('#' + CSS.escape(NAVBAR_ID));
    if (nodes.length <= 1) return;

    // Garde le premier <div.collapse.navbar-collapse>, retire l'id aux autres
    let keeper = nodes.find(n => n.matches('div.collapse.navbar-collapse')) || nodes[0];
    nodes.forEach(n => { if (n !== keeper) n.removeAttribute('id'); });

    // Optionnel : si une <ul> avait l'id → on retire aussi toute classe 'collapse' fantôme
    qa('ul#' + CSS.escape(NAVBAR_ID)).forEach(ul => {
      ul.classList.remove('collapse', 'collapsing', 'show');
      ul.style.height = '';
    });
  }

  function getCollapseEl() {
    ensureUniqueNavbarId();
    return document.getElementById(NAVBAR_ID);
  }

  // Ferme "fort" le collapse + remet le toggler dans l'état attendu
  function hardClose() {
    const el = getCollapseEl();
    if (!el) return;

    try {
      if (hasBS()) {
        const inst = bootstrap.Collapse.getOrCreateInstance(el, { toggle: false });
        inst.hide();
      }
    } catch { /* noop */ }

    // Force l'état DOM au cas où (gracieux)
    el.classList.remove('show', 'collapsing');
    el.classList.add('collapse');
    el.style.height = '';

    const toggler = q(NAVBAR_TOGGLER_SEL);
    if (toggler) {
      toggler.classList.add('collapsed');
      toggler.setAttribute('aria-expanded', 'false');
    }
  }

  // Ajoute la fermeture auto sur clic d'un lien du menu
  function bindAutoClose() {
    const container = getCollapseEl();
    if (!container) return;

    qa('.nav-link', container).forEach(a => {
      if (a.__closeHandler) {
        a.removeEventListener('click', a.__closeHandler, true);
      }
      const handler = () => hardClose();
      a.addEventListener('click', handler, { capture: true });
      a.__closeHandler = handler;
    });
  }

  // Normalise une URL/href en chemin absolu (root-relatif) comparable
  function normalizePath(urlLike) {
    try {
      const u = new URL(urlLike, window.location.origin);
      let p = u.pathname;
      if (p === '/') p = '/index.html';
      // Uniformise les chemins finissant par '/' -> ajoute index.html pour comparer juste
      if (p.endsWith('/')) p += 'index.html';
      return p.toLowerCase();
    } catch {
      // href relatif simple (ex: "/contact.html")
      if (!urlLike) return '/index.html';
      let p = urlLike;
      if (!p.startsWith('/')) {
        // transforme relatif en absolu par rapport à la racine
        const cur = window.location.pathname;
        // on ne résout pas finement ici : on compare par suffixe plus bas
        p = '/' + p.replace(/^\.?\//, '');
      }
      if (p === '/') p = '/index.html';
      if (p.endsWith('/')) p += 'index.html';
      return p.toLowerCase();
    }
  }

  // Met à jour la classe .active (et aria-current) selon l'URL courante
  function setActiveNav() {
    const current = normalizePath(window.location.href);

    qa('#' + CSS.escape(NAVBAR_ID) + ' .nav-link').forEach(a => {
      const href = (a.getAttribute('href') || '').trim();
      const target = normalizePath(href);

      // Match strict ou suffixe (utile si le site est servi sous un sous-dossier)
      const isActive = current === target || current.endsWith(target);

      a.classList.toggle('active', isActive);
      if (isActive) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  // Synchronise le toggler avec les événements Collapse (Bootstrap)
  function bindBootstrapTogglerSync() {
    const el = getCollapseEl();
    if (!el || !hasBS()) return;

    if (el.__bsSyncBound) return;
    el.__bsSyncBound = true;

    const togglerOn = () => {
      const toggler = q(NAVBAR_TOGGLER_SEL);
      if (!toggler) return;
      toggler.classList.remove('collapsed');
      toggler.setAttribute('aria-expanded', 'true');
    };
    const togglerOff = () => {
      const toggler = q(NAVBAR_TOGGLER_SEL);
      if (!toggler) return;
      toggler.classList.add('collapsed');
      toggler.setAttribute('aria-expanded', 'false');
    };

    el.addEventListener('show.bs.collapse',  togglerOn);
    el.addEventListener('shown.bs.collapse', togglerOn);
    el.addEventListener('hide.bs.collapse',  togglerOff);
    el.addEventListener('hidden.bs.collapse', togglerOff);
  }

  // Rebind après remplacement DOM (PJAX)
  function reinitAfterSwap() {
    ensureUniqueNavbarId();
    bindAutoClose();
    bindBootstrapTogglerSync();
    setActiveNav();
  }

  // Bind globaux une seule fois
  function bindGlobalsOnce() {
    if (globalsBound) return;
    globalsBound = true;

    // Clic hors du collapse : ferme
    document.addEventListener('click', (e) => {
      const inCollapse = e.target.closest('#' + NAVBAR_ID);
      const onToggler = e.target.closest(NAVBAR_TOGGLER_SEL);
      if (!inCollapse && !onToggler) hardClose();
    }, { capture: true });

    // Échap : ferme
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hardClose();
    });

    // Avant nav PJAX : ferme pour éviter états "fantômes"
    document.addEventListener('pjax:before', hardClose);

    // Après navigation PJAX : rebind
    document.addEventListener('pjax:ready', reinitAfterSwap);
    document.addEventListener('pjax:success', reinitAfterSwap);
    document.addEventListener('pjax:complete', reinitAfterSwap);

    // 1ère charge
    document.addEventListener('DOMContentLoaded', () => {
      reinitAfterSwap();
      hardClose(); // démarre fermé en mobile
    });

    // Sécurité : en cas de resize majeur, on force un état cohérent
    window.addEventListener('resize', () => {
      // Rien de spécial ici, mais on peut recalculer actif si tu as des routes dynamiques
      setActiveNav();
    });
  }

  // Init
  bindGlobalsOnce();

  // Optionnel : petite API debug
  window.Navbar = Object.freeze({
    close: hardClose,
    refresh: reinitAfterSwap
  });
})();
