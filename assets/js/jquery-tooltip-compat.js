(function (window) {
  'use strict';
  var jq = window.jQuery || window.$;
  if (!jq) return;
  var base = jq;
  function enrich(api) {
    if (!api) return api;
    if (typeof api.tooltip !== 'function') api.tooltip = function () { return api; };
    var originalFind = api.find;
    if (typeof originalFind === 'function' && !api.__tooltipFindCompat) {
      api.__tooltipFindCompat = true;
      api.find = function (selector) { return enrich(originalFind.call(api, selector)); };
    }
    return api;
  }
  function compat(selector, root) {
    return enrich(base(selector, root));
  }
  for (var key in base) compat[key] = base[key];
  compat.fn = base.fn || {};
  window.jQuery = window.$ = compat;
})(window);
