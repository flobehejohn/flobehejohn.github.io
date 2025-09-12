/* dev-stub: neutralise src/nuage_magique/test.js hors page nuage */
(function(){
  if (!location.pathname.includes('/assets/portfolio/nuage_magique/')) { return; }
  console.log('[stub] src/nuage_magique/test.js: hors nuage => noop');
})();

