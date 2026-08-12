# Compact practice workspace release candidate

Status: implementation and local verification complete; final live identity is filled by the release commit and GitHub Pages workflow.

## Product result

Microphone processing no longer reduces every frame to `stable | null`. The production PCM boundary now exposes raw estimator diagnostics, candidate pitch, short-latched display pitch, exercise-grade accepted pitch and separately completed segments. Gate timing is elapsed-time based; persisted High/Normal/Low sensitivity derives explicit dB margins above a robust ambient floor. Contaminated calibration retries with a clear quiet-room instruction.

Find and Ear discovery accept a live held pitch before release and require a new onset before another answer. Score/song/rhythm Step consume continuous accepted duration. Realtime performance keeps an independent clock and reviews completed segments. Microphone pitch highlights every matching physical action; breath and slide remain neutral when candidates disagree.

One framework-independent transport now drives song, ear-performance and rhythm practice. The notation itself supplies pointer, drag and keyboard seek with a system-aware Score mapping; the compact staff header supplies pause/resume/restart, count-in and measure/beat/time. Wait for me auto-arms once input is ready. Keep note progress, Restart current note and Restart current measure have distinct state, geometry, explanation and measure-scoped result clearing.

Ear practice has Random phrase and Song excerpt sources with Listen/Replay, New, Skip, Hint, Reveal, progress, Relative/Absolute and an optional In time stage. Rhythm has generated/preset sources and explicit meter, measures, difficulty and pitch policy. Both use the compact dock rhythm without changing their lifecycle. The menu now has one Practice a song entry and one implementation with direct behavior, layout, tempo, guidance and mistake controls; preset product state and duplicate score/guided branches are removed.

Sampled harmonica playback is restored at its actual failure points: the Pages build now includes `public/audio/harmonica`, browser `fetch` keeps its required binding, melody scheduling waits for preload, failed zones retry independently and successful zones remain usable. Healthy reference and Touch paths use `AudioBufferSourceNode`; oscillator is a visible retryable degraded state only.

## Evidence and limitation

The automated gate includes the frozen install, colour verification, strict TypeScript, unit/domain fixtures, production-path pitch benchmark, build, desktop/mobile browser flows, production flows and expanded Light/Dark release capture. GitHub Pages remains the authoritative publisher and `build-meta.json` must equal the final main SHA.

Synthetic and browser tests do not establish real-harmonica microphone acceptance. The owner checklist in `manual-test-checklist.md` is the final physical-device gate.
