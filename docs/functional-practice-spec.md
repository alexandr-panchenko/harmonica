# Harmonica Trainer functional practice specification

Status: **binding specification for the next production iteration**  
Scope: **microphone reliability, live note state, practice transport, ear/rhythm exercise lifecycle, and shared song practice**

This iteration follows the visual-system and notation-layout passes. The application is now readable enough to test, and owner testing has exposed functional regressions and missing product semantics. This is not a visual redesign and not a backend phase.

The iteration must repair the real production application and deploy it for owner testing with a physical harmonica.

---

## 1. Owner-observed failures

### Microphone

- Soft and medium notes are frequently ignored.
- A louder note may appear only briefly and disappear while the same sustained tone continues.
- Staff pitch traces and virtual-harmonica highlights blink because detection is unstable.
- The application can appear to infer the wrong breath/slide action.

The final point needs a precise product rule: microphone audio identifies sounding pitch, not the physical hole, breath direction, slide state, or technique. A pitch can have several valid actions, especially on the owner’s valveless chromatic harmonica. The interface must highlight every matching physical action and claim breath/slide only when all candidates agree.

### Score practice

- The target duration ribbon does not reliably show live held progress.
- It is unclear whether a short note is accepted, whether a mistake skips a note, or how Step differs from In time.
- There is no explicit transport position or seek control.
- The player cannot select where to begin or repeat a section.

### Play by ear

- The source phrase is unexplained.
- The current implementation uses one fixed four-note constant, but the screen behaves as though a phrase were generated.
- Phrase progress, Hint and Reveal are too far from the main controls.
- There is no explicit New phrase, Skip or Next action.
- The user needs both random phrases and excerpts from selected songs.

### Rhythm training

- The current rhythm pattern is a fixed constant.
- The screen does not say how it was chosen or when it changes.
- There is no New pattern or pattern configuration.

### Play the score versus Learn a song

The two entries currently expose nearly the same screen and their distinction is lost. They should share one implementation and differ by visible guidance presets, not by duplicated mode logic.

---

## 2. Current code findings to address

The implementation currently has several structural causes for the reported behavior:

1. `MicrophoneInput` passes a frame to the application only when `tracked.state === "stable"`; attack, tonal-unstable and release frames become `null`. A single temporary clarity/RMS drop therefore removes the UI pitch immediately even before the tracker fully closes.
2. `AdaptivePitchTracker` opens only after consecutive credible frames and returns `null` during release. Its current amplitude and clarity gates are not exposed as a meaningful user sensitivity model.
3. The main application evaluates only completed microphone segments. Pitch-only exercises therefore wait for release instead of accepting a live stable note, while transient dropouts can split one sustained note.
4. Score Step advances on pitch identity and intonation without enforcing target duration. `acceptsStep()` already describes a duration-aware rule but is not the active score-practice engine.
5. In time records segments and performs post-run alignment, while Step and its visual progress are not driven by a dedicated transport state.
6. Ear content is the fixed `EAR_TARGETS` constant.
7. Rhythm content is the fixed `RHYTHM_MELODY` constant.

Do not patch these issues with isolated UI timers. Introduce explicit domain state for audio observations and practice transport.

---

# Part I — microphone reliability

## 3. Separate raw observation, display state, acceptance state and completed segments

Create one microphone result contract rather than passing `TrackerFrame | null` as every concept.

A suitable model is:

```ts
interface MicrophoneFrameBundle {
  time: number;
  signalState: SignalState;

  rawEstimate?: {
    frequencyHz: number;
    midiFloat: number;
    clarity: number;
    rms: number;
  };

  candidate?: TrackerFrame;
  display?: TrackerFrame;
  accepted?: TrackerFrame;

  gate: {
    noiseFloorDb: number;
    openThresholdDb: number;
    closeThresholdDb: number;
    isOpen: boolean;
    confidence: number;
  };
}
```

Names may differ, but the responsibilities are mandatory:

- **raw estimate**: diagnostics only;
- **candidate**: plausible tracked pitch, even before exercise acceptance;
- **display**: a visually stable, short-latched pitch for tuner/staff/harmonica feedback;
- **accepted**: a pitch stable enough to count toward exercise progress;
- **completed segment**: a note event finalized after release/change and used for performance review.

The UI must not disappear because one frame is temporarily below the acceptance threshold. The scoring engine must not accept every candidate frame.

## 4. Time-based gate and hysteresis

Replace frame-count-dependent release behavior with explicit time-based hysteresis.

Required behavior:

- open only after a short credible tonal attack;
- sustain with a lower amplitude and clarity requirement than opening;
- tolerate short RMS/clarity dropouts while the same pitch remains plausible;
- close after sustained silence/non-tonality, not after a handful of animation frames;
- clear stale pitch after genuine release;
- distinguish pitch change from brief estimator error.

Initial target behavior for tuning, subject to deterministic benchmark evidence:

- stable pitch appears within approximately 120–250 ms after a credible onset;
- display does not disappear for a dropout shorter than approximately 150–220 ms;
- an active note segment survives short clarity dips and breath-noise bursts;
- genuine silence ends the segment after approximately 250–400 ms;
- repeated equal notes separated by articulation become distinct segments;
- vibrato and ordinary harmonica intonation drift do not create repeated neighboring-note events;
- a deliberate bend may cross to the neighboring semitone once the new pitch is genuinely stable.

Do not encode these as animation-frame counts.

## 5. Sensitivity model

The current public `sensitivity` number is not a usable product setting. Define a meaningful persisted microphone sensitivity:

- **High** — quieter notes, smaller margin above ambient;
- **Normal** — default;
- **Low** — noisy rooms, larger margin.

Internally use dBFS or an equivalently interpretable representation. Calibration should estimate ambient floor robustly, then derive separate open and sustain/close margins.

Requirements:

- normal sensitivity should recognize ordinary soft/medium chromatic-harmonica notes at a normal laptop/phone distance;
- high sensitivity must not turn room noise into wandering notes;
- low sensitivity remains available for noisy environments;
- the advanced diagnostics panel shows current RMS/dB, noise floor, open/close thresholds, clarity, state and selected sensitivity;
- Recalibrate remains available;
- sensitivity and selected input device persist locally.

## 6. Calibration contamination

During the initial ambient calibration:

- display a clear instruction to remain quiet;
- detect obviously contaminated/high-variance/tonal calibration data;
- do not silently turn a played note into a high noise floor;
- retry or ask for recalibration when calibration is contaminated;
- keep calibration duration short enough to be practical.

## 7. Display latch and exercise acceptance

### Display

Tuner, staff live pitch and compact harmonica use the `display` frame. It may hold/fade the last credible pitch briefly through dropouts. It must show confidence/state without blinking between a note and em dash on individual frames.

### Pitch-only exercises

Find a note and the pitch-discovery stage of Play by ear must accept a live `accepted` pitch after a short minimum stable hold. They must not require the player to release the note before the answer is evaluated.

After accepting one note:

- require release or a new onset before the same sustained sound can answer the next target;
- avoid double-submission while UI state changes;
- retain the completed segment for diagnostics/review when it ends.

### Duration-sensitive exercises

Score Step, song guidance and rhythm practice consume continuous accepted-pitch time, not only a completed segment.

### In-time performance

In-time mode records completed segments and live trace while the independent transport clock continues.

## 8. Ambiguity-safe harmonica feedback

For microphone input:

- map detected MIDI to all matching `HarmonicaAction`s in the selected profile;
- highlight all matching positions;
- show a single breath direction only when all matching actions share it;
- show slider in/out only when all matching actions share it;
- otherwise keep breath/slider neutral and label the state as multiple possible positions;
- never claim that microphone audio identified a physical technique.

Target guidance may still show one deterministic recommended fingering plus alternatives.

---

# Part II — shared practice transport

## 9. Introduce one transport domain

Create a framework-independent practice transport used by score/song/rhythm exercises.

```ts
interface PracticeTransportState {
  mode: "step" | "realtime";
  status: "idle" | "count-in" | "playing" | "paused" | "complete";
  positionBeat: number;
  startBeat: number;
  totalBeats: number;
  tempoQpm: number;
}
```

It must support:

- play;
- pause;
- restart;
- seek to beat/time;
- start from the selected position;
- active written/sounding event lookup;
- measure and beat display;
- deterministic tests without browser timing.

The notation viewport follows transport position. Native staff scrolling is not the transport control.

## 10. Visible transport and seek bar

Score/song/rhythm screens need a clear transport cluster near the staff:

- play/pause or Start;
- restart;
- count-in for real-time performance;
- current position and total duration;
- current measure/beat where available;
- a draggable seek bar spanning the full exercise;
- direct seeking before starting;
- seeking while paused;
- dragging while playing pauses first, then resumes only by explicit action.

Seeking must update:

- active event;
- notation follow position;
- active ribbon;
- harmonica target guidance;
- result collection scope.

Starting a new take from a seek position clears conflicting results for that take instead of combining unrelated timelines silently.

## 11. Step practice semantics

Step practice is user-driven. The timeline does not move merely because wall-clock time passes.

For a note event:

1. only accepted target pitch accumulates held progress;
2. wrong pitch pauses progress and shows explicit feedback;
3. release before completion follows the selected mistake policy;
4. at 100% target duration, the note completes and the transport advances;
5. a repeated equal note requires a new articulation;
6. no target note is skipped because of an error.

Provide a visible mistake policy:

- **Pause and continue** — default; retained correct hold progress freezes and resumes;
- **Restart note** — wrong pitch or premature release resets the current note;
- **Restart measure** — mistake returns to the current measure start.

For a rest event:

- silence accumulates rest progress;
- a played note pauses/resets according to the same policy;
- the UI explicitly says that silence is the target.

Too-long notes are not penalized in Step: completion occurs once required hold is reached.

## 12. Real-time performance semantics

In-time mode is clock-driven:

- start after count-in;
- transport never pauses for a wrong/missing note;
- target position follows musical time;
- input segments and pitch trace are recorded;
- notes may be matched, missing or extra;
- pitch, onset, duration, stability and intonation are reviewed separately;
- live notation may mark passed targets as hit/missed, but post-run alignment remains the authoritative review.

A mistake does not “skip” a note by logic; the clock reaches the next event and the previous event becomes missing/incorrect.

## 13. Ribbons and played-pitch trace

Keep two visually and semantically separate layers:

### Target duration ribbon

- belongs to the target note;
- active base remains visible;
- in Step, fill is driven by accumulated correct hold progress;
- in real time, fill is driven by transport position;
- it must not vanish because a completed input segment has not yet been emitted;
- upcoming ribbons remain subtle;
- rests use an appropriate neutral time indicator rather than a note-height ribbon.

### Played pitch trace

- shows what the microphone/Touch input actually produced;
- uses display/candidate state for smooth live feedback;
- completed segments remain as history;
- must not be confused with target duration progress.

Add a concise visual legend only where necessary; do not reintroduce technical canvas headings.

---

# Part III — exercise sources and lifecycle

## 14. Play by ear

### Source selector

Provide two explicit sources:

1. **Random phrase**
2. **Song excerpt**

The screen header/control cluster must say exactly what the player is solving, for example:

- `Random phrase · 4 notes · Relative`;
- `Ode to Joy · measures 1–2 · Absolute`.

### Random phrase

Settings:

- phrase length, initially 3–8 notes;
- instrument/profile range;
- difficulty/allowed interval size;
- optional rhythm complexity for the later performance stage.

Generation must use playable pitches and avoid accidental answer leakage. A phrase is generated on entry and changes only through an explicit lifecycle action.

### Song excerpt

Reuse the song library. Select a contiguous monodic phrase by measures or a clear note-range excerpt. Show song title and excerpt location.

### Controls near the top

- Listen / Replay;
- New phrase;
- Skip;
- Hint;
- Reveal;
- progress such as `0 of 4 pitches found`;
- Absolute / Relative.

Rules:

- New phrase creates another phrase with current settings;
- Skip marks the phrase skipped and moves to a new one;
- Next phrase appears after success;
- Reveal marks the attempt assisted;
- Relative mode anchors transposition on the first accepted note and checks intervals thereafter;
- Absolute mode requires exact target pitches;
- stage one discovers pitches without rhythm pressure;
- after discovery, offer stage two: perform the same phrase in rhythm using the shared transport.

Remove the hard-coded `EAR_TARGETS` product behavior. Constants may remain only as test fixtures.

## 15. Rhythm training

Replace the fixed product pattern with an explicit pattern source.

### Sources

- **Generated pattern** — default;
- **Preset pattern** — small curated examples are acceptable.

### Settings

- meter: at least 4/4, 3/4 and 6/8;
- length in measures;
- difficulty;
- allowed note values/rests;
- tempo;
- pitch policy:
  - any stable note (default, rhythm-only);
  - one selected fixed pitch.

### Controls

- New pattern;
- Repeat/listen;
- Start Step;
- Start In time;
- Skip/Next after completion;
- clear pattern summary such as `Generated · 2 bars · 4/4 · Easy`.

The pattern changes only through explicit New/Next actions. Remove the fixed `RHYTHM_MELODY` product behavior; retain it only as a deterministic fixture if useful.

Step and real-time behavior use the shared transport and mistake policies. Rhythm scoring ignores pitch when `any stable note` is selected.

---

# Part IV — one song-practice implementation

## 16. Unify Play the score and Learn a song internally

Do not maintain two divergent engines.

Create one Song Practice screen/domain with visible guidance settings and three practical presets:

### Learn preset

- full notation visible;
- recommended harmonica fingering visible;
- note names may be enabled;
- Step default;
- Pause and continue default mistake policy;
- target pitch may be heard on demand.

### Practice preset

- notation visible;
- fingering guidance off by default;
- learning aids optional;
- Step or In time selectable;
- normal scoring feedback.

### Perform preset

- In time;
- guidance minimized;
- count-in;
- complete post-run review.

For this iteration, the existing **Play the score** and **Learn a song** menu entries may remain as shortcuts that open the shared screen with Practice and Learn presets respectively. The UI must make the active preset and guidance differences visible. After owner review, the menu entries can be merged into one if they still feel redundant.

All song selection, import, transport, seeking, tempo and results logic must be shared.

---

# Part V — architecture and migration

## 17. Suggested modules

Names may differ, but keep responsibilities separate:

```text
src/audio/
  MicrophoneInput.ts
  PitchTracker.ts
  LivePitchState.ts
  NoteSegmenter.ts

src/practice/
  PracticeTransport.ts
  StepPracticeEngine.ts
  RealtimePerformanceEngine.ts
  practiceTypes.ts

src/exercises/ear/
  phraseGenerator.ts
  songExcerpt.ts
  earSession.ts

src/exercises/rhythm/
  rhythmGenerator.ts
  rhythmSession.ts

src/song-practice/
  SongPractice.tsx
  guidancePresets.ts
```

Avoid continuing to grow one monolithic `App.tsx` with mode-specific state transitions.

## 18. Migration sequence

1. Establish baseline and capture actual live behavior.
2. Refactor microphone result contract without changing exercise semantics.
3. Tune gate/latch/segmenter using deterministic fixtures and diagnostics.
4. Move Find and ear pitch discovery to live accepted-note input.
5. Introduce transport and Step engine.
6. Move score/song/rhythm Step behavior.
7. Introduce real-time transport and seek bar.
8. Move current performance alignment onto it.
9. Add random/song ear sources and lifecycle.
10. Add generated/preset rhythm sources and lifecycle.
11. Consolidate score/guided implementation into Song Practice presets.
12. Remove dead constants and old duplicated state.
13. Deploy and run real-device owner acceptance.

Do not delete working code before parity is verified.

---

# Part VI — automated verification

## 19. Audio fixtures

Extend deterministic fixtures beyond loud clean tones:

- quiet ambient noise;
- colored room noise;
- breath noise;
- click/impulse;
- soft harmonica-like harmonic tone near the opening threshold;
- medium and loud tones;
- amplitude ramp;
- sustained tone with short RMS dropouts;
- sustained tone with clarity dips;
- vibrato;
- bend crossing a semitone;
- repeated equal notes with articulation;
- calibration contaminated by a played tone.

Assertions:

- noise does not produce accepted/display pitch;
- soft/medium tones open within the target onset window;
- short dropout does not remove display or split segment;
- genuine release finalizes one segment;
- repeated articulation creates two segments;
- display and accepted state are intentionally different;
- sensitivity presets change thresholds deterministically.

Use the same production tracker path for synthetic, uploaded WAV and microphone input.

## 20. Practice engine tests

### Step

- correct pitch accumulates duration;
- wrong pitch does not advance;
- Pause and continue preserves progress;
- Restart note resets progress;
- Restart measure seeks to measure start;
- rest requires silence;
- repeated equal notes require articulation;
- seek changes active event;
- no event is skipped on error.

### Real time

- transport position follows a deterministic clock;
- errors do not stop time;
- seek/start offset is honored;
- missing/extra/matched results are recorded;
- target ribbon fill follows transport;
- post-run alignment covers pitch/timing/duration.

## 21. Ear and rhythm tests

- random phrases obey range, length and interval constraints;
- phrase changes only on explicit lifecycle actions;
- relative transposition and absolute checking remain correct;
- song excerpt comes from the selected melody;
- progress/assisted/skipped state is explicit;
- generated rhythms obey meter, measure length and allowed values;
- any-pitch rhythm ignores pitch identity but measures timing/duration;
- fixed-pitch rhythm checks the selected pitch.

## 22. Browser flows

Cover at least:

- microphone calibration and sensitivity control;
- injected soft sustained pitch remains visually stable;
- Find accepts a live note before release and requires rearticulation for next target;
- Song Learn Step completes a held note and shows ribbon progress;
- each mistake policy;
- seek then start;
- In time continues through a deliberate wrong/missing note;
- Ear Random/New/Skip/Hint/Reveal/Next;
- Ear Song excerpt;
- Rhythm generated/New/Step/In time;
- Play the score and Learn a song open one shared Song Practice implementation with different presets;
- 10-hole and 12-hole ambiguity-safe highlights.

---

# Part VII — manual owner acceptance

## 23. Required real-harmonica checklist

The final report must give this short checklist and must not claim physical-input acceptance before the owner performs it.

### Microphone

1. Calibrate in ten seconds of ordinary room silence.
2. Play low, middle and high notes softly, then normally.
3. Sustain each note for about two seconds and confirm it does not blink away.
4. Play one bend slowly and inspect continuous cents/pitch movement.
5. Articulate the same note twice and confirm two events.
6. Confirm no false note during ten seconds of silence.
7. Try High/Normal/Low sensitivity and record device/browser.

### Practice

1. Step: hold a note halfway, release, then resume under Pause and continue.
2. Repeat under Restart note.
3. Make a wrong note and verify no target is skipped.
4. Seek to the middle and start there.
5. Run In time with one deliberate miss and verify the clock continues and the miss is recorded.
6. Confirm target ribbon progress and played-pitch trace are visually distinct.

### Ear/rhythm/song

1. Generate and skip several random ear phrases.
2. Choose a song excerpt and solve it relatively and absolutely.
3. Generate several rhythm patterns and change meter/difficulty.
4. Open Play the score and Learn a song and verify the shared screen has visibly different presets.

---

# Part VIII — exclusions and release gate

## 24. Out of scope

Do not implement:

- Cloudflare migration;
- accounts or persistence beyond local settings/session state;
- achievements;
- community melody publishing;
- improvisation mode;
- graphical notation editing;
- a new visual theme;
- another staff or harmonica art redesign unrelated to functional feedback.

## 25. Verification and deployment

Run at minimum:

```bash
bun install --frozen-lockfile
bun run verify:colors
bun run typecheck
bun test
bun run benchmark:pitch
bun run build
bun run test:browser
bun run test:production
bun run capture:release
```

After successful local verification:

1. update canonical architecture/release/manual-test docs honestly;
2. create a detailed commit;
3. push `main`;
4. wait for the authoritative GitHub Pages workflow;
5. verify live `build-meta.json` equals final `main` SHA;
6. run live production tests;
7. leave a clean worktree;
8. stop for owner physical-instrument review.

The task is complete as a release candidate only when automated verification passes and the live build exposes the new microphone state, transport, ear/rhythm lifecycle and shared song-practice behavior. Final microphone acceptance remains owner-confirmed on real hardware.
