(function(){
  var DEST = (window.API_BASE || "").replace(/\/+$/,"") || "https://gestioncommandesapi.agreeablepebble-e135b62f.westeurope.azurecontainerapps.io/";
  try { console.log("[normalize-requests] actif →", DEST); } catch(e){}
  function absolutize(u){
    try{
      if (!u) return u;
      if (/^https?:\/\//i.test(u)) return u;
      if (u.startsWith("//")) return location.protocol + u;
      if (u.startsWith("/api")) return DEST + u;        // "/api/Commandes" -> "https://api.../api/Commandes"
      if (u.startsWith("api/")) return DEST + "/" + u;  // "api/Commandes"  -> "https://api.../api/Commandes"
      return u;
    }catch(e){ return u; }
  }
  // fetch
  var _fetch = window.fetch;
  if (_fetch) {
    window.fetch = function(input, init){
      if (typeof input === "string") input = absolutize(input);
      else if (input && input.url)   input = new Request(absolutize(input.url), input);
      return _fetch(input, init);
    };
  }
  // XHR
  if (window.XMLHttpRequest && XMLHttpRequest.prototype.open) {
    var _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url){
      arguments[1] = absolutize(url);
      return _open.apply(this, arguments);
    };
  }
  // Axios (bonus)
  if (window.axios && window.axios.defaults) {
    try { window.axios.defaults.baseURL = DEST; } catch(e){}
  }
})();
