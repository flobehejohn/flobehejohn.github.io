# Audio CI Strategy

## Gates recommandés

- test:audio-policy
- test:audio-contracts
- audit:audio-ci-lab
- test:audio-modal
- test:audio-runtime
- test:audio-r2-runtime
- test:interactive-runtime

## Contrats CI

- Pas d’AudioContext obligatoire dans les tests purs.
- Pas de provider externe obligatoire.
- État drone sérialisable.
- Politique mute testée hors navigateur.
- Sound design bloqué par mute global.
- Gain effectif calculé et clampé.
