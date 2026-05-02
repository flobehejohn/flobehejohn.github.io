# Legacy functional certification contract

## Scope

This contract freezes the expected legacy behavior for the portfolio before any functional restoration or refactor can be considered releasable.

The certification target is not only a successful build. The site is considered certified only when every expected page and module has a measurable runtime proof.

## Pages

| Page | Expected role | Critical checks |
|---|---|---|
| `/` | Entry page | HTTP 200, title, canonical, no fatal JS, local assets OK |
| `/portfolio_florian_b.html` | Portfolio/projects | cards visible, PJAX-compatible navigation, local assets OK |
| `/parcours.html` | Career/trajectory | dynamic text active, no fatal JS, local assets OK |
| `/contact.html` | Contact | contact runtime isolated, no analytics PII, no fatal JS |
| `/assets/portfolio/nuage_magique/nuage_magique_def.html` | Magic cloud project | canvas/DOM visible, module initializes, interaction changes state |
| `/assets/portfolio/projet_musicam/projet_musicam.html` | Musicam project | module initializes, audio gesture path controlled, fallback visible if blocked |
| `/assets/portfolio/projet_synth/main_synth_fm.html` | Synth project | synthesizer UI visible, AudioContext starts only after user gesture |

## Features

### Audio player / Cloudflare R2

Success criteria:

- playlist JSON is valid;
- player is visible and clickable;
- one audio element singleton exists;
- after interaction, `audio.currentSrc` is not empty;
- simple playback does not force `crossOrigin="anonymous"`;
- R2 failure produces a controlled fallback, not a fatal runtime failure;
- audio runtime events contain no PII.

Failure criteria:

- duplicated player;
- uncaught `NotSupportedError`;
- broken local fallback assets;
- fatal JS error during audio interaction.

### PJAX articulation

Success criteria:

- internal navigation updates URL and DOM;
- browser back/forward works;
- required legacy scripts remain initialized;
- audio singleton persists;
- listeners do not duplicate;
- modules can reinitialize after navigation;
- local analytics emits `pjax_navigation` without PII.

### Interactive modules

Covered modules:

- magic cloud / nuage magique;
- Musicam;
- synthesizer;
- canvas/WebAudio modules discovered by inventory.

Success criteria:

- module found on expected page;
- assets available;
- initialization has no fatal error;
- interaction produces an observable DOM/canvas/audio state change;
- audio permission is handled through explicit user gesture;
- fallback is visible if browser blocks audio.

### GA4 consent shell

GA4 must remain disabled by default unless a real Measurement ID and consent are present.

Success criteria:

- no Google Analytics network call without consent;
- placeholder/missing ID disables real GA;
- accepted consent allows only allowlisted events;
- denied consent blocks all events;
- PII fields are rejected.

### Security baseline

Success criteria:

- no known secret in public runtime;
- no mixed content;
- external scripts classified;
- local `/assets/` failures are blocking;
- external links with `_blank` use `rel="noopener noreferrer"`;
- no fatal console error.

## Proof model

Every proof must be reproducible and attached to a commit/run:

- invariant assertions;
- JSON summaries under `audit/_latest/`;
- Playwright traces/screenshots on failure;
- CI job verdict;
- preview branch commit referencing the certified head.

## Non-release rule

Do not declare the site certified while any historical module is untested, missing, or known non-functional.
