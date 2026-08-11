# Active Codex task — restore microphone reliability and make practice modes explicit

Execute this task autonomously from the latest `main` in the local VS Code/Codex environment.

Read completely before editing:

1. [`docs/functional-practice-spec.md`](docs/functional-practice-spec.md) — binding product, architecture and acceptance specification;
2. [`docs/architecture.md`](docs/architecture.md);
3. [`docs/audio-pipeline.md`](docs/audio-pipeline.md);
4. [`README.md`](README.md);
5. current production audio, exercise, notation, harmonica, application, tests and deployment files.

The visual-system and notation-layout iterations are closed for now. This is a functional hardening and practice-engine iteration.

---

## Mission

Deliver a deployed release candidate that:

- recognizes real harmonica notes reliably at ordinary soft/medium playing volume;
- keeps live tuner/staff/harmonica feedback stable through brief estimator dropouts;
- never pretends the microphone inferred a unique hole, breath or slide technique;
- accepts pitch-only answers live without waiting for note release;
- gives score/song/rhythm practice an explicit transport, seek bar and unambiguous Step versus In time behavior;
- restores visible target-duration progress;
- provides explicit Random phrase and Song excerpt lifecycle in Play by ear;
- provides generated/preset pattern lifecycle in Rhythm training;
- consolidates Play the score and Learn a song onto one shared Song Practice implementation with different visible presets;
- preserves the authoritative GitHub Actions Pages deployment and build identity.

Do not deliver another laboratory page. The live main application is the acceptance surface.

---

## Required implementation sequence

### 1. Establish the functional baseline

- fetch latest `main`;
- record starting SHA and live `build-meta.json`;
- run existing tests and pitch benchmark;
- reproduce current microphone and exercise semantics from code and injected fixtures;
- capture current production screenshots and diagnostic values;
- do not assume passing clean-tone tests prove real-device sensitivity.

### 2. Refactor microphone state

Implement the four distinct concepts required by the specification:

- raw estimate;
- candidate/display state;
- accepted exercise state;
- completed note segment.

Do not continue passing only `stable | null` to every consumer.

Use time-based open/sustain/release hysteresis, a short display latch, robust calibration and persisted High/Normal/Low sensitivity. Add diagnostics for RMS/dB, noise floor, thresholds, clarity and gate state.

Pitch-only Find/Ear discovery must accept a live stable note before release. Duration-sensitive practice must consume continuous accepted time. In-time review must continue to use completed segments.

### 3. Preserve honest harmonica ambiguity

For detected MIDI, highlight all matching actions. Show breath or slider state only when all candidates agree. Otherwise present multiple possible positions and neutral technique state.

Do not “fix” ambiguity by choosing one physical action from audio.

### 4. Introduce shared practice transport

Build one framework-independent transport with:

- Step and realtime modes;
- play/pause/restart;
- count-in;
- position beat/time;
- measure/beat display;
- draggable seek bar;
- start from selected position;
- deterministic clock tests.

#### Step

- correct target pitch accumulates held duration;
- wrong pitch never skips a target;
- rests require silence;
- repeated equal notes require rearticulation;
- visible mistake policies:
  - Pause and continue;
  - Restart note;
  - Restart measure.

#### In time

- transport never pauses for mistakes;
- inputs become match/missing/extra results;
- live and post-run pitch/timing/duration feedback remain separate.

Drive target ribbon fill from Step held progress or realtime transport. Keep played pitch trace as a distinct layer.

### 5. Make ear phrases explicit

Remove fixed product behavior based on `EAR_TARGETS`.

Provide:

- Random phrase;
- Song excerpt;
- phrase source summary;
- Listen/Replay;
- New phrase;
- Skip;
- Hint;
- Reveal;
- progress near the main controls;
- Absolute and Relative behavior;
- optional rhythm-performance stage after pitch discovery.

Phrase changes only through explicit lifecycle actions.

### 6. Make rhythm patterns explicit

Remove fixed product behavior based on `RHYTHM_MELODY`.

Provide generated and preset sources with:

- New pattern;
- meter;
- measures;
- difficulty;
- allowed values/rests;
- tempo;
- any-pitch or fixed-pitch policy;
- Step and In time using the shared transport.

Pattern changes only through explicit lifecycle actions.

### 7. Consolidate song practice

Create one shared Song Practice implementation and guidance presets:

- Learn;
- Practice;
- Perform.

The existing Play the score and Learn a song menu entries may remain as shortcuts to Practice and Learn presets for this iteration. They must not maintain separate engines, song selection, transport or results logic.

### 8. Remove old duplicated state

After parity:

- remove dead fixed target/pattern constants from product behavior;
- reduce the monolithic mode-specific state in `App.tsx`;
- keep deterministic constants only as tests/fixtures;
- update architecture and manual-test docs honestly.

---

## Verification requirements

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

Add the deterministic fixtures and assertions required by `docs/functional-practice-spec.md`, including soft tones, amplitude/clarity dropouts, vibrato, bend, repeated articulation, calibration contamination, all Step policies, seek, realtime misses, ear lifecycle, rhythm generation and shared song presets.

Use the same production audio path for synthetic PCM, uploaded fixtures and microphone input.

Do not claim real-harmonica acceptance from synthetic tests. The final report must provide the short owner checklist from the specification.

---

## Preserve

Do not regress:

- current light/dark/system visual system;
- production abcjs notation and responsive score/timeline layout;
- 10-hole and 12-hole mappings;
- compact and touch harmonica geometry;
- sampled harmonica playback;
- note labels and solfège;
- song library and ABC import;
- Pages workflow and build metadata;
- all current modes until their behavior is migrated to the shared engines.

---

## Excluded

Do not implement:

- Cloudflare migration;
- accounts;
- achievements;
- community melody publishing;
- improvisation mode;
- graphical notation editing;
- another general visual redesign;
- unrelated feature expansion.

---

## Deployment and completion

After local verification:

1. update canonical documentation;
2. create a detailed commit;
3. push `main`;
4. wait for authoritative GitHub Pages deployment;
5. verify live `build-meta.json` against final `main`;
6. run production tests against the live URL;
7. leave a clean worktree;
8. report source SHA, workflow, live URL, tests, fixture results, architecture changes, known limitations and owner manual checklist;
9. stop for owner testing with the physical harmonica.

The task is complete as a release candidate only when the live application exposes stable microphone feedback, explicit transport/practice semantics, explicit ear/rhythm lifecycle and shared song-practice behavior from the reported source commit.
