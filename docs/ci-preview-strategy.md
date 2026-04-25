# CI and preview strategy

## Role de la CI

La CI certifie l'état exact du repository avant toute décision de release. Elle ne certifie que le head courant de la pull request.

La chaine obligatoire couvre :

- lint
- typecheck
- build
- seo
- analytics
- content
- build_guard
- smoke
- runtime
- deep
- particles_runtime
- audio_runtime
- dynamic_text_runtime
- ga4_runtime
- rich_runtime
- visual

## Role de la preview

La branche `preview/refactor-live` est une preproduction isolee. Elle ne doit etre publiee qu'apres une chaine complete verte.

URL cible :

```text
https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/index.html
```

## Regle de securite

Une preview n'est fiable que si :

1. le workflow Preview a execute toutes les gates ;
2. le run Preview est vert ;
3. le commit de publication preview reference le head certifie ;
4. la production `main` n'a pas ete modifiee directement.

## Pourquoi ne pas basculer production au hasard

Le portfolio contient des comportements legacy sensibles : scripts jQuery, particules, audio HTML, texte dynamique, SEO, analytics contractuel et rendu visuel. Un simple build vert ne suffit pas a garantir la compatibilite runtime.

## Required checks recommandes pour main

- lint
- typecheck
- build
- seo
- analytics
- content
- build_guard
- smoke
- runtime
- deep
- particles_runtime
- audio_runtime
- dynamic_text_runtime
- ga4_runtime
- rich_runtime
- visual
