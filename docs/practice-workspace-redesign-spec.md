# Harmonica Trainer compact practice workspace specification

Status: **binding specification for the next deployed production iteration**  
Scope: **practice-screen information architecture, Song Practice consolidation, notation-integrated transport and feedback, mistake-policy clarity, and sampled-harmonica playback reliability**

The previous functional iteration substantially improved microphone recognition and introduced real practice engines. Owner testing now shows that the underlying behavior is usable, but the interface does not explain that behavior well and wastes a large amount of space through many unrelated full-width blocks.

This iteration must make the practice experience compact, coherent and visually legible without reopening the colour system, notation engraving, harmonica geometry, microphone detector or backend roadmap.

---

## 1. Owner-observed problems

### Layout and information architecture

Practice pages are currently assembled as a vertical stack of full-width bordered strips:

- Learn / Practice / Perform preset strip;
- Step / In time plus mistake policy strip;
- song selection plus tempo strip;
- separate Position transport strip;
- Timeline / Score strip;
- microphone enable strip;
- instrument and learning-aid strips.

Most strips contain only one or two compact controls while occupying the full page width. The empty area is not useful breathing room around content; it is dead space caused by an arbitrary block layout. Controls that belong together are separated, while controls with weak logical relationships are grouped together.

The redesigned page must be:

- compact;
- rhythmically spaced;
- aligned to a consistent grid;
- visually balanced;
- grouped by task and consequence;
- readable without scrolling past several control-only panels before reaching the musical content.

### Presets

Learn and Practice appear functionally identical. Perform is distinguishable only because it switches to real-time playback. Presets mostly duplicate ordinary settings and hide their effects.

### Transport

The separate Position slider is visually disconnected from the score. The notation already represents musical time and should be the primary seek/navigation surface. The user cannot easily tell where the transport is on the score.

### Feedback

- Correct pitch and held duration can advance the engine, but progress is not obvious on the score.
- A wrong pitch is drawn, but it is not explicitly marked as wrong.
- The target does not clearly communicate that progress stopped.
- Pause and continue and Restart note appear identical.
- Restart measure moves backward, but the UI does not say exactly why or what was reset.

### Playback

Reference playback no longer sounds recognizably like the sampled harmonica. The repository still contains the samples and `PlaybackEngine` still has a sampled path, so the release must diagnose and repair the actual production path rather than replacing it with another oscillator.

---

# Part I — product decisions

## 2. One Song Practice mode

Remove the separate product concepts **Play the score** and **Learn a song**.

Replace both main-menu entries with one entry:

### Practice a song

> Choose a song, decide how much guidance you want, and practise one note at a time or play it in tempo.

Use one internal mode, one song picker, one transport, one result model and one screen.

Old internal `score` / `guided` state may be migrated during the implementation, but no duplicate engine or duplicate menu card may remain after parity.

## 3. Remove Learn / Practice / Perform presets

Delete the user-facing preset selector and the preset-specific product state.

The same capabilities become explicit controls:

- **Practice behavior**
  - Wait for me
  - In time

- **Guidance**
  - Show harmonica fingering
  - Show staff note names
  - Show harmonica note names

- **Notation layout**
  - Timeline
  - Score

- **Mistake response** — Wait for me only
  - Keep note progress
  - Restart current note
  - Restart current measure

- **Tempo**

This makes every effect visible instead of requiring the user to infer what a preset changed.

Suggested initial Song Practice defaults:

- Wait for me;
- Timeline;
- harmonica fingering on;
- staff names off;
- harmonica names off;
- Keep note progress;
- current song tempo.

Persist explicit settings, not a preset name.

## 4. Rename Step

Use the user-facing label **Wait for me** instead of **Step**.

Semantics:

- the exercise advances only after the required pitch and duration are completed;
- wrong input never skips a target;
- once microphone or Touch input is active, the exercise is armed without a separate Start Step button;
- provide compact Pause / Resume and Restart controls;
- if microphone permission is not enabled, the primary action is Enable microphone.

**In time** remains clock-driven and starts through an explicit count-in.

---

# Part II — compact workspace design

## 5. Page hierarchy

Practice pages use this hierarchy:

```text
application header
mode title + current feedback
compact control dock
music stage with integrated transport
harmonica stage
compact instrument/input/learning controls
review or diagnostics only when relevant
```

The music stage is the dominant object. Controls support it; they do not form a stack of equally prominent cards.

## 6. Control dock

Create reusable primitives such as:

```text
PracticeWorkspace
ControlDock
ControlGroup
CompactField
OverflowMenu / Popover
```

Names may differ.

### Desktop

A single compact dock, wrapping to at most two rows at ordinary laptop width, should contain:

- current song and Change song;
- Wait for me / In time;
- tempo;
- Timeline / Score;
- a concise Guidance control;
- mistake response when applicable;
- reference Listen;
- primary transport action when applicable.

Use proximity, separators, alignment and shared baseline—not separate full-width bordered panels—to establish grouping.

### Phone

- controls wrap into a compact two-column or one-column arrangement;
- advanced settings move to labelled popovers/drawers;
- no horizontal page overflow;
- no tiny labels;
- the staff remains visible without scrolling through multiple control cards.

### Geometry and rhythm

Use a consistent spacing scale, for example 4 / 8 / 12 / 16 / 24 px.

All ordinary compact controls should share consistent heights and radii. Align labels, values and icons. Avoid arbitrary widths.

### Full-width elements

Only elements that genuinely use the width should span the content area:

- notation;
- a timeline/progress surface when integrated with notation;
- harmonica;
- review tables/graphs.

A pair of buttons, one select or one CTA must not receive its own full-width card.

## 7. Advanced settings

Controls not used every session should live in a clearly labelled popover/drawer, not permanently consume vertical space.

Examples:

- note-name system;
- detailed guidance toggles;
- strict intonation;
- microphone sensitivity/device;
- less common mistake policy explanations.

The current state must remain visible in a concise summary, for example:

```text
Guidance: harmonica
Mistakes: keep progress
Input: microphone
```

---

# Part III — notation is the transport

## 8. Remove the separate Position block

Delete the standalone full-width Position range panel from normal practice layout.

The score/timeline itself is the primary transport surface.

An accessible range input may remain visually hidden or be exposed in a compact transport popover as a keyboard/screen-reader alternative, but it must not be a separate large visual block.

## 9. Interactive playhead on the notation

Extend `MusicStage` with an interactive transport contract, for example:

```ts
interface MusicTransportOverlay {
  positionBeat: number;
  status: "ready" | "playing" | "paused" | "complete";
  seekable: boolean;
  onSeek(beat: number): void;
}
```

The visible playhead:

- is drawn directly over the staff;
- shows the current musical position;
- has a small draggable handle;
- can be moved by dragging;
- can be moved by clicking/tapping the notation;
- updates the active note, fingering guidance and results scope;
- supports keyboard seeking through an accessible control;
- respects reduced motion.

### Timeline layout

- derive beat-to-X and X-to-beat from measured abcjs timeline geometry;
- the playhead moves through the note and its duration ribbon;
- auto-scroll only when needed;
- manual seeking temporarily suspends auto-follow.

### Score layout

Conventional score spacing is not linearly proportional to time. Implement piecewise score mapping:

- identify the selected system from pointer Y;
- map pointer X between measured event/time anchors within that system;
- snap or interpolate to a valid beat;
- render the playhead in the active system;
- follow the next system vertically when transport advances;
- clicking a note seeks to that event;
- no separate disconnected transport slider.

## 10. Compact transport controls

Place a small transport cluster in or directly adjacent to the staff header/footer:

### Wait for me

- Pause / Resume;
- Restart;
- position such as `Measure 2 · beat 3`;
- no Start button once input is ready.

### In time

- Count in + Start;
- Pause;
- Restart;
- current time / total time;
- current measure / beat.

The cluster must not occupy a separate full-width panel.

---

# Part IV — visible musical feedback

## 11. Event states on the score

Introduce explicit render state per written/sounding event:

```ts
type PracticeEventState =
  | "pending"
  | "active"
  | "partial"
  | "correct"
  | "wrong"
  | "missed";
```

The score must show what happened, not rely only on a global text message.

### Active target

- clear active-note treatment;
- target duration ribbon visible;
- held progress fills the ribbon;
- transport line and ribbon agree.

### Correct

- short success pulse/check;
- completed note remains subtly marked;
- playhead advances visibly.

### Wrong pitch

- played pitch is shown at its actual staff height in the error style;
- include an explicit × / error marker, not color alone;
- target remains active;
- playhead/progress visibly stops or resets according to the selected policy;
- concise feedback near the staff, for example:
  - `Played G4 · expected F4`;
  - `Play lower`.

### Early release

- mark where the hold stopped;
- show the percentage or remaining duration when useful;
- state the applied response:
  - `Progress kept at 46%`;
  - `Current note restarted`;
  - `Measure 2 restarted`.

### In time

After the playhead passes an event:

- hit / missed state remains visible on the notation;
- extra notes appear as explicit attempt markers;
- post-run alignment remains authoritative, but the live display must be understandable.

## 12. Distinguish target ribbon and played trace

Target duration and actual input remain separate layers:

- target ribbon: required duration and progress;
- played trace/segment: actual pitch and duration;
- error marker: why the attempt did not count.

Do not make two similar unlabeled bars compete visually.

A small, plain legend may appear in a compact help popover, not as permanent technical text across the staff.

---

# Part V — mistake behavior

## 13. User-facing names

Replace current labels:

- Pause and continue → **Keep note progress**
- Restart note → **Restart current note**
- Restart measure → **Restart current measure**

Each option has a short explanation in its select/popover.

## 14. Exact semantics

### Keep note progress

If 45% of a note was held correctly and the player releases early or plays a wrong pitch:

- progress freezes at 45%;
- target does not advance;
- resuming the correct pitch continues from 45%.

### Restart current note

On a real mistake:

- current note progress returns to 0%;
- playhead returns to the note start;
- earlier completed notes remain completed.

### Restart current measure

On a real mistake:

- active event returns to the first event in the current measure;
- held progress resets;
- completion/result state for events in that measure is cleared;
- previous measures remain completed;
- playhead visibly returns to the measure start.

## 15. What counts as a mistake

Do not reset for a transient microphone dropout that the accepted-note state is designed to tolerate.

A mistake is an explicit domain event such as:

- stable wrong pitch;
- genuine premature release after progress began;
- sound during a rest;
- strict intonation failure when strict mode is enabled.

Every reset must expose an exact reason. Do not show only `wrong input`.

## 16. Tests that prove the difference

Browser/domain tests must simulate:

1. hold the correct note to approximately 50%;
2. introduce the same wrong-pitch or early-release event;
3. assert:
   - Keep retains approximately 50%;
   - Restart note becomes 0% at the same note;
   - Restart measure moves to the measure start and clears only that measure.

The distinction must be visible in notation screenshots as well as state assertions.

---

# Part VI — sampled harmonica playback

## 17. Do not silently regress to the oscillator

The normal instrument must use the locally bundled harmonica samples for:

- Listen / reference playback;
- complete melody playback;
- Touch harmonica playback.

Oscillator fallback may exist only as an explicit degraded state.

## 18. Diagnose the real production failure

Before changing the instrument:

- inspect all live sample URLs;
- verify HTTP status, content length and MIME type;
- decode every sample with Web Audio;
- inspect current `PlaybackEngine.diagnostics` in the deployed app;
- determine whether the failure is fetch, decode, scheduling, cache or a stale rejected preload promise.

Do not replace the existing licensed sample set without evidence.

## 19. Harden `PlaybackEngine`

Required behavior:

- preload/decode before scheduling a melody so initial loading does not collapse scheduled notes;
- track per-zone load state;
- one failed zone does not discard every successfully loaded zone;
- clear/retry a rejected preload promise;
- use the nearest successfully decoded zone;
- expose `loading / sampled / degraded` status;
- show a visible non-blocking warning and Retry action in degraded mode;
- never call the oscillator when a usable sample buffer exists;
- preserve attack, sustain loop and release envelope.

## 20. Playback tests

Add tests that:

- fetch/decode all production sample assets;
- verify `AudioBufferSourceNode` is used when samples are available;
- verify `OscillatorNode` is not used in the healthy path;
- verify a failed preload can retry;
- verify partial sample failure still uses another sampled zone;
- verify `playMelody()` awaits readiness before scheduling;
- verify the live Pages sample URLs and instrument status.

---

# Part VII — compact controls in the other modes

## 21. Apply the shared control layout

Migrate existing mode controls onto the same compact `ControlDock` primitives without changing their exercise semantics.

### Find a note

Primary row:

- Range;
- Notes;
- Listen;
- input status summary.

### Play by ear

Primary row:

- Random phrase / Song excerpt;
- Relative / Absolute;
- Listen;
- New phrase;
- progress.

Secondary actions:

- Hint;
- Reveal;
- Skip;
- phrase settings in a popover.

### Rhythm training

Primary row:

- pattern summary;
- New pattern;
- Listen;
- Wait for me / In time.

Pattern settings such as meter, bars, difficulty and pitch policy belong in one labelled popover, not five permanently visible selects.

This part is a layout migration only. Do not reopen the functional lifecycle implemented in the previous iteration.

---

# Part VIII — architecture and cleanup

## 22. Suggested boundaries

A suitable production structure is:

```text
src/practice-ui/
  PracticeWorkspace.tsx
  ControlDock.tsx
  MusicTransportControls.tsx
  GuidanceControls.tsx
  PracticeFeedback.tsx

src/notation/abc/
  scoreTransportGeometry.ts
  practiceEventState.ts

src/song-practice/
  SongPracticeScreen.tsx
  songPracticeSettings.ts
```

Names may differ. Avoid moving the entire redesign back into `App.tsx`.

## 23. Remove obsolete product code

After parity:

- remove `SongPracticePresetControl`;
- remove `SongGuidancePreset` product state and preset CSS;
- remove duplicate `score` / `guided` engines and UI branches;
- replace them with one Song Practice mode;
- remove the standalone visible Position range panel;
- remove obsolete full-width strip styles;
- keep an accessible seek fallback without reintroducing visual dead space.

---

# Part IX — acceptance and verification

## 24. Desktop acceptance

At approximately 1440 × 900:

- notation appears near the top of the workspace, not after several sparse cards;
- controls before the staff occupy no more than two compact rows;
- no sparse control group receives a separate full-width bordered panel;
- song, behavior, tempo, layout and guidance are logically grouped;
- the staff is visually dominant;
- the harmonica is visible without excessive scrolling in a typical Song Practice screen.

## 25. Phone acceptance

- controls are readable and compact;
- advanced settings collapse cleanly;
- no horizontal page overflow;
- staff and transport handle remain usable;
- touch targets remain accessible;
- the user does not scroll through several empty control panels before reaching notation.

## 26. Required screenshots

Capture and inspect at original size:

- Song Practice, Wait for me, desktop;
- Song Practice, In time, desktop;
- Song Practice, Score layout, desktop;
- Song Practice after a correct note;
- wrong pitch with explicit notation feedback;
- Keep progress after an early release;
- Restart note after the same event;
- Restart measure after the same event;
- draggable playhead at the middle of a song;
- Song Practice phone;
- Find compact dock;
- Ear compact dock;
- Rhythm compact dock;
- sampled-instrument healthy status;
- Light and Dark representative screens.

Perform at least one correction pass after visual inspection.

## 27. Automated verification

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

Add focused tests for:

- one Song Practice menu entry and one implementation;
- no preset selector;
- compact control hierarchy;
- no standalone visible Position panel;
- Timeline and Score pointer-to-beat seeking;
- drag/keyboard seeking;
- Wait for me auto-armed behavior;
- In time count-in;
- event-state rendering;
- exact mistake-policy differences;
- measure-state clearing;
- live wrong-note explanation;
- sampled playback healthy/degraded/retry paths;
- compact mode controls on desktop and phone.

## 28. Deployment gate

After successful local verification:

1. update architecture, README, release and manual-test documentation honestly;
2. create a detailed commit;
3. push `main`;
4. wait for the authoritative GitHub Pages workflow;
5. verify live `build-meta.json` against final `main`;
6. run live production tests;
7. verify live sample assets and sampled-instrument status;
8. leave a clean worktree;
9. stop for owner testing.

---

## 29. Out of scope

Do not implement:

- Cloudflare migration;
- accounts;
- achievements;
- community melody publishing;
- improvisation mode;
- notation editing;
- a new colour system;
- another staff engraving or harmonica-art redesign;
- unrelated feature expansion.

The iteration is complete only when the deployed application has one compact Song Practice experience, notation-integrated seek/progress, unmistakable correct/error/reset feedback, genuinely different mistake policies, and verified sampled harmonica playback.
