# Architecture

The Vite/React client is strict TypeScript and statically deployable. Domain logic remains framework-independent:

```text
ABC or generated canonical subset → AbcAdapter → written events + tie-merged sound events
                                             ↓
microphone/decoded PCM → ProductionAudioPipeline → raw/candidate/display/accepted → NoteSegmenter
                                             ↓                         ↓
touch/accepted pitch → StepPracticeEngine / RealtimePerformanceEngine → PracticeTransport → MusicStage
                                             ↓
typed HarmonicaProfile → FingeringPlanner / every pitch match → HarmonicaStage
```

## Notation boundary

`src/notation/abc/AbcAdapter.ts` is the only production module allowed to inspect abcjs parse objects, selectable arrays, generated SVG classes, or source-range binding. `RenderAnchor` exposes event bounds, exact notehead bounds, a temporal X coordinate, and system index. A diagnostic fallback is isolated at this boundary if abcjs changes its notehead classes.

`timelineGeometry.ts` sorts measured anchors by beat. A note segment begins just after its measured notehead and ends just before the next measured temporal anchor; rests terminate ribbons. The last event extrapolates from the local measured pixels-per-beat. A tied `SoundEvent` owns elapsed progress across its written segments. No production ribbon uses a parallel `duration * magicConstant` width. Find-note and pitch-hidden Ear canvases omit ribbons; duration contexts emphasize only the current ribbon and de-emphasize upcoming/distant events.

`MusicStage` is the sole production renderer. The product exposes one Timeline notation surface: it measures the real viewport, flattens authored body line breaks without changing source offsets and applies Balanced time-based spacing. The unused Score switch is hidden until a genuinely distinct score layout exists. `scoreTransportGeometry.ts` maps measured event anchors to pointer and keyboard seek positions. The draggable/tappable playhead, target ribbons, correct/wrong/missed markers, early-release point and accessible keyboard range are one overlay contract on the notation rather than a separate Position panel. `AbcAdapter` identifies systems within SVG output and extends abcjs's five measured staff rules across each full paper system.

Generated Find, Ear, and Rhythm documents pass through `generatedExerciseToAbc`, a deliberately narrow serializer preserving written pitch, accidentals, duration, rests, meter, tempo, and ties. Built-in/imported score ABC remains the engraving source of truth.

## Instrument boundary

`HarmonicaStage` selects Compact Guidance for microphone input and Interactive Touch for explicit touch input. Both use `HarmonicaBody`, the exact typed 10/12-hole profile, a single typed chassis/cap/hole/slider layout model, and shared slider semantics. Compact renders no action buttons and can show the four mapped note names per hole. Detected pitch maps to every valid action; breath or slide is shown only when all matches agree.

`FingeringPlanner` uses deterministic dynamic programming over a phrase. Its transition cost penalizes hole distance, unnecessary slide changes, breath changes, and awkward duplicate-position changes. It returns one recommendation, alternatives, or an explicit unplayable result. Pitch-correct microphone alternatives remain accepted.

Interactive Touch provides 40/48 keyboard- and pointer-accessible direct actions, pointer capture, held duration, physical slider animation, reduced-motion support, safe-viewport auto-follow, and a three-second suspension after manual interaction.

The shared chassis keeps typed 10/12-hole geometry. Its side caps use the same restrained vertical face material and seam treatment as the mouthpiece, and the right cap owns the visible socket around the slider rod.

## Exercise and audio

`src/audio/ProductionAudioPipeline.ts` is the shared PCM boundary for microphone capture, decoded recordings and deterministic synthetic fixtures. Estimator output is diagnostic raw state. `LivePitchState` separately exposes a plausible candidate, a short-latched display pitch and an exercise-grade accepted pitch. `NoteSegmenter` owns completed release/change events. Find and Ear discovery consume live accepted onsets; Step consumes continuous accepted time; realtime review consumes completed segments. Scoring never depends on SVG details.

`src/practice/PracticeTransport.ts` is a framework-independent clock/state machine shared by song, ear-performance and rhythm practice. It owns Wait for me/realtime mode, count-in, play/pause/restart, seek/start beat and deterministic clock advancement. `StepPracticeEngine` owns held progress, rests, rearticulation and the three mistake responses, including measure-scoped completion clearing. `RealtimePerformanceEngine` records without stopping the clock and delegates authoritative post-run pitch/timing/duration alignment.

`src/practice-ui` owns `PracticeWorkspace`, compact dock groups, settings popovers and near-staff transport. Ear phrases and rhythm patterns live under `src/exercises/ear` and `src/exercises/rhythm`; content changes only through explicit lifecycle actions. Song Practice is one product mode and implementation with persisted direct settings rather than preset state.

`PlaybackEngine` preloads all bundled VCSL zones before melody scheduling, tracks each zone independently, retries failures and chooses the nearest decoded sample. Reference audio has one explicit `ReferencePlaybackSession`: an engine generation token prevents async starts from racing, every scheduled voice carries the session id, and one synchronous stop cancels all current/future voices without orphan timers. The session's shared `AudioContext.currentTime` anchor maps elapsed audio time to beat position, active notation event and duration-ribbon fill; preview visuals never enter practice scoring or results. `vite.config.ts` copies the licensed sample directory into the exact Pages artifact. Oscillator output is exposed only as degraded fallback; diagnostics report loading/sampled/degraded plus every zone.

Assumptions: both profiles use standard C solo tuning; microphone input grades sounding pitch rather than physical technique; virtual bends remain a model extension; imported exercises are monodic.

## Visual system and themes

`src/design/palette.ts` is the deterministic LCh(ab) source for the five mode families and owns sRGB conversion, WCAG relative luminance and contrast calculation. `bun run verify:colors` checks every reversible accent pair, neutral text/surface combinations and the generated CSS values used by production.

Components consume semantic CSS tokens from `src/styles.css`. The root document stores a `light`, `dark` or `system` preference; a small inline bootstrap in `index.html` resolves it before React mounts, and `ThemeControl` keeps explicit preference and system colour-scheme changes synchronized. Staff and harmonica geometry are unchanged by theme selection.

## Score ingestion boundary

`src/score-import/core.ts` is the framework-independent import domain shared verbatim by the React workbench and Bun CLI. It owns stable source-hash IDs, canonical 960-PPQ timing, raw source notes, deterministic interpretation, warnings, and ABC/MIDI/MusicXML/JSON serialization. React only handles file selection, inspection, preview, audition, and downloads; CLI scripts only handle filesystem I/O. WAV analysis calls `analyzePcmThroughProduction`, preserving the production pitch tracker and note segmenter as the single detector. Optional executable adapters are local comparators and skip when unconfigured.
