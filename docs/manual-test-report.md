# Functional release-candidate automated report

Automated locally on 2026-08-11 with Bun 1.2.5 and repository-pinned Chromium.

- Deterministic audio covers noise rejection, soft production-path tones, dB sensitivity ordering, dropout/display latch, vibrato, semitone transition, repeated articulation and contaminated calibration.
- Deterministic practice covers clock/count-in/pause/seek, all Step mistake policies, retained/reset progress, rests and repeated-note rearticulation.
- Ear/rhythm tests cover playable random phrases, relative lifecycle, contiguous song excerpts, meter-complete generation and any/fixed pitch policy.
- Browser coverage runs desktop, Pixel 7 portrait and landscape for transport/seek, lifecycle actions and shared Song Practice presets in addition to the preserved notation, theme and harmonica flows.
- Release capture includes Light/Dark desktop and phone views of menu and functional practice screens.

Not automatable here: physical microphone sensitivity, real-room false positives, natural bend tracking, browser/device AGC behavior and physical-instrument latency. Use `manual-test-checklist.md`.
