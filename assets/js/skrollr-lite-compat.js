(function (window) {
  'use strict';
  if (window.skrollr) return;
  window.skrollr = {
    init: function () {
      return {
        refresh: function () {},
        destroy: function () {},
        on: function () {},
        off: function () {}
      };
    }
  };
})(window);
