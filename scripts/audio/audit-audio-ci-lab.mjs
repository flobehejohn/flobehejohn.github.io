import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createAudioAuditSnapshot } from '../../assets/js/audio-ci-lab/audio-audit-snapshot.mjs';
import { shouldPlaySoundDesign, normalizeAudioPreferences } from '../../assets/js/audio-ci-lab/audio-policy.mjs';

const outDir = join(process.cwd(), 'audit', '_latest');
mkdirSync(outDir, { recursive: true });

const droneFixture = JSON.parse(
  readFileSync('assets/audio-ci-lab/fixtures/drone-basic.audio-scene.json', 'utf8')
);

const snapshot = createAudioAuditSnapshot({
  ciMode: true,
  userGesture: true,
  drone: droneFixture.drone,
});

const uiClick = shouldPlaySoundDesign({
  eventType: 'uiClick',
  preferences: normalizeAudioPreferences({ soundDesignVolume: 0.7 }),
  nowMs: 1000,
});

const mutedClick = shouldPlaySoundDesign({
  eventType: 'uiClick',
  preferences: normalizeAudioPreferences({ muted: true }),
  nowMs: 1000,
});

const summary = {
  version: 'AUDIO_CI_LAB_AUDIT_V1',
  verdict: 'PASS',
  generatedAt: new Date().toISOString(),
  checks: {
    noExternalProviderInCi: snapshot.externalProviderRequired === false,
    waveformNotRequiredInCi: snapshot.waveformRequired === false,
    ciAudioDisabledByDefault: snapshot.startup.allowed === false,
    droneVoicePlanGenerated: snapshot.drone.voiceCount > 0,
    uiSoundAllowedWhenUnmuted: uiClick.allowed === true,
    uiSoundBlockedWhenMuted: mutedClick.allowed === false && mutedClick.reason === 'global-muted',
  },
  snapshot,
};

const failed = Object.entries(summary.checks)
  .filter(([, value]) => value !== true)
  .map(([key]) => key);

if (failed.length > 0) {
  summary.verdict = 'FAIL';
  summary.failed = failed;
}

writeFileSync(
  join(outDir, 'audio-ci-lab-summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
  'utf8'
);

if (summary.verdict !== 'PASS') {
  throw new Error(`Audio CI Lab audit failed: ${failed.join(', ')}`);
}

console.log('[audio-ci-lab] PASS');
console.log(`[audio-ci-lab] ${join(outDir, 'audio-ci-lab-summary.json')}`);
