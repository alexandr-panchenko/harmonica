# Active Codex task — build the deterministic Score Import Workbench

Execute this task autonomously from the latest `main` in the cloud Codex environment.

Read completely before editing:

1. [`docs/score-ingestion-workbench-spec.md`](docs/score-ingestion-workbench-spec.md) — binding product, architecture, security, test and completion specification;
2. [`docs/architecture.md`](docs/architecture.md);
3. [`docs/audio-pipeline.md`](docs/audio-pipeline.md);
4. [`docs/product-roadmap.md`](docs/product-roadmap.md);
5. [`README.md`](README.md);
6. current melody, ABC, notation, audio, song-library, import and deployment code.

The trainer and reference playback are stable enough for this iteration. Do not reopen previous visual/practice tasks unless the new import path exposes a focused regression.

---

## Mission

Deliver a deployed, local-first Score Import Workbench that:

- imports Standard MIDI files;
- imports MusicXML and compressed MXL;
- transcribes monophonic WAV/microphone audio through the existing production harmonica pipeline;
- preserves raw source timing separately from quantized notation;
- inventories tracks, parts, channels and voices;
- creates explicit monophonic candidate lines rather than silently choosing one;
- exposes deterministic extraction, quantization, spelling and range settings;
- previews the selected candidate through abcjs and sampled-harmonica playback;
- exports deterministic ABC, MIDI, MusicXML and canonical JSON;
- provides a Bun CLI using the same core modules;
- generates a deterministic synthetic benchmark report;
- includes optional local wrappers for MuseScore, Audiveris and Basic Pitch that skip cleanly when their executables are unavailable;
- deploys on the existing GitHub Pages workflow without uploading user files.

Do not build a full notation editor or browser OMR service in this iteration.

---

## Required implementation order

### 1. Establish baseline

- fetch latest `main`;
- record starting SHA and live `build-meta.json`;
- run current verification;
- inspect existing `Melody`, ABC serializer/importer, audio pipeline, song-library import and playback boundaries;
- verify current direct ABC import and practice flows before changing them.

### 2. Introduce the shared import domain

Implement the canonical source/project/candidate/provenance/warning models from the specification.

Mandatory properties:

- stable IDs derived from source hash and structural indices;
- canonical integer tick time base at `CANONICAL_PPQ = 960`;
- raw source data preserved independently of normalized events;
- deterministic settings hash;
- no wall-clock timestamps inside deterministic project output;
- explicit warnings instead of silent data loss.

Keep import-domain code framework-independent.

### 3. MIDI import and deterministic interpretation

Add a pinned MIDI parser/writer and support:

- tracks, channels, names, programs, note timing/velocity;
- PPQ conversion;
- tempo, time and key metadata;
- pitch bends;
- per-track/channel source inventory;
- extraction strategies:
  - as written;
  - highest voice;
  - lowest voice;
  - documented deterministic voice-leading path;
- overlap policies;
- explicit constant-tempo/meter arrangement policy with warnings for flattened source changes;
- quantization, rest inference, measure splitting and ties;
- deterministic key/enharmonic spelling;
- candidate metrics and harmonica-range difficulty diagnostics.

Do not silently select the final artistic line.

### 4. MusicXML/MXL import and export

Support the required MusicXML subset in the specification, including parts, voices, measures, divisions, key/time/tempo, notes/rests, written spelling, ties, backup/forward, chords and pickup measures.

Use the existing `jszip` dependency for MXL with ZIP safety limits.

Implement a deterministic single-part MusicXML 4.0 exporter for a selected monophonic candidate.

This is the repository-native reproducible MIDI-to-MusicXML path:

```text
MIDI → raw model → selected/quantized candidate → deterministic MusicXML
```

Document clearly that it is a deterministic interpretation under explicit settings, not a lossless reconstruction of an unknown original score.

### 5. Monophonic audio and recording import

Reuse the existing production audio pipeline and note segmenter.

- WAV is mandatory;
- other browser-decodable audio is optional;
- keep expressive onset/duration, MIDI, cents, RMS/velocity and pitch trace;
- allow explicit tempo, meter, start offset and grid to create a notation candidate;
- add a guided local microphone recorder with count-in/metronome;
- export expressive MIDI, including optional pitch-bend envelopes where practical;
- do not embed Basic Pitch or another heavy model in the production browser bundle.

### 6. Browser workbench

Add a production screen/route such as `/tools/score-import` and a discoverable entry from the song library.

Workflow:

1. choose/drop source or record;
2. inspect source summary;
3. choose track/part/voice/candidate;
4. choose extraction/quantization/key/range settings;
5. review abcjs score, raw-versus-quantized timing, warnings and metrics;
6. audition through sampled harmonica;
7. download ABC, MIDI, MusicXML and JSON;
8. temporarily open the candidate in Song Practice without persistence.

Keep direct ABC import working.

State clearly that processing is local and files are not uploaded.

### 7. Bun CLI and optional adapters

Add shared-core CLI commands, including:

```bash
bun run score:ingest -- <input> --output <dir>
bun run score:benchmark
```

Implement optional wrappers:

- `MUSESCORE_BIN` — reference MIDI-to-MusicXML conversion;
- `AUDIVERIS_BIN` — local PDF/image to MXL reference path;
- `BASIC_PITCH_BIN` — optional audio-to-MIDI comparator.

Cloud completion must not depend on these binaries. Tests must report clean skips when unavailable.

Do not scrape MuseScore.com or reverse engineer browser extensions.

### 8. Deterministic benchmark

Commit only synthetic/original/public-domain fixtures.

Generate equivalent MIDI, MusicXML, canonical JSON and synthetic WAV fixtures plus multitrack/polyphonic edge cases.

Produce JSON and human-readable reports covering:

- pitch precision/recall;
- onset/duration error;
- rests/ties;
- spelling;
- warnings;
- candidate metrics;
- output hashes;
- processing time.

Run the same import twice and prove stable IDs and byte-stable deterministic outputs, excluding timing measurements.

### 9. Security and resource limits

Implement all limits from the specification:

- file and decompressed MXL size caps;
- ZIP-slip prevention;
- MIDI event caps;
- browser audio duration cap;
- chunked/responsive processing;
- safe XML handling;
- no source-provided execution.

### 10. Cleanup and documentation

After parity:

- keep browser and CLI on one shared import core;
- remove any throwaway duplicate importer code;
- add local import/output paths to `.gitignore`;
- update README, architecture, product roadmap and release report;
- add external-tool setup notes;
- report the recommended next phase based on results: visual correction editor or OMR benchmark.

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

Add focused tests for every required importer, exporter, deterministic transform, browser flow, CLI flow and security limit in the binding specification.

External-tool tests may skip only when the corresponding binary is absent; the repository-native MIDI/MusicXML/audio paths may not skip.

Open and inspect the workbench at desktop and phone sizes. Perform at least one correction pass.

---

## Preserve

Do not regress:

- current practice application and menu;
- microphone display/accepted/completed-state architecture;
- sampled-harmonica playback;
- abcjs Timeline notation;
- transport and seeking;
- 10-hole/12-hole profiles;
- direct ABC import;
- light/dark/system themes;
- GitHub Pages deployment and build metadata.

---

## Excluded

Do not implement:

- Cloudflare/backend persistence;
- accounts or public song libraries;
- achievements;
- improvisation mode;
- scraping/reverse engineering MuseScore sources;
- browser PDF/image OMR;
- Replicate/Lambda OMR hosting;
- a full graphical notation editor;
- autonomous publication of commercial-song arrangements;
- unrelated visual redesign.

---

## Deployment and completion

After local verification:

1. update canonical documentation honestly;
2. create a detailed commit;
3. push the working branch and create a pull request if cloud integration requires it;
4. merge through the available repository workflow;
5. wait for authoritative GitHub Pages deployment;
6. verify live `build-meta.json` equals final `main`;
7. run live production tests and workbench smoke tests;
8. leave a clean worktree;
9. report final SHA, PR/merge, workflow, live URL, formats, benchmark, tests, skipped optional adapters and known limitations;
10. stop for owner review.

The task is complete only when the live workbench imports MIDI, MusicXML/MXL and monophonic WAV, exports deterministic ABC/MIDI/MusicXML/JSON, and the existing trainer remains functional.
