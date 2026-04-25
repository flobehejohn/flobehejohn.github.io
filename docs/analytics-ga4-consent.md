# Analytics GA4 and consent

## Etat actuel

Le contrat `ga4_runtime` valide la presence de signaux locaux et l'absence de fausse certification GA4.

GA4 reel ne doit pas etre declare installe sans Measurement ID reel au format :

```text
G-XXXXXXXXXX
```

## Regle sans Measurement ID

Si aucun Measurement ID reel n'est fourni :

- ne pas charger `gtag.js` ;
- ne pas envoyer de page_view reel ;
- ne pas envoyer d'evenement GA reel ;
- documenter explicitement l'etat desactive/placeholder.

## Architecture cible

Fichiers cibles possibles :

- `assets/js/analytics-config.js`
- `assets/js/analytics-ga4.js`
- `assets/js/consent-banner.js`
- `tests/analytics-ga4-runtime.spec.ts`
- `scripts/analytics-audit.mjs`

## Consentement

- Pas de GA avant consentement lorsque le consentement est requis.
- Le refus doit etre respecte.
- `page_view` seulement apres acceptation.
- Evenements custom seulement apres consentement.

## PII interdite

Ne jamais collecter :

- email ;
- nom ;
- telephone ;
- message de contact ;
- fingerprint ;
- identifiant personnel non consenti.

## Evenements autorises

- `page_view`
- `portfolio_card_click`
- `audio_player_open`
- `audio_play_attempt`
- `audio_canplay`
- `audio_error`
- `pjax_navigation`
- `deep_project_view`
- `contact_click`
- `outbound_link_click`
