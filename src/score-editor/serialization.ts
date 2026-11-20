import { Midi } from "@tonejs/midi";
import type { Melody, MelodyEvent } from "../music/melody";
import { CANONICAL_PPQ, stableStringify } from "../score-import/core";
import { deterministicSettingsHash, writtenPitchFromMidiAndPolicy } from "./EditableArrangement";
import type {
  EditableArrangement,
  EditableArrangementProject,
  EditableEvent,
} from "./editorTypes";
import { measureTicksForMeter } from "./validation";

export interface SerializedSegment {
  eventId: string;
  segmentIndex: number;
  kind: "note" | "rest";
  startTick: number;
  durationTick: number;
  measureIndex: number;
  midi?: number;
  writtenPitch?: EditableEvent["writtenPitch"];
  tieStart: boolean;
  tieEnd: boolean;
}

export interface AbcSerializationResult {
  abc: string;
  /** Ordered mapping from each written token index in ABC to the canonical EditableEvent.id */
  writtenTokenEventIds: string[];
  segments: SerializedSegment[];
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Formats tick duration relative to L:1/16 (240 ticks).
 * Supports whole/half/quarter/eighth/sixteenth/32nd, dotted values, and triplets deterministically.
 */
export function formatAbcDurationUnits(durationTick: number, unitTicks = 240): string {
  const ticks = Math.max(1, Math.round(durationTick));
  if (ticks === unitTicks) return "";
  const g = gcd(ticks, unitTicks);
  const num = Math.round(ticks / g);
  const den = Math.round(unitTicks / g);
  if (den === 1) return String(num);
  if (num === 1 && den === 2) return "/2";
  return `${num}/${den}`;
}

export function formatAbcPitchToken(event: {
  kind: "note" | "rest";
  midi?: number;
  writtenPitch?: EditableEvent["writtenPitch"];
}): string {
  if (event.kind === "rest") return "z";
  const w = event.writtenPitch ?? writtenPitchFromMidiAndPolicy(event.midi ?? 60, "sharps");
  const acc =
    w.accidental === "sharp"
      ? "^"
      : w.accidental === "flat"
        ? "_"
        : w.accidental === "natural"
          ? "="
          : "";
  const letter = w.octave >= 5 ? w.step.toLowerCase() : w.step;
  const oct =
    w.octave >= 6 ? "'".repeat(w.octave - 5) : w.octave < 4 ? ",".repeat(4 - w.octave) : "";
  return `${acc}${letter}${oct}`;
}

/**
 * Splits events that cross measure boundaries into barline-aligned segments with automatic ties for notes,
 * while preserving the exact canonical EditableEvent.id on every segment.
 */
export function buildMeasureAlignedSegments(arrangement: EditableArrangement): SerializedSegment[] {
  const measureTicks = measureTicksForMeter(arrangement.meter);
  const segments: SerializedSegment[] = [];

  for (const event of arrangement.events) {
    let remaining = Math.max(1, Math.round(event.durationTick));
    let cursor = Math.max(0, Math.round(event.startTick));
    let partIndex = 0;

    while (remaining > 0) {
      const measureIndex = Math.floor(cursor / measureTicks);
      const measureEnd = (measureIndex + 1) * measureTicks;
      const sliceTicks = Math.min(remaining, measureEnd - cursor);
      const isFirstPart = partIndex === 0;
      const isLastPart = sliceTicks === remaining;

      const tieEnd = event.kind === "note" ? (isFirstPart ? Boolean(event.tieIn) : true) : false;
      const tieStart = event.kind === "note" ? (isLastPart ? Boolean(event.tieOut) : true) : false;

      segments.push({
        eventId: event.id,
        segmentIndex: partIndex,
        kind: event.kind,
        startTick: cursor,
        durationTick: sliceTicks,
        measureIndex,
        midi: event.midi,
        writtenPitch: event.writtenPitch ? { ...event.writtenPitch } : undefined,
        tieStart,
        tieEnd,
      });

      cursor += sliceTicks;
      remaining -= sliceTicks;
      partIndex++;
    }
  }

  return segments;
}

export function serializeArrangementToAbcWithMap(
  arrangement: EditableArrangement,
): AbcSerializationResult {
  const segments = buildMeasureAlignedSegments(arrangement);
  const writtenTokenEventIds: string[] = [];
  const measures = new Map<number, string[]>();

  for (const seg of segments) {
    const pitchToken = formatAbcPitchToken(seg);
    const durToken = formatAbcDurationUnits(seg.durationTick, 240);
    const tieSuffix = seg.kind === "note" && seg.tieStart ? "-" : "";
    const token = `${pitchToken}${durToken}${tieSuffix}`;
    const list = measures.get(seg.measureIndex) ?? [];
    list.push(token);
    measures.set(seg.measureIndex, list);
    writtenTokenEventIds.push(seg.eventId);
  }

  const sortedMeasureIndices = [...measures.keys()].sort((a, b) => a - b);
  const bodyMeasures = sortedMeasureIndices.map((idx) => `${measures.get(idx)!.join(" ")} |`);

  const lines: string[] = [];
  for (let i = 0; i < bodyMeasures.length; i += 4) {
    lines.push(bodyMeasures.slice(i, i + 4).join(" "));
  }

  const keySuffix =
    arrangement.key.mode && arrangement.key.mode.toLowerCase() === "minor" ? "m" : "";
  const header = [
    "X:1",
    `T:${arrangement.title || "Untitled arrangement"}`,
    ...(arrangement.composer ? [`C:${arrangement.composer}`] : []),
    `M:${arrangement.meter.numerator}/${arrangement.meter.denominator}`,
    "L:1/16",
    `Q:1/4=${arrangement.tempoQpm}`,
    `K:${arrangement.key.tonic || "C"}${keySuffix}`,
  ];

  return {
    abc: `${header.join("\n")}\n${lines.join("\n")}\n`,
    writtenTokenEventIds,
    segments,
  };
}

export function serializeArrangementToAbc(arrangement: EditableArrangement): string {
  return serializeArrangementToAbcWithMap(arrangement).abc;
}

/**
 * Converts an EditableArrangement into a playable Melody (merging tied notes into continuous sounding notes for sampled playback).
 */
export function editableArrangementToMelody(
  arrangement: EditableArrangement,
  fromEventId?: string,
  selectionIds?: string[],
): Melody {
  const measureTicks = measureTicksForMeter(arrangement.meter);
  let sourceEvents = arrangement.events;

  if (selectionIds && selectionIds.length > 1) {
    const idSet = new Set(selectionIds);
    const indices = sourceEvents
      .map((e, idx) => (idSet.has(e.id) ? idx : -1))
      .filter((i) => i >= 0);
    if (indices.length > 0) {
      sourceEvents = sourceEvents.slice(indices[0]!, indices.at(-1)! + 1);
    }
  } else if (fromEventId) {
    const startIdx = sourceEvents.findIndex((e) => e.id === fromEventId);
    if (startIdx > 0) {
      sourceEvents = sourceEvents.slice(startIdx);
    }
  }

  const baseOffsetTick = sourceEvents[0]?.startTick ?? 0;
  const melodyEvents: MelodyEvent[] = [];

  for (const e of sourceEvents) {
    const startBeat = (e.startTick - baseOffsetTick) / CANONICAL_PPQ;
    const durationBeats = e.durationTick / CANONICAL_PPQ;
    const measureIndex = Math.floor(e.startTick / measureTicks);

    if (
      e.kind === "note" &&
      e.tieIn &&
      melodyEvents.length > 0 &&
      melodyEvents.at(-1)!.kind === "note" &&
      melodyEvents.at(-1)!.midi === e.midi
    ) {
      melodyEvents.at(-1)!.durationBeats += durationBeats;
      continue;
    }

    const tie =
      e.kind === "note"
        ? e.tieIn && e.tieOut
          ? "continue"
          : e.tieOut
            ? "start"
            : e.tieIn
              ? "end"
              : undefined
        : undefined;

    melodyEvents.push({
      id: e.id,
      kind: e.kind,
      startBeat,
      durationBeats,
      midi: e.midi,
      writtenPitch: e.writtenPitch ? { ...e.writtenPitch } : undefined,
      tie,
      measureIndex,
    });
  }

  return {
    id: arrangement.id,
    title: arrangement.title,
    composer: arrangement.composer,
    tempoQpm: arrangement.tempoQpm,
    meter: { ...arrangement.meter },
    events: melodyEvents,
  };
}

export function serializeArrangementToMidi(arrangement: EditableArrangement): Uint8Array {
  const midi = new Midi();
  midi.header.fromJSON({
    ...midi.header.toJSON(),
    ppq: CANONICAL_PPQ,
    name: arrangement.title,
    tempos: [{ ticks: 0, bpm: arrangement.tempoQpm }],
    timeSignatures: [
      {
        ticks: 0,
        timeSignature: [arrangement.meter.numerator, arrangement.meter.denominator],
      },
    ],
  });
  const track = midi.addTrack();
  track.name = arrangement.title;

  // Merge tied notes into single sounding MIDI note events
  let activeNote: { midi: number; startTick: number; durationTick: number } | null = null;
  for (const e of arrangement.events) {
    if (e.kind !== "note" || e.midi === undefined) {
      if (activeNote) {
        track.addNote({
          midi: activeNote.midi,
          ticks: activeNote.startTick,
          durationTicks: activeNote.durationTick,
          velocity: 0.8,
        });
        activeNote = null;
      }
      continue;
    }
    if (activeNote && e.tieIn && activeNote.midi === e.midi) {
      activeNote.durationTick += e.durationTick;
    } else {
      if (activeNote) {
        track.addNote({
          midi: activeNote.midi,
          ticks: activeNote.startTick,
          durationTicks: activeNote.durationTick,
          velocity: 0.8,
        });
      }
      activeNote = {
        midi: e.midi,
        startTick: e.startTick,
        durationTick: e.durationTick,
      };
    }
    if (!e.tieOut && activeNote) {
      track.addNote({
        midi: activeNote.midi,
        ticks: activeNote.startTick,
        durationTicks: activeNote.durationTick,
        velocity: 0.8,
      });
      activeNote = null;
    }
  }
  if (activeNote) {
    track.addNote({
      midi: activeNote.midi,
      ticks: activeNote.startTick,
      durationTicks: activeNote.durationTick,
      velocity: 0.8,
    });
  }

  return new Uint8Array(midi.toArray());
}

const KEY_FIFTHS: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  "F#": 6,
  F: -1,
  Bb: -2,
  Eb: -3,
  Ab: -4,
  Db: -5,
  Gb: -6,
  Am: 0,
  Em: 1,
  Bm: 2,
  "F#m": 3,
  Dm: -1,
  Gm: -2,
  Cm: -3,
  Fm: -4,
};

function xmlNoteTypeAndDots(ticks: number): { type: string; dots: number } {
  const table: { ticks: number; type: string; dots: number }[] = [
    { ticks: 3840, type: "whole", dots: 0 },
    { ticks: 2880, type: "half", dots: 1 },
    { ticks: 1920, type: "half", dots: 0 },
    { ticks: 1440, type: "quarter", dots: 1 },
    { ticks: 960, type: "quarter", dots: 0 },
    { ticks: 720, type: "eighth", dots: 1 },
    { ticks: 480, type: "eighth", dots: 0 },
    { ticks: 360, type: "16th", dots: 1 },
    { ticks: 320, type: "eighth", dots: 0 },
    { ticks: 240, type: "16th", dots: 0 },
    { ticks: 160, type: "16th", dots: 0 },
    { ticks: 120, type: "32nd", dots: 0 },
  ];
  const exact = table.find((item) => item.ticks === ticks);
  if (exact) return exact;
  if (ticks >= 1920) return { type: "half", dots: 0 };
  if (ticks >= 960) return { type: "quarter", dots: 0 };
  if (ticks >= 480) return { type: "eighth", dots: 0 };
  if (ticks >= 240) return { type: "16th", dots: 0 };
  return { type: "32nd", dots: 0 };
}

const escapeXml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[x]!,
  );

export function serializeArrangementToMusicXml(arrangement: EditableArrangement): string {
  const segments = buildMeasureAlignedSegments(arrangement);
  const measures = new Map<number, SerializedSegment[]>();
  for (const seg of segments) {
    const list = measures.get(seg.measureIndex) ?? [];
    list.push(seg);
    measures.set(seg.measureIndex, list);
  }
  if (measures.size === 0) {
    measures.set(0, []);
  }

  const keyName = `${arrangement.key.tonic}${arrangement.key.mode === "minor" ? "m" : ""}`;
  const fifths = KEY_FIFTHS[keyName] ?? KEY_FIFTHS[arrangement.key.tonic] ?? 0;

  const sortedIndices = [...measures.keys()].sort((a, b) => a - b);
  const xmlMeasures = sortedIndices
    .map((mIndex, idx) => {
      const attrs =
        idx === 0
          ? `<attributes><divisions>${CANONICAL_PPQ}</divisions><key><fifths>${fifths}</fifths><mode>${escapeXml(arrangement.key.mode || "major")}</mode></key><time><beats>${arrangement.meter.numerator}</beats><beat-type>${arrangement.meter.denominator}</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction placement="above"><sound tempo="${arrangement.tempoQpm}"/></direction>`
          : "";
      const notesXml = (measures.get(mIndex) ?? [])
        .map((seg) => {
          const { type, dots } = xmlNoteTypeAndDots(seg.durationTick);
          const dotXml = "<dot/>".repeat(dots);
          if (seg.kind === "rest") {
            return `<note><rest/><duration>${seg.durationTick}</duration><voice>1</voice><type>${type}</type>${dotXml}</note>`;
          }
          const w = seg.writtenPitch ?? writtenPitchFromMidiAndPolicy(seg.midi ?? 60, arrangement.key.prefer);
          const alterXml =
            w.accidental === "sharp"
              ? "<alter>1</alter>"
              : w.accidental === "flat"
                ? "<alter>-1</alter>"
                : "";
          const accXml =
            w.accidental === "sharp"
              ? "<accidental>sharp</accidental>"
              : w.accidental === "flat"
                ? "<accidental>flat</accidental>"
                : w.accidental === "natural"
                  ? "<accidental>natural</accidental>"
                  : "";
          const tieXml = `${seg.tieEnd ? '<tie type="stop"/>' : ""}${seg.tieStart ? '<tie type="start"/>' : ""}`;
          const notationsXml =
            seg.tieEnd || seg.tieStart
              ? `<notations>${seg.tieEnd ? '<tied type="stop"/>' : ""}${seg.tieStart ? '<tied type="start"/>' : ""}</notations>`
              : "";
          return `<note><pitch><step>${w.step}</step>${alterXml}<octave>${w.octave}</octave></pitch><duration>${seg.durationTick}</duration>${tieXml}<voice>1</voice><type>${type}</type>${dotXml}${accXml}${notationsXml}</note>`;
        })
        .join("");
      return `<measure number="${mIndex + 1}">${attrs}${notesXml}</measure>`;
    })
    .join("");

  const creatorXml = arrangement.composer
    ? `<identification><creator type="composer">${escapeXml(arrangement.composer)}</creator></identification>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n<score-partwise version="4.0"><work><work-title>${escapeXml(arrangement.title)}</work-title></work>${creatorXml}<part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list><part id="P1">${xmlMeasures}</part></score-partwise>\n`;
}

export function serializeCanonicalArrangementJson(arrangement: EditableArrangement): string {
  return `${stableStringify(arrangement)}\n`;
}

export function serializeEditorProjectJson(project: EditableArrangementProject): string {
  return `${stableStringify(project)}\n`;
}

export function parseEditorProjectJson(rawJson: string): EditableArrangementProject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Malformed JSON in editor project file.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid editor project payload.");
  }
  const obj = parsed as Partial<EditableArrangementProject>;
  if (
    obj.schemaVersion !== 1 ||
    !obj.sourceProject ||
    typeof obj.sourceCandidateId !== "string" ||
    !obj.arrangement ||
    !Array.isArray(obj.arrangement.events) ||
    obj.arrangement.canonicalPpq !== CANONICAL_PPQ
  ) {
    throw new Error("File is not a valid v1 EditableArrangementProject.");
  }

  const editLog = Array.isArray(obj.editLog) ? obj.editLog : [];
  const sourceHash = obj.sourceProject.provenance?.sha256 ?? "unknown";
  const settingsHash =
    obj.settingsHash ??
    deterministicSettingsHash(
      stableStringify({
        sourceHash,
        candidateId: obj.sourceCandidateId,
        arrangement: obj.arrangement,
        editLog,
      }),
    );

  return {
    schemaVersion: 1,
    sourceProject: obj.sourceProject,
    sourceCandidateId: obj.sourceCandidateId,
    arrangement: obj.arrangement,
    editLog,
    settingsHash,
  };
}
