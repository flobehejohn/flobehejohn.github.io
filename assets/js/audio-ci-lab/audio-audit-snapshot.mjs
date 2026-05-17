import { normalizeAudioPreferences, resolveAudioStartupPolicy } from './audio-policy.mjs';
import { normalizeBinauralDroneState, createDroneVoicePlan } from './binaural-drone-state.mjs';

export const AUDIO_AUDIT_SNAPSHOT_VERSION = 'AUDIO_AUDIT_SNAPSHOT_V1';

export function createAudioAuditSnapshot(input = {}) {
  const preferences = normalizeAudioPreferences(input.preferences || {});
  const startup = resolveAudioStartupPolicy({
    ciMode: Boolean(input.ciMode),
    userGesture: Boolean(input.userGesture),
    audioAvailable: input.audioAvailable !== false,
    preferences,
  });

  const droneState = normalizeBinauralDroneState(input.drone || {});
  const droneVoices = createDroneVoicePlan(droneState);

  return {
    version: AUDIO_AUDIT_SNAPSHOT_VERSION,
    ciMode: Boolean(input.ciMode),
    externalProviderRequired: false,
    waveformRequired: false,
    startup,
    preferences,
    drone: {
      state: droneState,
      voices: droneVoices,
      voiceCount: droneVoices.length,
    },
    contracts: {
      noExternalApiInCi: true,
      audioDisabledByDefaultInCi: Boolean(input.ciMode) ? startup.allowed === false : true,
      serializableState: true,
      mockableProvider: true,
    },
  };
}
