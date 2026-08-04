# Harmonica Trainer product roadmap

Status: **canonical planning document**  
Last updated: **2026-08-04**

This document replaces the sequence of local sprint prompts and handoff notes that were used to build the current prototype. Those historical prompts are useful as development history, but they are no longer the source of truth for future work. The current implementation is described in `README.md`, `docs/architecture.md`, and the release reports. Future product and design work should be planned here.

The roadmap deliberately separates:

- **Decision** — a direction that should be preserved unless new evidence disproves it.
- **Experiment** — a bounded prototype intended to choose between alternatives.
- **Deferred** — intentionally out of the current scope, not forgotten.

The next production changes must not begin with another broad request to “make it prettier.” The notation and virtual-instrument redesigns are separate design problems. Each gets an isolated laboratory first, owner review second, and production migration only after the design is approved.

---

## 1. Product vision

Harmonica Trainer should become a game-like learning environment for chromatic harmonica rather than a collection of forms and utilities.

Its long-term learning loop is:

```text
see or hear a musical intention
        ↓
produce it on a real or virtual harmonica
        ↓
receive immediate, musically meaningful feedback
        ↓
repeat, vary, improvise, and build durable skill
```

The product should support several kinds of musicianship instead of reducing harmonica practice to note memorization:

- reading standard notation;
- learning where pitches are available on a particular harmonica;
- playing melodies with accurate pitch, rhythm, duration, and intonation;
- finding melodies by ear in absolute or relative form;
- learning songs with all required guidance visible;
- developing rhythmic control;
- improvising inside scales, motifs, and changing musical constraints;
- building a personal repertoire and a visible practice history.

The current static GitHub Pages application is the correct place to finish the core interaction, notation, sound recognition, and visual design. Accounts, cloud persistence, user-created libraries, achievements, and community features come after the local product is demonstrably pleasant and correct.

---

## 2. Current state

The application already has working versions of:

- Find a note;
- Play the score;
- Play by ear;
- Rhythm training;
- Learn a song;
- microphone pitch detection and note segmentation;
- a persistent virtual harmonica during microphone use;
- explicit 10-hole and 12-hole C chromatic profiles;
- independent staff and harmonica note labels;
- letter-name and solfège display;
- sampled harmonica playback;
- a card-based built-in song library;
- static GitHub Pages deployment.

The two largest remaining quality problems are not missing modes. They are the two visual objects at the center of every mode:

1. **The staff is hand-engraved by application code and is not sufficiently correct or polished.**
2. **The virtual harmonica is still an HTML control grid that only loosely resembles a real instrument.**

These are the immediate focus. All cloud and social work is deferred until they are solved.

---

## 3. Visual direction reset

### Decision: light-first, clean, legible design

The earlier dark-neon direction is no longer a product requirement. It helped establish a game-like identity, but it also encouraged low-contrast text, heavy black surfaces, artificial glow, and a virtual instrument that feels less like a harmonica.

The next design experiments should use a **light-first baseline**:

- light neutral or warm-gray background;
- dark, high-contrast musical notation;
- restrained metallic or pearl surfaces for the instrument;
- generous whitespace;
- clear typography;
- colored duration ribbons, active-note fills, pitch traces, and feedback as focused accents;
- glow only where it communicates state, never as a substitute for contrast.

A future optional dark theme remains possible, but the redesign should first prove itself in a clean, bright presentation.

### Rejected concept direction

Do not repeat the first generated instrument concept:

- very dark gunmetal body;
- cyan-purple neon as the dominant material treatment;
- strong perspective with one end much larger than the other;
- dramatic product-shot angle that makes interactive geometry hard to map.

That image is not a production asset and should not be committed.

### Desired instrument-art direction

- near-orthographic front/top three-quarter view;
- only a small amount of perspective;
- all holes remain close to equal apparent width;
- the mouthpiece and every hole are clearly visible;
- the physical slide button is clearly visible at the right;
- bright brushed stainless steel, satin silver, pale pearl, or another clean material;
- no visible third-party logo or copied brand text;
- transparent or very light neutral background;
- suitable for deterministic SVG hit zones and animation overlays.

Easttop 4Runner (12-hole) and Easttop 1040 (10-hole) may be used as physical references for proportions and slide placement. The final asset should remain generic and should either be based on an owner-supplied photograph or on newly generated art with clean provenance.

---

# Part I — immediate two-stage redesign

## 4. Stage A: isolated design laboratories

### Goal

Produce evidence and reviewed visual prototypes without replacing the production staff or production virtual harmonica.

### Non-goals

During this stage, do not:

- rewrite exercise logic;
- remove the current production components;
- redesign every screen simultaneously;
- move to Cloudflare;
- add accounts, achievements, or user libraries;
- build a notation editor;
- commit an AI-generated concept directly as a final production asset.

The laboratories may be committed to `main` behind explicit lab routes because they are isolated and statically deployable.

---

## 5. Staff-design laboratory

Create `/lab/staff-design`.

The laboratory renders the same deliberately difficult fixture through multiple approaches so that engraving quality, temporal readability, overlays, scrolling, and mobile behavior can be compared directly.

### 5.1 Required variants

1. **Current custom renderer**
   - baseline only;
   - preserve long enough to compare and establish migration parity.

2. **abcjs standard engraving**
   - conventional paper-like spacing;
   - standard measures and line wrapping;
   - active-note highlighting only.

3. **abcjs time-based layout**
   - horizontal spacing proportional to musical duration;
   - no game overlay at first.

4. **abcjs time-based layout plus gameplay overlay**
   - duration ribbons;
   - fixed judgment line;
   - active-note progress;
   - pitch trace;
   - correct/incorrect performed-note history.

5. **abcjs standard engraving plus gameplay highlighting**
   - conventional score layout;
   - active element and elapsed-duration fill;
   - automatic movement to the next system.

### 5.2 Required musical fixture

Use one fixture collection that exposes failures rather than a simple C-major scale. It must contain:

- explicit sharps, flats, and naturals;
- a key signature whose accidentals are not repeated beside every note;
- whole, half, quarter, eighth, dotted, and shorter values already supported by exercises;
- corresponding rests;
- beamed groups;
- a tie inside a measure;
- a tie across a barline;
- repeated notes separated by articulation;
- barlines and multiple measures;
- 4/4 and 6/8 examples;
- a pickup measure;
- low and high ledger-line notes in the supported harmonica range;
- enough measures to require horizontal movement or system scrolling;
- at least one melody from the built-in song library.

### 5.3 abcjs direction

**Decision:** use abcjs as the notation engraver unless the laboratory exposes a specific blocking limitation.

The installed dependency is already available in the application. The production redesign should first use documented public functionality:

- `renderAbc()` for engraving;
- `add_classes: true` for styling and element association;
- `timeBasedLayout` for a duration-proportional horizontal timeline;
- `TimingCallbacks` for beat, event, and line-end synchronization;
- `responsive`, `wrap`, or horizontal viewport options as appropriate;
- click and drag support only in later melody-editing work.

Do not fork abcjs before proving that the required result cannot be achieved with public render options and an application-owned overlay.

Pin the tested abcjs version. Any use of the returned visual-object internals must be isolated behind one adapter because abcjs documents that internal return structures are not guaranteed to remain backward compatible.

### 5.4 Two user-facing notation modes

The laboratory is expected to validate two modes, not force one layout onto all users.

#### Timeline Staff — default learning mode

Purpose: maximize temporal legibility for beginners and guided performance.

- abcjs engraves correct notation;
- `timeBasedLayout` makes horizontal distance proportional to duration;
- the current duration ribbon idea is preserved;
- a fixed judgment line sits around 35–40% of viewport width;
- music moves under the line continuously;
- several previous and upcoming notes remain visible;
- the active ribbon visibly shows how long to hold;
- standard note values remain visible and correct instead of being replaced by ribbons;
- ties can continue one sounding ribbon across separate written notes;
- performed pitch and timing appear on a separate overlay.

This is the preferred default for Find a note, Rhythm training, Learn a song, and beginner score practice.

#### Engraved Score — conventional reading mode

Purpose: support musicians who already read notation and want conventional spacing.

- abcjs uses ordinary score layout;
- measures and systems look like printed music;
- active notes are highlighted;
- elapsed duration may be shown as a restrained fill or underline;
- the view scrolls or changes systems near the line end;
- duration ribbons are optional or much less prominent.

This should be available in Play the score and may be exposed elsewhere as a display preference.

### 5.5 Written events and sounding events

The current simplified melody model should not be stretched until it pretends to be a full notation parser.

Introduce a deliberate distinction:

```ts
interface WrittenMusicEvent {
  id: string;
  kind: "note" | "rest";
  writtenPitch?: WrittenPitch;
  startBeat: number;
  durationBeats: number;
  measureIndex: number;
  tie?: "start" | "continue" | "end";
  sourceRange?: { start: number; end: number };
}

interface SoundEvent {
  id: string;
  midi: number;
  startBeat: number;
  durationBeats: number;
  writtenEventIds: string[];
}
```

A note tied across a barline may be two written events but one sound event. Engraving uses written events; playback, scoring, and a continuous hold ribbon use sound events.

### 5.6 ABC as melody source of truth

For built-in and future user melodies:

```text
ABC source
   ↓
abcjs parse / render
   ↓
AbcAdapter
   ├── written event mapping
   ├── sounding event mapping
   ├── SVG/event association
   └── diagnostics and validation
   ↓
exercise engine / playback / scoring / overlays
```

The adapter must be one tested boundary. Exercise and scoring code must not query arbitrary abcjs SVG internals throughout the app.

### 5.7 Staff-lab deliverables

- route and fixture selector;
- all five render variants;
- desktop screenshots;
- phone portrait screenshots;
- phone landscape screenshots where useful;
- measured render width and scroll behavior;
- notes on ties, accidentals, beams, barlines, responsive behavior, and overlay alignment;
- recommendation with rejected alternatives;
- no production `GameStage` replacement yet.

### 5.8 Staff-lab acceptance questions

The owner should be able to answer visually:

- Are accidentals, key signatures, rests, beams, ties, and bars unmistakably correct?
- Is Timeline Staff easier to follow than conventional notation?
- Does the ribbon add information without hiding standard notation?
- Does the fixed judgment line feel natural?
- Is the conventional mode readable and calm?
- Are mobile notes large enough?
- Does motion remain smooth rather than jumping between notes?

---

## 6. Harmonica-design laboratory

Create `/lab/harmonica-design`.

The laboratory explores the visual asset, geometry, hit zones, responsive behavior, and state animations without replacing the production component.

### 6.1 Decision: hybrid visual model

Use a hybrid of:

- a clean raster or SVG base for the physical body and material;
- deterministic SVG/HTML geometry for hit zones;
- a separately animated slide button;
- application-owned overlays for guidance, microphone detection, pressed state, airflow, correct state, and error state.

A flat photograph alone is insufficient because it cannot reliably provide responsive hit geometry, state-specific lighting, separate 10-hole/12-hole variants, or a moving slide. A pure HTML table is also insufficient because it does not look like an instrument.

### 6.2 Projection

Use near-orthographic front/top three-quarter projection:

- the instrument stays mostly horizontal;
- left and right ends have similar apparent scale;
- all mouthpiece holes are visible;
- the top cover establishes physical realism;
- the mouthpiece face provides a stable plane for interaction;
- the right slide button and rod are visible;
- no dramatic diagonal recession.

### 6.3 Direct-action geometry

One press must continue to represent the complete action: hole, breath, and slide state.

The strongest candidate embeds four direct-action regions into every visible physical hole:

```text
┌───────────────────┐
│ blow / slide out  │ blow / slide in
├───────────────────┤
│ draw / slide out  │ draw / slide in
└───────────────────┘
```

This is interaction geometry, not a visible spreadsheet. At rest:

- divisions are subtle;
- the object still reads as one physical mouthpiece;
- full labels may be hidden;
- hover, focus, guided, or learning-label states reveal more structure.

Alternative overlay treatments may be compared in the lab, but no design may require pressing a separate slide control before pressing the hole.

### 6.4 Slide animation

The slide is a separate visual object with at least two positions:

- released: knob outside the body and rod visibly extended;
- pressed: knob moves toward the body, rod shortens, and shadow/contact state changes.

Rules:

- virtual direct action with `slide: in` presses it;
- virtual direct action with `slide: out` releases it;
- guided mode animates the recommended action;
- microphone input only animates the slide when every matching action agrees on slide state;
- if microphone matches include both states, highlight all valid zones and leave the physical slide neutral rather than claiming knowledge the microphone cannot provide.

### 6.5 Breath and state animation

Use restrained, informative motion:

- blow: a soft outward airflow cue;
- draw: a soft inward airflow cue;
- pressed action: inner-hole illumination and a small material response;
- guided target: calm pulsing outline;
- microphone detected: a distinct outer trace or halo;
- correct: clean short confirmation pulse;
- incorrect: restrained shake or broken outline;
- do not rely on color alone.

### 6.6 10-hole and 12-hole assets

Both profiles must share one visual language. The lab should compare:

- two separately generated base assets with identical camera and material;
- one parameterized body assembled from end caps, a repeatable center section, mouthpiece holes, and a shared slide.

The parameterized approach is preferable if it remains visually coherent. Two separate assets are acceptable if they look materially identical and their interactive geometry is generated from the same profile data.

The typed profile remains the source of truth. Art must never encode musical mapping.

### 6.7 AI-assisted asset process

AI generation is encouraged for concepting and may provide production base art, but it must be constrained by geometry and reviewed before use.

Generate at least three light concepts:

1. brushed stainless steel on transparent/light background;
2. satin pearl/silver body with restrained colored accents;
3. clean product-illustration hybrid with slightly simplified surfaces.

Every concept must have:

- correct hole count;
- no logos or invented text;
- near-orthographic projection;
- minimal perspective distortion;
- clearly separated slide button;
- clean silhouette;
- no hands, case, cloth, or other objects;
- sufficiently high resolution for 2× displays.

Reject and regenerate any image with:

- wrong number or malformed holes;
- hidden mouthpiece openings;
- warped or duplicated slider hardware;
- strong diagonal recession;
- dark-black/neon-dominant material;
- baked-in highlights that conflict with interactive state overlays;
- brand marks or unreadable pseudo-text.

### 6.8 Owner-supplied photo option

An owner photograph is the strongest provenance source and may be used directly or as generation/reference input.

Recommended capture set:

- 12-hole Easttop 4Runner and, if available, 10-hole Easttop 1040;
- neutral light-gray or white background;
- diffuse daylight or two soft lights;
- camera farther away with a moderate telephoto/2× lens to reduce perspective;
- instrument level and nearly horizontal;
- front/top three-quarter view;
- front mouthpiece view;
- top view;
- right-side slide released;
- right-side slide pressed;
- no hand in the final frame;
- highest available resolution;
- one measurement or ruler reference outside the production crop.

### 6.9 Harmonica-lab states

The lab must display, for 10-hole and 12-hole versions:

- idle;
- labels off;
- labels on;
- blow/out active;
- blow/in active;
- draw/out active;
- draw/in active;
- slider released;
- slider pressed;
- guided target;
- microphone detection with one mapping;
- microphone detection with multiple mappings;
- correct feedback;
- incorrect feedback;
- desktop;
- phone portrait with horizontal scrolling;
- phone landscape.

### 6.10 Harmonica-lab deliverables

- chosen visual-art family;
- transparent source assets;
- exact normalized hit-zone geometry;
- animation prototype;
- 10/12 scaling proof;
- desktop and mobile screenshots;
- accessibility and keyboard plan;
- notes on asset license/provenance;
- recommendation with rejected alternatives;
- no production replacement yet.

### 6.11 Harmonica-lab acceptance questions

- Does it immediately look like a real chromatic harmonica?
- Can every hole be distinguished without zooming?
- Is the projection useful rather than merely dramatic?
- Can the user understand direct actions after a short introduction?
- Does the slider visibly press and release?
- Are guided and detected states distinguishable?
- Is the instrument still comfortable on a phone?
- Does the bright design fit the staff and the rest of the UI?

---

## 7. Stage A verification and owner gate

The agent should run automated tests and inspect browser screenshots, but production migration is blocked on owner visual approval.

Required Stage A output:

- lab URLs;
- exact commit SHA;
- screenshot index;
- fixture descriptions;
- comparison table;
- technical limitations;
- recommended staff variant;
- recommended instrument variant;
- explicit list of decisions still requiring owner choice.

No agent should interpret “laboratory works” as approval to replace production components automatically.

---

## 8. Stage B: production implementation after approval

Only after Stage A approval:

1. Introduce `AbcStaffRenderer` and the tested `AbcAdapter`.
2. Add Timeline Staff and Engraved Score preferences.
3. Port duration ribbons, fixed playhead, pitch trace, performed-note history, hidden-note slots, and feedback overlays.
4. Route all production modes through the canonical written/sound event model.
5. Introduce the approved visual harmonica component and assets.
6. Preserve typed 10-hole/12-hole mappings and ambiguity-safe microphone highlighting.
7. Remove the old custom glyph renderer only after feature and regression parity.
8. Remove the old HTML-grid visual implementation only after direct-action and accessibility parity.
9. Run the complete unit, benchmark, browser, production, desktop, phone, and real-instrument acceptance set.
10. Deploy a release candidate to GitHub Pages for owner testing.

### Production acceptance

The owner performs the final checks with a real harmonica:

- notation correctness and readability;
- Timeline rhythm guidance;
- Engraved Score readability;
- real microphone tracking;
- slider animation plausibility;
- touch geometry on phone;
- mode-by-mode progression;
- overall light visual system.

---

# Part II — deferred platform roadmap

## 9. Cloudflare migration and persistence

Status: **Deferred until the visual and musical core is approved.**

The static client should be prepared through interfaces, not prematurely moved.

### 9.1 Adapter boundaries to introduce before migration

```ts
interface MelodyRepository {
  list(query?: MelodyQuery): Promise<MelodySummary[]>;
  get(id: string): Promise<MelodyDocument>;
  save?(document: MelodyDocument): Promise<MelodyDocument>;
}

interface ProgressStore {
  loadProfile(): Promise<PlayerProfile>;
  loadProgress(): Promise<UserProgress>;
  appendSession(session: PracticeSession): Promise<void>;
  saveSettings(settings: PlayerSettings): Promise<void>;
}

interface AuthProvider {
  getSession(): Promise<AuthSession | null>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}
```

The current implementations remain static/local. A later Cloudflare deployment replaces adapters rather than exercise logic.

### 9.2 Likely Cloudflare responsibilities

To be validated when this phase begins:

- Workers for API and authorization boundaries;
- D1 for users, melody metadata, revisions, progress, sessions, and achievements;
- R2 for user audio fixtures, optional backing tracks, exported files, and larger melody assets;
- KV only for suitable caches or configuration, not canonical progress;
- Durable Objects only if a future real-time collaborative editor creates a genuine coordination need.

### 9.3 Authentication scope

Start with simple account creation/sign-in sufficient to synchronize progress and user melodies. Do not let authentication dominate the product.

Research before implementation:

- passwordless email/magic link;
- OAuth providers;
- anonymous local profile upgraded to an account;
- data export and account deletion;
- abuse prevention for public melody publishing.

### 9.4 Offline-first behavior

The current local-first character is valuable and should remain:

- exercises continue without network;
- settings and unfinished sessions save locally;
- synchronization is retryable and idempotent;
- conflicts in user melody editing create explicit revisions rather than silent overwrite;
- audio is not uploaded unless the user intentionally saves or submits it.

---

## 10. Melody library and authoring

Status: **Deferred product phase after persistence.**

### 10.1 Library

The future library should contain:

- built-in curated melodies;
- private user melodies;
- optionally published community melodies;
- difficulty and instrument-range metadata;
- tags, composer/source, meter, tempo, key, and estimated practice duration;
- transposition/range compatibility for 10-hole and 12-hole profiles;
- revisions and provenance;
- favorites, recent practice, and completion state.

### 10.2 Initial authoring experience

Do not begin by building a full graphical score editor.

The first authoring version should be:

- ABC text editor;
- live abcjs preview;
- parse diagnostics tied to source ranges;
- instrument-range validation;
- monophony validation for supported exercise modes;
- tempo, title, composer, key, and difficulty metadata;
- playback preview;
- save as draft;
- explicit revision history.

### 10.3 Later direct manipulation

A limited direct editor may later support:

- dragging a note vertically to change pitch;
- selecting a note and choosing duration;
- inserting or deleting a note/rest;
- moving a note in time within a simple monodic measure;
- changing ties and barlines through constrained controls.

abcjs can provide selection and visual dragging, but dragging does not mutate the underlying ABC. The application must translate the drag into an ABC source edit and rerender. That is preferable to writing a complete engraver/editor from scratch.

### 10.4 Alternative input from the harmonica

A useful later authoring mode can record a monophonic phrase from:

- the virtual instrument;
- microphone-detected real harmonica;
- step input without rhythm;
- timed input with quantization.

The result is converted to editable ABC with explicit confidence and quantization controls.

---

# Part III — improvisation game backlog

## 11. Improvisation as a first-class mode

Status: **Detailed backlog; not part of the immediate redesign.**

Improvisation should eventually become one of the most distinctive parts of the product. Harmonica practice should not be limited to identifying notes and reproducing existing melodies. The instrument is strongly associated with spontaneous phrasing, exploration, and playing what comes to mind.

The inspiration includes the former **Harmonica Scale Finder** site: a large visual catalogue of scales and alternate harmonica tunings that made it easy to see where a bebop, gypsy, harmonic, blues, or other scale lay on the instrument and immediately improvise with it.

### 11.1 Research task

Before implementing the mode:

- recover the user’s saved copy from disk if available;
- search web archives for the historical Harmonica Scale Finder;
- record its scale catalogue, filters, visual strengths, and limitations;
- verify scale formulas through independent music-theory sources;
- avoid copying protected site code or artwork;
- treat it as product inspiration and a data-recovery lead.

### 11.2 Scale-domain model

A scale definition should not be a static screenshot. Model it explicitly:

```ts
interface ScaleDefinition {
  id: string;
  name: string;
  aliases: string[];
  intervalSemitones: number[];
  degreeLabels?: string[];
  tags: string[];
  family?: string;
  description?: string;
}

interface ScaleContext {
  scaleId: string;
  tonicMidiClass: number;
  profileId: string;
  minMidi: number;
  maxMidi: number;
}
```

The system maps scale pitch classes into every playable action of the selected harmonica profile and can show:

- tonic;
- chord tones;
- other scale tones;
- repeated physical positions;
- unavailable degrees in the selected range;
- bends and alternate techniques later.

### 11.3 Improvisation experience layers

#### A. Scale explorer

No score and no failure state.

- choose tonic and scale;
- see all matching positions on the virtual instrument;
- play freely through microphone or touch;
- see the current scale degree;
- optional drone or metronome;
- out-of-scale notes are shown, not punished;
- save favorite scale/profile combinations.

#### B. Free improvisation with a soft boundary

- choose scale and tempo;
- app tracks whether notes remain inside the scale;
- show phrase length, rests, repetition, register, and rhythmic density;
- no single “correct melody”;
- session summary describes behavior rather than assigning a simplistic musical-quality score.

#### C. Constraint cards

The application generates one temporary rule at a time. Examples:

- do not repeat the previous pitch;
- use only three selected scale degrees;
- end the phrase on the tonic;
- begin away from the tonic;
- move in one direction, then reverse;
- include one leap larger than a third;
- avoid adjacent scale steps for one bar;
- use the same note no more than twice;
- stay in the low register;
- move to the high register in the next phrase;
- leave one full beat of silence;
- answer with fewer notes than the prompt;
- answer with more notes than the prompt.

These rules turn improvisation into a game without prescribing the exact notes.

#### D. Rhythm imitation, pitch variation

- application plays or shows a rhythmic figure;
- user repeats the rhythm but chooses different scale pitches;
- scoring checks onset/duration similarity and scale membership, not exact pitch;
- advanced versions allow ornamentation while preserving the rhythmic skeleton.

#### E. Pitch-cell preservation, rhythm variation

- application gives one note, interval, or short pitch cell;
- user keeps the pitch material but invents a new rhythm;
- the next round may require augmentation, diminution, syncopation, or inserted rests.

#### F. Call and response

- application generates a short phrase inside the selected scale;
- user answers rather than copies;
- response constraints may require:
  - same rhythm, different pitches;
  - same contour, new rhythm;
  - contrary contour;
  - end on a chosen degree;
  - reuse a motif exactly once;
  - shorten or extend the phrase.

#### G. Guided generative improvisation

The application can “improvise for the player” one choice at a time:

- suggest the next scale degree;
- suggest direction rather than an exact note;
- suggest a rhythmic cell;
- generate a complete phrase to perform;
- gradually remove guidance as the player succeeds.

This supports players who want to improvise but do not yet know how to begin.

#### H. Scale transitions

Advanced missions introduce a new harmonic or modal context:

- improvise in one scale for several bars;
- switch tonic while retaining the same interval pattern;
- switch from one scale family to another;
- pivot through a common pitch;
- land on a target tone after the switch;
- alternate two scales on a fixed schedule;
- react to an unexpected but clearly announced change.

The visual system should show the transition without instantly revealing a complete optimal phrase.

### 11.4 Game-rule engine

Represent prompts as composable constraints rather than hard-coded screens:

```ts
interface ImprovisationConstraint {
  id: string;
  description: string;
  appliesTo: "note" | "phrase" | "rhythm" | "transition";
  evaluate(context: ImprovisationContext): ConstraintResult;
}
```

A mission can combine:

- one scale context;
- one rhythmic constraint;
- one pitch constraint;
- one phrase-shape goal;
- one transition rule.

Difficulty changes the number, strictness, and duration of constraints.

### 11.5 Feedback philosophy

Do not claim to judge whether an improvisation is artistically “good.” Score observable goals:

- scale membership;
- adherence to the current constraint;
- timing relative to pulse;
- duration control;
- requested motif use;
- phrase start/end goal;
- requested register or direction;
- successful scale transition;
- variety over time when variety is explicitly requested.

Also report descriptive metrics:

- pitch-class distribution;
- most-used degree;
- range;
- average phrase length;
- silence ratio;
- rhythmic density;
- repeated-note ratio;
- interval distribution;
- contour changes.

### 11.6 Backing context

Later additions may include:

- drone;
- metronome;
- simple chord loop;
- generated bass pulse;
- curated backing tracks with clear licensing;
- harmonic changes that update valid/target tones.

The first version should not require generative audio or a complex accompaniment engine.

### 11.7 Improvisation-mode progression

A possible progression:

1. find and play one scale;
2. stay in scale for 20 seconds;
3. make two-note phrases;
4. add rests;
5. vary rhythm on one note;
6. vary pitch with one rhythm;
7. answer a phrase;
8. obey one constraint;
9. obey two compatible constraints;
10. move between registers;
11. target chord tones;
12. switch scales;
13. complete longer free missions.

---

## 12. Achievements and progression

Status: **Deferred until persistent progress exists, but the event model should be designed before implementation.**

Achievements should reward meaningful practice rather than arbitrary clicking.

### 12.1 Event model

Exercise modes should eventually emit normalized events such as:

```ts
type PracticeEvent =
  | { type: "note-accepted"; mode: Mode; pitch: number; timingMs?: number }
  | { type: "phrase-completed"; mode: Mode; difficulty: number; score: ScoreBreakdown }
  | { type: "song-completed"; melodyId: string; difficulty: number; assisted: boolean }
  | { type: "ear-phrase-found"; relative: boolean; transposition?: number; attempts: number }
  | { type: "improvisation-session"; durationMs: number; constraintsPassed: string[] }
  | { type: "practice-session-ended"; durationMs: number; activeDays: number };
```

The achievement engine consumes events and remains separate from exercise logic.

### 12.2 Achievement families

#### Repertoire

- complete the first melody;
- complete melodies at increasing difficulty;
- complete a melody without visible note labels;
- complete a melody in time;
- complete a melody with high pitch and rhythm accuracy;
- complete songs across several keys or ranges when transposition is available.

#### Speed and precision

- accurately perform a fast phrase;
- maintain timing over a longer run;
- hold a difficult sustained note steadily;
- complete a phrase with tight onset and release tolerances;
- perform a chromatic passage without errors.

#### Ear training

- find the first relative phrase;
- find a phrase in a transposed starting position;
- find an absolute phrase;
- solve longer or more complex phrases;
- reduce attempts over repeated sessions;
- correctly identify difficult intervals.

#### Rhythm

- complete the first rhythm pattern;
- accurately perform rests and releases;
- complete syncopated or compound-meter patterns;
- maintain pulse through a long phrase;
- reproduce a rhythm while changing pitches.

#### Improvisation

- improvise continuously for 1, 5, 10, 20, 30, and 60 minutes cumulatively or in suitable sessions;
- remain in a chosen scale;
- pass constraint missions;
- complete call-and-response missions;
- use several scale families;
- make a successful scale transition;
- demonstrate requested rhythmic or pitch variation.

#### Practice habit

- practice on several distinct days;
- maintain a humane streak;
- return after a break;
- accumulate active practice time;
- balance several skill areas.

Streak mechanics should avoid punishing the player or encouraging meaningless activity. “Come back” and flexible weekly goals may be healthier than a single fragile daily streak.

### 12.3 Achievement integrity

- distinguish assisted and unassisted completion;
- do not award speed achievements from virtual playback or reference audio;
- use normalized verified exercise results;
- tolerate offline sessions and reconcile them idempotently;
- allow local progress export;
- make achievement definitions data-driven and versioned.

---

## 13. Suggested milestone sequence

### M10 — Staff and harmonica design laboratories

- `/lab/staff-design`;
- `/lab/harmonica-design`;
- light-first visual experiments;
- abcjs comparison;
- generated/photo-based instrument concepts;
- reviewed screenshots;
- owner design decision.

### M11 — Production notation migration

- AbcAdapter;
- written/sound event split;
- Timeline Staff;
- Engraved Score;
- gameplay overlays;
- parity and migration tests.

### M12 — Production visual harmonica

- approved base art;
- deterministic interaction geometry;
- animated slider;
- state overlays;
- 10/12 responsive variants;
- real-instrument owner acceptance.

### M13 — Core product hardening

- full mode walkthroughs;
- song data validation;
- real-device latency and microphone tuning;
- accessibility pass;
- polished light theme;
- curated melody expansion;
- stable GitHub Pages release.

### M14 — Persistence foundations

- local repository/store interfaces;
- Cloudflare architecture decision;
- authentication prototype;
- D1 schema;
- synchronization model;
- privacy/export/delete design.

### M15 — User melody library

- account-backed private melodies;
- ABC editor and preview;
- revisions;
- range validation;
- publishing model if approved.

### M16 — Progression and achievements

- normalized practice events;
- progress summaries;
- achievement engine;
- repertoire and habit tracking.

### M17 — Improvisation game

- scale catalogue;
- scale explorer;
- constraint engine;
- rhythm/pitch transformation missions;
- call and response;
- scale-transition missions;
- improvisation progression and achievements.

---

## 14. Explicit current non-goals

Until M10–M13 are accepted, do not begin:

- backend migration;
- login UI;
- public user profiles;
- achievements UI;
- community melody publishing;
- a complete graphical notation editor;
- collaborative editing;
- AI-generated accompaniment;
- social leaderboards;
- monetization.

These features are not rejected. They are sequenced behind the core instrument experience.

---

## 15. Decision log

### Accepted

- Preserve the duration-ribbon idea.
- Use professional notation engraving rather than continuing a custom glyph system.
- Try abcjs public capabilities before considering a fork.
- Support both Timeline Staff and conventional Engraved Score.
- Keep ABC as the canonical melody-authoring format for the foreseeable future.
- Use a hybrid visual harmonica: realistic base art plus deterministic interactive overlay.
- Preserve one-press direct actions; never require pressing the physical slide control first.
- Animate the visible physical slide to explain slide state.
- Continue ambiguity-safe microphone highlighting.
- Move the next design direction toward light, clean, and high-contrast presentation.
- Finish the static/local product before Cloudflare persistence work.
- Treat improvisation as a major future mode rather than a minor scale-reference screen.

### Experiments still required

- exact Timeline Staff density and playhead location;
- exact ribbon shape and progress behavior over ties;
- best conventional-score scrolling behavior;
- best base-art material and projection;
- quadrant hit zones versus another equally direct hole-integrated overlay;
- parameterized versus separate 10-hole/12-hole base assets;
- how much instructional labeling is visible by default;
- whether the light redesign should retain an optional dark theme.

### Deferred decisions

- authentication provider;
- exact Cloudflare data architecture;
- public community library and moderation;
- graphical editor scope;
- backing-track system;
- scale catalogue source and licensing;
- achievement thresholds and final names.
