# Audio CI Lab — Roadmap

Objectif : transformer l’audio du portfolio en moteur gouverné, testable et non intrusif.

## Principes

- Aucune API externe requise en CI.
- Audio désactivé par défaut en CI.
- Tests de politique et snapshots de paramètres avant tests waveform.
- Mute global prioritaire sur média, sound design et drone.
- Moteur local Web Audio d’abord, providers génératifs ensuite.

## Phases

1. Socle AudioPolicy + BinauralDroneState.
2. Mute global et volumes effectifs.
3. Sound design UI gouverné.
4. Page Binaural Drone Lab.
5. Adapters Musicam / FlowModulator.
6. Provider Lyria mockable puis réel.
7. Budgets CPU/audio et observabilité runtime.
