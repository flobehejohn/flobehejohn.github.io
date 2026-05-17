
export default [
  {
    id: 'audio-modal-single-owner-runtime',
    description: 'Le contrôleur audio modal est un singleton canonique compact. Les anciennes couches V7/V8/V9/V10/V11/V13/V14 sont interdites.',
    files: [
      'assets/js/floating-audio-toggle.js',
      'docs/assets/js/floating-audio-toggle.js',
    ],
    requiredMarkers: [
      'PR6_AUDIO_MODAL_TITLE_MARQUEE_PLAYBOUND_V28_FINAL_CSS_STABLE',
    ],
    forbiddenMarkers: [
      'PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V3_LAYOUT',
      'PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V7',
      'PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V8',
      'PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V9',
      'PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V10',
      'PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V11',
      'PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V13',
      'PR6_AUDIO_MODAL_TOGGLE_SINGLETON_V14',
      'V7_READABLE_RANGES',
      'widthOfReadableAudioControl',
      'audioTimecodeReadable',
      'audioMusicVolumeReadable',
      'pr6AudioReadableControlsStack',
      'audioTimecodeReadableRow',
      'audioMusicVolumeReadableRow',
      'pr6AudioReadableControlsRow',
    ],
  },
  {
    id: 'audio-modal-playwright-contract',
    description: 'Le test Playwright certifie ouverture, fermeture, réouverture, trois ranges uniques, dimensions compactes et absence de doublons legacy.',
    files: [
      'tests/audio-modal-toggle-contract.spec.ts',
    ],
    requiredMarkers: [
      'PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V15_CANONICAL_COMPACT',
    ],
    forbiddenMarkers: [
      'PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V7',
      'PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V8',
      'PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V9',
      'PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V10',
      'PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V11',
      'PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V13',
      'PR6_AUDIO_MODAL_TOGGLE_CONTRACT_TEST_V14',
      'V7_READABLE_RANGES',
      'widthOfReadableAudioControl',
      'audioTimecodeReadable',
      'audioMusicVolumeReadable',
      'pr6AudioReadableControlsStack',
      'audioTimecodeReadableRow',
      'audioMusicVolumeReadableRow',
      'pr6AudioReadableControlsRow',
    ],
  },
];
