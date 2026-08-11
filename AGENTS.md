# Repository agent instructions

## Active task

Before making changes, read and execute:

1. [`CODEX_TASK.md`](CODEX_TASK.md)
2. [`docs/visual-system-spec.md`](docs/visual-system-spec.md)

These files are the current acceptance contract. Older production-redesign prompts, laboratory reports and release claims are context only and must not replace the active task.

## Working rules

- Start from the latest `main`; fetch before editing.
- Work in the local VS Code/Codex environment with the available GitHub credentials.
- Repair and verify the authoritative deployment path before judging visual changes.
- Work autonomously on routine implementation and design details resolved by the specification.
- Preserve all existing modes and domain behaviour.
- Do not redesign staff geometry, ribbons or harmonica geometry during this iteration.
- Use Bun and the existing TypeScript/Vite/React stack.
- Refactor existing styles; do not append another emergency override layer.
- Close each observed failure loop: reproduce → smallest structural fix → rerun the same check → compare.
- Use automated checks and visually inspect deployed desktop/mobile screenshots in both themes.
- Do not claim deployment from a local preview, a pushed `main`, or a test-only workflow.
- After successful verification, commit, push `main`, publish the exact build, verify live `build-meta.json`, run live production tests and leave a clean worktree.
- Stop after the deployed visual-system/main-menu iteration and request owner review instead of continuing into another design phase.

## Out of scope

Do not implement Cloudflare migration, authentication, achievements, user/community melody publishing, improvisation mode, notation editing, another staff redesign or another harmonica redesign during the active task.
