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

`src/music` owns pitch math, configurable teaching names, and monodic melody events, including ABC-preserved written spelling. `src/notation` maps written pitch to diatonic treble-staff positions and owns duration-aware SVG note/rest glyphs, accidentals, and ledger-line data. `src/harmonica` owns typed 10- and 12-hole profiles, physical actions, alternate pitch representations, and calibration types. `src/audio` owns sampled playback, output-contamination protection, microphone acquisition, three estimator adapters, adaptive gating, tracking, and segmentation. `src/game` owns beat/time positioning. `src/exercises` owns randomized target generation, identity, relative transposition, timing windows, and dynamic-programming alignment. Scoring does not depend on rendered SVG DOM details.

Exercise modes use explicit `mode`, `practice`, and input variants. Score, guided-song, rhythm, and discovered-ear stages share the canonical `Melody` event model. Flow targets use beat coordinates around a fixed playhead; performed segments and traces use monotonic timestamps. Find mode keeps the active target plus four accepted predecessors and samples from a profile/range/accidental-constrained pool with recent-note and scale-run suppression. Realtime trace history is aged by elapsed time rather than array index.

The isolated M10 staff lab adds a proposed `AbcAdapter` boundary: it alone reads abcjs parse/visual-object details and exposes canonical written events, tie-merged sounding events, source ranges, and measured render anchors. The lab does not route production scoring or `GameStage` through that boundary yet. The harmonica lab likewise generates normalized four-zone hit geometry from the existing typed profiles without replacing `VirtualHarmonica`.

Assumptions: both release profiles use standard C solo tuning; microphone input grades sounding pitch and highlights every matching position, never claiming to infer a unique hole, breath, or slide; virtual bends remain a data-model extension; imported music must be monodic.
