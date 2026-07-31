# Harmonica Trainer

A static, local-first trainer for 10-hole and 12-hole chromatic harmonicas. It teaches note location, score reading, rhythmic performance, guided beginner songs, and absolute or relative ear playing. The persistent on-screen instrument accepts touch input and mirrors stable microphone pitches.

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

The typed instrument profiles expose all 40 or 48 normal hole/breath/slide actions directly. Press and hold one position to sound and time it. Staff and instrument labels are independent, with letter-name or Do–Re–Mi–Fa–Sol–La–Si display. The staff uses duration-correct whole, half, quarter, eighth, dotted, and rest glyphs while retaining game ribbons.

The pitch lab compares MPM, YIN, and autocorrelation against the same PCM frame path used by uploaded audio. Microphone startup calibrates ambient noise for 750 ms and can be recalibrated from the input deck. The fixture recorder creates a local ZIP and manifest. Instrument intonation calibration is stored in `localStorage`; it changes intonation centers, never note identity.

Reference and virtual playback use locally bundled Hohner Super 64 samples from VCSL under CC0 1.0; see [`public/audio/harmonica/LICENSE.md`](public/audio/harmonica/LICENSE.md). Speaker output temporarily suppresses microphone scoring and flushes tracking before input resumes.

Deployment is a static GitHub Pages artifact built by [.github/workflows/pages.yml](.github/workflows/pages.yml). No backend, account, database, telemetry, or cloud audio processing is used.
