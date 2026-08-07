# Harmonica Trainer

A static, local-first trainer for 10-hole and 12-hole chromatic harmonicas. It teaches note location, score reading, rhythmic performance, guided songs, and absolute or relative ear playing. Audio is analyzed locally in the browser and is never uploaded.

## Active implementation task

The design-lab direction was approved, but the first attempt to migrate it into production was **not accepted**. The next Codex run must update the main application directly, remove the standalone lab product surface, and prove the deployed build.

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
bun run typecheck
bun test
bun run benchmark:pitch
bun run build
bun run test:browser
bun run test:production
bun run capture:release
```

The active task removes lab-only capture and routes after reusable code/fixtures are promoted.

After publication, production verification must use the live build metadata and run:

```bash
PRODUCTION_URL=https://alexandr-panchenko.github.io/harmonica/ bun run test:production
```

## Deployment state

GitHub Pages currently serves the root of the `gh-pages` branch. `.github/workflows/pages.yml` is a test/build CI gate rather than the publisher. The active task must build from the final pushed `main` SHA, publish only `dist` to `gh-pages`, expose generated `build-meta.json`, and verify that the live source SHA matches the final source commit.

No account, backend, database, telemetry, or cloud audio processing is included in this milestone.