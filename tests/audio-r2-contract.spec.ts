import { createRequire } from 'module';
import { attachConsoleProbe, assertNoFatalConsole } from './utils/consoleErrors';
import { attachNetworkProbe, assertNoLocalAssetFailures } from './utils/networkProbe';
import { assertAudioSimpleMode, getAudioRuntimeState, openAndAttemptAudio } from './utils/audioProbe';
import { nowIso, writeAuditJson } from './utils/artifactWriter';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test') as typeof import('@playwright/test');

function isControlledAudioFailure(message: string): boolean {
  return /audio|media|r2|failed|lecture|piste suivante|player-singleton|échec de lecture/i.test(message);
}

test('R2 audio player exposes a certified simple-playback path', async ({ page }) => {
  const consoleProbe = attachConsoleProbe(page);
  const networkProbe = attachNetworkProbe(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_000);

  const initial = await getAudioRuntimeState(page);
  assertAudioSimpleMode(initial);

  const afterGesture = await openAndAttemptAudio(page);
  assertAudioSimpleMode(afterGesture);

  expect(afterGesture.currentSrc, 'audio.currentSrc after user gesture').toMatch(/^https?:\/\//);
  expect(afterGesture.errorCode, `audio error code for ${afterGesture.currentSrc}`).toBe(0);
  expect(afterGesture.readyState, `audio readyState for ${afterGesture.currentSrc}`).toBeGreaterThanOrEqual(1);

  assertNoFatalConsole(consoleProbe);
  assertNoLocalAssetFailures(networkProbe);

  writeAuditJson('audit/_latest/audio-summary.json', {
    timestamp: nowIso(),
    mode: 'r2-online',
    initial,
    afterGesture,
    localAssetFailures: networkProbe.localAssetFailures,
    externalFailures: networkProbe.externalFailures,
    fatalErrors: consoleProbe.fatalErrors,
    verdict: 'passed'
  });
});

test('R2 outage remains controlled and does not break local runtime', async ({ page }) => {
  await page.route(/pub-.*\.r2\.dev/i, (route) => route.abort('failed'));

  const consoleProbe = attachConsoleProbe(page);
  const networkProbe = attachNetworkProbe(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_000);

  const initial = await getAudioRuntimeState(page);
  assertAudioSimpleMode(initial);

  const afterGesture = await openAndAttemptAudio(page);
  assertAudioSimpleMode(afterGesture);

  expect(afterGesture.currentSrc, 'audio source should still be assigned even during R2 outage').toMatch(/^https?:\/\//);
  expect(afterGesture.errorCode > 0 || afterGesture.networkState >= 2 || afterGesture.fallbackVisible).toBeTruthy();

  assertNoLocalAssetFailures(networkProbe);
  const nonAudioFatalErrors = consoleProbe.fatalErrors.filter((message) => !isControlledAudioFailure(message));
  expect(nonAudioFatalErrors).toEqual([]);

  writeAuditJson('audit/_latest/audio-r2-fallback-summary.json', {
    timestamp: nowIso(),
    mode: 'r2-unavailable',
    initial,
    afterGesture,
    localAssetFailures: networkProbe.localAssetFailures,
    externalFailures: networkProbe.externalFailures,
    controlledAudioFailures: consoleProbe.fatalErrors.filter(isControlledAudioFailure),
    fatalErrors: nonAudioFatalErrors,
    verdict: 'passed-with-controlled-external-failure'
  });
});
