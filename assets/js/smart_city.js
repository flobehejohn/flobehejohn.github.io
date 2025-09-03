// assets/js/pages/smart_city.js
(function (root) {
    'use strict';
  
    let handlers = [];
    let booted = false;
  
    function on(el, ev, fn, opt){
      if (el) {
        el.addEventListener(ev, fn, opt || false);
        handlers.push(() => el.removeEventListener(ev, fn, opt || false));
      }
    }
  
    function seekStableFrame(video){
      const frameTime = 0.12;
      const seek = () => {
        try { if (Math.abs(video.currentTime - frameTime) > 0.01) video.currentTime = frameTime; } catch {}
      };
      on(video, 'loadedmetadata', seek, { once:true });
      setTimeout(seek, 150);
    }
  
    function openModal(modal){
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closeModal(modal){
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  
    function init(container){
      if (!container || booted) return;
      booted = true;
  
      try { document.getElementById('audioPlayer')?.pause?.(); root.AudioApp?.close?.(); } catch {}
  
      container.querySelectorAll('.carte-lecteur-video video').forEach(seekStableFrame);
  
      const pubModal = container.querySelector('#publication-modal');
      const openPub  = container.querySelector('#open-publication-modal');
      const closePub = container.querySelector('#close-publication-modal');
      if (pubModal && openPub && closePub) {
        on(openPub, 'click', () => openModal(pubModal));
        on(closePub, 'click', () => closeModal(pubModal));
        on(pubModal, 'click', (e) => { if (e.target === pubModal) closeModal(pubModal); });
        on(document, 'keydown', (e) => { if (e.key === 'Escape' && pubModal.classList.contains('show')) closeModal(pubModal); });
      }
    }
  
    function destroy(){
      handlers.forEach(off => { try { off(); } catch {} });
      handlers = [];
  
      const modal = document.querySelector('main[data-pjax-root] #publication-modal');
      if (modal) { modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true'); }
      document.body.style.overflow = '';
  
      booted = false;
    }
  
    root.SmartCity = { init, destroy };
  
    // Fallback non-PJAX UNIQUEMENT si page-hub n'est pas là (flag)
    if (!root.__PAGE_HUB__) {
      const boot = () => {
        const rootEl = document.querySelector('main[data-pjax-root]');
        if (rootEl?.getAttribute('data-page') === 'smart_city') init(rootEl);
      };
      if (document.readyState !== 'loading') boot();
      else document.addEventListener('DOMContentLoaded', boot);
    }
  })(window);
  