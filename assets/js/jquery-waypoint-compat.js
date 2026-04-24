(function (window) {
  'use strict';
  var jq = window.jQuery || window.$;
  if (!jq) return;
  var base = jq;
  function enrich(api) {
    if (!api) return api;
    if (typeof api.waypoint !== 'function') api.waypoint = function () { return api; };
    return api;
  }
  function compat(selector, root) {
    return enrich(base(selector, root));
  }
  for (var key in base) compat[key] = base[key];
  compat.fn = base.fn || {};
  compat.waypoints = base.waypoints || function () {};
  window.jQuery = window.$ = compat;
})(window);
