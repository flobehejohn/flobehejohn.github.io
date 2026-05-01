// playwright.config.js
// Configuration minimale orientée audit Firefox (headless).
const { devices } = require('@playwright/test');

module.exports = {
  timeout: 120000,
  reporter: [ ['list'], ['html', { outputFolder: 'playwright-report' }] ],
  projects: [
    {
      name: 'firefox-audit',
      use: {
        browserName: 'firefox',
        headless: true,
        // Préréglages Firefox pour autoriser la reprise/lecture autoplay dans l'audit (utile en CI)
        firefoxUserPrefs: {
          // 0 = Allow autoplay, 1= Block non-muted, 2 = Block all (values vary by FF versions)
          'media.autoplay.default': 0,
          'media.block-autoplay-until-in-foreground': false,
          // réduire logs de telemetry
          'toolkit.telemetry.reportingpolicy.firstRun': false
        }
      }
    }
  ]
};
