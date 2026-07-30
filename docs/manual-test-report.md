# Browser and mobile test report — polish sprint

Automated on 2026-07-30 with the repository-pinned Playwright Chromium.

- Desktop Chromium: hidden answer, all 48 direct actions, blow/out and draw/in one-press paths, held duration, five-target Find history, beat-aware score step/flow, relative-ear anchor, navigation, and labs are covered.
- Pixel 7 portrait and landscape emulation run the same paths. Portrait uses two stacked six-hole banks; every cell is at least 44 CSS px high.
- Visual inspection artifacts in `docs/screenshots/` show the deterministic clef, middle-C ledger line, answer-hidden stage, five-note history, score step, two flow positions, and all responsive grid variants.
- Reduced motion is covered by CSS media query, not a separate screenshot.

Not automatable here: physical microphone permission UX on Safari/iOS, real-room noise, real-note latency, background/return behavior, natural bend trace, sample-timbre judgment, and actual touch scroll suppression on hardware. See `manual-test-checklist.md`.
