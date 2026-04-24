(function (window, document) {
  'use strict';
  var base = window.jQuery || window.$;
  if (!base) return;

  function onReady(callback, context) {
    var run = function () { callback.call(context || document, window.jQuery); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  }

  function compat(selector, root) {
    if (typeof selector === 'function') {
      onReady(selector, document);
      return base([]);
    }
    var api = base(selector, root);
    api.ready = function (callback) {
      onReady(callback, document);
      return api;
    };
    return api;
  }

  for (var key in base) compat[key] = base[key];
  compat.fn = base.fn || {};
  window.jQuery = window.$ = compat;
})(window, document);
