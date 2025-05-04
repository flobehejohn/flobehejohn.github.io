// Patch : recr�er smartresize() pour �viter l'erreur
if (jQuery.fn.smartresize === undefined) {
  jQuery.fn.smartresize = function (fn) {
    return this.resize(fn);
  };
}
