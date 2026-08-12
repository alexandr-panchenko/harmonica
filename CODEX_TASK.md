# Active Codex task — compact the practice workspace and integrate transport with notation

Execute this task autonomously from the latest `main` in the local VS Code/Codex environment.

Read completely before editing:

1. [`docs/practice-workspace-redesign-spec.md`](docs/practice-workspace-redesign-spec.md) — binding product/design/acceptance specification;
2. [`docs/functional-practice-spec.md`](docs/functional-practice-spec.md) — existing microphone and practice semantics that must be preserved;
3. [`docs/architecture.md`](docs/architecture.md);
4. [`README.md`](README.md);
5. current application, practice, notation, song-practice, playback, styles, tests and deployment files.

The microphone/transport functional iteration is complete enough for owner testing. This iteration fixes the practice-screen product design and makes that behavior visually understandable.

---

## Mission

Deliver a deployed production release that:

- replaces the stack of sparse full-width control strips with one compact, logically grouped practice workspace;
- consolidates Play the score and Learn a song into one Song Practice mode;
- removes Learn / Practice / Perform presets and exposes their effects as direct settings;
- renames Step to Wait for me and removes the unnecessary Start Step gate once input is ready;
- moves transport position and seeking onto the notation itself;
- gives correct, wrong, partial, missed and reset states explicit feedback on the score;
- makes Keep progress, Restart note and Restart measure visibly and behaviorally different;
- restores and proves sampled-harmonica playback instead of silently falling back to an oscillator;
- applies compact control-dock primitives to Find, Ear and Rhythm without changing their exercise lifecycle;
- preserves the authoritative GitHub Actions Pages deployment and exact build identity.

Do not create laboratory routes. The live application is the acceptance surface.

---

## Required implementation order

### 1. Establish baseline

- fetch latest `main`;
- record starting SHA and live `build-meta.json`;
- reproduce the current sparse Song Practice layout;
- reproduce the current preset behavior and mistake policies;
- inspect current `PlaybackEngine.diagnostics` and live sample URLs;
- capture baseline desktop and phone screenshots.

### 2. Build reusable compact workspace primitives

Implement the `PracticeWorkspace` / `ControlDock` style boundaries from the specification.

- no separate full-width card for one select or two buttons;
- controls group by task and consequence;
- ordinary desktop practice controls fit into at most two compact rows;
- advanced settings move to labelled popovers/drawers;
- music stage is the dominant surface;
- migrate Find, Ear and Rhythm control bars to the same compact primitives without changing their functionality.

### 3. Consolidate Song Practice

- replace the two main-menu entries Play the score and Learn a song with one Practice a song entry;
- use one internal mode, picker, transport and result model;
- remove `SongPracticePresetControl`, `SongGuidancePreset` product state and preset-specific CSS;
- expose direct controls for Wait for me / In time, guidance, Timeline / Score, mistake response and tempo;
- preserve song library and ABC import.

### 4. Integrate transport into the staff

- remove the standalone visible Position range panel;
- draw a draggable/tappable playhead directly over Timeline and Score notation;
- implement measured beat↔point mapping in Timeline and piecewise system-aware mapping in Score;
- clicking a note seeks to it;
- dragging updates active event and harmonica guidance;
- provide compact Pause/Resume/Restart or Count-in/Start controls near the staff;
- retain an accessible keyboard/range fallback without a large visual block.

### 5. Make practice feedback explicit

Render event states on notation:

- active/partial target with duration progress;
- correct completion with a visible check/success state;
- wrong played pitch at its actual height with ×/error marking;
- missed events in In time;
- early-release point;
- clear near-staff explanation such as played versus expected pitch and the applied policy action.

The target must visibly stop, retain or reset progress according to the selected policy.

### 6. Correct mistake policy semantics and labels

Use:

- Keep note progress;
- Restart current note;
- Restart current measure.

Fix measure restart so it clears result/completion state only inside the current measure and moves the notation playhead to the measure start.

Add tests that begin from approximately 50% held progress and prove all three outcomes differ in state and screenshot-visible geometry.

Do not treat tolerated microphone dropout as a mistake.

### 7. Restore sampled harmonica playback

- inspect actual live fetch/decode/scheduling behavior;
- preload before scheduling a melody;
- support per-zone success/failure;
- retry a rejected preload;
- use the nearest decoded sample if one zone fails;
- expose loading/sampled/degraded status;
- show a visible retryable warning in degraded mode;
- verify healthy reference and Touch playback use `AudioBufferSourceNode`, not `OscillatorNode`;
- keep oscillator only as explicit degraded fallback.

Do not replace the licensed sample set without evidence.

### 8. Cleanup

After parity:

- remove obsolete score/guided mode branches;
- remove preset modules and CSS;
- remove the visible standalone position panel;
- remove sparse full-width strip styles;
- keep architecture out of the monolithic `App.tsx` through focused components/modules;
- update canonical documentation honestly.

---

## Verification

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

Implement all focused tests and screenshot states required by `docs/practice-workspace-redesign-spec.md`, especially:

- one Song Practice entry and implementation;
- no preset selector;
- compact desktop/phone control hierarchy;
- notation click/drag/keyboard seeking;
- no standalone visible Position block;
- Wait for me auto-armed behavior;
- In time count-in;
- correct/wrong/partial/missed score states;
- exact three-policy distinction from 50% progress;
- measure result clearing;
- sampled playback healthy, partial-failure, retry and degraded paths;
- live sample URLs and instrument status.

Perform at least one visual correction pass after opening screenshots at original size.

---

## Preserve

Do not regress:

- current microphone display/accepted/completed-state architecture;
- microphone sensitivity and calibration behavior;
- Timeline and Score engraving;
- 10-hole/12-hole mappings and harmonica geometry;
- Ear and Rhythm lifecycle functionality;
- note-name and solfège settings;
- light/dark/system themes;
- Pages workflow and build metadata.

---

## Excluded

Do not implement:

- Cloudflare migration;
- accounts;
- achievements;
- community melody publishing;
- improvisation mode;
- graphical notation editing;
- another colour or instrument-art redesign;
- unrelated feature expansion.

---

## Deployment and completion

After local verification:

1. update architecture, README, release and manual-test documentation;
2. create a detailed commit;
3. push `main`;
4. wait for authoritative GitHub Pages deployment;
5. verify live `build-meta.json` equals final `main`;
6. run live production tests;
7. verify live sample assets and sampled-instrument status;
8. leave a clean worktree;
9. report final SHA, workflow, live URL, tests, screenshots, removed code and known limitations;
10. stop for owner review.

The task is complete only when the live application has one compact Song Practice experience, notation-integrated transport, unmistakable practice feedback, genuinely different mistake policies and verified sampled harmonica playback.
