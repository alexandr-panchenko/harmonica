# Harmonica Trainer

A static, local-first trainer for 10-hole and 12-hole chromatic harmonicas. It teaches note location, score reading, rhythmic performance, guided songs, and absolute or relative ear playing. Audio is analyzed locally in the browser and is never uploaded.

## Production experience

All five modes use abcjs 6.5.2 through one production `AbcAdapter`. **Timeline** is the default guided view: measured temporal spacing, notehead-aligned duration ribbons, a fixed judgment line, pitch trace, and performance history. **Score** keeps conventional systems and active-event highlighting. The display choice is independent of note-name and naming-system settings and persists in `localStorage`.

The instrument has two views over the same typed 10/12-hole profiles and physical body:

- **Microphone · recommended** uses Compact Guidance: one readable harmonica, target and detected states, honest ambiguity, airflow, and a physical slider. It never claims that pitch detection identified a unique hole, breath, or slide.
- **Touch · alternative** exposes four direct actions per physical hole. One press chooses hole, blow/draw, and slide out/in; hold duration remains exercise input. Mobile uses horizontal scrolling and follows the primary phrase-level fingering after a short user-scroll suspension.

The production UI is light-first. Notation and text stay dark and high-contrast; mint, cyan, violet, and amber are reserved for state, duration, trace, and feedback.

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
bun run capture:labs
bun run capture:release
```

After Pages deploys:

```bash
PRODUCTION_URL=https://alexandr-panchenko.github.io/harmonica/ bun run test:production
```

## Product map

- **Find a note:** assessment-first randomized targets; no fingering leak before success.
- **Play the score:** Timeline or conventional Score, Step or In time, optional guidance and labels.
- **Play by ear:** hidden SVG event groups and neutral rhythm markers until discovery/reveal.
- **Rhythm training:** engraved rests and values with duration ribbons and timing/length scoring.
- **Learn a song:** visible notation plus deterministic recommended fingering and alternatives.
- **Design diagnostics:** `/lab/staff-design/` and `/lab/harmonica-design/` use production primitives.

See [the architecture](docs/architecture.md), [roadmap](docs/product-roadmap.md), [release report](docs/release-report.md), and [manual owner checklist](docs/manual-test-checklist.md).

Deployment uses a locally verified static build published to the `gh-pages` branch; `.github/workflows/pages.yml` remains a build/test CI gate and no longer calls the unavailable Pages deployment action. No account, backend, database, telemetry, or cloud audio processing is included.
