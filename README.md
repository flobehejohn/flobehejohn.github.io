# Florian Behejohn — Portfolio interactif (flobehejohn.github.io)

**Créateur sonore & Développeur web** — je conçois des expériences multimédia interactives (installations, web audio, interfaces immersives) et je code des applications front-end performantes et accessibles.  
Je combine design sonore, UX, et ingénierie front pour produire des prototypes fonctionnels qui sont à la fois esthétiques et exploitables en production.

---

##  Proposition de valeur 
Ingénieur créatif hybride — je transforme des concepts sonores et visuels en démonstrations techniques (Web, WebAudio, WebGL, UI/UX).  
Je suis à l’aise dans des équipes produit ou studios créatifs qui cherchent un profil full-stack front / sound-designer capable de prototyper rapidement et déployer un MVP performant sur GitHub Pages.

---

## Ce que vous trouverez dans ce dépôt
- Site public : `https://flobehejohn.github.io`  
- Pages principales (fichiers) :
  - `index.html` — page d’accueil / vitrine principale.  
  - `portfolio_florian_b.html` — galerie projets & démonstrations interactives.  
  - `parcours.html` — CV / parcours professionnel interactif.  
  - `contact.html` — page contact + lecteur audio persistant.  
- Actifs principaux : `assets/` (images, audio, fonts, js, css)  


## Projets phares
> Chaque projet est décrit brièvement pour un premier balayage. Pour une démo live, voir `portfolio_florian_b.html`.

- **MusiCam / Synth gestuel** — Prototype d’instrument gestuel Web (MediaPipe → mapping MIDI → WebAudio worklet). (assets/js, assets/audio, pages dédiées)
- **Nuage Magique** — générateur visuel 3D/texte (WebGL / three.js) pour prompter identité visuelle interactive. (modules page-hub, nuage_magique)
- **Lecteur audio persistant (PlayerSingleton)** — architecture audio globale pour navigation PJAX, playlists R2 Cloudflare & fade in/out, drag & drop UI (assets/js/player-singleton.js).
- **Projets installatifs (HOLON, Rencontre, etc.)** — prototypes sonores et UI pour muséographie et espace public.



## Stack technique (extrait)
- Front : **HTML5**, **CSS3** (Bootstrap 5), **Vanilla JS** (modulaire), Isotope/imagesLoaded, Web Audio API, WebGL / three.js pour effets 3D.
- Build / tooling : **npm**, scripts `build:docs`, PurgeCSS (prévu), GitHub Pages (`docs/`), Git.
- Hébergement médias lourds : **Cloudflare R2** (S3 compatible) — préconnect configuré dans les pages (ex : `pub-...r2.dev`).
- CI / déploiement : workflow GitHub Actions recommandé + script PowerShell pour build & publish.
- Environnement dev : Windows (PowerShell), Python simple server pour tests locaux.

