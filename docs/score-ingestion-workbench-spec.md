# Harmonica Trainer score-ingestion workbench specification

Status: **binding specification for the next autonomous Codex iteration**  
Scope: **deterministic MIDI/MusicXML ingestion, monophonic audio transcription, source comparison, preview, and export**

The practice application is now usable enough to shift attention to repertoire preparation. The immediate bottleneck is no longer playback or training logic: it is obtaining trustworthy symbolic melody data and turning it into a clean monophonic arrangement that the application can review, edit later, and add to the song library.

This iteration builds the ingestion foundation. It does **not** build a full notation editor, a cloud OMR service, or an autonomous copyrighted-song arranger.

---

## 1. Product goal

Create one local-first **Score Import Workbench** that can take:

- Standard MIDI files (`.mid`, `.midi`);
- MusicXML (`.musicxml`, `.xml`);
- compressed MusicXML (`.mxl`);
- a monophonic harmonica recording (`.wav` required; other browser-decodable formats optional);
- microphone recording made inside the workbench;

and produce a deterministic, inspectable `ScoreImportProject` containing:

- raw source structure;
- available tracks, parts, channels and voices;
- one or more monophonic melody candidates;
- explicit quantization and spelling settings;
- warnings and provenance;
- an abcjs notation preview;
- sampled-harmonica playback;
- export to ABC, MIDI, MusicXML and canonical JSON.

The tool must help an agent or owner prepare source material. It must not silently claim that one extracted line is the final artistic arrangement.

---

## 2. Core principles

### 2.1 Deterministic interpretation, not mythical lossless conversion

MIDI does not uniquely determine written notation. The workbench must make interpretation settings explicit and reproducible:

- selected track/channel/voice;
- melody-extraction strategy;
- meter and tempo policy;
- quantization grid;
- onset and duration tolerances;
- minimum note/rest duration;
- overlap resolution;
- enharmonic spelling/key preference;
- octave transposition;
- playable range.

The same source bytes, importer version and settings must produce the same canonical events and serialized outputs.

### 2.2 Preserve raw data before quantization

Never destroy the source timing during import. Store both:

- raw tick/second timing;
- normalized/quantized notation timing.

A user must be able to change quantization settings without re-reading the source file.

### 2.3 One canonical time base

Use integer musical ticks internally for symbolic notation.

```ts
export const CANONICAL_PPQ = 960;
```

All MIDI ticks and MusicXML `divisions` values convert to this canonical PPQ without floating-point drift. Audio retains raw seconds/milliseconds and receives canonical ticks only through an explicit tempo/quantization operation.

### 2.4 Local and private by default

- Imported files stay in the browser or local CLI process.
- No source file is uploaded.
- Do not add telemetry.
- Do not commit owner-downloaded commercial MIDI/PDF/audio files.
- Add local import/output directories to `.gitignore`.
- Test fixtures must be synthetic, original, or clearly public domain.

### 2.5 Shared core, multiple front ends

Browser workbench and Bun CLI must call the same pure TypeScript import, normalization and serialization modules. Do not implement two converters.

---

# Part I — canonical import model

## 3. Project model

Introduce a format-independent model similar to the following. Names may differ, but the information and separation are required.

```ts
type ScoreSourceType = "midi" | "musicxml" | "audio" | "microphone" | "omr";

type ImportSeverity = "info" | "warning" | "error";

interface ImportWarning {
  code: string;
  severity: ImportSeverity;
  message: string;
  sourceLocation?: {
    track?: number;
    channel?: number;
    partId?: string;
    voice?: string;
    measure?: number;
    sourceStart?: number;
  };
  eventIds?: string[];
}

interface SourceProvenance {
  sourceType: ScoreSourceType;
  fileName: string;
  byteLength: number;
  sha256: string;
  importer: string;
  importerVersion: string;
  importedAt?: never; // deterministic project data must not contain timestamps
  externalTool?: {
    name: string;
    version?: string;
    command?: string[];
  };
}

interface RawImportedNote {
  id: string;
  sourceTrack?: number;
  sourceChannel?: number;
  sourcePart?: string;
  sourceVoice?: string;
  midi: number;
  velocity?: number;
  startTick?: number;
  durationTick?: number;
  startSeconds?: number;
  durationSeconds?: number;
  pitchTrace?: { offsetMs: number; midiFloat: number; confidence: number }[];
}

interface QuantizationSettings {
  grid: "off" | "1/4" | "1/8" | "1/8T" | "1/16" | "1/16T" | "1/32";
  onsetToleranceTicks: number;
  durationToleranceTicks: number;
  minimumNoteTicks: number;
  minimumRestTicks: number;
  preserveArticulationGap: boolean;
}

interface MelodyExtractionSettings {
  sourceId: string;
  strategy: "as-written" | "highest" | "lowest" | "voice-leading";
  overlapPolicy: "trim-previous" | "prefer-louder" | "prefer-longer" | "reject";
  octaveShift: number;
  minMidi?: number;
  maxMidi?: number;
}

interface ScoreImportCandidate {
  id: string;
  label: string;
  sourceDescription: string;
  rawNotes: RawImportedNote[];
  canonicalEvents: MelodyEvent[];
  tempoQpm: number;
  meter: { numerator: number; denominator: number };
  key?: { tonic: string; mode: string; prefer: "sharps" | "flats" };
  quantization: QuantizationSettings;
  extraction: MelodyExtractionSettings;
  warnings: ImportWarning[];
  metrics: CandidateMetrics;
}

interface ScoreImportProject {
  schemaVersion: 1;
  provenance: SourceProvenance;
  sourceSummary: SourceSummary;
  candidates: ScoreImportCandidate[];
  selectedCandidateId?: string;
  settingsHash: string;
}
```

Use stable IDs derived from source hash plus deterministic structural indices. Do not use random UUIDs or wall-clock time in serialized project data.

## 4. Candidate metrics

Calculate descriptive metrics for each candidate:

- note count;
- duration;
- pitch range;
- monophony ratio;
- overlapping-note count;
- chord-density ratio;
- median and maximum interval;
- note density;
- rest ratio;
- repeated-note ratio;
- percentage inside selected 10-hole/12-hole ranges;
- estimated slider changes;
- estimated breath changes;
- maximum hole jump under deterministic fingering planning.

These metrics help compare source lines. They are not a claim of artistic quality.

---

# Part II — MIDI ingestion

## 5. MIDI parser

Use a maintained, pinned JavaScript/TypeScript MIDI parser/writer such as `@tonejs/midi`, unless repository inspection proves a smaller existing dependency is preferable.

Parse and preserve:

- PPQ;
- tracks;
- channels;
- track names;
- General MIDI program/instrument metadata;
- note pitch, velocity, tick/time and duration;
- tempo map;
- time signatures;
- key signatures when present;
- pitch bends where present.

Do not quantize during parsing.

## 6. Source inventory

For every MIDI file, expose:

- one candidate per non-empty track/channel combination;
- track/instrument metadata;
- polyphony/overlap metrics;
- register and note-count summary;
- audition of each source line;
- a small piano-roll/source-event preview.

## 7. Melody extraction strategies

A source track may contain chords or several voices. Implement deterministic candidate strategies:

### As written

Use a source only if it is already monophonic within a small tolerance; otherwise emit warnings or reject according to settings.

### Highest voice

At every overlap, retain the highest active pitch.

### Lowest voice

At every overlap, retain the lowest active pitch.

### Voice-leading melody

Use a documented dynamic-programming path through note candidates. The cost should consider:

- interval size;
- continuity;
- duration;
- velocity;
- register preference;
- repeated notes;
- large discontinuities;
- brief chord tones.

Do not hide the algorithm. Expose the chosen source note IDs and alternatives in diagnostics.

The workbench may rank candidates by melodic suitability, but the owner/agent explicitly chooses the line used for export.

## 8. Tempo and meter policy

MIDI may contain changes that the current trainer cannot represent fully.

Required behavior:

- preserve the complete source tempo/time-signature map in provenance;
- support a constant-tempo arrangement output;
- default to the first musically active tempo/time signature;
- allow explicit override;
- emit warnings when source changes are flattened;
- never silently discard changes.

## 9. Quantization

Quantization is an explicit transform from raw ticks to canonical ticks.

Required:

- grid presets listed in `QuantizationSettings`;
- visual before/after timing comparison;
- quantization error per note;
- warning when error exceeds tolerance;
- rest inference from gaps;
- note splitting and ties at measure boundaries;
- handling of near-zero notes and overlaps;
- reversible settings change using preserved raw notes.

## 10. Enharmonic spelling

MIDI pitch numbers do not preserve C-sharp versus D-flat.

Provide:

- source key signature when present;
- user key override;
- `prefer sharps / prefer flats` override;
- deterministic spelling table;
- warnings when a chromatic passage has ambiguous spelling.

Do not claim to recover original spelling from MIDI.

---

# Part III — MusicXML ingestion and export

## 11. Inputs

Support:

- uncompressed `.musicxml` and `.xml`;
- compressed `.mxl` using the existing `jszip` dependency;
- MusicXML partwise documents as the required first format.

## 12. Supported MusicXML subset

Import at minimum:

- part list and part names;
- measures;
- divisions;
- key and time signatures;
- tempo from `sound`/metronome directions;
- notes and rests;
- duration;
- voice;
- staff;
- ties;
- accidentals and written pitch;
- `backup` and `forward` timing;
- chords;
- pickup measures;
- simple transposing-instrument metadata, with warning if flattened.

Preserve part and voice structure so users can choose a melody source.

Unsupported or partially supported constructs must produce explicit warnings rather than being silently ignored, including:

- tuplets/time modifications;
- grace notes;
- repeats and alternate endings;
- ornaments;
- multiple simultaneous staves;
- complex directions;
- percussion/unpitched events.

## 13. MusicXML exporter

Implement a deterministic single-part MusicXML exporter for the selected monophonic candidate.

Required output:

- MusicXML 4.0 partwise document;
- stable divisions value;
- title/part metadata supplied by the user;
- key, time and tempo;
- measures;
- notes and rests;
- written spelling;
- split notes and ties across barlines;
- deterministic element ordering and whitespace;
- no generated timestamp.

This exporter is the repository-native deterministic MIDI-to-MusicXML path:

```text
MIDI bytes → raw MIDI model → selected/quantized candidate → MusicXML
```

It must be documented as a reproducible interpretation under explicit settings, not lossless restoration of the source score.

---

# Part IV — monophonic audio and microphone transcription

## 14. Reuse the production audio pipeline

Do not build a second pitch detector.

Decode uploaded audio to PCM and feed frames through the same production `ProductionAudioPipeline` / tracker / segmenter used by microphone input. Recording inside the workbench must use the same path.

Guaranteed first input format: WAV. Other formats may be supported only when `AudioContext.decodeAudioData` succeeds.

## 15. Two audio outputs

### Expressive transcription

Preserve:

- real onset and duration in seconds;
- classified MIDI;
- median frequency/cents;
- velocity estimate from calibrated RMS;
- pitch trace;
- optional MIDI pitch-bend envelope.

This is the closest representation of what was played.

### Quantized notation candidate

Require explicit:

- tempo;
- meter;
- count-in/start offset;
- quantization grid;
- articulation-gap behavior.

Convert expressive segments to canonical ticks and notation only after those settings are chosen.

Do not attempt magical full-song beat tracking in this iteration.

## 16. Guided recording

Add a simple local recorder:

- choose tempo and meter;
- optional metronome/count-in;
- record monophonic harmonica;
- stop;
- inspect detected note segments;
- compare expressive and quantized views;
- export MIDI/ABC/MusicXML/JSON.

The existing microphone sensitivity, device, calibration and output-contamination behavior must be reused.

## 17. Audio-to-MIDI export

Use the MIDI writer to export:

- one melody track;
- note on/off times;
- velocity;
- tempo and meter;
- optional pitch-bend events with an explicit bend range.

The browser must not embed a heavy Basic Pitch model in the production bundle in this iteration.

---

# Part V — browser workbench

## 18. Route and discoverability

Add a production route/screen for the local tool, for example:

```text
/tools/score-import
```

Provide a clear entry from the song library such as **Prepare a song** or **Import MIDI / MusicXML / audio**. Keep existing direct ABC import working.

The workbench is local-only and should say so clearly.

## 19. Workflow

Use a stepwise but compact layout:

### Step 1 — Source

- drop/select file or record harmonica;
- identify type;
- display source hash and summary;
- report malformed input clearly.

### Step 2 — Choose material

- tracks/parts/channels/voices list;
- metadata and metrics;
- audition;
- choose extraction strategy;
- compare generated candidates.

### Step 3 — Normalize

- tempo and meter policy;
- quantization controls;
- key/spelling;
- octave shift;
- 10-hole/12-hole range validation;
- warnings.

### Step 4 — Review

- abcjs score preview;
- sampled-harmonica playback;
- raw-versus-quantized event/piano-roll view;
- source provenance;
- candidate metrics;
- warning list linked to events.

### Step 5 — Export

- download ABC;
- download MIDI;
- download MusicXML;
- download canonical JSON project;
- copy ABC;
- open the selected candidate temporarily in Song Practice without persisting it.

## 20. No full note editor yet

This workbench is for ingestion, selection, normalization and review.

Do not implement in this iteration:

- arbitrary drag-to-edit notation;
- insertion/deletion toolbar;
- graphical tie editing;
- full undo/redo score editor;
- persistent user song library.

Design the canonical model and event IDs so the next editor task can build on them.

---

# Part VI — CLI and external adapters

## 21. Bun CLI

Add scripts such as:

```bash
bun run score:ingest -- input.mid --output ./scratch/import
bun run score:benchmark
```

The CLI must support MIDI, MusicXML/MXL and WAV through the same core modules as the browser.

Useful options:

```text
--candidate <id>
--track <number>
--channel <number>
--strategy as-written|highest|lowest|voice-leading
--grid 1/16
--tempo 96
--meter 4/4
--key Dm
--prefer sharps|flats
--octave-shift 1
--profile c10|c12
--format abc,midi,musicxml,json
```

Write an import manifest containing source hash, settings, warnings, metrics and generated file hashes.

## 22. Optional MuseScore reference adapter

Implement an optional CLI adapter that runs only when `MUSESCORE_BIN` is configured.

Purpose:

- convert MIDI to MusicXML with MuseScore as a reference;
- compare MuseScore output with the repository-native interpretation;
- record executable version and command in provenance.

Use MuseScore CLI export-to behavior; do not make MuseScore a required dependency for normal tests or browser use.

If the binary is unavailable, report a clean skipped adapter rather than failure.

## 23. Optional Audiveris adapter

Implement an optional local CLI wrapper that runs only when `AUDIVERIS_BIN` is configured.

Expected flow:

```text
PDF/image → Audiveris batch transcription/export → MXL → MusicXML importer
```

Use batch/transcribe/export/output arguments supported by the installed version. Record command/version and preserve the original source hash.

This task does not require Audiveris to be installed in the cloud environment and does not add PDF/image upload to the browser UI yet.

## 24. Optional Basic Pitch comparator

Define an external audio-transcription adapter and optional CLI wrapper for an installed `basic-pitch` executable.

Purpose:

- compare Basic Pitch note events against the existing harmonica-specialized pipeline;
- generate a benchmark report;
- never become a required browser dependency in this iteration.

If unavailable, skip cleanly.

---

# Part VII — deterministic benchmark

## 25. Fixtures

Commit only synthetic/original/public-domain fixtures.

Required fixture family:

1. one monophonic melody represented equivalently as:
   - MIDI;
   - MusicXML;
   - canonical JSON;
   - synthetic WAV;
2. a multitrack MIDI with:
   - melody track;
   - chord/accompaniment track;
   - bass track;
3. a polyphonic single-track MIDI for highest/lowest/voice-leading extraction;
4. tempo and meter metadata;
5. notes crossing barlines;
6. rests, repeated notes, accidentals and a pickup;
7. an amplitude-varying monophonic WAV with brief dropouts and articulation.

## 26. Benchmark report

Generate JSON and human-readable HTML/Markdown reports comparing:

- source note count;
- selected candidate note count;
- pitch precision/recall versus canonical fixture;
- onset and duration error before and after quantization;
- rest/tie reconstruction;
- spelling differences;
- warnings;
- deterministic output hashes;
- processing time.

For equivalent fixtures, MIDI and MusicXML imports should converge to the same canonical melody after matching settings. Audio is expected to have tolerances, not byte equality.

Optional external-adapter rows appear only when their binaries are available.

## 27. Reproducibility

Run the same import twice and assert:

- identical candidate IDs;
- identical canonical JSON;
- identical ABC;
- identical MIDI event data;
- identical MusicXML bytes;
- identical settings/output hashes.

Performance timings may be excluded from deterministic hashes.

---

# Part VIII — testing

## 28. Unit tests

Cover:

- MIDI PPQ conversion;
- tempo/time-signature parsing;
- track/channel inventory;
- all extraction strategies;
- deterministic voice-leading path;
- quantization grids including triplets;
- overlap policies;
- rest inference;
- measure splitting and ties;
- key-based spelling;
- MXL extraction;
- MusicXML voices/backup/forward;
- MusicXML exporter round-trip for the supported subset;
- stable IDs and hashes;
- audio segment-to-expressive-MIDI conversion;
- audio quantization;
- optional external command construction.

## 29. Browser tests

Cover:

- import each supported source type;
- source summary and warnings;
- candidate selection;
- quantization changes preview deterministically;
- 10/12-hole range warnings;
- playback of selected line;
- export downloads;
- open candidate in Song Practice;
- local-only/privacy message;
- malformed files;
- no existing practice-mode regression.

## 30. CLI tests

- run the CLI on fixtures;
- compare output hashes;
- verify manifest;
- cleanly skip optional binaries;
- fail with useful diagnostics on unsupported input.

---

# Part IX — documentation, security and deployment

## 31. Documentation

Update:

- README with Score Import Workbench entry and supported formats;
- architecture with the shared import core;
- product roadmap with ingestion milestone status and next editor/OMR phases;
- release report;
- a short local external-tools setup document for MuseScore, Audiveris and Basic Pitch adapters.

## 32. Security and resource limits

- validate ZIP/MXL entry paths and prevent ZIP-slip behavior;
- cap source file size and decompressed MXL size;
- cap MIDI note/event counts;
- cap audio duration for browser processing in this iteration;
- process large work in chunks and keep UI responsive;
- avoid rendering untrusted XML as HTML;
- do not execute source-provided commands or scripts.

## 33. Deployment

The browser workbench must deploy on the existing authoritative GitHub Pages workflow. External binaries are local CLI-only and must not affect Pages build.

Verify live:

- workbench route;
- MIDI import;
- MusicXML/MXL import;
- fixture WAV import;
- preview and exports;
- exact `build-meta.json` identity;
- existing practice application smoke tests.

---

# Part X — exclusions

Do not implement in this iteration:

- Cloudflare/backend storage;
- accounts or shared libraries;
- scraping or reverse engineering MuseScore.com or browser extensions;
- committing downloaded commercial songs;
- autonomous publication of copyrighted arrangements;
- PDF/image OMR in the browser;
- a hosted Replicate/Lambda OMR service;
- a full graphical notation editor;
- arbitrary polyphonic score reconstruction;
- automatic final artistic arrangement selection;
- improvisation mode or achievements.

---

# Part XI — completion contract

The iteration is complete only when:

- the browser workbench imports MIDI, MusicXML/MXL and monophonic WAV;
- the CLI uses the same core;
- raw data and quantized data remain separate;
- candidate selection and extraction are explicit;
- deterministic ABC/MIDI/MusicXML/JSON export works;
- a repository-native MIDI-to-MusicXML path is tested and documented;
- synthetic benchmark reports are generated;
- optional MuseScore/Audiveris/Basic Pitch adapters skip cleanly when unavailable;
- no copyrighted source files are committed;
- GitHub Pages deploys the exact tested commit;
- the existing trainer remains functional;
- the final report identifies limitations and the next recommended task: visual correction editor versus OMR benchmark.
