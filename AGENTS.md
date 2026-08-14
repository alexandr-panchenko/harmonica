# Repository agent instructions

## Active task

Before making changes, read and execute:

1. [`CODEX_TASK.md`](CODEX_TASK.md)
2. [`docs/score-ingestion-workbench-spec.md`](docs/score-ingestion-workbench-spec.md)
3. [`docs/architecture.md`](docs/architecture.md)
4. [`docs/audio-pipeline.md`](docs/audio-pipeline.md)
5. [`docs/product-roadmap.md`](docs/product-roadmap.md)

These files are the current acceptance contract. Older visual/practice tasks and reports are context only and must not replace the active task.

## Working rules

- Start from the latest `main`; fetch before editing.
- The active environment is cloud Codex; use the available GitHub branch/PR integration rather than assuming direct push credentials.
- Preserve the authoritative GitHub Actions Pages deployment and verify live build identity after merge.
- Build one framework-independent import core used by both browser and Bun CLI.
- Preserve raw source timing separately from notation interpretation.
- Use integer canonical ticks and stable IDs; deterministic output may not depend on random values or wall-clock timestamps.
- Expose track/part/voice selection, extraction strategy, quantization and spelling decisions instead of silently making an artistic choice.
- Reuse the production harmonica audio pipeline for monophonic audio import; do not build a second detector.
- Treat optional MuseScore, Audiveris and Basic Pitch executables as adapters that skip cleanly when unavailable.
- Do not commit owner-downloaded commercial MIDI, PDF, MusicXML or audio files.
- Keep all source processing local; do not add uploads, telemetry or backend dependencies.
- Validate untrusted MIDI/XML/ZIP/audio input and enforce resource limits.
- Close each failure loop: reproduce → smallest structural fix → rerun the same check → compare.
- Use automated tests and inspect the deployed desktop/phone workbench.
- Do not claim deployment from a local preview or unmerged branch.
- After successful verification, create/merge the PR, wait for Pages, verify live `build-meta.json`, run live tests and stop for owner review.

## Out of scope

Do not implement Cloudflare migration, authentication, achievements, community song publishing, improvisation mode, MuseScore scraping/extension reverse engineering, browser OMR, hosted OMR, a full graphical notation editor, autonomous publication of copyrighted arrangements or unrelated feature expansion during this task.
