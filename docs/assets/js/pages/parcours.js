// /assets/js/pages/parcours.js  (ESM)
// Découvert automatiquement par page-hub.js pour la page "parcours"

export async function init(container) {
    console.info('[parcours.js] init');
  
    // 1) Ajuste la hauteur réelle de la navbar → --nav-h (l’UI en dépend)
    setNavH();
    window.addEventListener('resize', setNavH, { passive: true });
  
    // 2) Garantit le chargement du moteur (nuage + analytics) en PJAX
    await ensureScript('/assets/js/parcours-analytics-cloud.js');
  
    // 3) Rebind + ouverture du viewer (temps réel direct)
    if (window.ParcoursAnalytics && typeof window.ParcoursAnalytics.rebindUI === 'function') {
      window.ParcoursAnalytics.rebindUI({ open: true });
    } else {
      // fallback ultra simple
      const dash = document.getElementById('analyticsDashboard');
      if (dash) dash.style.display = 'block';
    }
  }
  
  export async function destroy() {
    console.info('[parcours.js] destroy');
    window.removeEventListener('resize', setNavH);
    // on laisse Analytics vivant (session continue) — on peut juste masquer le panneau si souhaité
    const dash = document.getElementById('analyticsDashboard');
    if (dash) dash.style.display = 'none';
  }
  
  /* utils */
  function setNavH() {
    const nav = document.getElementById('masthead');
    const h = nav ? Math.max(64, Math.round(nav.getBoundingClientRect().height)) : 72;
    document.documentElement.style.setProperty('--nav-h', h + 'px');
  }
  function ensureScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => (s.src||'').endsWith(src))) return resolve();
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = () => resolve();
      s.onerror = () => reject(new Error('load fail: ' + src));
      document.head.appendChild(s);
    });
  }
  