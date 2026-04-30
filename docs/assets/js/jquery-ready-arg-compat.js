(function (window, document) {
  'use strict';
  var base = window.jQuery || window.$;
  if (!base) return;

  function onReady(callback, context) {
    var run = function () { callback.call(context || document, window.jQuery); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  }

  function nodesOf(api) {
    var nodes = [];
    if (api && typeof api.each === 'function') {
      api.each(function (_index, node) { nodes.push(node || this); });
      return nodes.filter(function (node) { return Boolean(node); });
    }
    var length = api && typeof api.length === 'number' ? api.length : 0;
    for (var index = 0; index < length; index += 1) if (api[index]) nodes.push(api[index]);
    return nodes;
  }

  function sizeOf(api, dimension) {
    var first = nodesOf(api)[0];
    if (first === window) return dimension === 'height' ? window.innerHeight : window.innerWidth;
    if (first === document) return dimension === 'height' ? document.documentElement.scrollHeight : document.documentElement.scrollWidth;
    if (first && first.getBoundingClientRect) return first.getBoundingClientRect()[dimension] || 0;
    return dimension === 'height' ? window.innerHeight : window.innerWidth;
  }

  function positionOf(api) {
    var first = nodesOf(api)[0];
    if (!first || !first.getBoundingClientRect) return { top: 0, left: 0 };
    var rect = first.getBoundingClientRect();
    return { top: rect.top + window.scrollY, left: rect.left + window.scrollX };
  }

  function addLegacyMethods(api) {
    var originalOn = api.on;
    var originalOff = api.off;
    api.on = function (eventName, handler) {
      if (typeof handler !== 'function') return api;
      if (typeof originalOn === 'function') return originalOn.call(api, eventName, handler);
      nodesOf(api).forEach(function (node) { if (node && node.addEventListener) node.addEventListener(eventName, handler); });
      return api;
    };
    api.off = function (eventName, handler) {
      if (typeof handler !== 'function') return api;
      if (typeof originalOff === 'function') return originalOff.call(api, eventName, handler);
      nodesOf(api).forEach(function (node) { if (node && node.removeEventListener) node.removeEventListener(eventName, handler); });
      return api;
    };
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
    api.append = function (content) {
      nodesOf(api).forEach(function (node) {
        if (!node) return;
        if (typeof content === 'string' && node.insertAdjacentHTML) node.insertAdjacentHTML('beforeend', content);
        else if (content && node.appendChild) node.appendChild(content.cloneNode ? content.cloneNode(true) : content);
      });
      return api;
    };
    api.height = function () { return sizeOf(api, 'height'); };
    api.width = function () { return sizeOf(api, 'width'); };
    api.outerHeight = function () { return sizeOf(api, 'height'); };
    api.outerWidth = function () { return sizeOf(api, 'width'); };
    api.position = function () { return positionOf(api); };
    api.offset = function () { return positionOf(api); };
    api.get = function (index) {
      var nodes = nodesOf(api);
      if (index === undefined) return nodes;
      return nodes[index];
    };
    api.map = function (callback) {
      var mapped = nodesOf(api).map(function (node, index) { return callback.call(node, index, node); }).filter(function (value) { return value != null; });
      return { get: function (index) { return index === undefined ? mapped : mapped[index]; } };
    };
    api.not = function () { return api; };
    api.filter = function () { return api; };
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
