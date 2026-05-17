export const AUDIO_POLICY_VERSION = 'AUDIO_POLICY_V1_CI_LAB';

export const DEFAULT_AUDIO_PREFERENCES = Object.freeze({
  muted: false,
  masterVolume: 1,
  mediaVolume: 1,
  soundDesignVolume: 0.7,
  droneVolume: 0.5,
  allowSoundDesign: true,
  allowMedia: true,
  allowDrone: true,
  consent: 'unknown',
});

export const DEFAULT_SOUND_DESIGN_COOLDOWNS_MS = Object.freeze({
  uiClick: 35,
  isotopeFilter: 90,
  cardMotion: 55,
});

export function clamp(value, min, max, fallback = min) {
  const parsed = Number.parseFloat(String(value));

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

export function clamp01(value, fallback = 0) {
  return clamp(value, 0, 1, fallback);
}

export function dbToGain(db, fallback = 1) {
  const parsed = Number.parseFloat(String(db));

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.pow(10, parsed / 20);
}

export function normalizeAudioPreferences(input = {}) {
  return {
    muted: Boolean(input.muted ?? DEFAULT_AUDIO_PREFERENCES.muted),
    masterVolume: clamp01(input.masterVolume, DEFAULT_AUDIO_PREFERENCES.masterVolume),
    mediaVolume: clamp01(input.mediaVolume, DEFAULT_AUDIO_PREFERENCES.mediaVolume),
    soundDesignVolume: clamp01(input.soundDesignVolume, DEFAULT_AUDIO_PREFERENCES.soundDesignVolume),
    droneVolume: clamp01(input.droneVolume, DEFAULT_AUDIO_PREFERENCES.droneVolume),
    allowSoundDesign: Boolean(input.allowSoundDesign ?? DEFAULT_AUDIO_PREFERENCES.allowSoundDesign),
    allowMedia: Boolean(input.allowMedia ?? DEFAULT_AUDIO_PREFERENCES.allowMedia),
    allowDrone: Boolean(input.allowDrone ?? DEFAULT_AUDIO_PREFERENCES.allowDrone),
    consent: String(input.consent ?? DEFAULT_AUDIO_PREFERENCES.consent),
  };
}

export function resolveAudioStartupPolicy(input = {}) {
  const ciMode = Boolean(input.ciMode);
  const userGesture = Boolean(input.userGesture);
  const preferences = normalizeAudioPreferences(input.preferences || {});
  const audioAvailable = input.audioAvailable !== false;

  if (ciMode) {
    return {
      allowed: false,
      reason: 'ci-audio-disabled',
      requiresUserGesture: false,
      preferences,
    };
  }

  if (!audioAvailable) {
    return {
      allowed: false,
      reason: 'audio-api-unavailable',
      requiresUserGesture: false,
      preferences,
    };
  }

  if (!userGesture) {
    return {
      allowed: false,
      reason: 'requires-user-gesture',
      requiresUserGesture: true,
      preferences,
    };
  }

  if (preferences.muted) {
    return {
      allowed: false,
      reason: 'global-muted',
      requiresUserGesture: false,
      preferences,
    };
  }

  return {
    allowed: true,
    reason: 'allowed',
    requiresUserGesture: false,
    preferences,
  };
}

export function resolveMuteTransition(state = {}, action = {}) {
  const muted = Boolean(state.muted);
  const mediaPlaying = Boolean(state.mediaPlaying);
  const droneActive = Boolean(state.droneActive);
  const nextMuted = action.type === 'toggle'
    ? !muted
    : Boolean(action.muted);

  const mediaWasPlayingBeforeMute = nextMuted
    ? mediaPlaying
    : Boolean(state.mediaWasPlayingBeforeMute);

  const droneWasActiveBeforeMute = nextMuted
    ? droneActive
    : Boolean(state.droneWasActiveBeforeMute);

  return {
    muted: nextMuted,
    mediaShouldPlay: !nextMuted && mediaWasPlayingBeforeMute,
    mediaWasPlayingBeforeMute: nextMuted ? mediaWasPlayingBeforeMute : false,
    soundDesignEnabled: !nextMuted,
    droneEnabled: !nextMuted && droneWasActiveBeforeMute,
    droneWasActiveBeforeMute: nextMuted ? droneWasActiveBeforeMute : false,
    persist: {
      storage: action.persist === 'session' ? 'session' : 'local',
      key: 'audio.globalMuted.v1',
      value: String(nextMuted),
    },
  };
}

export function resolveEffectiveGain(input = {}) {
  const preferences = normalizeAudioPreferences(input.preferences || {});
  const assetGainDb = input.assetGainDb ?? 0;
  const channel = input.channel || 'media';

  if (preferences.muted) {
    return {
      gain: 0,
      muted: true,
      channel,
      reason: 'global-muted',
    };
  }

  const channelVolume = channel === 'soundDesign'
    ? preferences.soundDesignVolume
    : channel === 'drone'
      ? preferences.droneVolume
      : preferences.mediaVolume;

  const rawGain = preferences.masterVolume * channelVolume * dbToGain(assetGainDb, 1);

  return {
    gain: clamp(rawGain, 0, 2, 1),
    muted: false,
    channel,
    reason: 'ok',
  };
}

export function shouldPlaySoundDesign(input = {}) {
  const preferences = normalizeAudioPreferences(input.preferences || {});
  const eventType = String(input.eventType || 'unknown');
  const nowMs = Number(input.nowMs || 0);
  const lastPlayedAtMs = Number(input.lastPlayedAtMs || 0);
  const mediaPageActive = Boolean(input.mediaPageActive);
  const duplicatedSignal = Boolean(input.duplicatedSignal);

  if (preferences.muted) {
    return { allowed: false, reason: 'global-muted', eventType };
  }

  if (!preferences.allowSoundDesign) {
    return { allowed: false, reason: 'sound-design-disabled', eventType };
  }

  if (preferences.soundDesignVolume <= 0) {
    return { allowed: false, reason: 'sound-design-volume-zero', eventType };
  }

  if (mediaPageActive && duplicatedSignal) {
    return { allowed: false, reason: 'media-page-duplicate-signal', eventType };
  }

  const cooldown = DEFAULT_SOUND_DESIGN_COOLDOWNS_MS[eventType] ?? 50;

  if (lastPlayedAtMs > 0 && nowMs - lastPlayedAtMs < cooldown) {
    return { allowed: false, reason: 'cooldown', eventType, cooldown };
  }

  return {
    allowed: true,
    reason: 'allowed',
    eventType,
    gain: resolveEffectiveGain({
      preferences,
      channel: 'soundDesign',
      assetGainDb: input.assetGainDb ?? 0,
    }).gain,
  };
}
