# Harmonica Trainer score correction editor specification

Status: **binding specification for the next cloud Codex iteration**  
Scope: **repair the deployed Score Import Workbench route, add a constrained monophonic correction editor, preserve deterministic imports/exports, and prepare later OMR/audio-transcription adapters**

The Score Import Workbench core has been merged, but the advertised direct URL currently returns GitHub Pages 404. The current browser entry chooses the workbench only after `src/main.tsx` has loaded and inspects `location.pathname`; GitHub Pages cannot execute that code when no physical file exists at the nested request path.

Fixing that route is the first gate, but it is not the whole task. After the route works, continue directly into the correction editor described below. Do not stop after replacing the URL or adding a redirect.

---

# 1. Product goal

Turn the imported `ScoreImportCandidate` into an editable, locally saved monophonic arrangement without attempting to build a complete MuseScore replacement.

The intended workflow is:

```text
MIDI / MusicXML / MXL / monophonic WAV
              ↓
      deterministic import
              ↓
     choose source candidate
              ↓
  create editable arrangement draft
              ↓
 correct pitch / spelling / duration / rests / ties
              ↓
 inspect range and harmonica fingering
              ↓
 audition, compare, undo/redo
              ↓
 export ABC / MIDI / MusicXML / canonical JSON
              ↓
 open in Song Practice
```

The editor is a **review and correction editor for one monophonic line**. It is not a polyphonic notation application, DAW, complete score engraver, OMR engine, or autonomous arrangement generator.

---

# 2. Phase 0 — repair the GitHub Pages route correctly

## 2.1 Current failure

The existing implementation renders the workbench when:

```ts
location.pathname.endsWith("/tools/score-import")
```

That only works if the root application HTML has already loaded. A direct request or refresh at:

```text
https://alexandr-panchenko.github.io/harmonica/tools/score-import
```

is handled by GitHub Pages before React starts and currently returns 404.

Do not treat a client-side pathname test as static routing.

## 2.2 Required routing architecture

Use a real Vite multi-page entry.

Preferred structure:

```text
index.html
  → src/main.tsx

tools/score-import/index.html
  → src/score-import/main.tsx
```

`src/score-import/main.tsx` should mount `ScoreImportWorkbench` directly and import the shared stylesheet/theme bootstrap. The trainer root should no longer need to detect the tool by pathname.

Configure Vite `build.rollupOptions.input` with both HTML entries. Preserve:

```ts
base: "/harmonica/"
```

Do not make a GitHub Pages 404 redirect hack the primary route implementation. A generated `404.html` fallback may be added for unknown future client routes, but the workbench must have a real emitted nested `index.html`.

## 2.3 Canonical URL and URL helpers

The canonical URL is:

```text
https://alexandr-panchenko.github.io/harmonica/tools/score-import/
```

Links may accept the non-trailing-slash form if Pages redirects it, but all application-generated links should use the canonical trailing slash.

Create a small base-aware URL helper rather than writing fragile relative links:

```ts
function appUrl(path = ""): string {
  return new URL(path, new URL(import.meta.env.BASE_URL, location.origin)).toString();
}
```

The exact API may differ, but these actions must resolve correctly from the nested page:

- Back to Trainer;
- Open in Song Practice;
- navigation from Song Library to Workbench;
- asset loading;
- build metadata;
- any future editor reload/navigation.

Do not use `href="./"` or `location.href="./?..."` from the nested route.

## 2.4 Route acceptance

Automated and live checks must prove:

- root trainer returns 200;
- `/harmonica/tools/score-import/` returns 200 directly;
- `/harmonica/tools/score-import` reaches the canonical page;
- refreshing the nested route still works;
- workbench JS/CSS/sample assets load under the project base;
- Back to Trainer reaches `/harmonica/`;
- Open in Song Practice reaches the root app with the imported ABC;
- live `build-meta.json` matches the final merge SHA.

The task continues into the editor after this gate passes.

---

# Part I — editable arrangement domain

## 3. Preserve imported source and candidate data

Never mutate the original `ScoreImportProject`, `RawImportedNote[]`, or selected `ScoreImportCandidate` in place.

Create an explicit arrangement draft derived from a candidate.

A suitable model is:

```ts
interface EditableArrangementProject {
  schemaVersion: 1;
  sourceProject: ScoreImportProject;
  sourceCandidateId: string;
  arrangement: EditableArrangement;
  editLog: EditCommand[];
  settingsHash: string;
}

interface EditableArrangement {
  id: string;
  title: string;
  composer?: string;
  tempoQpm: number;
  meter: { numerator: number; denominator: number };
  key: {
    tonic: string;
    mode: string;
    prefer: "sharps" | "flats";
  };
  canonicalPpq: 960;
  events: EditableEvent[];
}

interface EditableEvent {
  id: string;
  kind: "note" | "rest";
  startTick: number;
  durationTick: number;
  midi?: number;
  writtenPitch?: WrittenPitch;
  tieIn?: boolean;
  tieOut?: boolean;
  sourceEventIds: string[];
  warnings: ImportWarning[];
  origin: "imported" | "inserted" | "split" | "derived";
}
```

Names may differ, but the separation is mandatory.

## 4. Monophonic invariant

The correction editor owns one monophonic sequence.

Required invariant:

- events are sorted by `startTick`;
- notes do not overlap;
- silent gaps are represented by explicit rest events;
- every duration is a positive integer tick count;
- bar positions derive from meter and canonical PPQ;
- edits that would create overlaps must use an explicit, deterministic resolution policy;
- no hidden polyphony may be introduced by UI operations.

For the first editor version, default to **ripple editing**:

- changing an event duration shifts following events;
- inserting an event shifts subsequent events;
- deleting an event can either close the gap or convert the time to a rest through an explicit command;
- the UI must state which behavior occurred.

Do not silently trim neighboring notes.

## 5. Stable IDs and deterministic serialization

Imported events retain stable IDs where possible.

Inserted/split events derive IDs from:

- source project hash;
- source candidate ID;
- deterministic edit sequence index;
- operation-local index.

Do not use wall-clock timestamps or random UUIDs inside serialized editor projects.

Given the same imported project plus the same edit command log, exported ABC, MIDI, MusicXML and canonical JSON must be byte-stable, excluding explicitly non-deterministic diagnostic timing.

## 6. Command model and undo/redo

All edits must go through reversible commands, not direct React state mutation.

Required command families:

```ts
type EditCommand =
  | SetPitchCommand
  | MovePitchDiatonicallyCommand
  | RespellPitchCommand
  | SetDurationCommand
  | InsertEventCommand
  | DeleteEventCommand
  | ConvertNoteRestCommand
  | SplitEventCommand
  | MergeEventsCommand
  | ToggleTieCommand
  | TransposeSelectionCommand
  | ShiftOctaveCommand
  | CropToSelectionCommand
  | SetMetadataCommand;
```

Names may differ.

Requirements:

- Undo;
- Redo;
- keyboard shortcuts;
- redo stack clears after a new command;
- selection survives rerender where its event still exists;
- command tests prove round-trip restoration;
- command log can be serialized as provenance, although transient UI history need not be exported to ABC/MIDI/MusicXML.

---

# Part II — editor user experience

## 7. Workbench stages

Refactor the workbench into explicit stages within one page:

```text
1. Import
2. Extract
3. Edit
4. Export
```

A user may move backward without losing the imported source.

### Import

- choose/drop MIDI, MusicXML/MXL, WAV, or editor project JSON;
- show local/private processing statement;
- show parse errors and resource-limit errors clearly.

### Extract

- inspect tracks/parts/voices;
- choose candidate/extraction strategy;
- adjust deterministic import settings already supported;
- audition candidates;
- click `Edit this candidate`.

### Edit

- correction editor described below.

### Export

- validate;
- compare original candidate and edited arrangement;
- export all formats;
- open edited version in Song Practice.

Do not display every diagnostic panel at once. Use a compact workspace with clear primary/secondary information.

## 8. Editor layout

Desktop layout:

```text
compact editor toolbar
engraved score / selectable notation
narrow timing lane or event ruler
selection inspector + warnings
compact playback/export bar
```

Phone/tablet:

- notation remains readable;
- toolbar may scroll horizontally or collapse into grouped menus;
- inspector becomes a drawer;
- touch targets remain usable;
- no page-wide horizontal overflow except an intentional notation/timing viewport.

The score is the dominant object.

## 9. Selection

Required:

- click/tap a note or rest to select it;
- Shift-click extends a contiguous range;
- keyboard navigation selects previous/next event;
- selected event remains mapped by stable event ID after every abcjs rerender;
- inspector shows pitch, written spelling, start, duration, measure, source provenance and warnings;
- selection is visually obvious but does not obscure noteheads or accidentals.

## 10. Pitch editing on the staff

Use abcjs selection and dragging for vertical pitch correction.

abcjs dragging is only a visual gesture. The callback must update the canonical event and rerender; never treat the transformed SVG as source data.

Required behaviors:

- drag note vertically by diatonic staff steps;
- update `writtenPitch` deterministically;
- update MIDI according to the chosen key/spelling policy;
- keep selection after rerender;
- show exact resulting pitch in the inspector;
- keyboard Arrow Up/Down moves pitch by configurable semitone or diatonic step;
- Alt/Option + Arrow shifts octave;
- accidentals can be corrected independently through the inspector/toolbar.

Define and document drag semantics for altered notes. A reasonable default is:

- visual drag changes the diatonic letter and octave;
- preserves the accidental class where musically valid;
- the inspector always allows exact MIDI and spelling correction afterward.

Do not guess silently when a drag creates an enharmonic ambiguity; show the resulting spelling.

## 11. Duration and rest editing

Provide duration controls for at least:

- whole;
- half;
- quarter;
- eighth;
- sixteenth;
- dotted versions supported by the serializer;
- triplet-grid values already supported by import settings.

Required operations:

- set selected event duration;
- convert selected note to rest while preserving time;
- convert rest to note using a chosen/default pitch;
- insert note before/after selection;
- insert rest before/after selection;
- delete and close gap;
- delete and leave rest;
- split an event at a valid grid point;
- merge adjacent compatible notes/rests;
- tie/untie adjacent equal-pitch notes.

The editor should not force users to type ABC.

## 12. Timing lane

Do not attempt arbitrary horizontal dragging inside conventional score engraving in the first version.

Add a compact timing lane synchronized with the selected score events:

- event blocks aligned to canonical ticks;
- note/rest distinction;
- selected event highlight;
- right-edge duration resize handle with quantized snapping;
- click a gap/beat to set insertion point;
- optional drag to select a range;
- playhead during audition;
- scroll synchronization with notation where practical.

This lane is a correction aid, not a DAW piano roll.

Changing duration through the timing lane uses the same command model as the notation toolbar.

## 13. Metadata and notation settings

Editable metadata:

- title;
- composer/source description;
- tempo;
- meter;
- key tonic/mode;
- sharps/flats preference.

Changing meter/key must rerender and revalidate the arrangement. Do not rewrite source provenance.

## 14. Range and harmonica diagnostics

Use existing 10-hole/12-hole profiles and fingering planner.

Show:

- selected harmonica profile;
- notes outside the profile range;
- notes with several available positions;
- estimated breath/slide changes;
- maximum hole jump;
- deterministic recommended fingering preview.

Provide safe editing actions:

- transpose selection;
- shift selection one octave;
- transpose complete arrangement;
- fit range suggestion.

Do not automatically transpose without explicit confirmation.

## 15. Original versus edited comparison

Allow the user to switch between:

- imported candidate;
- current edited arrangement;
- optional overlay/diff summary.

Diff summary should include:

- pitches changed;
- spellings changed;
- durations changed;
- notes/rests inserted or deleted;
- ties changed;
- range warnings introduced/resolved.

Provide `Reset to imported candidate` with confirmation.

---

# Part III — playback and project persistence

## 16. Audition controls

Reuse the sampled harmonica `PlaybackEngine` and stoppable reference playback behavior.

Required:

- Play from start;
- Play from selection;
- Stop;
- loop selection/range;
- visual playhead on notation and timing lane;
- no overlapping preview sessions;
- playback uses edited arrangement, not stale imported candidate;
- healthy path uses sampled harmonica;
- degraded state is explicit.

## 17. Save and reopen editor projects

Add a deterministic editor project JSON export and import.

File extension may be `.json` or a more descriptive suffix such as:

```text
my-song.harmonica-project.json
```

The workbench must reopen:

- source provenance;
- source inventory/candidates where embedded;
- selected base candidate;
- current editable arrangement;
- edit log or equivalent revision provenance;
- warnings and settings.

A lightweight IndexedDB autosave is allowed after core functionality works, but downloadable/reloadable project JSON is mandatory and sufficient for this iteration.

Do not store large owner source files in `localStorage`.

## 18. Export

Export the edited arrangement to:

- ABC;
- Standard MIDI;
- MusicXML 4.0;
- canonical arrangement JSON;
- editor project JSON.

All existing deterministic export guarantees continue to apply.

`Open in Song Practice` must pass the **edited** ABC and navigate safely from the nested tool route to the trainer root.

---

# Part IV — validation

## 19. Continuous validation

After every command, validate:

- monophony;
- positive durations;
- explicit rests/gaps;
- measure arithmetic;
- tie validity;
- written pitch/MIDI agreement;
- supported serializer values;
- 10-hole/12-hole range;
- empty arrangement;
- excessively dense events.

Errors block export. Warnings do not block export but remain visible and are included in JSON provenance.

## 20. Serializer improvements

Extend repository-native serializers only as needed for the editor’s supported subset.

At minimum preserve correctly:

- note/rest durations;
- dots;
- barlines;
- accidentals/spelling;
- ties across barlines;
- tempo;
- meter;
- key preference;
- pickup where already represented.

Do not claim support for arbitrary MusicXML polyphony or engraving semantics.

---

# Part V — automated tests

## 21. Route tests

Test preview and deployed route:

- direct nested URL returns 200;
- refresh returns 200;
- canonical trailing slash works;
- base assets resolve;
- Back to Trainer works;
- Open in Song Practice works;
- root trainer remains unaffected.

A browser test that only reaches the workbench through client navigation is insufficient.

## 22. Domain command tests

Cover every command family:

- apply;
- undo;
- redo;
- deterministic IDs;
- selection retention;
- no overlap invariant;
- explicit rest behavior;
- ripple timing;
- split/merge/tie;
- transpose/range operations;
- metadata edits.

## 23. Editor browser tests

At minimum:

1. import synthetic MIDI;
2. choose a candidate;
3. create editable arrangement;
4. select a note;
5. drag pitch vertically;
6. change duration;
7. respell accidental;
8. insert note;
9. insert rest;
10. delete and close gap;
11. delete and leave rest;
12. split/merge/tie;
13. undo/redo;
14. audition from selection and stop;
15. export/reimport editor project JSON;
16. export ABC/MIDI/MusicXML twice and compare bytes;
17. open edited result in Song Practice;
18. validate 10-hole/12-hole range warnings;
19. phone selection/toolbar/inspector flow;
20. keyboard accessibility.

## 24. Regression fixtures

Use only synthetic, original, or public-domain fixtures.

Include fixtures with:

- wrong imported pitch requiring correction;
- wrong duration;
- omitted rest;
- extra note;
- accidental respelling;
- note crossing a barline;
- repeated equal notes;
- pickup;
- out-of-range note;
- simple triplet if supported.

Do not commit downloaded commercial scores or recordings.

---

# Part VI — design and accessibility

## 25. Visual design

Use the existing light/dark/system design tokens.

The editor should feel like part of the trainer, not a developer diagnostics page.

Requirements:

- notation is dominant;
- toolbar is compact;
- inspector is logically grouped;
- warnings are readable but not overwhelming;
- imported/raw diagnostics are secondary;
- no large dead-space cards for one control;
- no neon redesign;
- desktop and phone screenshots reviewed at original size.

## 26. Keyboard and accessibility

At minimum:

- Tab reaches toolbar and score selection;
- Left/Right selects previous/next event;
- Up/Down changes pitch through documented semantics;
- Delete removes using the selected delete policy;
- Ctrl/Cmd+Z undo;
- Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo;
- Space toggles audition when focus is not in a text field;
- accessible names expose note/rest, pitch, measure and duration;
- drag operations have keyboard alternatives.

---

# Part VII — implementation boundaries

## 27. Suggested modules

```text
src/score-import/
  core.ts
  ScoreImportWorkbench.tsx
  main.tsx

src/score-editor/
  editorTypes.ts
  EditableArrangement.ts
  commands/
  validation.ts
  serialization.ts
  ScoreCorrectionEditor.tsx
  EditorToolbar.tsx
  EventInspector.tsx
  TimingLane.tsx
  editorSelection.ts
```

Names may differ.

Keep framework-independent command/domain logic outside React components.

## 28. abcjs boundary

Use abcjs for engraving, selection and visual vertical dragging.

Do not make abcjs SVG DOM the editor’s source of truth. On every gesture:

```text
abcjs callback
      ↓
resolve stable event ID
      ↓
create EditCommand
      ↓
update EditableArrangement
      ↓
serialize ABC
      ↓
rerender abcjs
```

Any reliance on abcjs element/source internals stays isolated behind the existing notation adapter or a new editor adapter with tests.

## 29. Out of scope

Do not implement in this iteration:

- polyphonic score editing;
- multiple staves;
- lyrics;
- chord-symbol editing;
- layout/engraving customization;
- hosted persistence;
- accounts;
- community publishing;
- OMR;
- MuScriptor or Basic Pitch inference in the deployed GitHub Pages bundle;
- Cloudflare/Replicate/Lambda services;
- autonomous commercial-song publication;
- full arrangement assembly from several source tracks.

The domain should remain extensible to a later section/arrangement assembler, but that is not acceptance scope.

---

# Part VIII — completion contract

## 30. Required verification

Run at minimum:

```bash
bun install --frozen-lockfile
bun run verify:colors
bun run typecheck
bun test
bun run benchmark:pitch
bun run score:benchmark
bun run build
bun run test:browser
bun run test:production
```

Add focused editor and route scripts if useful.

Open and inspect:

- direct workbench URL desktop;
- direct refresh;
- import/extract/edit/export desktop;
- pitch drag;
- duration edit;
- timing lane;
- undo/redo;
- validation error;
- 10-hole range warning;
- phone editor;
- edited Song Practice handoff;
- light and dark themes.

Perform at least one visual correction pass.

## 31. Cloud Codex integration

The active environment is cloud Codex.

- work on a branch;
- create a PR;
- do not commit generated binary screenshots;
- keep screenshot output ignored/reproducible;
- merge after verification;
- wait for authoritative GitHub Pages deployment;
- verify live `build-meta.json` equals the merge SHA;
- run live route and production tests;
- stop for owner review.

## 32. Final report

Report:

- starting SHA;
- final branch SHA and merge SHA;
- PR;
- Pages workflow;
- live root URL;
- live workbench URL;
- direct-route/refresh proof;
- editor architecture;
- supported commands;
- abcjs drag mapping;
- deterministic export hashes;
- unit/browser/live test results;
- screenshot locations generated locally but not committed;
- known editor limitations;
- manual owner checklist.

The task is complete only when the direct URL works on GitHub Pages and a user can import a candidate, correct it visually, undo/redo, export deterministic outputs, reopen the project, and open the edited result in Song Practice.
