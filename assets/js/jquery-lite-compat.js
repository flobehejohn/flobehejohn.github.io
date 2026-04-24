(function (window, document) {
  'use strict';
  if (window.jQuery && window.$) return;

  function wrap(nodes) {
    const list = Array.isArray(nodes) ? nodes : Array.from(nodes || []);
    return {
      length: list.length,
      each(callback) {
        list.forEach((node, index) => callback.call(node, index, node));
        return this;
      },
      on(eventName, handler) {
        list.forEach((node) => node.addEventListener && node.addEventListener(eventName, handler));
        return this;
      },
      off(eventName, handler) {
        list.forEach((node) => node.removeEventListener && node.removeEventListener(eventName, handler));
        return this;
      },
      addClass(className) {
        list.forEach((node) => node.classList && node.classList.add(className));
        return this;
      },
      removeClass(className) {
        list.forEach((node) => node.classList && node.classList.remove(className));
        return this;
      },
      css(prop, value) {
        if (value === undefined) return list[0] ? getComputedStyle(list[0]).getPropertyValue(prop) : undefined;
        list.forEach((node) => { if (node.style) node.style[prop] = value; });
        return this;
      },
      attr(name, value) {
        if (value === undefined) return list[0] ? list[0].getAttribute(name) : undefined;
        list.forEach((node) => node.setAttribute && node.setAttribute(name, value));
        return this;
      },
      find(selector) {
        return wrap(list.flatMap((node) => Array.from(node.querySelectorAll ? node.querySelectorAll(selector) : [])));
      }
    };
  }

  function jquery(selectorOrCallback, root) {
    if (typeof selectorOrCallback === 'function') {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', selectorOrCallback, { once: true });
      else selectorOrCallback();
      return wrap([]);
    }
    if (selectorOrCallback === window || selectorOrCallback === document || selectorOrCallback instanceof Element) return wrap([selectorOrCallback]);
    return wrap((root || document).querySelectorAll(selectorOrCallback));
  }

  jquery.fn = {};
  window.jQuery = window.$ = jquery;
})(window, document);
