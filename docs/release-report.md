# M11/M12 production migration release candidate

Date: 2026-08-06
Starting SHA: `c1f25e3a1e4197f24a8276c3339820809b28b1b0`
Final SHA and workflow run: recorded after the release commit/deployment.

## Delivered

- One production abcjs 6.5.2 adapter and renderer for Find, Score, Ear, Rhythm, and Learn.
- Persisted Timeline/Score switch; Timeline is default.
- Exact notehead/temporal/system anchors and measured ribbon geometry with a 5 px next-anchor gap.
- Balanced Timeline density: `minPadding 13`, `minWidth 33`, about 40 layout px/beat.
- Tie-merged sound events, generated-exercise ABC serializer, and built-in/import ABC source handling.
- Complete hidden-event masking plus neutral Ear marker and application-owned note names.
- Shared product-illustration harmonica body with Compact Guidance and Interactive Touch views.
- Deterministic phrase-level fingering planner with alternatives and explicit unplayable results.
- Ambiguity-safe detected mappings, common-only breath/slider claims, and out/in/neutral physical slider.
- Phone compact fit plus Interactive safe-viewport follow and three-second manual-interaction suspension.
- Light-first production surfaces and updated canonical documentation.
- Removed legacy `GameStage`, `MusicGlyphs`, and `VirtualHarmonica` render paths.

## Evidence

Focused scripts added:

- `bun run capture:release`
- `tests/unit/timeline-geometry.test.ts`
- `tests/unit/fingering-planner.test.ts`
- `tests/unit/generated-abc.test.ts`

Screenshot sets:

- `docs/screenshots/labs/`
- `docs/screenshots/release-candidate/`

## Known limitations

- abcjs internal DOM binding is intentionally isolated but still version-sensitive; the adapter emits a notehead fallback diagnostic.
- Microphone pitch cannot infer physical technique and therefore never selects a unique ambiguous hole/breath/slide.
- The fingering recommendation is deterministic guidance, not a claim of the only correct technique.
- Chromium provides the screenshot reference; Safari/Firefox and real-device latency remain owner/manual acceptance items.
- Bun's compatibility runtime reports Node 22.6 while Vite 7 recommends 22.12+; Bun-driven builds and both Playwright suites complete successfully.

The release candidate is not final product acceptance until the checklist in `docs/manual-test-checklist.md` is completed with a real harmonica.
