# Functional practice release candidate

Status: implementation and local verification complete; final live identity is filled by the release commit and GitHub Pages workflow.

## Product result

Microphone processing no longer reduces every frame to `stable | null`. The production PCM boundary now exposes raw estimator diagnostics, candidate pitch, short-latched display pitch, exercise-grade accepted pitch and separately completed segments. Gate timing is elapsed-time based; persisted High/Normal/Low sensitivity derives explicit dB margins above a robust ambient floor. Contaminated calibration retries with a clear quiet-room instruction.

Find and Ear discovery accept a live held pitch before release and require a new onset before another answer. Score/song/rhythm Step consume continuous accepted duration. Realtime performance keeps an independent clock and reviews completed segments. Microphone pitch highlights every matching physical action; breath and slide remain neutral when candidates disagree.

One framework-independent transport now drives song, ear-performance and rhythm practice. It supplies Step/In time, count-in, play/pause/restart, draggable seek, measure/beat/time position and scoped takes. Step implements Pause and continue, Restart note and Restart measure; rests require silence and equal repeated notes require rearticulation. Ribbon fill follows held Step progress or realtime position while the played trace remains separate.

Ear practice has Random phrase and Song excerpt sources with Listen/Replay, New, Skip, Hint, Reveal, progress, Relative/Absolute and an optional In time stage. Rhythm has generated/preset sources and explicit meter, measures, difficulty and pitch policy. Play the score and Learn a song share Song Practice and open its Practice/Learn presets; Perform is available on the same screen.

## Evidence and limitation

The automated gate includes the frozen install, colour verification, strict TypeScript, unit/domain fixtures, production-path pitch benchmark, build, desktop/mobile browser flows, production flows and expanded Light/Dark release capture. GitHub Pages remains the authoritative publisher and `build-meta.json` must equal the final main SHA.

Synthetic and browser tests do not establish real-harmonica microphone acceptance. The owner checklist in `manual-test-checklist.md` is the final physical-device gate.
