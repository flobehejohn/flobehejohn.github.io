/* Exemple de module de page (idempotent) - utiliser sur les pages PJAX (contenu)
   Nommer /insérer ce script dans assets/js/pages/<page>.js
   Contract:
     - register with ShellHub.register("pageName", { init:fn, destroy:fn })
     - listen to shell events if needed
*/
(function(){
  const PAGE = 'example-page';
  function init() {
    // initialisations idempotentes : vérifier si déjà initialisé
    if (window.ShellHub && window.ShellHub[PAGE] && window.ShellHub[PAGE]._inited) return;
    // ton code d'init ici...
    console.log('[page] init', PAGE);
    window.ShellHub[PAGE] = window.ShellHub[PAGE] || {};
    window.ShellHub[PAGE]._inited = true;
  }
  function destroy() {
    console.log('[page] destroy', PAGE);
    // nettoyer timers, listeners, re-enable body scroll si nécessaire
    if (window.ShellHub && window.ShellHub[PAGE]) {
      window.ShellHub[PAGE]._inited = false;
    }
  }
  if (window.ShellHub && typeof window.ShellHub.register === 'function') {
    window.ShellHub.register(PAGE, { init:init, destroy:destroy });
  } else {
    // fallback: expose globally
    window[PAGE] = { init:init, destroy:destroy };
  }
})();