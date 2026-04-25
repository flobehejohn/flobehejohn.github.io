import { test, expect } from '@playwright/test';
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';
import { attachNetworkProbe, assertNoLocalAssetFailures } from './utils/networkProbe';
import { assertInteractiveModule, probeInteractiveModule } from './utils/interactiveProbe';
import { nowIso, writeAuditJson } from './utils/artifactWriter';

test('Synthesizer legacy module is discoverable and initializes without fatal error', async ({ page }) => {
  const consoleProbe = attachConsoleProbe(page);
  const networkProbe = attachNetworkProbe(page);
  const state = await probeInteractiveModule(page, 'synth', '/assets/portfolio/projet_synth/main_synth_fm.html');

  assertInteractiveModule(state);
  expect(state.visibleElements).toBeGreaterThan(0);
  assertNoFatalConsole(consoleProbe);
  assertNoLocalAssetFailures(networkProbe);

  writeAuditJson('audit/_latest/synth-runtime-summary.json', {
    timestamp: nowIso(),
    state,
    localAssetFailures: networkProbe.localAssetFailures,
    fatalErrors: consoleProbe.fatalErrors,
    verdict: 'passed'
  });
});
