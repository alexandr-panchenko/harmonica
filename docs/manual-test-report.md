# Browser and mobile test report

Automated on 2026-07-28 with Playwright Chromium 140 fallback build.

- Desktop Chromium: Mode A held note, score step, relative-ear anchor, navigation, and pitch lab passed.
- Pixel 7 emulation: the same hero paths passed; portrait layout remained readable.
- Multi-pointer simulation: Slide pointer and hole pointer were held concurrently; pointer release/cancellation completed without accidental navigation.
- Visual inspection: desktop pitch lab and mobile game-stage screenshots are in `docs/screenshots/`. Staff, target ribbon, playhead, trace, controls, and non-color labels were visible. No horizontal page overflow appeared; the harmonica itself intentionally scrolls horizontally.
- Reduced motion is covered by CSS media query, not a separate screenshot.

Not automatable here: physical microphone permission UX on Safari/iOS, real-note latency, background/return behavior, natural bend trace, and actual touch scroll suppression on hardware. See `manual-test-checklist.md`.
