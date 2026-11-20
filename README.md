# Harmonica Trainer

A static, local-first trainer for 10-hole and 12-hole chromatic harmonicas. It teaches note location, score reading, rhythmic performance, guided songs, and absolute or relative ear playing. Audio is analyzed locally in the browser and is never uploaded.

## Production application

The main application uses a light-first semantic visual system with persisted Light, Dark and System themes. Five deterministic LCh(ab) accent families identify the learning modes, while measured abcjs Timeline geometry and the shared vector harmonica remain the production notation and instrument foundations. Standalone visual design laboratories remain removed; the production URL is the sole product surface.

Start here:

- [`CODEX_TASK.md`](CODEX_TASK.md) — active autonomous execution contract (Phase 1: route fix & Score Correction Editor);
- [`docs/product-roadmap.md`](docs/product-roadmap.md) — unified master plan, decide-now vs change-later matrix, and phased execution roadmap;
- [`docs/canvas-collab-architecture.md`](docs/canvas-collab-architecture.md) — 3-layer architecture separating deterministic musical standards, collaborative agent artifacts (`AnimaticML/ml-collab-codec`), and the zoomable 2D/3D canvas desktop (`AnimaticML/canvas-ir`);
- [`docs/design-packet.md`](docs/design-packet.md) — complete Portable Instruments design packet (vision, IA, journeys, screens, instruments, agent, ingestion/generation, wireframes, and review criteria);
- [`docs/functional-practice-spec.md`](docs/functional-practice-spec.md) — binding microphone, transport and exercise semantics;
- [`docs/architecture.md`](docs/architecture.md) — current production boundaries.

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

## Score Import & Correction Workbench

Open `/harmonica/tools/score-import/` (served by a dedicated Vite multi-page entry `tools/score-import/index.html` → `src/score-import/main.tsx` that survives direct navigation and page refresh on GitHub Pages) to process Standard MIDI, MusicXML/MXL, monophonic 16-bit PCM WAV, or saved `.harmonica-project.json` files locally.

The workbench is organized into four stages (`Import → Extract → Edit → Export`):

1. **Import & Extract (`src/score-import/core.ts`):** shared verbatim by the browser and Bun CLI. Retains raw timing and source provenance separately from the explicit `960 PPQ` quantized candidate, inventories tracks/parts/voices, and previews `as-written`, `highest`, `lowest`, and `voice-leading` melody candidates.
2. **Visual Score Correction Editor (`src/score-editor/`):** keeps the imported `ScoreImportProject` and `Candidate` immutable and edits a separate monophonic `EditableArrangement` (`960 PPQ`, explicit rests, deterministic IDs, ripple editing) through reversible `EditCommand` objects (`Undo/Redo`):
   - **Pitch & spelling:** click/tap or Shift-range selection, vertical diatonic staff dragging on `abcjs`, keyboard navigation (`ArrowLeft/Right`, `ArrowUp/Down`, `Alt+Arrow` octave shift), and independent enharmonic respelling (`♯`/`♭`/`♮`).
   - **Timing & structure:** duration presets (whole through 32nd, dotted, triplets), synchronized compact `TimingLane` with quantized right-edge resize handles and insertion markers, `Note ↔ Rest` conversion, insert before/after, `Delete & close gap` versus `Delete & leave rest`, `Split`, `Merge`, `Tie/Untie`, `Transpose`, `Shift octave`, `Crop to selection`, and metadata editing.
   - **Diagnostics & diff:** continuous monophony/tie/spelling validation, 10-hole and 12-hole C chromatic harmonica range and fingering diagnostics with one-click range fit suggestions, and live `Original vs Edited` diff comparison with reset.
3. **Audition, Export & Song Practice handoff:** stoppable sampled-harmonica audition from start or selection (with loop), byte-deterministic export to ABC, Standard MIDI, MusicXML 4.0, canonical arrangement JSON, and reloadable `.harmonica-project.json`, plus base-safe handoff of the **edited** arrangement into Song Practice.

```bash
bun run score:ingest -- local.mid --output score-import-output
bun run score:benchmark
bun run score:adapters
```

`MUSESCORE_BIN`, `AUDIVERIS_BIN`, and `BASIC_PITCH_BIN` enable version-probed local reference adapters. They skip cleanly when absent and are never required by the repository-native conversion paths. Imports remain on-device; file-size, MXL expansion/path, MIDI-event, XML declaration, and audio-duration limits are enforced.
