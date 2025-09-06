;(function(){
  // Autoriser le scroll DANS ces conteneurs (jamais .mgc-*)
  var SCROLLER = [
    ".modal-content",
    ".modal .modal-dialog .modal-content",
    "#cv-modal .modal-content",
    ".skill-card.is-open"
  ].join(",");

  function hasOpenModalOrSkill(){
    return document.querySelector('#cv-modal[aria-hidden="false"], .modal-overlay.is-open, .modal.show, .skill-card.is-open');
  }

  // Body lock
  var scrollTop = 0;
  function lockBody(){
    if(document.body.classList.contains('modal-open')) return;
    scrollTop = window.scrollY || window.pageYOffset || 0;
    document.body.style.setProperty('--scroll-lock-top', (-scrollTop) + 'px');
    document.body.classList.add('modal-open');
  }
  function unlockBody(){
    if(!document.body.classList.contains('modal-open')) return;
    var t = parseInt(getComputedStyle(document.body).getPropertyValue('--scroll-lock-top')||'0',10);
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('--scroll-lock-top');
    window.scrollTo(0, -t || 0);
  }

  // Observer ouverture/fermeture
  var obs = new MutationObserver(function(){
    hasOpenModalOrSkill() ? lockBody() : unlockBody();
  });
  obs.observe(document.documentElement, {subtree:true, attributes:true, attributeFilter:['class','aria-hidden','style']});

  // Scroll tactile : laisser passer dans la modale/skill, bloquer le fond
  function allowInside(e){
    if(!hasOpenModalOrSkill()) return;
    var scroller = e.target && e.target.closest && e.target.closest(SCROLLER);
    if(scroller){
      scroller.style.webkitOverflowScrolling = 'touch';
      scroller.style.overscrollBehavior = 'contain';
      scroller.style.touchAction = 'pan-y';
      e.stopImmediatePropagation(); // coupe les listeners agressifs
      return; // pas de preventDefault => scroll natif
    }
    if(e.cancelable) e.preventDefault();
  }
  ['touchmove','wheel'].forEach(function(ev){
    document.addEventListener(ev, allowInside, {passive:false, capture:true});
  });

  // ESC (fallback)
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      var s = document.querySelector('.skill-card.is-open');
      if(s) s.classList.remove('is-open');
    }
  });

  // First pass
  if(hasOpenModalOrSkill()) lockBody();
})();
