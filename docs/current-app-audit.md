# Legacy application audit

Audit date: 2026-07-28. Baseline commit: `d01666e` on `main`.

## What existed

The repository contained three runtime files: `index.html` (311 lines), `app.js` (1,274 lines), and `style.css` (1,323 lines). It was an unbundled English-language application with ABCJS 6.6.3 loaded from jsDelivr. There was no package manifest, TypeScript, automated test, local dependency lock, service worker, or GitHub Actions workflow in the reachable history.

Working scenarios were a random single-note quiz, oscillator reference playback, hole/breath/slide selection, score/streak statistics, range and accidental settings, keyboard controls, ABC rendering, eight built-in tunes, custom ABC paste, tune playback, and click-to-advance song practice. The 12-hole C solo-tuning formula repeats a four-hole octave pattern; duplicate actions such as C5 are accepted.

Preserved content: Twinkle Twinkle, Ode to Joy, Happy Birthday, Amazing Grace, Scarborough Fair, Greensleeves, Por una Cabeza, Menuet in G, and the exact legacy action-to-MIDI formula. The old `app.js` and `style.css` remain in history as reference but are no longer loaded.

## Limitations found

- Product logic, rendering, audio, state, and DOM mutation shared one script.
- ABCJS internals were used as both notation and learning state.
- Song playback used wall-clock timers; no input duration or flow scoring existed.
- There was no microphone path, pitch identity/intonation split, ear mode, calibration, deterministic fixture path, or diagnostic UI.
- The page depended on CDN availability and Google Fonts.
- No deploy workflow was present. The likely URL is `https://alexandr-panchenko.github.io/harmonica/`, but it could not be verified before authentication/deployment.

## Baseline deployment and console

The git remote is `https://github.com/alexandr-panchenko/harmonica.git`, default local branch is `main`, and it initially matched `origin/main`. GitHub CLI credentials were invalid during the audit, so Pages settings and the old production console could not be queried. The release workflow added by this change is the first deployment configuration visible in repository history.
