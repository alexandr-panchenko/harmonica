# Production staff and harmonica redesign

Status: **approved design direction; current production migration rejected and must be rebuilt in the main application**  
Last updated: **2026-08-07**

This is the canonical design and acceptance specification for the next implementation pass. It supersedes the idea of continuing work through separate public laboratory pages.

The design laboratories were useful: they proved that abcjs can produce the correct notation and time-proportional layout, and they established a workable parameterized vector harmonica with a separately animated slide. The first attempt to promote those ideas into production was not accepted, however:

- the deployed application did not visibly show the approved harmonica redesign;
- the production staff changed but its duration ribbons were still positioned incorrectly;
- deployment became ambiguous after switching from Actions deployment to a manually published `gh-pages` branch;
- repository reports claimed visual acceptance that the owner did not confirm.

The next agent must modify the **main application directly**, prove the result in production, and remove the standalone design-lab product surface after extracting any reusable code.

---

## 1. Scope

The implementation has three deliverables:

1. a correct production Timeline Staff based on abcjs;
2. a visibly improved production virtual harmonica based on the approved vector concept;
3. one deterministic, verifiable GitHub Pages deployment.

This pass must preserve all existing training modes and audio behavior. It must not add Cloudflare, accounts, achievements, user melody publishing, an improvisation mode, or a notation editor.

---

## 2. Non-negotiable product result

### The production page is the deliverable

Success is evaluated at:

`https://alexandr-panchenko.github.io/harmonica/`

Separate `/lab/staff-design/` and `/lab/harmonica-design/` pages are not an acceptable substitute. Their useful implementation code may be promoted into production modules, but the public lab entry points, lab-only controls, capture script, and duplicated lab components should be removed after migration.

### Microphone is the primary playing path

The normal training experience uses the real harmonica and microphone. The virtual instrument remains essential because it replaces tablature and explains:

- which hole is recommended;
- blow or draw;
- slider released or pressed;
- what pitch the microphone detected;
- which alternate physical positions can produce that pitch.

Touch input remains available, but it is secondary.

---

# Part I — production notation

## 3. abcjs remains the engraver

Use `abcjs@6.5.2` for production engraving. Do not restore the handwritten `MusicGlyphs`/custom-staff path.

The production notation boundary must remain isolated under `src/notation/abc/`:

- `AbcAdapter.ts` owns abcjs parse/visual-object details;
- `AbcRenderer.tsx` owns production rendering;
- `timelineGeometry.ts` owns measured temporal geometry;
- `generatedExerciseToAbc.ts` serializes generated exercises into the supported ABC subset.

Do not query arbitrary abcjs SVG details from exercise code or `App.tsx`.

## 4. Timeline Staff is the primary production view

Timeline Staff must combine:

- correctly engraved notes, rests, accidentals, key signatures, ties, beams, dots, and barlines;
- horizontal spacing proportional to musical time through abcjs `timeBasedLayout`;
- a fixed judgment line;
- duration ribbons;
- active hold progress;
- performed-pitch trace and result history.

Conventional Score view may remain as a secondary option. This task is accepted only when Timeline Staff is correct in the main application.

---

## 5. Ribbon geometry: one coordinate system

The current code measures abcjs elements relative to `.abc-production-render` and then positions ribbon elements in a sibling overlay. That is unsafe whenever the render root, generated SVG, padding, scale, or overlay host have different origins.

Create one explicit coordinate space shared by:

- abcjs notation;
- ribbon underlay;
- hidden-note markers;
- note-name labels;
- performance segments;
- pitch trace.

Recommended structure:

```text
.music-canvas  (position: relative; one coordinate origin)
  .ribbon-underlay          (absolute, inset: 0)
  .abc-production-render    (same origin)
  .music-performance-layer  (absolute, inset: 0)
```

`bindAbcRender` must receive the actual overlay host / coordinate root and return all bounds relative to that root—not relative to an inner renderer that has a different offset.

Account for:

- generated SVG position inside the renderer;
- abcjs scale;
- SVG `viewBox` and CSS size;
- padding and margins;
- horizontal scroll;
- `ResizeObserver` updates;
- font/render completion before final measurement.

No CSS translation or later parent offset may be omitted from the measured coordinate system.

---

## 6. Notehead anchor, not whole selectable group

Each note anchor must identify the visible notehead itself.

A selectable abcjs note group may include:

- stem;
- flag;
- beam;
- accidental;
- dot;
- ledger lines;
- tie-related geometry.

Its bounding-box center is not the notehead center.

`RenderAnchor` must contain at least:

```ts
interface RenderAnchor {
  eventId: string;
  eventBounds: RectBounds;
  notehead?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    centerX: number;
    centerY: number;
  };
  temporalX: number;
  systemIndex: number;
}
```

Use a robust notehead selector verified against the actual `abcjs@6.5.2` SVG. If a notehead cannot be found:

- emit a diagnostic;
- do not silently treat the entire event group as a successful exact anchor;
- add a test fixture that reproduces the missing case.

---

## 7. Correct ribbon placement

For every written note segment:

- ribbon vertical center equals `notehead.centerY` within a small rendering tolerance;
- ribbon begins at the notehead center or immediately behind/right of the notehead;
- ribbon runs horizontally from the note at its actual staff pitch;
- ribbon is a translucent rounded band, not a series of circles;
- the abcjs notation remains visibly above it;
- staff lines remain visible through it.

Recommended visual treatment:

- height: roughly 10–14 CSS px at the production scale;
- rounded rectangle/capsule;
- low-opacity base duration band;
- stronger elapsed fill;
- minimal glow;
- no vertical offset based on stem or flag bounds.

The owner should visually perceive the ribbon as a continuation of the notehead.

---

## 8. Correct ribbon length

Do not compute ribbon width from an independent constant such as `durationBeats * 42` or from an approximate density constant that is disconnected from the rendered notation.

For an event on the same Timeline system:

1. use the current note's measured temporal anchor;
2. find the next written event's measured temporal anchor, including rests;
3. end the ribbon a small visual gap before that next anchor;
4. ensure it covers almost the full horizontal temporal interval;
5. for the final event, extrapolate using measured neighboring intervals / a measured beat-to-X function;
6. recompute after resize.

The ribbon lengths must preserve duration ratios **and** visually fill the actual time-proportional spacing produced by abcjs.

Acceptance examples:

- a two-beat note occupies roughly twice the measured horizontal interval of a one-beat note;
- no large unexplained empty gap remains between the ribbon end and the next event;
- a rest ends the previous note ribbon and creates silence;
- repeated notes remain separate when not tied;
- a tied sounding event can continue across multiple engraved written notes and a barline without creating a false release.

---

## 9. Layering

Required z-order:

1. light staff/game background;
2. duration ribbon underlay;
3. abcjs notation SVG;
4. active/hidden/name overlays;
5. performance result and pitch trace overlays.

Do not place ribbons above noteheads, accidentals, ties, beams, or barlines.

Do not use a ribbon background that obscures the notation.

---

## 10. Spacing and density

The laboratory's time-based notation was visually successful but slightly too spacious.

Use a balanced setting derived from actual screenshots, but do not solve ribbon mismatch by merely changing `minPadding`, `minWidth`, or staff width.

Requirements:

- slightly reduce excess spacing compared with the original laboratory;
- retain clean accidentals, dots, flags, beams, ties, and rests;
- avoid crowding;
- use measured anchors for ribbons regardless of density;
- keep notes large enough on mobile and prefer horizontal scrolling to shrinking.

One production density is enough. Diagnostic density selectors are not required in the main app.

---

## 11. Hidden-pitch behavior

Play by ear and any other hidden-answer exercise must not leak pitch through the engraved SVG.

When pitch is hidden:

- hide the complete abcjs event group, including accidental, ledger line, stem, flag, and notehead;
- show a neutral question marker at a neutral vertical location;
- preserve temporal position and duration only when the exercise is intended to reveal rhythm;
- do not expose pitch in visible labels, tooltips, ARIA names, or DOM text before reveal.

After reveal, restore the normal engraved event.

---

## 12. Production notation acceptance

The main application must demonstrate all of the following without navigating to a lab page:

- correct C-sharp, B-flat, and natural signs;
- key signature behavior;
- whole, half, quarter, eighth, dotted notes;
- rests;
- beamed groups;
- ties within and across measures;
- barlines;
- low and high ledger notes;
- Timeline scrolling;
- conventional Score view if retained;
- note-name labels and solfège/letters;
- hidden ear phrase without pitch leakage;
- ribbon aligned to notehead and nearly reaching the next event.

---

# Part II — production virtual harmonica

## 13. Use the approved vector concept in the main app

The current production component files exist, but the owner did not see a meaningful visual change. Do not accept the presence of `HarmonicaBody`, `CompactHarmonicaView`, or `InteractiveHarmonicaView` as proof that the feature is complete.

The main training screen must visibly render a coherent vector/CSS chromatic harmonica with:

- one continuous light metal/pearl body;
- top cover;
- mouthpiece face;
- 10 or 12 clear physical holes;
- end caps;
- a clearly visible slide rod and knob at the right;
- restrained shadows and highlights;
- near-orthographic presentation;
- no table-like outer appearance.

Use the laboratory's parameterized product-illustration direction. A raster image is not required in this pass.

---

## 14. Compact Guidance is the default microphone view

When input is Microphone:

- display the compact harmonica prominently under the staff;
- show the complete 10-hole or 12-hole instrument in one coherent object;
- do not show four large touch buttons per hole;
- fit the instrument on phone portrait whenever practical;
- use the physical instrument as tablature/guidance.

It must show:

- target/recommended hole when guidance is allowed;
- blow or draw direction when known;
- slider released or pressed when known;
- detected pitch mappings from the microphone;
- correct and incorrect feedback;
- note names only when the harmonica-label setting is enabled.

### Honest ambiguity

Pitch detection cannot identify a unique physical action when several actions produce the same note.

Therefore:

- highlight every matching action/hole from the selected profile;
- show a common breath only when all matches share it;
- show a common slide state only when all matches share it;
- leave the physical slide neutral when matches include both `in` and `out`;
- never state that the microphone identified a specific hole/action unless the mapping is actually unique.

---

## 15. Physical slide animation

The slide is a separate visual object.

Required states:

- **out/released:** rod extended, knob farther from the body;
- **in/pressed:** knob moves toward the body, rod visibly shortens, shadow/contact changes;
- **neutral/ambiguous:** visually distinct without pretending to be one of the two physical states.

The animation must occur in the production app for:

- guided target action;
- touch action;
- unambiguous microphone mapping.

Respect `prefers-reduced-motion`.

---

## 16. Touch input remains available but secondary

When input is Touch:

- use the same physical body;
- expose four direct-action regions per physical hole;
- one action selects hole + blow/draw + slide out/in;
- holding records duration;
- keyboard activation remains available;
- the physical slide animates.

The four regions must be integrated into the mouthpiece and must not turn the entire component back into an external spreadsheet/table.

On phone:

- horizontal scrolling is acceptable;
- automatically center the recommended/current hole when it is outside a safe viewport;
- suspend auto-follow for several seconds after manual user scrolling;
- do not jump among alternate mappings;
- respect reduced motion.

---

## 17. Guidance policy by mode

### Find a note

Do not reveal the target fingering before the answer in assessment mode. The compact harmonica may show:

- detected wrong pitch;
- possible positions after a microphone note is heard;
- recommended/alternative positions after success.

### Learn a song

Always show the selected phrase-level recommended fingering:

- target hole;
- blow/draw;
- slide state;
- alternatives may be shown more subtly.

### Play the score

Guidance follows the existing user setting. Timeline/Score notation and compact harmonica must remain synchronized.

### Play by ear

Do not reveal the hidden target action. Show only what the microphone actually detected until discovery/reveal.

### Rhythm training

Show the fixed/simple recommended physical action when pitch is not the challenge.

---

## 18. Phrase-level fingering

Keep a deterministic phrase-level fingering planner so repeated pitches do not cause random visual jumps between equivalent holes.

The planner should prefer:

- small hole movement;
- fewer unnecessary slide changes;
- fewer unnecessary breath changes;
- continuity through tied notes;
- stable handling of duplicate positions;
- valid profile range.

It must preserve all acceptable alternatives because microphone pitch validation accepts the sounding note rather than only the recommendation.

---

## 19. Visual/CSS cleanup

The stylesheet currently contains substantial legacy dark/neon rules followed by later light overrides. Do not append another final override block.

Refactor the production CSS:

- remove obsolete custom-staff styles;
- remove obsolete virtual-table styles;
- remove lab-only styles when labs are deleted;
- group notation styles with notation components;
- group harmonica styles with harmonica components where practical;
- keep the light, high-contrast product direction;
- preserve readable mobile typography;
- eliminate hidden cascade conflicts that can restore old visuals.

The production page must not look unchanged merely because new components are underneath old CSS.

---

# Part III — remove the laboratory product surface

## 20. Remove standalone lab pages

After their reusable production code and test fixtures are incorporated:

- delete `lab/staff-design/index.html`;
- delete `lab/harmonica-design/index.html`;
- delete public navigation to those pages;
- remove `src/labs/staff/` and `src/labs/harmonica/` components that duplicate production code;
- move valuable fixtures into `tests/fixtures/` or a production-neutral fixture folder;
- remove `capture:labs` and the lab-only screenshot script;
- remove obsolete lab screenshots if they are no longer needed as historical documentation.

The main application and its production screenshots are the only visual acceptance surface for this milestone.

---

# Part IV — deployment must be provable

## 21. Current deployment state

At the time of this specification:

- `main` contains the rejected migration attempt;
- GitHub Pages is configured as a legacy branch deployment from `gh-pages:/`;
- `.github/workflows/pages.yml` runs tests/build only;
- the `gh-pages` branch contains a manually published static artifact;
- the owner could not determine whether the visible production page matched the new source.

Do not change deployment mechanisms repeatedly during the task. Use one authoritative path.

## 22. Authoritative branch-based publication

Keep branch-based Pages publication for this pass unless a verified repository setting change makes Actions deployment unquestionably available.

Required release procedure:

1. finish and verify source on `main`;
2. create a production `dist` from that exact final source SHA;
3. publish only `dist` contents to the root of `gh-pages`;
4. use a commit message containing the exact main source SHA;
5. confirm repository Pages source remains `gh-pages:/`;
6. wait until Pages is no longer in `building` state;
7. verify the live production content.

Do not claim deployment based only on pushing `main` or on a local preview.

## 23. Build identity

Add generated build identity so deployment cannot be ambiguous again.

The built site must expose the exact source commit SHA through both:

- a machine-readable file, for example `/harmonica/build-meta.json`;
- a small visible location such as Settings/About or footer.

Suggested schema:

```json
{
  "sourceCommit": "<full main SHA>",
  "builtAt": "<ISO timestamp>",
  "version": "<package version>"
}
```

Generate it during build; do not hand-edit the SHA.

Production verification must fetch the live `build-meta.json` with a cache-busting query and assert that `sourceCommit` equals the final source commit deployed.

---

# Part V — tests and evidence

## 24. Automated notation tests

Add focused tests for:

- abcjs adapter mapping;
- exact notehead discovery;
- one shared coordinate root;
- ribbon Y aligned to notehead center;
- ribbon beginning at/behind the notehead;
- ribbon ending close to the next temporal event;
- rest interruption;
- tied sounding events;
- resize recalculation;
- hidden-pitch masking;
- Timeline and Score rendering;
- note-name labels.

Do not test only abstract width ratios. Use a browser-rendered fixture and measured DOM geometry.

## 25. Automated harmonica tests

Add focused tests for:

- visible compact vector body in the main app;
- 10/12 hole counts;
- slider out/in/neutral states;
- target, detected, correct, and incorrect states;
- ambiguity rules;
- compact microphone view without four large direct-action buttons;
- touch view with 40/48 direct actions;
- hold duration;
- keyboard behavior;
- mobile auto-focus and manual-scroll suspension;
- guidance leakage rules by mode.

## 26. Main-app screenshots

Capture and inspect production screens only:

- Learn a song desktop, Timeline;
- Play the score desktop, Timeline;
- Play the score desktop, Score;
- Timeline close-up showing notehead-aligned ribbons;
- tie across a barline;
- hidden ear phrase;
- microphone compact harmonica, 12-hole;
- microphone compact harmonica, 10-hole;
- ambiguous microphone mapping;
- slider released and pressed;
- touch instrument desktop;
- phone portrait guided mode;
- phone portrait touch mode with current hole centered.

At least two screenshot-review iterations are required. Passing DOM tests is not proof that the visual result is good.

## 27. Existing mode regressions

Preserve deterministic happy paths for:

- Find a note;
- Score Step;
- Score In time;
- Ear Relative;
- Ear Absolute;
- Rhythm Step;
- Rhythm In time;
- Learn a song Step;
- Learn a song In time;
- microphone denied/fallback;
- microphone enabled;
- touch input;
- 10-hole;
- 12-hole.

---

# Part VI — completion contract

## 28. Required commands

Run at minimum:

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run benchmark:pitch
bun run build
bun run test:browser
bun run test:production
bun run capture:release
```

Update scripts as needed after removing lab capture.

## 29. Git and release

After successful verification:

1. create a detailed commit on `main`;
2. push `main`;
3. build from the final pushed SHA;
4. publish `dist` to `gh-pages`;
5. verify live build identity and production smoke tests;
6. leave both worktrees/branches clean;
7. report exact SHAs for `main` and `gh-pages`.

Do not stop after another partial visual experiment. Do not leave the owner to determine whether deployment happened.

## 30. Final report

Report:

- starting source SHA;
- final source SHA;
- `gh-pages` publication SHA;
- live `build-meta.json` value;
- production URL;
- exact staff geometry fix;
- exact harmonica production components used;
- removed laboratory/legacy files;
- tests and results;
- screenshot list;
- known limitations;
- short owner checklist for real-harmonica acceptance.

The task is complete only when the **main deployed application** visibly contains the corrected staff and virtual harmonica and the live build identifies the final source commit.