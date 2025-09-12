;(function(){
  try{
    var isLocal = (location.hostname==='127.0.0.1' || location.hostname==='localhost');
    if(!isLocal) return;
    var AZURE_BASE = 'https://gestioncommandesapi.agreeablepebble-e135b62f.westeurope.azurecontainerapps.io/';
    var PROXY      = 'http://127.0.0.1:8787/';

    function pref(url){
      try{
        var u = new URL(url, location.href);
        if(u.href.indexOf(AZURE_BASE)===0){ return PROXY + u.href; }
        return url;
      }catch(_){ return url; }
    }

    // fetch()
    var _fetch = window.fetch;
    window.fetch = function(input, init){
      if(typeof input==='string'){ input = pref(input); }
      else if(input && input.url){ input = new Request(pref(input.url), input); }
      return _fetch.call(this, input, init);
    };

    // XMLHttpRequest
    var _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, pass){
      return _open.call(this, method, pref(url), async, user, pass);
    };

    console.debug('[dev-proxy-cors] actif (local) → via', PROXY);
  }catch(e){ console.warn('[dev-proxy-cors] erreur init', e); }
})();
