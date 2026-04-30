Tu es Staff Engineer / Release Engineer / Architecte CI/CD senior.

Repository local courant :
flobehejohn/flobehejohn.github.io

Branche obligatoire :
fix/legacy-interactions-audio-pjax-certification-20260425

Interdictions :
- Ne jamais toucher main.
- Ne jamais merger.
- Ne jamais passer PR #6 Ready.
- Ne jamais désactiver une gate.
- Ne jamais retirer une preuve du release_manifest.
- Ne jamais affaiblir un test comportemental.
- Ne jamais remplacer le site en big bang.
- Ne jamais activer GA4 réel sans Measurement ID réel G-XXXXXXXXXX + consentement explicite.
- Ne jamais collecter de PII.
- Toute erreur locale /assets/ doit rester bloquante.
- Toute erreur JS fatale doit rester bloquante.

Méthode obligatoire :
1. Inspecter les fichiers existants.
2. Lire les logs dans audit/_local/ci-failures_* et audit/_local/static-scan_*.
3. Faire un diff minimal.
4. Corriger par adaptateurs, résolveur d’URL, fallback contrôlé et tests de non-régression.
5. Ne pas réécrire massivement le legacy.

Objectif :
Rendre la preview RawGitHack certifiable pour :
https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/index.html

Corriger :
- erreurs ESM “export declarations may only appear at top level of a module” ;
- imports dynamiques nus / bare specifier ;
- chemins cassés sous RawGitHack ;
- Nuage magique fonts / particules / fallback ;
- DotNet demo appBase / iframe srcdoc / fallback ;
- PJAX depuis pages profondes ;
- Contact Google Maps sans clé + consentement ;
- GA4 réel interdit sans Measurement ID réel + consentement ;
- getUserMedia granted / denied / unsupported ;
- Musicam / Synth fallback contrôlé ;
- zéro erreur JS fatale ;
- zéro 404 local /assets/.

À implémenter minimalement :
1. scripts/serve-docs.mjs :
   - PREVIEW_BASE_PATH
   - STRICT_PREVIEW_BASE
   - 404 hors préfixe en mode strict
   - bons MIME types.

2. assets/js/runtime-url.js :
   - window.AppRuntimeUrl
   - version
   - baseHref()
   - asset(path)
   - page(path)
   - normalizeInternalHref(href)
   - isInternalAppUrl(url)
   - fromCurrentScriptAssetBase()

3. assets/js/page-hub.js :
   - charger runtime-url avant résolution
   - import ESM via AppRuntimeUrl.asset(...)
   - video-card.js uniquement via import ESM
   - pas de fallback classic script pour un module ESM
   - audit window.__PAGE_HUB_AUDIT__

4. assets/js/pjax-router.js :
   - normaliser tous liens internes à la racine applicative
   - pushState normalisé
   - popstate home/portfolio/parcours/contact/back
   - fallback full load sur URL normalisée si 404 fragment.

5. build/docs HTML :
   - injecter runtime-url.js avant pjax-router/page-hub/player-singleton
   - normaliser src/href relatifs depuis chaque profondeur
   - ne jamais produire /assets/... absolu pour preview stricte
   - générer audit/_latest/static-url-normalization-summary.json.

6. Nuage magique :
   - fonts via AppRuntimeUrl.asset
   - fallback contrôlé si fonts KO
   - __NUAGE_AUDIT__.initialized ou fallbackControlled
   - rafLoops <= 1.

7. DotNet :
   - APP_BASE_ABS = AppRuntimeUrl.asset('assets/portfolio/Projet_dotnet/')
   - jamais https://raw.githack.com/assets/...
   - fallback contrôlé si bundle absent
   - __DOTNET_AUDIT__.

8. Contact :
   - sans clé + consentement : aucun iframe maps, aucun maps.googleapis.com, aucun google.com/maps/embed
   - fallback visible “Carte désactivée : ouvrir dans Google Maps”.

9. Tests :
   - tests/rawgithack-preview-contract.spec.ts
   - tests/runtime-url.contract.spec.ts
   - tests/magic-cloud-rawgithack-contract.spec.ts
   - tests/dotnet-demo-rawgithack-contract.spec.ts
   - tests/contact-privacy-contract.spec.ts
   - tests/media-permissions-contract.spec.ts
   - tests/musicam-rawgithack-contract.spec.ts
   - tests/synth-rawgithack-contract.spec.ts

10. package.json :
   - ajouter test:rawgithack-preview.
   - si les scripts CI attendus sont absents, les ajouter seulement s’ils correspondent aux workflows existants, sans fausse gate.

Validation obligatoire :
- npm run build
- npm run test:rawgithack-preview
- npm run audit:release si script disponible ou créé
- les commandes CI réelles trouvées dans .github/workflows

Ne jamais masquer un échec.
Ne jamais print [OK] après une commande échouée.
Créer des commits atomiques si possible.
