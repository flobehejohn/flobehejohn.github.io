(function (window, document) {
  'use strict';
  var base = window.jQuery || window.$;
  if (!base) return;

  function onReady(callback, context) {
    var run = function () { callback.call(context || document, window.jQuery); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  }

  function sizeOf(api, dimension) {
    var first = api && api.length ? api[0] : null;
    if (first === window) return dimension === 'height' ? window.innerHeight : window.innerWidth;
    if (first === document) return dimension === 'height' ? document.documentElement.scrollHeight : document.documentElement.scrollWidth;
    if (first && first.getBoundingClientRect) return first.getBoundingClientRect()[dimension] || 0;
    return dimension === 'height' ? window.innerHeight : window.innerWidth;
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
    api.height = function () { return sizeOf(api, 'height'); };
    api.width = function () { return sizeOf(api, 'width'); };
    api.outerHeight = function () { return sizeOf(api, 'height'); };
    api.outerWidth = function () { return sizeOf(api, 'width'); };
    api.placeholder = function () { return api; };
    api.fitVids = function () { return api; };
    api.mediaelementplayer = function () { return api; };
    api.wrap = function () { return api; };
    var originalFind = api.find;
    api.find = function (selector) {
      if (typeof originalFind === 'function') return addLegacyMethods(originalFind.call(api, selector));
      return addLegacyMethods(base([]));
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
