# Harmonica Trainer

A static, local-first trainer for 10-hole and 12-hole chromatic harmonicas. It teaches note location, score reading, rhythmic performance, guided beginner songs, and absolute or relative ear playing. The persistent on-screen instrument accepts touch input and mirrors stable microphone pitches.

## Development roadmap

The canonical plan for the next notation and virtual-instrument redesign, later Cloudflare persistence, melody authoring, achievements, and the future improvisation game is [`docs/product-roadmap.md`](docs/product-roadmap.md). It supersedes the local sprint prompts and handoff documents used during the initial build.

The next implementation milestone is deliberately split into two stages: isolated `/lab/staff-design` and `/lab/harmonica-design` experiments first, then production migration only after owner review.

## Run and validate

Requirements: [Bun](https://bun.sh/) 1.2.5 or later and a modern Chromium, Firefox, or Safari browser.

```bash
bun install --frozen-lockfile
bun run dev
bun run typecheck
bun test
bun run benchmark:pitch
bun run build
bun run test:browser
bun run test:production
```

After Pages deploys, run the production suite against it with `PRODUCTION_URL=https://alexandr-panchenko.github.io/harmonica/ bun run test:production`.

Vite serves the repository under `/harmonica/`, matching GitHub Pages. Microphone access needs HTTPS in production (localhost is allowed during development). Audio is analyzed in the browser and is never sent to a server.

## Product map

- **Find a note:** anti-repeat randomized targets with beginner, medium, and profile-wide ranges plus natural, mixed-accidental, and chromatic pitch pools.
- **Play the score:** a card-based library of eight examples or monodic ABC import; untimed step practice and count-in performance with separate pitch, onset, length, stability, and intonation results.
- **Play by ear:** hidden four-note phrase, explicit absolute/relative variants, transposition feedback, hint/reveal ladder, then rhythm performance.
- **Rhythm training:** fixed-pitch patterns with standard note/rest durations, step feedback, and timing/length-only flow review.
- **Learn a song:** fully visible notation with the current note and every matching harmonica position highlighted in step or timed practice.
- **Diagnostics:** `?lab=pitch`, `?lab=fixtures`, `?lab=timing`, and `?lab=calibration`.

The main menu stays focused on choosing a training mode. During every exercise, Player setup sits directly below the virtual harmonica. Its segmented controls select **10 holes / 12 holes**, independently toggle **Staff note names** and **Harmonica note names**, and switch **Letters / Solfège**. These choices persist in `localStorage`; no visit to the advanced settings drawer is required.

The virtual instrument is one horizontally scrollable harmonica with exactly two breath rows: **BLOW** and **DRAW**. Every numbered hole contains two independently clickable/touchable halves; compact slider pictograms distinguish the released and pressed positions by moving the knob instead of repeating `OUT` / `IN` text. Holding either half captures duration, and its accessible name still states the slide position. The 10-hole and 12-hole profiles are built from separate explicit typed tables, exposing 40 and 48 direct physical actions respectively. In particular, compact 10-hole holes 9–10 use the owner-supplied `E6/D6` and `G6/F6` slide-out layout instead of truncating the 12-hole octave pattern. Stable microphone pitch continues to mark every matching physical action in the selected profile.

The staff uses duration-correct whole, half, quarter, eighth, dotted, and rest glyphs while retaining game ribbons. Enabled note names include octave numbers and update immediately between C–D–E letter naming and Do–Re–Mi–Fa–Sol–La–Si.

The pitch lab compares MPM, YIN, and autocorrelation against the same PCM frame path used by uploaded audio. Microphone startup calibrates ambient noise for 750 ms and can be recalibrated from the input deck. The fixture recorder creates a local ZIP and manifest. Instrument intonation calibration is stored in `localStorage`; it changes intonation centers, never note identity.

Reference and virtual playback use locally bundled Hohner Super 64 samples from VCSL under CC0 1.0; see [`public/audio/harmonica/LICENSE.md`](public/audio/harmonica/LICENSE.md). Speaker output temporarily suppresses microphone scoring and flushes tracking before input resumes.

Deployment is a static GitHub Pages artifact built by [.github/workflows/pages.yml](.github/workflows/pages.yml). No backend, account, database, telemetry, or cloud audio processing is used.
