import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeBinauralDroneState,
  createDroneVoicePlan,
  serializeBinauralDroneState,
} from '../../assets/js/audio-ci-lab/binaural-drone-state.mjs';

test('binaural drone state is normalized, clamped and serializable', () => {
  const state = normalizeBinauralDroneState({
    enabled: true,
    renderer: 'binaural',
    rootMidi: 200,
    azimuthDeg: 999,
    elevationDeg: -999,
    distance: 0,
    spreadDeg: 999,
    gain: 2,
    intervals: [0, 3, 7, 12, 19],
  });

  assert.equal(state.rootMidi, 96);
  assert.equal(state.azimuthDeg, 180);
  assert.equal(state.elevationDeg, -90);
  assert.equal(state.distance, 0.1);
  assert.equal(state.spreadDeg, 180);
  assert.equal(state.gain, 1);

  const serialized = serializeBinauralDroneState(state);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.version, 'BINAURAL_DRONE_STATE_V1');
  assert.equal(parsed.renderer, 'binaural');
});

test('binaural drone voice plan produces deterministic spatial notes', () => {
  const voicesA = createDroneVoicePlan({
    rootMidi: 45,
    intervals: [0, 7, 12],
    azimuthDeg: 0,
    spreadDeg: 60,
    gain: 0.3,
  });

  const voicesB = createDroneVoicePlan({
    rootMidi: 45,
    intervals: [0, 7, 12],
    azimuthDeg: 0,
    spreadDeg: 60,
    gain: 0.3,
  });

  assert.deepEqual(voicesA, voicesB);
  assert.equal(voicesA.length, 3);
  assert.equal(voicesA[0].midi, 45);
  assert.ok(voicesA[0].frequencyHz > 100);
  assert.ok(voicesA[0].azimuthDeg < voicesA[2].azimuthDeg);
});
