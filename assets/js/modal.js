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
      modalBody = modal.querySelector('.modal-body');
      return;
    }

    const overlay  = Object.assign(document.createElement('div'), { id: 'skill-modal', className: 'modal-overlay', style: 'display:none' });
    const content  = Object.assign(document.createElement('div'), { className: 'modal-content' });
    const closeBtn = Object.assign(document.createElement('span'), { className: 'close-btn', innerHTML: '&times;' });
    modalBody      = document.createElement('div'); modalBody.className = 'modal-body';

    // Fermetures
    closeBtn.addEventListener('click', closeSkillModal);
    overlay .addEventListener('click', closeSkillModal);
    content.addEventListener('click', (e) => e.stopPropagation()); // évite fermeture si on clique dans le contenu

    content.append(closeBtn, modalBody);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

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
  function getStarsHTML(val, color = '#FFD700') {
    let html = '';
    const v = Number(val) || 0;
    for (let i = 1; i <= 5; i++) {
      html += v >= i       ? `<i class="fas fa-star" style="color:${color}"></i>`
           :  v >= i - 0.5 ? `<i class="fas fa-star-half-alt" style="color:${color}"></i>`
                           : `<i class="far fa-star" style="color:#ddd"></i>`;
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
