# Architecture

The Vite/React shell is strict TypeScript and statically deployable. Domain logic is deliberately framework-independent:

```text
HarmonicaProfile / canonical Melody
              ↓
Virtual events or microphone PCM → estimator → tracker → segment/evaluation
              ↓                              ↓
       exercise state                    pitch trace
              └──────────── GameStage / tuner / review
```

`src/music` owns pitch math and monodic melody events. `src/harmonica` owns physical actions, alternate pitch representations, and calibration types. `src/audio` owns playback, microphone acquisition, three estimator adapters, tracking, and segmentation. `src/exercises` owns identity, relative transposition, timing windows, and dynamic-programming alignment. React renders controls; the staff is application-owned SVG, so scoring never depends on ABCJS DOM internals.

Exercise modes use explicit `mode`, `practice`, and input variants. Flow timestamps are measured on a monotonic performance clock; Web Audio playback uses its own monotonic audio clock. A future latency bridge can translate these clocks using the stored timing offset. Realtime history is capped at 150 points.

Assumptions: the release profile is standard 12-hole C solo tuning; microphone input grades sounding pitch, never inferred holes or breath; virtual bends remain a data-model extension; imported music must be monodic.
