import { test, expect } from '@playwright/test';
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';
import { attachNetworkProbe, assertNoLocalAssetFailures } from './utils/networkProbe';
import { assertInteractiveModule, probeInteractiveModule } from './utils/interactiveProbe';
import { nowIso, writeAuditJson } from './utils/artifactWriter';

const modules = [
  {
    name: 'nuage',
    label: 'magic-cloud',
    url: '/assets/portfolio/nuage_magique/nuage_magique_def.html',
    expectsCanvas: true
  },
  {
    name: 'musicam',
    label: 'musicam',
    url: '/assets/portfolio/projet_musicam/projet_musicam.html',
    expectsCanvas: false
  },
  {
    name: 'synth',
    label: 'synthesizer',
    url: '/assets/portfolio/projet_synth/main_synth_fm.html',
    expectsCanvas: false
  }
];

for (const module of modules) {
  test(`${module.label} legacy module initializes with certified runtime surface`, async ({ page }) => {
    const consoleProbe = attachConsoleProbe(page);
    const networkProbe = attachNetworkProbe(page);
    const state = await probeInteractiveModule(page, module.name, module.url);

    assertInteractiveModule(state);
    if (module.expectsCanvas) expect(state.canvasCount, `${module.label} canvas count`).toBeGreaterThan(0);
    expect(state.visibleElements, `${module.label} visible interactive surface`).toBeGreaterThan(0);

    assertNoFatalConsole(consoleProbe);
    assertNoLocalAssetFailures(networkProbe);

    writeAuditJson(`audit/_latest/${module.label}-summary.json`, {
      timestamp: nowIso(),
      module,
      state,
      localAssetFailures: networkProbe.localAssetFailures,
      externalFailures: networkProbe.externalFailures,
      fatalErrors: consoleProbe.fatalErrors,
      verdict: 'passed'
    });
  });
}
