# Release checklist

## Principe

Aucune release ne doit être considérée comme certifiée sans un run GitHub Actions complet vert sur le head courant de la pull request.

## Validation locale

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

npm ci
npm run lint
npm run typecheck
npm run build
npm run audit:seo
npm run audit:analytics
npm run audit:content
npm run audit:build
npx playwright install --with-deps chromium
npm run test:smoke
npm run test:runtime
npx playwright test tests/portfolio-deep-runtime.spec.ts
npm run test:particles-runtime
npm run test:audio-runtime
npm run test:dynamic-text
npm run test:ga4-runtime
npm run test:rich-runtime
npm run test:visual
```

## Ordre de validation

1. Synchroniser la branche PR avec `main` sans pousser directement sur `main`.
2. Obtenir une CI complète verte sur le head courant.
3. Publier la preview uniquement après les gates complètes.
4. Vérifier la preview `preview/refactor-live`.
5. Vérifier ou appliquer les protections de branche.
6. Passer la PR en ready for review uniquement après preuve.
7. Merger uniquement après validation humaine explicite.

## Conditions de merge

- PR ouverte et non mergée.
- PR non draft.
- Branche à jour avec `main`.
- CI complète verte sur le head courant.
- Preview publiée après cette CI verte.
- Branch protection active sur `main`.
- Production `main` intacte avant merge.

## Rollback

En cas de régression production après merge :

1. Identifier le merge commit.
2. Créer une PR de revert.
3. Relancer la CI complète.
4. Publier une preview de rollback.
5. Merger uniquement après validation humaine.
