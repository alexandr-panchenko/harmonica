# Functional release-candidate automated report

Automated locally on 2026-08-12 with Bun 1.2.5 and repository-pinned Chromium.

- Static verification: TypeScript, production build, colour contrast and the synthetic pitch benchmark pass.
- Unit verification: 68 tests pass, including sampled-audio fallback/retry and measured score transport geometry.
- Browser verification: 86 applicable tests pass across desktop, Pixel 7 portrait and landscape; 4 project-specific assertions are skipped by design.

- Deterministic audio covers noise rejection, soft production-path tones, dB sensitivity ordering, dropout/display latch, vibrato, semitone transition, repeated articulation and contaminated calibration.
- Deterministic practice covers clock/count-in/pause/notation seek, all Wait for me mistake responses, exact half-held retained/reset/measure-scope results, rests and repeated-note rearticulation.
- Ear/rhythm tests cover playable random phrases, relative lifecycle, contiguous song excerpts, meter-complete generation and any/fixed pitch policy.
- Browser coverage runs desktop, Pixel 7 portrait and landscape for notation click/drag/keyboard seek, lifecycle actions, the single compact Song Practice, event feedback and sampled playback in addition to preserved notation, theme and harmonica flows.
- Release capture includes Light/Dark desktop and phone views of menu and functional practice screens.

Not automatable here: physical microphone sensitivity, real-room false positives, natural bend tracking, browser/device AGC behavior and physical-instrument latency. Use `manual-test-checklist.md`.
