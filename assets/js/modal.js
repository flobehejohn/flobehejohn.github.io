/**
 * MODALE DYNAMIQUE DE COMPÉTENCES – Bundle unique
 * ------------------------------------------------
 * 1.  createSkillModal / openSkillModal / closeSkillModal
 * 2.  initSkillCards : rendu des étoiles + interactions grille
 * 3.  utils : getStarsHTML, renderStars
 * by Florian – mai 2025
 */

/* ---------- 1. Création / ouverture / fermeture de la modale ---------- */

let lastScrollPosition = 0;          // pour restaurer le scroll
let modal, modalBody;                // références internes

function createSkillModal () {
  if (document.getElementById('skill-modal')) return;          // déjà créée

  const overlay  = Object.assign(document.createElement('div'), { id:'skill-modal', className:'modal-overlay' });
  const content  = Object.assign(document.createElement('div'), { className:'modal-content' });
  const closeBtn = Object.assign(document.createElement('span'),{ className:'close-btn', innerHTML:'&times;' });
  modalBody      =               document.createElement('div');   modalBody.className = 'modal-body';

  closeBtn.addEventListener('click', closeSkillModal);
  overlay .addEventListener('click', closeSkillModal);
  content.addEventListener('click', e => e.stopPropagation());    // évite la fermeture sur le contenu

  content.append(closeBtn, modalBody); overlay.appendChild(content);
  document.body.appendChild(overlay);

  modal = overlay;     // on garde la référence
}

function openSkillModal (card) {
  createSkillModal();

  /* --- récupération des infos de la carte --- */
  const rating      = parseFloat(card.closest('[data-rating]').dataset.rating);
  const logos       = card.querySelectorAll('.software-logos .logo');
  const toolRatings = JSON.parse(card.dataset.toolRatings);

  /* --- construction du HTML --- */
  modalBody.innerHTML = `
      <div class="software-logos">
        ${[...logos].map(l => `<img src="${l.src}" alt="${l.alt}" class="modal-logo" />`).join('')}
      </div>
      <h3>${card.querySelector('h3').textContent}</h3>
      <p>${card.querySelector('p').innerHTML}</p>
      <div class="rating-stars">${getStarsHTML(rating)}</div>
      <div class="custom-rating"><span class="tool-name"></span></div>
  `;

  /* --- interactions dans la modale --- */
  const modalStars   = modalBody.querySelector('.rating-stars');
  const customRate   = modalBody.querySelector('.custom-rating');
  const modalLogos   = modalBody.querySelectorAll('.modal-logo');

  let selectedLogo   = null;      // logo « verrouillé » après un clic
  let revertTimeout  = null;      // timeout de 35 s avant retour auto

  const lockToolRating = (logo) => {
    if (selectedLogo) selectedLogo.classList.remove('selected');
    selectedLogo = logo;
    const val = toolRatings[logo.alt] || rating;

    modalStars.innerHTML = getStarsHTML(val, '#FF0000');
    customRate.classList.add('show');
    customRate.querySelector('.tool-name').textContent = `${logo.alt} (${val}/5)`;
    logo.classList.add('selected');

    clearTimeout(revertTimeout);
    revertTimeout = setTimeout(resetToDefault, 35000);      // 35 s puis retour
  };

  const previewToolRating = (logo) => {
    if (selectedLogo === logo) return;                      // ne pas surcharger la sélection
    const val = toolRatings[logo.alt] || rating;
    modalStars.innerHTML = getStarsHTML(val, '#FF0000');
    customRate.classList.add('show');
    customRate.querySelector('.tool-name').textContent = `${logo.alt} (${val}/5)`;
  };

  const resetToDefault = () => {
    if (selectedLogo) selectedLogo.classList.remove('selected');
    selectedLogo = null;
    modalStars.innerHTML = getStarsHTML(rating);
    customRate.classList.remove('show');
    clearTimeout(revertTimeout);
  };

  modalLogos.forEach(logo => {
    logo.style.cursor = 'pointer';

    // Survol : aperçu
    logo.addEventListener('mouseenter', () => previewToolRating(logo));
    logo.addEventListener('mouseleave', () => {
      if (!selectedLogo) resetToDefault();
    });

    // Clic : verrouillage pour 35 s
    logo.addEventListener('click', e => {
      e.stopPropagation();
      lockToolRating(logo);
    });
  });

  // Clic ailleurs dans la modale => retour note par défaut
  modalBody.addEventListener('click', e => {
    if (!e.target.classList.contains('modal-logo')) resetToDefault();
  });

  /* --- affichage + verrouillage scroll --- */
  lastScrollPosition = window.scrollY || document.documentElement.scrollTop;
  document.body.classList.add('modal-open');
  modal.style.display = 'flex';
}

function closeSkillModal () {
  modal.style.display = 'none';
  document.body.classList.remove('modal-open');
  window.scrollTo({ top:lastScrollPosition, behaviour:'instant' });
}

/* ---------- 2. Initialisation des cartes (grille Isotope) ---------- */

function initSkillCards () {
  const cards = document.querySelectorAll('.skill-card');

  cards.forEach(card => {
    const rating      = parseFloat(card.closest('[data-rating]').dataset.rating);
    const logos       = card.querySelectorAll('.software-logos .logo');
    const toolRatings = JSON.parse(card.dataset.toolRatings);
    const starBox     = card.querySelector('.rating-stars');
    const customRate  = card.querySelector('.custom-rating');

    /* rendu initial */
    renderStars(starBox, rating);

    /* survol des logos (desktop) */
    if (window.matchMedia('(hover:hover)').matches) {
      logos.forEach(logo => {
        logo.addEventListener('mouseenter', () => {
          renderStars(starBox, toolRatings[logo.alt] || rating, '#FF0000');
          customRate.classList.add('show');
          customRate.querySelector('.tool-name').textContent = `${logo.alt}`;
        });
        logo.addEventListener('mouseleave', () => {
          renderStars(starBox, rating);
          customRate.classList.remove('show');
        });
      });
    }

    /* ouverture modale */
    card.addEventListener('click', () => openSkillModal(card));
  });
}

/* ---------- 3. Utilitaires ---------- */

function getStarsHTML (val, color = '#FFD700') {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += val >= i        ? `<i class="fas fa-star"        style="color:${color}"></i>`
         :  val >= i - 0.5  ? `<i class="fas fa-star-half-alt" style="color:${color}"></i>`
                             : `<i class="far fa-star"        style="color:#ddd"></i>`;
  }
  return html;
}
const renderStars = (box, val, color) => box.innerHTML = getStarsHTML(val, color);

/* ---------- 4. Bootstrapping ---------- */

document.addEventListener('DOMContentLoaded', () => {
  createSkillModal();
  initSkillCards();
});
