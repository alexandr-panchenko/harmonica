# Active Codex task — repair the Score Import route and build the correction editor

Execute this task autonomously from the latest `main` in the cloud Codex environment.

Read completely before editing:

1. [`docs/score-correction-editor-spec.md`](docs/score-correction-editor-spec.md) — binding route, editor, test and deployment specification;
2. [`docs/score-ingestion-workbench-spec.md`](docs/score-ingestion-workbench-spec.md) — existing deterministic import contract that must be preserved;
3. [`docs/transcription-models-backlog.md`](docs/transcription-models-backlog.md) — future MuScriptor/OMR context, not current implementation scope;
4. [`docs/architecture.md`](docs/architecture.md);
5. [`README.md`](README.md);
6. current score-import core/UI, notation adapter, playback, Song Practice handoff, tests, Vite configuration and Pages workflow.

The previous workbench implementation is merged, but its advertised direct GitHub Pages URL returns 404. Fix that first, then continue into the correction editor. Do **not** stop after the route fix.

---

## Mission

Deliver a merged and deployed production release that:

- serves a real static workbench page at `/harmonica/tools/score-import/`;
- survives direct navigation and refresh on GitHub Pages;
- uses base-safe navigation back to the trainer and into Song Practice;
- preserves repository-native MIDI, MusicXML/MXL and monophonic WAV import;
- turns a selected candidate into a separate editable monophonic arrangement;
- supports visual pitch correction on the abcjs score;
- supports duration, rest, insertion, deletion, split, merge, tie, spelling, transpose and crop corrections;
- provides deterministic command-based undo/redo;
- provides a compact timing lane for duration correction;
- preserves source provenance and raw imported data;
- validates monophony, timing, ties, spelling and harmonica range continuously;
- auditions the edited arrangement with sampled harmonica playback;
- exports/reimports an editor project and deterministic ABC/MIDI/MusicXML/JSON;
- opens the **edited** result in Song Practice;
- preserves authoritative Pages deployment and exact build identity.

Do not deliver only design documents or a route redirect. The live correction editor is the acceptance surface.

---

## Required implementation order

### 1. Establish baseline

- fetch latest `main`;
- record starting SHA and live `build-meta.json`;
- prove the current direct workbench URL returns 404;
- run existing unit/browser/import benchmark tests;
- inspect current `src/main.tsx`, Vite build inputs and nested-page navigation;
- inspect current candidate/project types and serializers;
- capture baseline workbench desktop/phone screenshots through the root navigation path.

### 2. Repair static routing structurally

Implement the real Vite multi-page architecture from the specification:

```text
index.html → trainer entry

tools/score-import/index.html → dedicated workbench entry
```

- add a dedicated workbench React entry;
- configure both HTML inputs in Vite;
- remove pathname-based tool selection from the trainer bootstrap;
- use canonical trailing-slash tool URLs;
- replace fragile `./` links with base-aware URL helpers;
- test direct load, refresh, Back to Trainer and Open in Song Practice;
- verify root app and labs remain unaffected.

Do not use a 404 redirect hack as the only fix.

### 3. Introduce the editable arrangement domain

Implement the framework-independent editor model and reversible command system from the specification.

Mandatory:

- source project/candidate remains immutable;
- editable arrangement uses canonical 960-PPQ integer ticks;
- explicit notes/rests and no overlap;
- stable deterministic IDs;
- ripple editing with explicit delete/insert behavior;
- command-based undo/redo;
- deterministic project serialization;
- continuous validation.

### 4. Refactor Workbench into Import / Extract / Edit / Export

- retain source inventory and candidate selection;
- add `Edit this candidate`;
- make notation the dominant editor surface;
- move raw timing/metrics/warnings to secondary panels;
- avoid another stack of sparse full-width diagnostic cards;
- support desktop and phone.

### 5. Build the visual correction editor

Implement:

- note/rest selection by stable ID;
- contiguous range selection;
- abcjs vertical drag updating canonical pitch and rerendering;
- keyboard pitch editing;
- exact pitch/spelling inspector;
- duration toolbar;
- note↔rest conversion;
- insert before/after;
- delete and close gap;
- delete and leave rest;
- split/merge;
- tie/untie;
- transpose selection/arrangement;
- octave shift;
- crop to selection;
- title/composer/tempo/meter/key editing;
- harmonica range and fingering diagnostics;
- original-versus-edited diff and reset.

Do not edit the SVG or raw ABC as source of truth. Every gesture creates an editor command, updates the arrangement, serializes and rerenders.

### 6. Add the compact timing lane

- synchronized blocks for canonical note/rest events;
- selected event state;
- quantized duration resize handle;
- insertion point;
- range selection where useful;
- audition playhead;
- same command system as the notation toolbar.

Do not build a DAW or arbitrary polyphonic piano roll.

### 7. Playback, save and export

- sampled-harmonica Play from start;
- Play from selection;
- Stop;
- loop selection;
- one non-overlapping playback session;
- deterministic editor project JSON export/import;
- edited ABC/MIDI/MusicXML/canonical JSON export;
- `Open in Song Practice` uses the edited arrangement and correct base URL.

### 8. Validation and serializer parity

Continuously validate the supported monophonic subset.

Extend serializers only as needed for:

- durations/dots;
- rests;
- barlines;
- written accidentals;
- ties across barlines;
- tempo/meter/key;
- pickup already represented by the domain.

Errors block export; warnings remain visible and serialized.

### 9. Cleanup and documentation

After parity:

- remove obsolete pathname workbench routing;
- keep browser and CLI on the same import core;
- keep editor domain outside React;
- update README and architecture;
- record route fix and editor limitations honestly;
- leave MuScriptor/OMR as deferred adapters described in `docs/transcription-models-backlog.md`.

---

## Verification

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

Add all focused route/editor tests required by `docs/score-correction-editor-spec.md`, especially:

- direct nested route and refresh;
- base-safe navigation;
- command apply/undo/redo;
- pitch drag;
- durations/rests/insertion/deletion;
- split/merge/tie;
- deterministic exports;
- project export/reimport;
- range diagnostics;
- sampled audition;
- edited Song Practice handoff;
- phone and keyboard flows.

Use only synthetic/original/public-domain fixtures. Do not commit commercial MIDI/PDF/audio or binary screenshot evidence.

Perform at least one visual correction pass after opening generated screenshots at original size.

---

## Preserve

Do not regress:

- deterministic Score Import core and CLI;
- MIDI/MusicXML/MXL/WAV imports;
- current trainer and Song Practice;
- sampled playback;
- production notation;
- 10-hole/12-hole profiles;
- themes;
- Pages workflow and build metadata.

---

## Excluded

Do not implement:

- MuScriptor inference;
- Basic Pitch inference;
- Audiveris/OMR processing;
- hosted transcription service;
- Cloudflare/Replicate/Lambda integration;
- polyphonic notation editing;
- multiple staves;
- full arrangement assembly from several source lines;
- accounts or hosted persistence;
- autonomous publication of copyrighted arrangements;
- unrelated feature expansion.

---

## Cloud PR, deployment and completion

After verification:

1. update canonical docs;
2. create a cloud Codex branch and PR;
3. keep generated screenshots out of the PR;
4. merge after checks;
5. wait for authoritative GitHub Pages deployment;
6. verify live `build-meta.json` equals the merge SHA;
7. prove the direct workbench route returns 200 and survives refresh;
8. run live production/editor smoke tests;
9. report and stop for owner review.

Final report must include:

- starting SHA;
- branch/final SHA and merge SHA;
- PR and workflow;
- live trainer/workbench URLs;
- direct-route proof;
- editor architecture and commands;
- abcjs drag semantics;
- deterministic export hashes;
- tests;
- generated screenshot locations;
- known limitations;
- owner manual checklist.

The task is complete only when the direct URL works and the live editor can import a candidate, correct it visually, undo/redo, export/reopen deterministically and open the edited result in Song Practice.
