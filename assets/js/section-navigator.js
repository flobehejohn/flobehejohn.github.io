(() => {
  'use strict';

  const SCROLL_SELECTORS = [
    '[data-scroll-section]:not([data-scroll-section="skip"])',
    'main section',
    'main .section',
    'main article > *',
    'main > .section',
    'main > *'
  ];

  let sections = [];
  let navContainer = null;
  let prevBtn = null;
  let nextBtn = null;
  let rafId = 0;
  let eventsBound = false;
  let navObserver = null;
  let contentObserver = null;
  let collectTimer = 0;

  function ensureNav() {
    if (navContainer) {
      attachNavContainer();
      return;
    }

    navContainer = document.createElement('div');
    navContainer.id = 'section-nav';
    navContainer.className = 'section-nav section-nav--navbar';
    navContainer.setAttribute('role', 'navigation');
    navContainer.setAttribute('aria-label', 'Navigation verticale');

    prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'section-nav__btn section-nav__btn--prev';
    prevBtn.setAttribute('aria-label', 'Section précédente');
    prevBtn.innerHTML = '<i class="fas fa-arrow-up" aria-hidden="true"></i><span class="visually-hidden">Section précédente</span>';

    nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'section-nav__btn section-nav__btn--next';
    nextBtn.setAttribute('aria-label', 'Section suivante');
    nextBtn.innerHTML = '<i class="fas fa-arrow-down" aria-hidden="true"></i><span class="visually-hidden">Section suivante</span>';

    prevBtn.addEventListener('click', () => scrollToSection('prev'));
    nextBtn.addEventListener('click', () => scrollToSection('next'));

    navContainer.appendChild(prevBtn);
    navContainer.appendChild(nextBtn);

    attachNavContainer();
  }

  function ensureNavGroup() {
    let navGroup = document.getElementById('navRightGroup');
    if (navGroup) {
      return navGroup;
    }

    const masthead = document.getElementById('masthead');
    if (!masthead) {
      return null;
    }
    const host = masthead.querySelector('.container') || masthead;
    if (!host) {
      return null;
    }

    navGroup = document.createElement('div');
    navGroup.id = 'navRightGroup';
    navGroup.className = 'd-flex align-items-center justify-content-center nav-right-group';

    const audioBtn = host.querySelector('#openAudioPlayer');
    const toggler = host.querySelector('.navbar-toggler');

    if (audioBtn) {
      navGroup.appendChild(audioBtn);
    }
    if (navContainer) {
      navGroup.appendChild(navContainer);
    }
    if (toggler) {
      navGroup.appendChild(toggler);
    }

    const collapse = host.querySelector('.navbar-collapse');
    if (collapse) {
      host.insertBefore(navGroup, collapse);
    } else {
      host.appendChild(navGroup);
    }

    if (!audioBtn && !toggler) {
      host.appendChild(navGroup);
    }

    return navGroup;
  }

  function attachNavContainer() {
    if (!navContainer) {
      return;
    }

    const navGroup = ensureNavGroup();

    if (navGroup) {
      navContainer.classList.add('section-nav--navbar');
      navContainer.classList.remove('section-nav--floating');

      const toggler = navGroup.querySelector('.navbar-toggler');
      if (toggler) {
        if (navContainer.parentElement !== navGroup || navContainer.nextElementSibling !== toggler) {
          navGroup.insertBefore(navContainer, toggler);
        }
      } else if (navContainer.parentElement !== navGroup) {
        navGroup.appendChild(navContainer);
      }

      watchNavGroup(navGroup);
    } else {
      navContainer.classList.add('section-nav--floating');
      navContainer.classList.remove('section-nav--navbar');

      const body = document.body;
      if (body && navContainer.parentElement !== body) {
        body.appendChild(navContainer);
      }

      disconnectNavObserver();
    }
  }

  function watchNavGroup(navGroup) {
    disconnectNavObserver();

    if (!(navGroup instanceof HTMLElement)) {
      return;
    }

    try {
      navObserver = new MutationObserver(() => {
        attachNavContainer();
      });
      navObserver.observe(navGroup, { childList: true });
    } catch (_) {
      navObserver = null;
    }
  }

  function disconnectNavObserver() {
    if (navObserver) {
      try { navObserver.disconnect(); } catch (_) {}
      navObserver = null;
    }
  }

  function watchContentRoot() {
    disconnectContentObserver();

    const root = document.querySelector('[data-pjax-root]') || document.querySelector('main');
    if (!(root instanceof HTMLElement)) {
      return;
    }

    try {
      contentObserver = new MutationObserver(() => {
        scheduleCollect(32);
      });
      contentObserver.observe(root, { childList: true, subtree: true });
    } catch (_) {
      contentObserver = null;
    }
  }

  function disconnectContentObserver() {
    if (contentObserver) {
      try { contentObserver.disconnect(); } catch (_) {}
      contentObserver = null;
    }
  }

  function scheduleCollect(delay = 0) {
    if (collectTimer) {
      window.clearTimeout(collectTimer);
    }
    collectTimer = window.setTimeout(() => {
      collectTimer = 0;
      collectSections();
    }, delay);
  }

  function getHeaderOffset() {
    const root = document.documentElement;
    const raw = getComputedStyle(root).getPropertyValue('--masthead-h').trim();
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) {
      return parsed + 12;
    }
    return 88;
  }

  function getElementTop(el) {
    return window.scrollY + el.getBoundingClientRect().top;
  }

  function isUsableSection(el) {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    if (!el.isConnected) {
      return false;
    }
    if (el.dataset.scrollNav === 'skip') {
      return false;
    }
    if (el.closest('[data-scroll-nav="skip"],[aria-hidden="true"],.modal-overlay')) {
      return false;
    }
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    if (el.offsetHeight < 24) {
      return false;
    }
    if (el.getAttribute('role') === 'presentation') {
      return false;
    }
    return true;
  }

  function collectSections() {
    ensureNav();

    const found = [];
    const seen = new Set();

    SCROLL_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (!isUsableSection(el)) {
          return;
        }
        if (seen.has(el)) {
          return;
        }
        seen.add(el);
        found.push(el);
      });
    });

    if (!found.length) {
      const main = document.querySelector('main');
      if (main && isUsableSection(main)) {
        found.push(main);
      }
    }

    found.sort((a, b) => getElementTop(a) - getElementTop(b));
    sections = found;
    toggleNavVisibility();
    updateButtonState();
    watchContentRoot();
  }

  function findNextSection(pos) {
    return sections.find((section) => getElementTop(section) > pos + 1) || null;
  }

  function findPreviousSection(pos) {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      if (getElementTop(sections[i]) < pos - 1) {
        return sections[i];
      }
    }
    return null;
  }

  function scrollToSection(direction) {
    if (!sections.length) {
      return;
    }

    const headerOffset = getHeaderOffset();
    const currentTop = window.scrollY + headerOffset;
    let target = null;

    if (direction === 'next') {
      target = findNextSection(currentTop);
      if (!target) {
        target = sections[sections.length - 1];
      }
    } else {
      target = findPreviousSection(window.scrollY + 1);
      if (!target) {
        target = sections[0];
      }
    }

    if (!target) {
      return;
    }

    const destination = Math.max(0, getElementTop(target) - headerOffset);
    window.scrollTo({ top: destination, behavior: 'smooth' });
  }

  function toggleNavVisibility() {
    if (!navContainer) {
      return;
    }
    if (!sections.length) {
      navContainer.setAttribute('hidden', '');
      return;
    }
    navContainer.removeAttribute('hidden');
  }

  function scheduleUpdate() {
    if (rafId) {
      return;
    }
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      updateButtonState();
    });
  }

  function updateButtonState() {
    if (!prevBtn || !nextBtn) {
      return;
    }
    if (!sections.length) {
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }
    if (sections.length < 2) {
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    const headerOffset = getHeaderOffset();
    const currentTop = window.scrollY + headerOffset;
    const nextSection = findNextSection(currentTop);
    const prevSection = findPreviousSection(window.scrollY + 1);

    prevBtn.disabled = !prevSection;
    nextBtn.disabled = !nextSection;
  }

  function bindEvents() {
    if (eventsBound) {
      return;
    }
    eventsBound = true;

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', () => {
      scheduleCollect(48);
      scheduleUpdate();
    }, { passive: true });

    document.addEventListener('pjax:ready', () => {
      attachNavContainer();
      collectSections();
      scheduleCollect(200);
      scheduleCollect(500);
    });

    document.addEventListener('pjax:send', () => {
      navContainer?.setAttribute('hidden', '');
      sections = [];
      disconnectContentObserver();
    });

    window.addEventListener('load', () => {
      scheduleCollect(200);
      scheduleCollect(600);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        scheduleCollect(60);
      }
    });
  }

  function init() {
    ensureNav();
    bindEvents();
    collectSections();
    scheduleCollect(250);
    scheduleCollect(750);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

