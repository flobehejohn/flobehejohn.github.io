(function (window) {
  'use strict';
  var jq = window.jQuery || window.$;
  if (!jq) return;
  var base = jq;
  function enrich(api) {
    if (!api) return api;
    if (typeof api.parent !== 'function') api.parent = function () { return api; };
    if (typeof api.parents !== 'function') api.parents = function () { return api; };
    if (typeof api.end !== 'function') api.end = function () { return api; };
    return api;
  }
  function compat(selector, root) {
    return enrich(base(selector, root));
  }
  for (var key in base) compat[key] = base[key];
  compat.fn = base.fn || {};
  window.jQuery = window.$ = compat;
})(window);
