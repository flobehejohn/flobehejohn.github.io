# Pass 0 — Gel de l’existant

Cette baseline fige l’état de référence du site avant poursuite de la refacto.

## Références gelées

- **Production de référence** : `main@0918c23535158d4c713936869a85ca2bee2b7727`
- **URL de référence** : `https://flobehejohn.github.io/`
- **Branche snapshot créée** : `snapshot/pass0-prod-reference-20260423`
- **Branche de travail** : `refactor/repo-hardening-ci-seo-analytics-20260423@b74550d1f9d1a4e0cd63da88dd751a1d02fc1611`

## Artefacts de cette pass

- `audit/pass0-baseline/baseline.manifest.json`
  - baseline SEO
  - baseline navigation
  - URLs critiques
  - assets critiques
  - cible analytics
- `audit/pass0-baseline/visual-baseline.manifest.json`
  - spécification de baseline visuelle desktop/mobile
  - anchors visuels attendus page par page
  - noms de captures attendus

## Ce qui a été réellement gelé

### 1. Référence de prod
La production de référence est figée sur `main@0918c23535158d4c713936869a85ca2bee2b7727`.
La branche `snapshot/pass0-prod-reference-20260423` joue le rôle de snapshot immuable dans le dépôt.

### 2. SEO et navigation
Les routes publiques de référence sont :

- `/`
- `/index.html`
- `/portfolio_florian_b.html`
- `/parcours.html`
- `/contact.html`

La baseline inclut les titres, descriptions, canonicals, favicon, robots et sitemap associés.

### 3. Assets critiques
La baseline recense :

- CSS indispensables au rendu
- JS cœur de navigation/audio/UI
- images et favicon critiques
- entrées portfolio internes à ne pas casser
- dépendances externes structurantes

### 4. Cible analytics
La cible actuellement préparée dans la branche de refactor est un mode **local queue-only** via :

- `/assets/js/analytics.js`
- `/assets/js/usage-signals.js`

La baseline recense aussi la page `parcours.html` comme surface d’observabilité dédiée.

## Limites constatées pendant cette pass

### Pas de vrai tag Git créé
Le connecteur GitHub disponible ici permet la création de branches mais pas la création directe d’un tag Git annoté.
Pour conserver un équivalent robuste et référençable, j’ai créé la branche snapshot :

- `snapshot/pass0-prod-reference-20260423`

### Pas de captures PNG réellement produites depuis cet environnement
Je peux lire et modifier le dépôt, mais pas ouvrir/rendre le site comme un navigateur live dans cet environnement.
La baseline visuelle est donc **spécifiée** dans `visual-baseline.manifest.json`, mais les PNG desktop/mobile restent à capturer ensuite depuis un run Playwright local ou CI.

### Divergence analytics déjà visible
Deux clés de stockage local apparaissent dans l’état courant :

- `site_usage_signals_v1`
- `site_analytics_queue_v1`

Ce n’est pas bloquant pour Pass 0, mais c’est un point d’alignement à traiter en Pass 1 pour éviter une observabilité fragmentée.

## Décision d’usage

À partir de maintenant :

- toute refacto doit préserver cette baseline ou documenter explicitement ses écarts ;
- la branche `snapshot/pass0-prod-reference-20260423` sert de point de retour fiable ;
- `baseline.manifest.json` devient la source de vérité du périmètre public minimal à garantir.
