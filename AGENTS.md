# Repository agent instructions

## Active task

Before making changes, read and execute:

1. [`CODEX_TASK.md`](CODEX_TASK.md)
2. [`docs/production-redesign-spec.md`](docs/production-redesign-spec.md)

These files are the current acceptance contract. Do not substitute older sprint prompts, laboratory reports, or release claims.

## Working rules

- Start from the latest `main`; fetch before editing.
- Work autonomously and do not ask for routine design decisions already resolved in the specification.
- Do not create another separate experimental/laboratory page as the deliverable.
- Preserve existing modes and domain behavior while rebuilding the production staff and harmonica presentation.
- Use Bun and the existing TypeScript/Vite/React stack.
- Close each observed failure loop: reproduce → smallest structural fix → rerun the same check → compare.
- Use automated tests and visually inspect main-application desktop/mobile screenshots.
- Do not claim deployment from a local preview or from pushing `main` alone.
- After successful verification, create a detailed commit, push `main`, publish the exact final build to `gh-pages`, verify live `build-meta.json`, and leave a clean worktree.
- Stop only for a genuine external blocker, security boundary, or unavailable required credential; report the exact blocker rather than replacing the required path with a workaround.

## Out of scope

Do not implement Cloudflare migration, authentication, achievements, user/community melody publishing, improvisation mode, or notation editing during the active task.