# MusiCam — Audit Firefox
Date: 2025-08-16 05:23:38Z
URL : http://127.0.0.1:5500/assets/portfolio/projet_musicam/projet_musicam.html
UA  : Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0
OS  : Win32
WebGL: Google Inc. (Intel) / ANGLE (Intel, Intel(R) HD Graphics 400 Direct3D11 vs_5_0 ps_5_0), or similar

## Résumé
- DOM vidéo/canvas présent : ✅
- Dimensions vidéo valides (≠0) & visibles : ✅  (video=640×360, box=1100×619)
- OffscreenCanvas + Worker dessin : ✅
- PerfAudit (lastInferMs visible) : ⛔️  (inferEvery=4, res=lo, infer=n/ams, fpsBadge=18)
- Audio démarré (badge) : ⛔️  (badge='Audio: —')

## Flags runtime
- __mc_resSwitching : false
- --energy-fill CSS : 3.101682474460546e-59%

## Mapping modes
- Modes UI     : fixed, y-pitch, drum-limbs, x-y-theremin, head-bend
- Modes runtime: fixed, y-pitch, drum-limbs, x-y-theremin, head-bend
- Modes UI non implémentés côté loop : —

## Recommandations rapides
- Si Audio: — → cliquer “Audio Start” pour lever le blocage navigateur.
- Si videoWidth/videoHeight = 0 ou display:none → vérifier CSS (#webcam/#overlay).
- Sur portables lents : window.MusiCam.setModelType('lite') pour alléger Mediapipe.
