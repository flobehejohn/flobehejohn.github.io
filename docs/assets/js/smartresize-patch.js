/*!
 * smartresize-patch.js (jQuery 3+ compatible, PJAX-safe)
 * - Ajoute $.fn.smartresize(fn, wait) si absent (debounce sur "resize")
 * - Supporte $(window).smartresize() pour déclencher, et
 *   $(window).trigger('smartresize') (bridge -> "resize")
 * - Idempotent: ré-installable sans doublons (DOMContentLoaded / pjax:ready)
 */
(function (root) {
  'use strict';

  var INSTALLED_FLAG = '__smartresize_installed_v2__'; // évite réinstallations sauvages

  function debounce(fn, wait) {
    var t = null, w = (typeof wait === 'number') ? wait : 100;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, w);
    };
  }

  function install($) {
    if (!$) return; // jQuery pas encore présent
    // 1) Ajoute le plugin si absent
    if (!$.fn.smartresize) {
      $.fn.smartresize = function (fn, wait) {
        if (typeof fn === 'function') {
          // on débounce le handler sur l'événement natif "resize"
          return this.on('resize.smartresizeShim', debounce(fn, wait));
        }
        // sans fn: compat historique -> déclenche un "resize"
        return this.trigger('resize');
      };
      $.fn.smartresize.__shim = true;
    }

    // 2) Bridge events: "smartresize" (et "smartresize.__bridge") → "resize"
    //    On nettoie nos propres handlers via un namespace unique.
    $(root)
      .off('smartresize.smartresizeShim smartresize.__bridge.smartresizeShim')
      .on('smartresize.smartresizeShim smartresize.__bridge.smartresizeShim', function () {
        $(this).trigger('resize');
      });

    // 3) Flag global (utile pour debug)
    root[INSTALLED_FLAG] = true;
    if (root.console && console.debug) console.debug('[smartresize-patch] prêt (idempotent, PJAX-safe)');
  }

  // Installe dès que possible
  if (root.jQuery) install(root.jQuery);

  // Filets de sécurité si jQuery arrive après
  root.addEventListener('DOMContentLoaded', function () { install(root.jQuery || root.$); });

  // Et à chaque navigation PJAX (inoffensif grâce au namespace/flag)
  document.addEventListener('pjax:ready', function () { install(root.jQuery || root.$); });

})(window);
