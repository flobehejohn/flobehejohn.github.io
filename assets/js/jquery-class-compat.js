(function (window) {
  'use strict';
  var jq = window.jQuery || window.$;
  if (!jq) return;
  var base = jq;

  function nodesOf(api) {
    var nodes = [];
    if (api && typeof api.each === 'function') {
      api.each(function (_index, node) { nodes.push(node || this); });
      return nodes.filter(Boolean);
    }
    var length = api && typeof api.length === 'number' ? api.length : 0;
    for (var index = 0; index < length; index += 1) if (api[index]) nodes.push(api[index]);
    return nodes;
  }

  function classNames(value) {
    return String(value || '').split(/\s+/).filter(Boolean);
  }

  function enrich(api) {
    if (!api) return api;
    if (typeof api.hasClass !== 'function') {
      api.hasClass = function (name) {
        var first = nodesOf(api)[0];
        return Boolean(first && first.classList && first.classList.contains(name));
      };
    }
    if (typeof api.addClass !== 'function') {
      api.addClass = function (names) {
        nodesOf(api).forEach(function (node) {
          if (!node || !node.classList) return;
          classNames(names).forEach(function (name) { node.classList.add(name); });
        });
        return api;
      };
    }
    if (typeof api.removeClass !== 'function') {
      api.removeClass = function (names) {
        nodesOf(api).forEach(function (node) {
          if (!node || !node.classList) return;
          classNames(names).forEach(function (name) { node.classList.remove(name); });
        });
        return api;
      };
    }
    if (typeof api.toggleClass !== 'function') {
      api.toggleClass = function (name) {
        nodesOf(api).forEach(function (node) { if (node && node.classList) node.classList.toggle(name); });
        return api;
      };
    }
    if (typeof api.tooltip !== 'function') {
      api.tooltip = function () { return api; };
    }
    var originalFind = api.find;
    if (typeof originalFind === 'function' && !api.__classFindCompat) {
      api.__classFindCompat = true;
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
