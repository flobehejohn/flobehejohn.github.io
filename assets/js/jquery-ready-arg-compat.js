(function (window, document) {
  'use strict';
  var base = window.jQuery || window.$;
  if (!base) return;

  function onReady(callback, context) {
    var run = function () { callback.call(context || document, window.jQuery); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  }

  function addLegacyMethods(api) {
    api.ready = function (callback) {
      onReady(callback, document);
      return api;
    };
    api.smartresize = function (callback) {
      if (typeof callback === 'function') api.on('resize', callback);
      return api;
    };
    api.click = function (callback) {
      if (typeof callback === 'function') api.on('click', callback);
      return api;
    };
    return api;
  }

  function compat(selector, root) {
    if (typeof selector === 'function') {
      onReady(selector, document);
      return addLegacyMethods(base([]));
    }
    return addLegacyMethods(base(selector, root));
  }

  for (var key in base) compat[key] = base[key];
  compat.fn = base.fn || {};
  window.jQuery = window.$ = compat;
})(window, document);
