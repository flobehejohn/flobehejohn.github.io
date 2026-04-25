import { test, expect } from '@playwright/test';
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';
import { attachNetworkProbe, assertNoLocalAssetFailures } from './utils/networkProbe';
import { assertInteractiveModule, probeInteractiveModule } from './utils/interactiveProbe';
import { nowIso, writeAuditJson } from './utils/artifactWriter';

test('Magic cloud legacy module exposes canvas surface and initializes without fatal error', async ({ page }) => {
  const consoleProbe = attachConsoleProbe(page);
  const networkProbe = attachNetworkProbe(page);
  const state = await probeInteractiveModule(page, 'nuage', '/assets/portfolio/nuage_magique/nuage_magique_def.html');

  assertInteractiveModule(state);
  expect(state.canvasCount).toBeGreaterThan(0);
  assertNoFatalConsole(consoleProbe);
  assertNoLocalAssetFailures(networkProbe);

  writeAuditJson('audit/_latest/magic-cloud-runtime-summary.json', {
    timestamp: nowIso(),
    state,
    localAssetFailures: networkProbe.localAssetFailures,
    fatalErrors: consoleProbe.fatalErrors,
    verdict: 'passed'
  });
});
