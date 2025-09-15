# Feuille de route — Refactorisation & Optimisation du site

Objectif: assainir le dépôt, sécuriser les formulaires, accélérer le chargement, améliorer l’accessibilité et le SEO, et réduire drastiquement la taille des assets et du bundle publié.

Dernier audit: dépôt ≈469 Mo (assets), plusieurs artefacts .bak, formulaire PHP risqué, clés exposées, scripts chargés globalement, et incohérences tooling.

## Objectifs mesurables (KPI)
- Taille assets (dev): 469 Mo → < 120 Mo
- Taille bundle publié (`docs/`): < 25 Mo (sans sources lourdes)
- Performance (mobile 4G): LCP < 2.5 s, FCP < 1.2 s, TBT < 150 ms, CLS < 0.1
- Accessibilité: contrastes AA, navigation clavier complète, focus visible global
- SEO: meta + OpenGraph + JSON-LD valides, `sitemap.xml` + `robots.txt` présents
- Sécurité: pas de secrets en clair, SRI sur CDN, politique cache sûre

## Portée
- Pages: `index.html`, `portfolio_florian_b.html`, `parcours.html`, `contact.html`
- Scripts: `assets/js/**` (navbar, pjax-router, page-hub, lecteur audio, packages)
- Styles: `assets/css/**` (theme, swatch, fixes)
- Médias: `assets/images/**`, `assets/audio/**`, `assets/fonts/**`, `assets/vendor/**`
- Tooling: `package.json`, `.htaccess`, `.gitignore`, `eslint.config.js`, `tsconfig.json`

## Plan par phases (jalons et critères d’acceptation)

### Phase 0 — Hygiène du dépôt (J+1)
- [x] Supprimer artefacts inutiles: `**/*.bak`, PSD, ZIP, maps `.map` géantes, `.xap` obsolète
  - Action: supprimé .bak (assets/docs/vendor/phpmailer), `moi.psd`, multiples `.zip` SVG/polices, `tf.min.js.map`, `silverlightmediaelement.xap`
  - Résultats: `du -ah assets` ≈ 365 Mo (avant ≈ 469 Mo); reste élevé car médias/mediapipe nécessaires
  - Critères atteints: `find . -name '*.bak'` → 0; taille globale réduite
- [x] Standardiser npm (supprimer Yarn): retirer `yarn.lock`, `.pnp.cjs`, `.pnp.loader.mjs`
  - Résultats: artefacts Yarn supprimés; npm standard OK (lock npm présent)
- [x] `.gitignore`: ajouter patterns lourds et artefacts (`*.bak`, `*.psd`, `*.zip`, `*.map`, `*.xap` + dossiers optionnels)
  - Résultats: patterns ajoutés; dépôt plus propre après nettoyage

### Phase 1 — Sécurité & Contact (J+2 à J+3)
- [ ] Retirer `contact_mailer.php` et `vendor/phpmailer` résiduels
  - Critères: fichiers supprimés, lien de contact fonctionnel via alternative
- [ ] Implémenter alternative sans backend (recommandé): bouton mailto ou service (Formspree/Resend/CF Workers)
  - Fichiers: `contact.html`, `assets/js/contact.js` si nécessaire
  - Critères: envoi de message opérationnel, pas de données sensibles côté client
- [ ] Clé Google Maps: retirer/rotater et basculer sur embed/statique si possible; sinon documenter restrictions strictes (domaines, quotas)
  - Fichiers: `contact.html`
  - Critères: aucune clé sensible en clair ou usage restreint vérifié

### Phase 2 — Performance & Bundling (J+4 à J+7)
- [ ] Déploiement minimal dans `docs/`: ne publier que HTML nécessaires, CSS/JS minifiés, images optimisées, polices subset
  - Critères: taille `docs/` < 25 Mo; site fonctionnel sur GitHub Pages
- [ ] Caching agressif pour assets fingerprintés
  - Fichiers: `.htaccess` — `Cache-Control: public, max-age=31536000, immutable` + `Expires`
  - Critères: headers présents sur CSS/JS/Images; pas de cache long sur HTML
- [ ] SRI sur CDN (Bootstrap, jQuery) + `rel=preconnect` sur domaines critiques (fonts.gstatic.com, domaine R2 audio)
  - Fichiers: `index.html`, `portfolio_florian_b.html`, `contact.html`
  - Critères: attributs `integrity` + `crossorigin` visibles; preconnect effectif
- [ ] Chargement conditionnel par page (via PJAX ou modules): ne charger que scripts nécessaires
  - Fichiers: `index.html` (ordre scripts), `assets/js/page-hub.js` (si route-based init), retrait des plugins inutilisés par page
  - Critères: réduction du nombre de scripts sur pages qui n’en ont pas besoin
- [ ] Purge CSS (PurgeCSS/PostCSS) sur `theme.min.css` et `swatch.bundle.css`; supprimer `revolution*.css` si inutilisés
  - Critères: taille CSS réduite sensiblement; UI intacte

### Phase 3 — Accessibilité (J+8)
- [ ] Ajouter un “skip to content” global (`.visually-hidden` → `#content`)
  - Fichiers: toutes pages globales
  - Critères: navigation clavier rapide au contenu principal
- [ ] Focus visible global cohérent (au-delà de Contact)
  - Fichiers: `assets/css/fixes.css`
  - Critères: focus clair sur liens/boutons/inputs
- [ ] Icônes décoratives: ajouter `aria-hidden="true"` ou `aria-label` selon le cas
  - Fichiers: navbar, boutons audio, cartes
  - Critères: lecteur d’écran ne lit pas le décoratif; étiquettes présentes pour actions
- [ ] Vérifier contrastes (surtout `swatch-custom`) et ajuster variables couleurs si nécessaire
  - Critères: AA au minimum

### Phase 4 — SEO (J+9)
- [ ] Corriger JSON-LD (LinkedIn réel au lieu de placeholder)
  - Fichiers: `index.html`
- [ ] Ajouter `sitemap.xml` et `robots.txt`
  - Fichiers: racine ou `docs/`
- [ ] Ajouter `og:locale`, `meta name=theme-color` (couleur brand)
  - Fichiers: `index.html`, autres pages
- [ ] Vérifier titles/descriptions uniques par page
  - Critères: meta cohérentes; tests de partage OG OK

### Phase 5 — Médias & Assets (J+10 à J+12)
- [ ] Images: supprimer PSD, convertir en WebP si possible, compresser JPEG/PNG, générer tailles adaptées, lazy-loading
  - Fichiers: `assets/images/**`
  - Critères: taille totale images réduite ≥ 50%
- [ ] Audio: playlist R2 — valider licences; ne pas packager localement les MP3 lourds; différer initialisation audio
  - Fichiers: `assets/js/playlist.json`, lecteur audio
  - Critères: pas de download audio au premier paint; démarrage rapide du site
- [ ] Fonts: subset FontAwesome (icônes utilisées) ou basculer vers SVG inline ciblés
  - Fichiers: `assets/fonts/**`, `assets/images/svg/**`
  - Critères: poids des polices / icônes réduit fortement
- [ ] Vendor: conserver uniquement libs requises (mediapipe/tfjs) pour les pages qui les utilisent; exclure du build sinon
  - Fichiers: `assets/vendor/**`
  - Critères: pas de ressources lourdes non utilisées en prod

### Phase 6 — Tooling & QA (J+13)
- [ ] Nettoyer `assets/js/playwright.config.js` (CJS) ou retirer si non utilisé (problème `type: module`)
- [ ] ESLint: retirer `eslint-plugin-vue` si aucune `.vue`; aligner config TS
- [ ] Script de nettoyage (npm script) pour purger artefacts avant build
- [ ] (Optionnel) Lighthouse CI local; rapport de perf avant/après

## Livrables par PR
- PR#1: Hygiène du dépôt + `.gitignore` + standardisation npm
- PR#2: Sécurité Contact (retrait PHP) + clé Maps + docs README
- PR#3: Performance (SRI, preconnect, ordre scripts, purge CSS, caching .htaccess)
- PR#4: Accessibilité (skip link, focus, aria)
- PR#5: SEO (JSON-LD, sitemap/robots, metas)
- PR#6: Médias (images/audio/fonts/vendor) + publication `docs/` minimal
- PR#7: Tooling & QA (lint/tests/scripts)

## Modifications ciblées (checklist fichiers)
- `index.html` — metas, SRI, preconnect, JSON-LD, scripts conditionnels
- `portfolio_florian_b.html`, `parcours.html` — SRI/preconnect, scripts conditionnels
- `contact.html` — clé Maps/Embed, formulaire (mailto/service), accessibilité
- `assets/css/fixes.css` — focus-visible global, skip link style
- `assets/js/pjax-router.js`, `assets/js/navbar.js` — aucun changement fonctionnel prévu; garder l’ordre
- `assets/js/packages.min.js` — vérifier l’usage; décharger si non requis par page
- `assets/js/playlist.json` — valider sources/licences; pas de poids local
- `.htaccess` — règles de cache long + compression (déjà partielle)
- `.gitignore` — patterns artefacts lourds
- `package.json` — scripts `build`, `clean`, `deploy:docs`

## Politique de cache recommandée (.htaccess)
- HTML: `Cache-Control: no-store, must-revalidate`
- CSS/JS/Images fingerprintés: `Cache-Control: public, max-age=31536000, immutable`
- Ajouter `Expires` cohérent et `Vary: Accept-Encoding`

## Risques & mitigations
- Régressions visuelles après purge CSS → tests visuels manuels/scriptés
- Clés/tiers (Maps, audio R2) → ajouter preconnect, gestion d’erreurs UI, timeouts
- Sur-optimisation images → conserver originaux hors repo (stockage externe)

## Suivi & responsabilités
- DRI global: à nommer
- Validation technique: perf (Lighthouse), a11y (axe), SEO (Rich Results/Test OG)
- Fréquence: stand-up quotidien durant la phase (2 semaines)

## Annexes — Commandes de validation (indicatives)
- Taille assets: `du -ah assets | sort -hr | head`
- Artefacts: `rg -n "\.bak$|\.psd$|\.zip$|\.xap$|\.map$" assets/`
- SRI/CDN: inspection DOM (DevTools) des attributs `integrity`
- Cache headers: `curl -I https://site/asset.css`
