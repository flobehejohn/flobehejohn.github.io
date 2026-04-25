# External integrations

## Principe

Les integrations externes doivent rester controlees et ne doivent pas rendre la CI principale instable.

Elles doivent disposer :

- d'un diagnostic explicite ;
- d'un fallback UI ;
- d'un classement clair entre dependance critique et dependance externe ;
- d'un mode de test separe si le service externe est instable.

## Cloudflare R2 audio

L'audio R2 doit consolider la lecture sans casser le mode simple base sur HTMLAudioElement.

Points a verifier :

- playlist valide ;
- URL audio accessible ;
- lecture simple possible ;
- pas de configuration CORS forcee dans le mode simple ;
- fallback visible si une piste est indisponible ;
- erreurs audio sans donnees personnelles.

Si un futur mode WebAudio ou analyse FFT devient necessaire, il doit etre implemente comme un mode separe, documente et teste independamment.

## Azure et backend .NET

L'integration Azure doit rester externe et controlee.

Regles :

- aucun secret cote front ;
- origine autorisee explicitement cote backend ;
- fallback UI si API indisponible ;
- pas de blocage de la CI principale sur un service externe ;
- job manuel ou nightly dedie pour les tests d'integration externe.

## Migration future

Ne pas migrer dans cette PR.

La stabilisation legacy doit rester prioritaire. Une migration Vite ou React doit etre faite dans une PR separee, page par page, avec Playwright comme contrat anti-regression.
