# Audio transcription and OMR research backlog

Status: **deferred research after the correction editor**  
Scope: **multi-instrument audio transcription, monophonic comparison, OMR, local/server execution and licensing constraints**

The Score Import Workbench and correction editor establish a deterministic destination for imperfect symbolic data. That editor should exist before adding more recognition systems: MIDI, OMR and audio-transcription outputs will all require correction.

This document records promising future adapters without making them dependencies of the current GitHub Pages application.

---

## 1. Separation of concerns

Future source paths should all terminate at the existing import boundary:

```text
PDF/image → OMR → MusicXML/MXL ───────┐
                                      │
complex audio → AMT model → MIDI ─────┤
                                      ↓
                            Score Import Workbench
                                      ↓
                              correction editor
                                      ↓
                         monophonic arrangement / ABC
```

Recognition models must not bypass provenance, warnings, candidate selection or correction.

---

## 2. MuScriptor

Relevant project:

- Hugging Face: `MuScriptor/muscriptor-large`
- code: `muscriptor/muscriptor`

MuScriptor is designed for general multi-instrument automatic music transcription. It outputs MIDI-like note events containing pitch, onset, offset and an instrument group. It is therefore potentially useful when the source is a complete song with several simultaneous parts and the Workbench needs candidate instrument lines rather than one monophonic recording.

### Model variants

- small: approximately 100M parameters;
- medium: approximately 300M parameters and the practical default trade-off;
- large: approximately 1.3–1.4B parameters and the highest-quality published checkpoint.

The large model should be treated as GPU-oriented. Small/medium are better first benchmark candidates on CPU or modest hardware.

### Useful capabilities

- multi-instrument audio-to-MIDI;
- onset and offset recovery;
- instrument-group assignment;
- instrument conditioning/restriction;
- CLI and Python API;
- local FastAPI/web server in the upstream project;
- MIDI output that can enter the current Workbench unchanged.

### Limitations

- not a substitute for a hand-annotated score;
- dense mixes and uncommon timbres still produce errors;
- no velocity/dynamics output;
- instrument taxonomy is coarse;
- exact offsets are less reliable than onsets;
- chunked inference can affect boundary behavior;
- simultaneous same-pitch notes in the same instrument group cannot be represented distinctly;
- output is performance MIDI, not engraved notation.

### Licensing and access

- upstream code is MIT;
- model weights are gated and released under CC BY-NC 4.0;
- the model card imposes rights requirements for input recordings and generated transcriptions;
- do not assume commercial hosted use is allowed;
- no public Inference Provider is currently available for the large Hugging Face checkpoint;
- a future hosted adapter therefore requires self-hosting or a custom service plus explicit license review.

MuScriptor must initially be a **local/research adapter only**.

---

## 3. Future MuScriptor adapter contract

A later local adapter may use:

```text
MUSCRIPTOR_BIN=/path/to/muscriptor
```

or a separately configured local HTTP endpoint.

Expected workflow:

```text
rights-cleared audio
      ↓
MuScriptor small / medium / large
      ↓
multi-track MIDI or note-event JSON
      ↓
existing MIDI importer
      ↓
per-instrument inventory and candidates
      ↓
correction editor
```

The adapter should preserve:

- model name/version/hash;
- command/options;
- instrument conditioning;
- source audio hash;
- raw note-event JSON where available;
- generated MIDI;
- warnings and processing diagnostics.

Do not embed model weights in the browser bundle.

---

## 4. MuScriptor benchmark

Use only original, public-domain or otherwise rights-cleared recordings.

Compare:

- native monophonic harmonica pipeline;
- Basic Pitch;
- MuScriptor small;
- MuScriptor medium;
- MuScriptor large where GPU resources permit.

Fixture families:

1. solo harmonica;
2. melody plus simple accompaniment;
3. voice plus bass/drums;
4. dense pop arrangement;
5. classical ensemble;
6. source where the desired melody changes instrument between sections.

Metrics:

- pitch precision/recall;
- onset/offset error;
- correct instrument-group assignment;
- continuity across chunks;
- useful candidate-line recall;
- amount of manual correction required;
- processing time and hardware;
- reproducibility;
- Workbench warnings;
- final arrangement usability rather than only raw event F1.

The most important product metric is not merely transcription F1. It is:

> How quickly can an owner or agent obtain a trustworthy monophonic line after candidate selection and correction?

---

## 5. Hosted execution options

Not part of the current task.

Possible later architectures:

### Local desktop tool

- simplest privacy and licensing story;
- direct CLI integration;
- best for experiments;
- GPU optional depending on model size.

### Self-hosted container

- upstream already provides a FastAPI-style server path;
- can run on a GPU machine;
- Cloudflare Worker can later create jobs and store status/results, but should not execute the model itself.

### Replicate/custom GPU service

- technically plausible through a custom model container;
- requires gated weight access and accepted license terms;
- requires explicit review of non-commercial restrictions before product use;
- source recordings must not be uploaded without the user having the necessary rights.

### Lambda

- ordinary CPU Lambda is not a good target for the large model;
- container/image size, model download and cold start are problematic;
- GPU/container jobs are more appropriate.

---

## 6. OMR backlog

Audiveris remains the preferred first local open-source OMR benchmark:

```text
PDF/image → Audiveris CLI → MXL → Workbench → correction editor
```

Benchmark after the editor exists.

Compare at least:

- vector PDF when available;
- clean printed raster PDF;
- phone photo;
- single-staff melody;
- piano score;
- ties, beams, accidentals, tuplets and multiple voices.

Do not embed Java-based OMR in GitHub Pages. A future server job may wrap it, but local CLI is the first experiment.

---

## 7. Deferred product decisions

Do not decide yet:

- whether MuScriptor or Basic Pitch becomes the default complex-audio path;
- whether transcription is offered in the public product;
- whether a paid/commercial license is needed;
- which hosted provider is used;
- whether source audio is retained;
- whether OMR and AMT jobs are synchronous;
- how community uploads are moderated.

The correction editor and real benchmark results should inform these choices.
