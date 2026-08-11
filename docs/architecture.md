# Architecture

The Vite/React client is strict TypeScript and statically deployable. Domain logic remains framework-independent:

```text
ABC or generated canonical subset → AbcAdapter → written events + tie-merged sound events
                                             ↓
microphone/touch → tracker/segmenter → scoring + monotonic beat clock → MusicStage
                                             ↓
typed HarmonicaProfile → FingeringPlanner → HarmonicaStage
```

## Notation boundary

`src/notation/abc/AbcAdapter.ts` is the only production module allowed to inspect abcjs parse objects, selectable arrays, generated SVG classes, or source-range binding. `RenderAnchor` exposes event bounds, exact notehead bounds, a temporal X coordinate, and system index. A diagnostic fallback is isolated at this boundary if abcjs changes its notehead classes.

`timelineGeometry.ts` sorts measured anchors by beat. A note segment begins just after its measured notehead and ends just before the next measured temporal anchor; rests terminate ribbons. The last event extrapolates from the local measured pixels-per-beat. A tied `SoundEvent` owns elapsed progress across its written segments. No production ribbon uses a parallel `duration * magicConstant` width. Find-note and pitch-hidden Ear canvases omit ribbons; duration contexts emphasize only the current ribbon and de-emphasize upcoming/distant events.

`MusicStage` is the sole production renderer. Timeline flattens authored body line breaks without changing source offsets, applies Balanced time-based spacing, and uses an unlabeled 38% playback line only during timed performance. `AbcAdapter` extends abcjs's five measured staff rules across each full paper system. Score uses conventional wrapping and vertical system follow. Page titles and technical legends stay outside the canvas. Note names, hidden markers, pitch traces, and results are application overlays. Hidden Ear events set the complete engraved group—including accidental and accessible SVG content—to hidden and add identical pitch-neutral placeholders at one fixed staff height.

Generated Find, Ear, and Rhythm documents pass through `generatedExerciseToAbc`, a deliberately narrow serializer preserving written pitch, accidentals, duration, rests, meter, tempo, and ties. Built-in/imported score ABC remains the engraving source of truth.

## Instrument boundary

`HarmonicaStage` selects Compact Guidance for microphone input and Interactive Touch for explicit touch input. Both use `HarmonicaBody`, the exact typed 10/12-hole profile, a single typed chassis/cap/hole/slider layout model, and shared slider semantics. Compact renders no action buttons and can show the four mapped note names per hole. Detected pitch maps to every valid action; breath or slide is shown only when all matches agree.

`FingeringPlanner` uses deterministic dynamic programming over a phrase. Its transition cost penalizes hole distance, unnecessary slide changes, breath changes, and awkward duplicate-position changes. It returns one recommendation, alternatives, or an explicit unplayable result. Pitch-correct microphone alternatives remain accepted.

Interactive Touch provides 40/48 keyboard- and pointer-accessible direct actions, pointer capture, held duration, physical slider animation, reduced-motion support, safe-viewport auto-follow, and a three-second suspension after manual interaction.

## Exercise and audio

Exercise modes retain explicit mode, Step/In time, and input variants. Flow derives beat position from a monotonic performance/audio clock; Step advances event identity. `src/audio` owns sampled playback, output-contamination protection, acquisition, estimators, adaptive gating, tracking, and segmentation. Scoring never depends on SVG details.

Assumptions: both profiles use standard C solo tuning; microphone input grades sounding pitch rather than physical technique; virtual bends remain a model extension; imported exercises are monodic.

## Visual system and themes

`src/design/palette.ts` is the deterministic LCh(ab) source for the five mode families and owns sRGB conversion, WCAG relative luminance and contrast calculation. `bun run verify:colors` checks every reversible accent pair, neutral text/surface combinations and the generated CSS values used by production.

Components consume semantic CSS tokens from `src/styles.css`. The root document stores a `light`, `dark` or `system` preference; a small inline bootstrap in `index.html` resolves it before React mounts, and `ThemeControl` keeps explicit preference and system colour-scheme changes synchronized. Staff and harmonica geometry are unchanged by theme selection.
