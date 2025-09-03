(function(){
  var ROOT = (window.API_BASE_URL || "").replace(/\/+$/,"");
  if(!ROOT){ console.warn("[normalize] API_BASE_URL manquant"); return; }

  function toAbs(u){
    if(!u) return u;
    u = u.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, ROOT);
    if(!/^https?:\/\//i.test(u)){ u = ROOT + (u.startsWith("/") ? u : ("/" + u)); }
    u = u.replace(/\/api\/commandes/gi,"/api/Commandes")
         .replace(/(\/api\/Commandes){2,}(\/?)/g, "/api/Commandes$2");
    return u;
  }

  if (typeof window.fetch === "function") {
    const _fetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      try { if (typeof input === "string") input = toAbs(input);
            else if (input && input.url) input = toAbs(input.url); } catch(e){}
      return _fetch(input, init);
    };
  }

  if (window.XMLHttpRequest) {
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url){
      try { url = toAbs(url); } catch(e){}
      return open.apply(this, [method, url].concat([].slice.call(arguments,2)));
    };
  }

  if (window.axios && window.axios.interceptors && window.axios.interceptors.request) {
    window.axios.interceptors.request.use(function(cfg){
      if (cfg.baseURL) cfg.baseURL = ROOT;
      if (typeof cfg.url === "string") cfg.url = toAbs(cfg.url);
      return cfg;
    });
  }

  window.__CFG_PATCHED__ = true;
  console.info("[normalize] Patch actif →", ROOT);
})();
