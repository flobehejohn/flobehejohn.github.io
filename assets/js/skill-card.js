/*!
 * skill-card.js (PJAX-safe, no auto-boot)
 * - Init idempotente, scoped au container
 * - Un seul handler global Escape
 * - Exporte window.initSkillCards / window.teardownSkillCards
 */
(() => {
  'use strict';

  let globalKeydownBound = false;
  let currentOpenModal = null;

  // Font-agnostic stars (SVG) to avoid dependency on FontAwesome loading/order
  function getStarSVGHTML(level = 0, color = '#FFD700') {
    // level: 1 = full, 0.5 = half, 0 = empty
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

  function renderStars(container, rating, color = '#FFD700') {
    if (!container) return;
    const r = Number.isFinite(rating) ? rating : 0;
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const lvl = r >= i ? 1 : (r >= i - 0.5 ? 0.5 : 0);
      html += getStarSVGHTML(lvl, color);
    }
    container.innerHTML = html;
  }

  function init(container = document) {
    const root = (container instanceof Element) ? container : document;
    const cards = root.querySelectorAll('.skill-card');
    if (!cards.length) return;

    let modal =
      document.getElementById('skill-modal') ||
      document.getElementById('skillModal') || null;

    if (!modal) {
      const cvModal = document.getElementById('cv-modal');
      if (cvModal && cvModal.querySelector('.modal-body')) modal = cvModal;
    }
    if (!modal) return;

    const modalContent = modal.querySelector('.modal-content');
    const modalBody    = modal.querySelector('.modal-body');
    if (!modalContent || !modalBody) return;

    if (!modal.__skillBound) {
      const onOutsideClick = () => {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        if (modalBody) modalBody.innerHTML = '';
        currentOpenModal = null;
      };
      const onInsideClick = (e) => e.stopPropagation();

      modal.addEventListener('click', onOutsideClick);
      modalContent.addEventListener('click', onInsideClick);

      modal.querySelectorAll('.close-btn, #close-skill-modal, #close-cv-modal, [data-dismiss="modal"]')
        .forEach((btn) => btn.addEventListener('click', onOutsideClick));

      modal.__skillBound = true;
      modal.__skillHandlers = { onOutsideClick, onInsideClick };
    }

    if (!globalKeydownBound) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentOpenModal && currentOpenModal.style.display === 'flex') {
          try { currentOpenModal.click(); } catch {}
        }
      });
      globalKeydownBound = true;
    }

    cards.forEach((card) => {
      if (card.__skillBound) return;
      card.__skillBound = true;

      const ratingHost    = card.closest('[data-rating]');
      const defaultRating = ratingHost?.dataset?.rating ? parseFloat(ratingHost.dataset.rating) : 3;

      const starsContainer = card.querySelector('.rating-stars');
      const customRating   = card.querySelector('.custom-rating');
      const toolNameSpan   = customRating?.querySelector('.tool-name');
      const logos          = card.querySelectorAll('.software-logos .logo');

      let ratings = {};
      try {
        const raw = card.getAttribute('data-tool-ratings');
        if (raw) ratings = JSON.parse(raw);
      } catch { ratings = {}; }

      renderStars(starsContainer, defaultRating);

      const resetToDefault = () => {
        logos.forEach((l) => l.classList.remove('selected'));
        if (customRating) customRating.classList.remove('show');
        renderStars(starsContainer, defaultRating);
        if (toolNameSpan) toolNameSpan.textContent = '';
      };

      const showRating = (logo, targetStars, targetCustom) => {
        const key = (logo?.alt || '').trim();
        const val = Number.isFinite(ratings[key]) ? ratings[key] : defaultRating;
        logos.forEach((l) => l.classList.remove('selected'));
        logo.classList.add('selected');
        renderStars(targetStars, val, '#FF0000');
        if (targetCustom && targetCustom.querySelector('.tool-name')) {
          targetCustom.querySelector('.tool-name').textContent = `${key} (${val}/5)`;
          targetCustom.classList.add('show');
        }
      };

      const openSkillModal = () => {
        modalBody.innerHTML = `
          <div class="software-logos">${card.querySelector('.software-logos')?.innerHTML || ''}</div>
          <h3>${card.querySelector('h3')?.textContent || ''}</h3>
          <p>${card.querySelector('p')?.innerHTML || ''}</p>
          <div class="rating-stars"></div>
          <div class="custom-rating"><span class="tool-name"></span></div>
        `;

        const modalStars        = modalBody.querySelector('.rating-stars');
        const modalCustomRating = modalBody.querySelector('.custom-rating');
        const modalLogos        = modalBody.querySelectorAll('.software-logos .logo');

        renderStars(modalStars, defaultRating);
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        currentOpenModal = modal;

        modalLogos.forEach((logo) => {
          logo.addEventListener('click', (e) => {
            e.stopPropagation();
            showRating(logo, modalStars, modalCustomRating);
          });
        });

        modalBody.onclick = (e) => {
          if (!e.target.classList.contains('logo')) {
            modalLogos.forEach((l) => l.classList.remove('selected'));
            renderStars(modalStars, defaultRating);
            modalCustomRating?.classList.remove('show');
          }
        };
      };

      logos.forEach((logo) => {
        if (window.matchMedia?.('(hover:hover)').matches) {
          logo.addEventListener('mouseenter', () => {
            // Aperçu rouge uniquement au survol (non persistant)
            showRating(logo, starsContainer, customRating);
          });
          logo.addEventListener('mouseleave', resetToDefault);
        }
        // Sur clic dans la carte, on ouvre la modale (pas de note rouge persistante en liste)
        logo.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openSkillModal();
        });
      });

      card.addEventListener('click', () => {
        if (!modal || !modalBody || !modalContent) return;
        openSkillModal();
      });
    });
  }

  function destroy() {
    if (currentOpenModal && currentOpenModal.style.display === 'flex') {
      try { currentOpenModal.click(); } catch {}
      currentOpenModal = null;
    }
  }

  // ✅ Exports (sans auto-boot)
  window.SkillCards = Object.freeze({ init, destroy });
  window.initSkillCards = init;
  window.teardownSkillCards = destroy;
})();
