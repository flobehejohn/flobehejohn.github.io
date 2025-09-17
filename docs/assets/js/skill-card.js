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

  function renderStars(container, rating, color = '#FFD700') {
    if (!container) return;
    container.innerHTML = '';
    const r = Number.isFinite(rating) ? rating : 0;
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('i');
      star.className = i <= r ? 'fas fa-star' : 'far fa-star';
      star.style.color = i <= r ? color : '#ddd';
      container.appendChild(star);
    }
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

    const modalContent = modal ? modal.querySelector('.modal-content') : null;
    const modalBody    = modal ? modal.querySelector('.modal-body') : null;
    // on continue même si la modale n'est pas encore présente (étoiles/hover)

    if (modal && !modal.__skillBound) {
      const onOutsideClick = () => {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        if (modalBody) modalBody.innerHTML = '';
        currentOpenModal = null;
      };
      const onInsideClick = (e) => e.stopPropagation();

      modal.addEventListener('click', onOutsideClick);
      if (modalContent) modalContent.addEventListener('click', onInsideClick);

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
        let m = document.getElementById('skill-modal') || document.getElementById('skillModal') || null;
        if (!m) { const cv = document.getElementById('cv-modal'); if (cv && cv.querySelector('.modal-body')) m = cv; }
        if (!m) return;
        const mBody = m.querySelector('.modal-body'); if (!mBody) return;
        mBody.innerHTML = `
          <div class="software-logos">${card.querySelector('.software-logos')?.innerHTML || ''}</div>
          <h3>${card.querySelector('h3')?.textContent || ''}</h3>
          <p>${card.querySelector('p')?.innerHTML || ''}</p>
          <div class="rating-stars"></div>
          <div class="custom-rating"><span class="tool-name"></span></div>
        `;

        const modalStars        = mBody.querySelector('.rating-stars');
        const modalCustomRating = mBody.querySelector('.custom-rating');
        const modalLogos        = mBody.querySelectorAll('.software-logos .logo');

        renderStars(modalStars, defaultRating);
        m.style.display = 'flex';
        m.setAttribute('aria-hidden', 'false');
        currentOpenModal = m;

        modalLogos.forEach((logo) => {
          logo.addEventListener('click', (e) => {
            e.stopPropagation();
            showRating(logo, modalStars, modalCustomRating);
          });
        });

        mBody.onclick = (e) => {
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
            showRating(logo, starsContainer, customRating);
          });
          logo.addEventListener('mouseleave', resetToDefault);
        }
        logo.addEventListener('click', (e) => {
          e.stopPropagation();
          showRating(logo, starsContainer, customRating);
        });
      });

      card.addEventListener('click', () => {
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
