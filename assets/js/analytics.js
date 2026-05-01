(() => {
  'use strict';

  if (window.SiteUsageSignals) {
    window.SiteAnalytics = window.SiteUsageSignals;
    return;
  }

  const script = document.createElement('script');
  script.src = 'assets/js/usage-signals.js';
  script.defer = true;
  script.onload = () => {
    if (window.SiteUsageSignals) {
      window.SiteAnalytics = window.SiteUsageSignals;
    }
  };

  document.head.appendChild(script);
})();
