# Architecture

The Vite/React shell is strict TypeScript and statically deployable. Domain logic is deliberately framework-independent:

```text
HarmonicaProfile / canonical Melody / WrittenPitch
              ↓
Virtual actions or microphone PCM → ambient gate → estimator → tracker → segmenter
              ↓                                             ↓
       exercise target                                 timestamped trace
              └──────── beat/time timeline → GameStage / tuner / review
```

`src/music` owns pitch math and monodic melody events, including ABC-preserved written spelling. `src/notation` maps written pitch to diatonic treble-staff positions and owns all SVG glyph paths, accidentals, and ledger-line data. `src/harmonica` owns physical actions, alternate pitch representations, and calibration types. `src/audio` owns sampled playback, output-contamination protection, microphone acquisition, three estimator adapters, adaptive gating, tracking, and segmentation. `src/game` owns beat/time positioning. `src/exercises` owns identity, relative transposition, timing windows, and dynamic-programming alignment. Scoring does not depend on rendered SVG DOM details.

Exercise modes use explicit `mode`, `practice`, and input variants. Score and discovered-ear rhythm stages share one `exerciseMelody`. Flow targets use beat coordinates around a fixed playhead; performed segments and traces use monotonic timestamps. Find mode keeps the active target plus four accepted predecessors. Realtime trace history is aged by elapsed time rather than array index.

Assumptions: the release profile is standard 12-hole C solo tuning; microphone input grades sounding pitch, never inferred holes or breath; virtual bends remain a data-model extension; imported music must be monodic.
