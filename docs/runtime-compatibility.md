# Runtime compatibility

## Objectif

Preserver le comportement du portfolio legacy sans dependre de CDN fragiles ni supprimer de fonctionnalites visibles pour faire passer la CI.

## Shims jQuery locaux

Les shims locaux existent pour maintenir les comportements historiques des pages legacy tout en evitant les erreurs fatales telles que `jQuery is not defined`.

Fichiers concernes :

- `assets/js/jquery-lite-compat.js`
- `assets/js/jquery-class-compat.js`
- `assets/js/jquery-ready-arg-compat.js`
- `assets/js/jquery-tooltip-compat.js`
- `assets/js/jquery-traversal-compat.js`
- `assets/js/jquery-waypoint-compat.js`
- `assets/js/jquery-waypoint-find-compat.js`

## Politique CDN

Les dependances runtime critiques doivent rester locales lorsque leur absence casserait une page. Toute erreur locale sous `/assets/` reste bloquante.

## Pages concernees

Les contrats runtime couvrent notamment :

- `index.html`
- `portfolio_florian_b.html`
- `parcours.html`
- `contact.html`

## Isolation contact.html / Mac Val

Le runtime specifique a `contact.html` doit rester isole. Une correction contact ne doit pas modifier le comportement de `portfolio_florian_b.html`, `parcours.html` ou `index.html` sans test explicite.

## Audio CORS simple

Le mode audio par defaut repose sur `HTMLAudioElement` en lecture simple. Il ne doit pas forcer `crossOrigin="anonymous"`.

Si un futur mode WebAudio ou FFT exige CORS, il doit etre separe, documente et teste independamment.
