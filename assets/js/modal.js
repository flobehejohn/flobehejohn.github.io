/**
 * MODALE DYNAMIQUE DE COMPÉTENCES – PJAX friendly (bundle unique)
 * ---------------------------------------------------------------
 * 1) createSkillModal / openSkillModal / closeSkillModal (global once)
 * 2) bindSkillCards(container) : rendu des étoiles + interactions grille
 * 3) utils : getStarsHTML, renderStars
 * 4) init(container) : boot au DOMReady + à chaque pjax:ready
 * by Florian – mai 2025 (refactor PJAX)
 */

(() => {
  'use strict';

  // ---------- Variables "globales" au module (non polluantes) ----------
  let modal, modalBody;
  let lastScrollPosition = 0;
  let globalBound = false; // pour binder les listeners globaux une seule fois

  // ---------- 1. Création / ouverture / fermeture de la modale ----------
  function createSkillModal() {
    if (document.getElementById('skill-modal')) {
      modal = document.getElementById('skill-modal');
      modalBody = modal.querySelector('.sc-modal-body') || modal.querySelector('.modal-body');
      return;
    }

    const overlay  = Object.assign(document.createElement('div'), { id: 'skill-modal', className: 'sc-modal-overlay', style: 'display:none' });
    const content  = Object.assign(document.createElement('div'), { className: 'sc-modal-content' });
    const closeBtn = Object.assign(document.createElement('span'), { className: 'sc-close-btn', innerHTML: '&times;' });
    modalBody      = document.createElement('div'); modalBody.className = 'sc-modal-body';

    // Fermetures
    closeBtn.addEventListener('click', closeSkillModal);
    overlay .addEventListener('click', closeSkillModal);
    content.addEventListener('click', (e) => e.stopPropagation()); // évite fermeture si on clique dans le contenu

    content.append(closeBtn, modalBody);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Inject minimal CSS once (if absent)
    if (!document.querySelector('style[data-skill-modal-css],link[href*="/assets/css/skill-card-modal.css"]')) {
      const css = `
        .sc-modal-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:3000}
        .sc-modal-overlay[aria-hidden="false"],.sc-modal-overlay.show{display:flex}
        .sc-modal-content{background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);display:flex;flex-direction:column;max-height:92vh;max-width:min(900px,92vw);width:92vw}
        .sc-close-btn{align-self:flex-end;margin:.5rem .75rem 0 0;font-size:1.75rem;line-height:1;cursor:pointer}
        .sc-modal-body{padding:1rem;overflow:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y}
        .sc-modal-body .software-logos{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;margin:0 0 .5rem 0}
        .sc-modal-body .modal-logo{width:40px;height:40px;object-fit:contain;border-radius:4px;box-shadow:none;opacity:.95;transition:transform .15s ease}
        @media (min-width: 576px){.sc-modal-body .modal-logo{width:48px;height:48px}}
        .sc-modal-body .modal-logo:hover{transform:scale(1.06)}
        .sc-modal-body .modal-logo.selected{outline:2px solid rgba(255,0,0,.35)}
        .sc-modal-body h3{font-size:1.1rem;font-weight:600;text-align:center;margin:.25rem 0 .5rem}
        .sc-modal-body p{margin:.25rem 0 .75rem}
        @media (max-width: 767.98px){.sc-modal-content{width:100vw;height:100vh;max-height:100vh;border-radius:0}}
      `;
      const st = document.createElement('style'); st.type='text/css'; st.setAttribute('data-skill-modal-css','1'); st.appendChild(document.createTextNode(css));
      document.head.appendChild(st);
    }

    modal = overlay;
  }

  function openSkillModal(card) {
    createSkillModal();

    // Récup infos carte (robuste)
    const ratingHost = card.closest('[data-rating]');
    const rating     = Number.parseFloat(ratingHost?.dataset.rating) || 0;
    const logos      = card.querySelectorAll('.software-logos .logo');
    let toolRatings  = {};
    try {
      toolRatings = JSON.parse(card.dataset.toolRatings || '{}');
    } catch { toolRatings = {}; }

    // HTML de la modale
    modalBody.innerHTML = `
      <div class="software-logos">
        ${[...logos].map(l => `<img src="${l.src}" alt="${l.alt || ''}" class="modal-logo" />`).join('')}
      </div>
      <h3>${(card.querySelector('h3')?.textContent || '').trim()}</h3>
      <p>${card.querySelector('p')?.innerHTML || ''}</p>
      <div class="rating-stars">${getStarsHTML(rating)}</div>
      <div class="custom-rating"><span class="tool-name"></span></div>
    `;

    // Interactions internes
    const modalStars = modalBody.querySelector('.rating-stars');
    const customRate = modalBody.querySelector('.custom-rating');
    const modalLogos = modalBody.querySelectorAll('.modal-logo');

    let selectedLogo  = null;   // logo verrouillé
    let revertTimeout = null;   // retour auto (35s)

    const showTool = (logo, lock = false) => {
      const val = toolRatings[logo.alt] ?? rating;
      modalStars.innerHTML = getStarsHTML(val, '#FF0000');
      customRate.classList.add('show');
      customRate.querySelector('.tool-name').textContent = `${logo.alt} (${val}/5)`;

      if (lock) {
        if (selectedLogo) selectedLogo.classList.remove('selected');
        selectedLogo = logo;
        logo.classList.add('selected');
        clearTimeout(revertTimeout);
        revertTimeout = setTimeout(resetToDefault, 35000);
      }
    };

    const resetToDefault = () => {
      if (selectedLogo) selectedLogo.classList.remove('selected');
      selectedLogo = null;
      modalStars.innerHTML = getStarsHTML(rating);
      customRate.classList.remove('show');
      clearTimeout(revertTimeout);
    };

    modalLogos.forEach((logo) => {
      logo.style.cursor = 'pointer';
      logo.addEventListener('mouseenter', () => { if (selectedLogo !== logo) showTool(logo, false); });
      logo.addEventListener('mouseleave', () => { if (!selectedLogo) resetToDefault(); });
      logo.addEventListener('click', (e) => { e.stopPropagation(); showTool(logo, true); });
    });

    // Clic dans la zone vide de la modale = retour note par défaut
    modalBody.addEventListener('click', (e) => {
      if (!e.target.classList.contains('modal-logo')) resetToDefault();
    }, { once: true });

    // Affichage + scroll lock
    lastScrollPosition = window.pageYOffset || document.documentElement.scrollTop || 0;
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeSkillModal() {
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    try { window.scrollTo({ top: lastScrollPosition, left: 0 }); } catch { window.scrollTo(0, lastScrollPosition); }
  }

  // ---------- 2. Binding des cartes dans un CONTAINER (PJAX friendly) ----------
  function bindSkillCards(container = document) {
    const root = (container instanceof Element) ? container : document;
    const cards = root.querySelectorAll('.skill-card');

    cards.forEach((card) => {
      if (card.dataset.skillBound === '1') return; // évite double-binding si même DOM
      card.dataset.skillBound = '1';

      const ratingHost = card.closest('[data-rating]');
      const rating     = Number.parseFloat(ratingHost?.dataset.rating) || 0;
      const logos      = card.querySelectorAll('.software-logos .logo');
      let toolRatings  = {};
      try {
        toolRatings = JSON.parse(card.dataset.toolRatings || '{}');
      } catch { toolRatings = {}; }

      const starBox    = card.querySelector('.rating-stars');
      const customRate = card.querySelector('.custom-rating');

      // Rendu initial des étoiles
      if (starBox) renderStars(starBox, rating);

      // Survol des logos (desktop) → aperçu
      if (window.matchMedia('(hover:hover)').matches && logos.length) {
        logos.forEach((logo) => {
          logo.addEventListener('mouseenter', () => {
            if (!starBox) return;
            renderStars(starBox, toolRatings[logo.alt] || rating, '#FF0000');
            if (customRate) {
              customRate.classList.add('show');
              const tn = customRate.querySelector('.tool-name');
              if (tn) tn.textContent = `${logo.alt}`;
            }
          });
          logo.addEventListener('mouseleave', () => {
            if (!starBox) return;
            renderStars(starBox, rating);
            customRate?.classList.remove('show');
          });
        });
      }

      // Ouverture modale au clic carte
      card.addEventListener('click', () => openSkillModal(card));
    });
  }

  // ---------- 3. Utilitaires ----------
  function starSVG(level = 0, color = '#FFD700') {
    const id = 'clip' + Math.random().toString(36).slice(2);
    const base = '#ddd';
    const ratio = Math.max(0, Math.min(1, level));
    return `
      <svg viewBox="0 0 24 24" width="20" height="20" style="margin:2px;vertical-align:middle">
        <defs>
          <clipPath id="${id}"><rect x="0" y="0" width="${24*ratio}" height="24" /></clipPath>
        </defs>
        <path d="M12 2.1l2.77 5.61 6.19.9-4.48 4.37 1.06 6.16L12 16.97 6.46 19.14l1.06-6.16L3.04 8.61l6.19-.9L12 2.1z" fill="${base}"/>
        <g clip-path="url(#${id})">
          <path d="M12 2.1l2.77 5.61 6.19.9-4.48 4.37 1.06 6.16L12 16.97 6.46 19.14l1.06-6.16L3.04 8.61l6.19-.9L12 2.1z" fill="${color}"/>
        </g>
      </svg>`;
  }

  function getStarsHTML(val, color = '#FFD700') {
    const v = Number(val) || 0;
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const lvl = v >= i ? 1 : (v >= i - 0.5 ? 0.5 : 0);
      html += starSVG(lvl, color);
    }
    return html;
  }
  const renderStars = (box, val, color) => { if (box) box.innerHTML = getStarsHTML(val, color); };

  // ---------- 4. Bootstrapping (DOM Ready + PJAX) ----------
  function init(container = document) {
    // Global: modal + handlers une seule fois
    if (!globalBound) {
      createSkillModal();

      // Échap pour fermer
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.style.display !== 'none') closeSkillModal();
      });

      // Ferme la modale si on change de page par PJAX
      document.addEventListener('pjax:before', () => closeSkillModal());

      globalBound = true;
    }

    // (Re)bind des cartes dans le fragment PJAX
    bindSkillCards(container);
  }

  // Premier chargement
  document.addEventListener('DOMContentLoaded', () => init(document));
  // À chaque navigation PJAX
  document.addEventListener('pjax:ready', (e) => init(e.detail?.container || document));

  // (Optionnel) Expose pour un page-hub
  window.initSkillCards = window.initSkillCards || init;

})();
