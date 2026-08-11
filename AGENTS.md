# Repository agent instructions

## Active task

Before making changes, read and execute:

1. [`CODEX_TASK.md`](CODEX_TASK.md)
2. [`docs/functional-practice-spec.md`](docs/functional-practice-spec.md)

These files are the current acceptance contract. Older visual-system, notation-redesign, laboratory and release documents are context only and must not replace the active task.

## Working rules

- Start from the latest `main`; fetch before editing.
- Work in the local VS Code/Codex environment with the available GitHub credentials.
- Preserve the authoritative GitHub Actions Pages deployment and verify live build identity.
- Work autonomously on routine implementation decisions resolved by the specification.
- Treat microphone display, exercise acceptance and completed note segments as separate concepts.
- Never infer a unique hole, breath, slide or technique from pitch-only microphone audio.
- Build one shared, tested practice transport rather than adding more mode-specific timers to `App.tsx`.
- Use production audio paths for synthetic/uploaded/microphone fixtures.
- Preserve current visual system and production notation/harmonica geometry unless a functional state requires a focused adjustment.
- Close each failure loop: reproduce → smallest structural fix → rerun the same check → compare.
- Do not claim physical-microphone acceptance from synthetic tests; provide owner real-harmonica validation steps.
- Do not claim deployment from local preview or pushed source alone.
- After successful verification, commit, push `main`, wait for Pages, verify live `build-meta.json`, run live production tests and leave a clean worktree.
- Stop after the deployed functional release candidate and request owner physical-instrument review.

## Out of scope

Do not implement Cloudflare migration, authentication, achievements, user/community melody publishing, improvisation mode, notation editing, another general visual redesign or unrelated feature expansion during the active task.
