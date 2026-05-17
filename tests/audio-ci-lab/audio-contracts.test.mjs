import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createAudioAuditSnapshot } from '../../assets/js/audio-ci-lab/audio-audit-snapshot.mjs';

test('audio audit snapshot is stable and CI-safe', () => {
  const fixture = JSON.parse(
    readFileSync('assets/audio-ci-lab/fixtures/drone-basic.audio-scene.json', 'utf8')
  );

  const snapshot = createAudioAuditSnapshot({
    ciMode: true,
    userGesture: true,
    drone: fixture.drone,
  });

  assert.equal(snapshot.version, 'AUDIO_AUDIT_SNAPSHOT_V1');
  assert.equal(snapshot.externalProviderRequired, false);
  assert.equal(snapshot.waveformRequired, false);
  assert.equal(snapshot.contracts.noExternalApiInCi, true);
  assert.equal(snapshot.contracts.audioDisabledByDefaultInCi, true);
  assert.equal(snapshot.startup.allowed, false);
  assert.equal(snapshot.startup.reason, 'ci-audio-disabled');
  assert.equal(snapshot.drone.voiceCount, fixture.drone.intervals.length);
});
