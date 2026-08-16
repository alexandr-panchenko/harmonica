# Repository agent instructions

## Active task

Before making changes, read and execute:

1. [`CODEX_TASK.md`](CODEX_TASK.md)
2. [`docs/score-correction-editor-spec.md`](docs/score-correction-editor-spec.md)
3. [`docs/score-ingestion-workbench-spec.md`](docs/score-ingestion-workbench-spec.md)
4. [`docs/transcription-models-backlog.md`](docs/transcription-models-backlog.md)
5. [`docs/architecture.md`](docs/architecture.md)

These files are the current acceptance contract. Older visual/practice/import tasks and reports are context only and must not replace the active task.

## Working rules

- Start from the latest `main`; fetch before editing.
- The active environment is cloud Codex; use GitHub branch/PR integration rather than assuming direct push credentials.
- First prove and repair the deployed direct-route 404, then continue into the correction editor; do not stop after routing.
- Implement a real Vite multi-page workbench entry, not a pathname-only client route or a redirect-only workaround.
- Keep the imported project/candidate immutable and edit a separate monophonic arrangement model.
- Keep editor command/undo/redo/validation logic framework-independent.
- Use canonical 960-PPQ integer ticks, explicit rests, stable IDs and deterministic serialization.
- Use abcjs only as engraving/selection/drag UI; SVG and raw ABC are not editor source data.
- Preserve raw timing and source provenance through every correction.
- Reuse sampled harmonica playback and the existing deterministic import/export core.
- Validate 10-hole/12-hole range and fingering without auto-transposing silently.
- Keep source processing local; do not add uploads, telemetry or backend dependencies.
- Do not commit owner-downloaded commercial MIDI/PDF/MusicXML/audio files.
- Do not commit generated binary screenshots; keep them ignored and reproducible.
- Close each failure loop: reproduce → structural fix → rerun the same check → compare.
- Use automated tests and inspect the deployed desktop/phone editor.
- Do not claim deployment from a branch preview or local build.
- After successful verification, create/merge the PR, wait for Pages, verify live `build-meta.json`, run direct-route/live editor tests and stop for owner review.

## Out of scope

Do not implement MuScriptor, Basic Pitch, Audiveris/OMR, hosted transcription, Cloudflare/Replicate/Lambda integration, polyphonic/multi-staff editing, full arrangement assembly, accounts, community publishing, autonomous copyrighted-song publication or unrelated feature expansion during the active task.
