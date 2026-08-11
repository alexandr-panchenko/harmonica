# Harmonica Trainer

A static, local-first trainer for 10-hole and 12-hole chromatic harmonicas. It teaches note location, score reading, rhythmic performance, guided songs, and absolute or relative ear playing. Audio is analyzed locally in the browser and is never uploaded.

## Production visual system

The main application uses a light-first semantic visual system with persisted Light, Dark and System themes. Five deterministic LCh(ab) accent families identify the learning modes, while measured abcjs Timeline geometry and the shared vector harmonica remain the production notation and instrument foundations. Standalone visual design laboratories remain removed; the production URL is the sole product surface.

Start here:

- [`CODEX_TASK.md`](CODEX_TASK.md) — active autonomous execution contract;
- [`docs/production-redesign-spec.md`](docs/production-redesign-spec.md) — binding staff, harmonica, testing, cleanup, and deployment specification;
- [`docs/design-labs-report.md`](docs/design-labs-report.md) — approved ideas and owner feedback on the rejected migration;
- [`docs/product-roadmap.md`](docs/product-roadmap.md) — longer-term roadmap and deferred work.

The production result is evaluated only at:

`https://alexandr-panchenko.github.io/harmonica/`

Separate laboratory pages are not an acceptable deliverable for the active task.

## Current product map

- **Find a note:** randomized staff-to-instrument training with configurable range and chromatic content.
- **Play the score:** step and timed score practice.
- **Play by ear:** relative and absolute phrase discovery.
- **Rhythm training:** onset, duration, release, and rest practice.
- **Learn a song:** fully guided beginner performance.
- **Microphone:** local pitch, cents, gating, and note segmentation.
- **Touch:** direct virtual harmonica input.
- **Profiles:** explicit 10-hole and 12-hole C chromatic mappings.

The active rebuild preserves all of these while replacing the central production notation and virtual-instrument presentation.

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
