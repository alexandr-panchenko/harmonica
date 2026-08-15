# Harmonica Trainer

A static, local-first trainer for 10-hole and 12-hole chromatic harmonicas. It teaches note location, score reading, rhythmic performance, guided songs, and absolute or relative ear playing. Audio is analyzed locally in the browser and is never uploaded.

## Production application

The main application uses a light-first semantic visual system with persisted Light, Dark and System themes. Five deterministic LCh(ab) accent families identify the learning modes, while measured abcjs Timeline geometry and the shared vector harmonica remain the production notation and instrument foundations. Standalone visual design laboratories remain removed; the production URL is the sole product surface.

Start here:

- [`CODEX_TASK.md`](CODEX_TASK.md) — active autonomous execution contract;
- [`docs/functional-practice-spec.md`](docs/functional-practice-spec.md) — binding microphone, transport and exercise semantics;
- [`docs/architecture.md`](docs/architecture.md) — current production boundaries;
- [`docs/product-roadmap.md`](docs/product-roadmap.md) — longer-term roadmap and deferred work.

The production result is evaluated only at:

`https://alexandr-panchenko.github.io/harmonica/`

Separate laboratory pages are not an acceptable deliverable for the active task.

## Current product map

- **Find a note:** randomized staff-to-instrument training with configurable range and chromatic content.
- **Practice a song:** one compact Song Practice workspace with Wait for me/In time, direct guidance and mistake settings, notation-integrated seek, and a sampled Listen/Stop preview synchronized to the staff.
- **Play by ear:** explicit random/song-excerpt lifecycle, relative/absolute discovery and optional realtime performance.
- **Rhythm training:** explicit generated/preset patterns with configurable meter, measures, difficulty and pitch policy.
- **Microphone:** separate raw/candidate/display/accepted/completed state, dB hysteresis and persisted sensitivity.
- **Touch:** direct virtual harmonica input.
- **Profiles:** explicit 10-hole and 12-hole C chromatic mappings.

The production UI keeps page instructions and controls outside the music canvas, uses measured post-notehead duration ribbons only where rhythm matters, and shares one responsive chassis model across compact and touch 10/12-hole instruments.

## Run and validate

Requirements: Bun 1.2.5 or later and a modern Chromium, Firefox, or Safari browser.

```bash
bun install --frozen-lockfile
bun run verify:colors
bun run typecheck
bun test
bun run benchmark:pitch
bun run build
bun run test:browser
bun run test:production
bun run capture:release
```

Release capture targets only the main application. The build emits `build-meta.json` with its exact source commit and also shows the short SHA in the UI.

After publication, production verification must use the live build metadata and run:

```bash
PRODUCTION_URL=https://alexandr-panchenko.github.io/harmonica/ bun run test:production
```

## Deployment

GitHub Pages uses the official Actions source. `.github/workflows/pages.yml` installs the frozen dependency graph, verifies the palette, typechecks and tests before building once with `SOURCE_COMMIT=${{ github.sha }}`; only that verified `dist/` artifact reaches the Pages deployment job. A release is accepted only after live `build-meta.json` and production tests agree with the final `main` SHA.

No account, backend, database, telemetry, or cloud audio processing is included in this milestone.

## Score Import Workbench

Open `/tools/score-import` to process Standard MIDI, MusicXML/MXL, or monophonic 16-bit PCM WAV locally. The browser and Bun CLI both call `src/score-import/core.ts`; raw timing is retained separately from the explicit 960-PPQ quantized candidate. The workbench inventories source lines, presents deterministic extraction candidates and warnings, previews notation and sampled playback, and exports ABC, MIDI, MusicXML 4.0, and canonical JSON.

```bash
bun run score:ingest -- local.mid --output score-import-output
bun run score:benchmark
bun run score:adapters
```

`MUSESCORE_BIN`, `AUDIVERIS_BIN`, and `BASIC_PITCH_BIN` enable version-probed local reference adapters. They skip cleanly when absent and are never required by the repository-native conversion paths. Imports remain on-device; file-size, MXL expansion/path, MIDI-event, XML declaration, and audio-duration limits are enforced. MIDI-to-MusicXML is a deterministic interpretation under visible settings, not lossless reconstruction.
