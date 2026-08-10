# Production redesign release report

Status: implemented and locally verified; production identity is generated from the release source commit.

## Product result

The production Timeline Staff now measures noteheads and every overlay from the same `.music-canvas` coordinate root. Ribbons use the notehead center and the next measured written-event anchor (including rests), while tied sound progress remains shared across its engraved written segments. Measurements repeat after SVG/root resize and font readiness.

The production training screen uses the shared light `HarmonicaBody` for microphone Compact Guidance and secondary Interactive Touch. Both 10- and 12-hole profiles retain deterministic phrase fingering, ambiguity-safe detected mappings, and the physical out/in/neutral slider states.

The standalone staff and harmonica design pages, their duplicated components, lab capture command, and lab-only CSS were removed. Staff fixtures now live under `tests/fixtures/`.

## Verification evidence

The required unit, pitch benchmark, build, browser, production-preview, and release-capture commands pass. Browser geometry checks assert notehead/ribbon vertical alignment, measured interval coverage, and resize recalculation. Production-only desktop/mobile screenshots were generated and visually reviewed with `bun run capture:release`. Reproducible local evidence is written to the ignored `docs/screenshots/release-candidate/` output directory and is intentionally excluded from the pull request.

Each build emits `build-meta.json` and displays its source commit in the application. Publication verification must compare the live metadata against the final `main` SHA.
