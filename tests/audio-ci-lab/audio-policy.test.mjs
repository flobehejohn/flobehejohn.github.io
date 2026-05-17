import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeAudioPreferences,
  resolveAudioStartupPolicy,
  resolveMuteTransition,
  resolveEffectiveGain,
  shouldPlaySoundDesign,
} from '../../assets/js/audio-ci-lab/audio-policy.mjs';

test('audio startup is disabled by default in CI', () => {
  const result = resolveAudioStartupPolicy({
    ciMode: true,
    userGesture: true,
    preferences: { muted: false },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'ci-audio-disabled');
});

test('global mute blocks media and sound design while preserving restore intent', () => {
  const muted = resolveMuteTransition({
    muted: false,
    mediaPlaying: true,
    droneActive: true,
  }, {
    type: 'set',
    muted: true,
    persist: 'session',
  });

  assert.equal(muted.muted, true);
  assert.equal(muted.mediaShouldPlay, false);
  assert.equal(muted.mediaWasPlayingBeforeMute, true);
  assert.equal(muted.droneWasActiveBeforeMute, true);
  assert.equal(muted.soundDesignEnabled, false);
  assert.equal(muted.persist.storage, 'session');

  const restored = resolveMuteTransition(muted, {
    type: 'set',
    muted: false,
  });

  assert.equal(restored.muted, false);
  assert.equal(restored.mediaShouldPlay, true);
  assert.equal(restored.droneEnabled, true);
});

test('effective gain supports R2 asset compensation with safe clamp', () => {
  const result = resolveEffectiveGain({
    channel: 'media',
    assetGainDb: 9,
    preferences: {
      muted: false,
      masterVolume: 1,
      mediaVolume: 1,
    },
  });

  assert.equal(result.muted, false);
  assert.equal(result.channel, 'media');
  assert.ok(result.gain > 1);
  assert.ok(result.gain <= 2);
});

test('sound design respects mute, volume, cooldown and media-page dedupe', () => {
  assert.equal(
    shouldPlaySoundDesign({
      eventType: 'uiClick',
      preferences: { muted: true },
      nowMs: 1000,
    }).reason,
    'global-muted'
  );

  assert.equal(
    shouldPlaySoundDesign({
      eventType: 'isotopeFilter',
      preferences: { soundDesignVolume: 0 },
      nowMs: 1000,
    }).reason,
    'sound-design-volume-zero'
  );

  assert.equal(
    shouldPlaySoundDesign({
      eventType: 'cardMotion',
      preferences: normalizeAudioPreferences(),
      nowMs: 1020,
      lastPlayedAtMs: 1000,
    }).reason,
    'cooldown'
  );

  assert.equal(
    shouldPlaySoundDesign({
      eventType: 'uiClick',
      preferences: normalizeAudioPreferences(),
      mediaPageActive: true,
      duplicatedSignal: true,
      nowMs: 1000,
    }).reason,
    'media-page-duplicate-signal'
  );

  assert.equal(
    shouldPlaySoundDesign({
      eventType: 'uiClick',
      preferences: normalizeAudioPreferences({ soundDesignVolume: 0.5 }),
      nowMs: 1000,
    }).allowed,
    true
  );
});
