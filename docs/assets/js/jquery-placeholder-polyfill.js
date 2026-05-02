/* assets/js/jquery-placeholder-polyfill.js */
(() => {
    function install(root) {
      const $ = root.jQuery || root.$;
      if (!$) return;                            // jQuery pas encore présent
      if (typeof $.fn.placeholder === 'function') return; // déjà défini
      $.fn.placeholder = function () { return this; };     // no-op
      if (root.console && console.debug) {
        console.debug('[placeholder-polyfill] $.fn.placeholder (no-op) installé.');
      }
    }
  
    // 1) Tente tout de suite (cas standard : jQuery déjà dispo)
    install(window);
  
    // 2) Sécurités : retente lorsque le DOM est prêt (si jQuery arrive plus tard)
    document.addEventListener('DOMContentLoaded', () => install(window));
  
    // 3) Et après chaque navigation PJAX (au cas où l’ordre de chargement varie)
    document.addEventListener('pjax:ready', () => install(window));
  })();
  