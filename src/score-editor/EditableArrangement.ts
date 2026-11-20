import type { WrittenPitch } from "../music/melody";
import type { Candidate, Project } from "../score-import/core";
import { CANONICAL_PPQ, stableStringify } from "../score-import/core";
import type {
  ArrangementDiffSummary,
  EditCommand,
  EditableArrangement,
  EditableArrangementProject,
  EditableEvent,
} from "./editorTypes";

const STEPS = ["C", "D", "E", "F", "G", "A", "B"] as const;
const STEP_SEMITONES: Record<WrittenPitch["step"], number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function midiFromWrittenPitch(pitch: WrittenPitch): number {
  const accidentalOffset =
    pitch.accidental === "sharp" ? 1 : pitch.accidental === "flat" ? -1 : 0;
  return (pitch.octave + 1) * 12 + STEP_SEMITONES[pitch.step] + accidentalOffset;
}

export function writtenPitchFromMidiAndPolicy(
  midi: number,
  prefer: "sharps" | "flats" = "sharps",
): WrittenPitch {
  const clamped = Math.max(0, Math.min(127, Math.round(midi)));
  const sharpTable: { step: WrittenPitch["step"]; accidental?: WrittenPitch["accidental"] }[] = [
    { step: "C" },
    { step: "C", accidental: "sharp" },
    { step: "D" },
    { step: "D", accidental: "sharp" },
    { step: "E" },
    { step: "F" },
    { step: "F", accidental: "sharp" },
    { step: "G" },
    { step: "G", accidental: "sharp" },
    { step: "A" },
    { step: "A", accidental: "sharp" },
    { step: "B" },
  ];
  const flatTable: { step: WrittenPitch["step"]; accidental?: WrittenPitch["accidental"] }[] = [
    { step: "C" },
    { step: "D", accidental: "flat" },
    { step: "D" },
    { step: "E", accidental: "flat" },
    { step: "E" },
    { step: "F" },
    { step: "G", accidental: "flat" },
    { step: "G" },
    { step: "A", accidental: "flat" },
    { step: "A" },
    { step: "B", accidental: "flat" },
    { step: "B" },
  ];
  const entry = (prefer === "flats" ? flatTable : sharpTable)[((clamped % 12) + 12) % 12]!;
  return {
    step: entry.step,
    accidental: entry.accidental,
    octave: Math.floor(clamped / 12) - 1,
  };
}

export function formatWrittenPitch(pitch?: WrittenPitch, fallbackMidi?: number): string {
  if (!pitch) {
    if (fallbackMidi === undefined) return "Rest";
    return formatWrittenPitch(writtenPitchFromMidiAndPolicy(fallbackMidi, "sharps"));
  }
  const acc =
    pitch.accidental === "sharp" ? "♯" : pitch.accidental === "flat" ? "♭" : pitch.accidental === "natural" ? "♮" : "";
  return `${pitch.step}${acc}${pitch.octave}`;
}

export function moveWrittenPitchDiatonically(
  pitch: WrittenPitch,
  deltaSteps: number,
): { writtenPitch: WrittenPitch; midi: number } {
  const currentIndex = pitch.octave * 7 + STEPS.indexOf(pitch.step);
  const nextIndex = Math.max(7, Math.min(7 * 9 + 6, currentIndex + deltaSteps));
  const nextOctave = Math.floor(nextIndex / 7);
  const nextStep = STEPS[((nextIndex % 7) + 7) % 7]!;
  const writtenPitch: WrittenPitch = {
    step: nextStep,
    octave: nextOctave,
    accidental: pitch.accidental,
  };
  return { writtenPitch, midi: midiFromWrittenPitch(writtenPitch) };
}

export function respellMidiPitch(
  midi: number,
  targetMode: "sharp" | "flat" | "natural" | "toggle",
  current?: WrittenPitch,
): WrittenPitch {
  if (targetMode === "toggle") {
    const currentIsFlat = current?.accidental === "flat";
    return writtenPitchFromMidiAndPolicy(midi, currentIsFlat ? "sharps" : "flats");
  }
  if (targetMode === "flat") {
    const candidate = writtenPitchFromMidiAndPolicy(midi, "flats");
    if (candidate.accidental === "flat") return candidate;
    // Also support B->Cb, E->Fb, C->Db etc. when exact enharmonic matches
    for (const octave of [candidate.octave - 1, candidate.octave, candidate.octave + 1]) {
      for (const step of STEPS) {
        const test: WrittenPitch = { step, octave, accidental: "flat" };
        if (midiFromWrittenPitch(test) === midi) return test;
      }
    }
    return candidate;
  }
  if (targetMode === "sharp") {
    const candidate = writtenPitchFromMidiAndPolicy(midi, "sharps");
    if (candidate.accidental === "sharp") return candidate;
    for (const octave of [candidate.octave - 1, candidate.octave, candidate.octave + 1]) {
      for (const step of STEPS) {
        const test: WrittenPitch = { step, octave, accidental: "sharp" };
        if (midiFromWrittenPitch(test) === midi) return test;
      }
    }
    return candidate;
  }
  // natural
  for (const octave of [(current?.octave ?? 4) - 1, current?.octave ?? 4, (current?.octave ?? 4) + 1]) {
    for (const step of STEPS) {
      const test: WrittenPitch = { step, octave, accidental: "natural" };
      if (midiFromWrittenPitch(test) === midi) return test;
    }
  }
  return { ...(current ?? writtenPitchFromMidiAndPolicy(midi, "sharps")), accidental: "natural" };
}

export function deterministicSettingsHash(input: string): string {
  // Fast deterministic FNV-1a 64-bit hex digest so command application stays synchronous and pure
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

export function deriveEventId(
  sourceHash: string,
  candidateId: string,
  commandSeq: number,
  localIndex = 0,
): string {
  const shortHash = sourceHash.slice(0, 10);
  const shortCand = deterministicSettingsHash(candidateId).slice(0, 6);
  return `ed-${shortHash}-${shortCand}-s${commandSeq}-${localIndex}`;
}

export function cloneArrangement(arrangement: EditableArrangement): EditableArrangement {
  return {
    ...arrangement,
    meter: { ...arrangement.meter },
    key: { ...arrangement.key },
    events: arrangement.events.map((e) => ({
      ...e,
      writtenPitch: e.writtenPitch ? { ...e.writtenPitch } : undefined,
      sourceEventIds: [...e.sourceEventIds],
      warnings: e.warnings.map((w) => ({ ...w })),
    })),
  };
}

/**
 * Reflows a monophonic sequence so events are strictly contiguous (no overlaps, explicit rests for any initial/internal gaps)
 * and cleans up invalid tie flags when adjacent notes no longer share pitch.
 */
export function normalizeMonophonicTimeline(
  events: EditableEvent[],
  sourceHash: string,
  candidateId: string,
  commandSeq: number,
): EditableEvent[] {
  const result: EditableEvent[] = [];
  let cursor = 0;
  let localIdx = 100;
  for (const raw of events) {
    const durationTick = Math.max(1, Math.round(raw.durationTick));
    const event: EditableEvent = {
      ...raw,
      startTick: cursor,
      durationTick,
      writtenPitch: raw.kind === "note" ? (raw.writtenPitch ? { ...raw.writtenPitch } : writtenPitchFromMidiAndPolicy(raw.midi ?? 60)) : undefined,
      midi: raw.kind === "note" ? (raw.midi ?? (raw.writtenPitch ? midiFromWrittenPitch(raw.writtenPitch) : 60)) : undefined,
      tieIn: raw.kind === "note" ? Boolean(raw.tieIn) : undefined,
      tieOut: raw.kind === "note" ? Boolean(raw.tieOut) : undefined,
      sourceEventIds: [...raw.sourceEventIds],
      warnings: raw.warnings.map((w) => ({ ...w })),
    };
    if (event.startTick > cursor) {
      result.push({
        id: deriveEventId(sourceHash, candidateId, commandSeq, localIdx++),
        kind: "rest",
        startTick: cursor,
        durationTick: event.startTick - cursor,
        sourceEventIds: [],
        warnings: [],
        origin: "derived",
      });
      cursor = event.startTick;
    }
    result.push(event);
    cursor += durationTick;
  }

  // Synchronize tieIn with previous note's tieOut
  for (let i = 0; i < result.length; i++) {
    const curr = result[i]!;
    const prev = result[i - 1];
    const next = result[i + 1];
    if (curr.kind !== "note") {
      delete curr.tieIn;
      delete curr.tieOut;
      continue;
    }
    if (curr.tieOut && (!next || next.kind !== "note" || next.midi !== curr.midi)) {
      // Keep tieOut only if next is note; if pitch differs, validation will flag it unless cleared
    }
    curr.tieIn = Boolean(prev && prev.kind === "note" && prev.tieOut && prev.midi === curr.midi);
  }
  return result;
}

export function createEditableArrangementFromCandidate(
  sourceProject: Project,
  candidateId?: string,
): EditableArrangementProject {
  const candidate: Candidate | undefined =
    sourceProject.candidates.find((c) => c.id === (candidateId ?? sourceProject.selectedCandidateId)) ??
    sourceProject.candidates[0];
  if (!candidate) {
    throw new Error("Source project has no candidates to edit.");
  }

  const sourceHash = sourceProject.provenance.sha256;
  const events: EditableEvent[] = [];
  let cursor = 0;

  for (let i = 0; i < candidate.canonicalEvents.length; i++) {
    const src = candidate.canonicalEvents[i]!;
    const startTick = Math.max(cursor, Math.round(src.startBeat * CANONICAL_PPQ));
    const durationTick = Math.max(1, Math.round(src.durationBeats * CANONICAL_PPQ));
    if (startTick > cursor) {
      events.push({
        id: `${sourceHash.slice(0, 12)}-gap-r${i}`,
        kind: "rest",
        startTick: cursor,
        durationTick: startTick - cursor,
        sourceEventIds: [],
        warnings: [],
        origin: "derived",
      });
      cursor = startTick;
    }
    const isNote = src.kind === "note";
    const midi = isNote ? (src.midi ?? 60) : undefined;
    const writtenPitch = isNote
      ? src.writtenPitch
        ? { ...src.writtenPitch }
        : writtenPitchFromMidiAndPolicy(midi!, candidate.key.prefer)
      : undefined;

    const eventWarnings = candidate.warnings.filter((w) => w.eventIds?.includes(src.id));
    events.push({
      id: src.id,
      kind: src.kind,
      startTick: cursor,
      durationTick,
      midi,
      writtenPitch,
      tieIn: isNote ? src.tie === "continue" || src.tie === "end" : undefined,
      tieOut: isNote ? src.tie === "start" || src.tie === "continue" : undefined,
      sourceEventIds: [src.id],
      warnings: eventWarnings.map((w) => ({ ...w })),
      origin: "imported",
    });
    cursor += durationTick;
  }

  const arrangement: EditableArrangement = {
    id: `arr-${sourceHash.slice(0, 12)}-${deterministicSettingsHash(candidate.id).slice(0, 8)}`,
    title: candidate.label,
    composer: sourceProject.provenance.fileName,
    tempoQpm: candidate.tempoQpm,
    meter: { ...candidate.meter },
    key: {
      tonic: candidate.key?.tonic ?? "C",
      mode: candidate.key?.mode ?? "major",
      prefer: candidate.key?.prefer ?? candidate.settings.prefer ?? "sharps",
    },
    canonicalPpq: CANONICAL_PPQ,
    events: normalizeMonophonicTimeline(events, sourceHash, candidate.id, 0),
  };

  const editLog: EditCommand[] = [];
  const settingsHash = deterministicSettingsHash(
    stableStringify({
      sourceHash,
      candidateId: candidate.id,
      arrangement,
      editLog,
    }),
  );

  return {
    schemaVersion: 1,
    sourceProject,
    sourceCandidateId: candidate.id,
    arrangement,
    editLog,
    settingsHash,
  };
}

export interface CommandApplicationResult {
  project: EditableArrangementProject;
  selectedEventIds: string[];
  description: string;
}

export function applyEditCommand(
  currentProject: EditableArrangementProject,
  command: EditCommand,
): CommandApplicationResult {
  const nextSeq = currentProject.editLog.length + 1;
  const sourceHash = currentProject.sourceProject.provenance.sha256;
  const candidateId = currentProject.sourceCandidateId;
  const arrangement = cloneArrangement(currentProject.arrangement);
  const events = arrangement.events;
  let selectedEventIds: string[] = [];
  let description = "";

  switch (command.type) {
    case "set-pitch": {
      const target = events.find((e) => e.id === command.eventId);
      if (!target || target.kind !== "note") {
        throw new Error(`Note event ${command.eventId} not found.`);
      }
      const clampedMidi = Math.max(12, Math.min(108, Math.round(command.midi)));
      target.midi = clampedMidi;
      target.writtenPitch = command.writtenPitch
        ? { ...command.writtenPitch }
        : writtenPitchFromMidiAndPolicy(clampedMidi, arrangement.key.prefer);
      selectedEventIds = [target.id];
      description = `Set pitch to ${formatWrittenPitch(target.writtenPitch, target.midi)} (MIDI ${target.midi})`;
      break;
    }

    case "move-pitch-diatonically": {
      const target = events.find((e) => e.id === command.eventId);
      if (!target || target.kind !== "note") {
        throw new Error(`Note event ${command.eventId} not found.`);
      }
      const currentPitch =
        target.writtenPitch ?? writtenPitchFromMidiAndPolicy(target.midi ?? 60, arrangement.key.prefer);
      const moved = moveWrittenPitchDiatonically(currentPitch, command.deltaSteps);
      target.writtenPitch = moved.writtenPitch;
      target.midi = moved.midi;
      selectedEventIds = [target.id];
      description = `Moved pitch ${command.deltaSteps > 0 ? "up" : "down"} ${Math.abs(command.deltaSteps)} diatonic step${Math.abs(command.deltaSteps) === 1 ? "" : "s"} to ${formatWrittenPitch(target.writtenPitch)}`;
      break;
    }

    case "respell-pitch": {
      const target = events.find((e) => e.id === command.eventId);
      if (!target || target.kind !== "note") {
        throw new Error(`Note event ${command.eventId} not found.`);
      }
      target.writtenPitch = { ...command.writtenPitch };
      target.midi = midiFromWrittenPitch(command.writtenPitch);
      selectedEventIds = [target.id];
      description = `Respelled note as ${formatWrittenPitch(target.writtenPitch)}`;
      break;
    }

    case "set-duration": {
      const target = events.find((e) => e.id === command.eventId);
      if (!target) {
        throw new Error(`Event ${command.eventId} not found.`);
      }
      const nextTicks = Math.max(60, Math.round(command.durationTick));
      const delta = nextTicks - target.durationTick;
      target.durationTick = nextTicks;
      selectedEventIds = [target.id];
      description = `Changed duration to ${nextTicks} ticks (${delta >= 0 ? `+${delta}` : delta} ripple shift)`;
      break;
    }

    case "convert-note-rest": {
      const target = events.find((e) => e.id === command.eventId);
      if (!target) {
        throw new Error(`Event ${command.eventId} not found.`);
      }
      if (command.targetKind === "rest") {
        target.kind = "rest";
        delete target.midi;
        delete target.writtenPitch;
        delete target.tieIn;
        delete target.tieOut;
        description = "Converted note to rest (duration preserved)";
      } else {
        const midi = command.defaultMidi ?? target.midi ?? 60;
        target.kind = "note";
        target.midi = midi;
        target.writtenPitch = writtenPitchFromMidiAndPolicy(midi, arrangement.key.prefer);
        description = `Converted rest to note ${formatWrittenPitch(target.writtenPitch)}`;
      }
      selectedEventIds = [target.id];
      break;
    }

    case "insert-event": {
      const durationTick = Math.max(60, Math.round(command.durationTick));
      const newId = deriveEventId(sourceHash, candidateId, nextSeq, 0);
      const isNote = command.kind === "note";
      const midi = isNote ? (command.midi ?? 60) : undefined;
      const writtenPitch = isNote
        ? command.writtenPitch
          ? { ...command.writtenPitch }
          : writtenPitchFromMidiAndPolicy(midi!, arrangement.key.prefer)
        : undefined;

      const newEvent: EditableEvent = {
        id: newId,
        kind: command.kind,
        startTick: 0,
        durationTick,
        midi,
        writtenPitch,
        sourceEventIds: [],
        warnings: [],
        origin: "inserted",
      };

      if (command.placement === "at-tick" && command.atTick !== undefined) {
        const idx = events.findIndex((e) => e.startTick >= command.atTick!);
        if (idx >= 0) events.splice(idx, 0, newEvent);
        else events.push(newEvent);
      } else {
        const targetIdx = command.targetEventId
          ? events.findIndex((e) => e.id === command.targetEventId)
          : events.length - 1;
        if (targetIdx < 0) {
          events.push(newEvent);
        } else if (command.placement === "before") {
          events.splice(targetIdx, 0, newEvent);
        } else {
          events.splice(targetIdx + 1, 0, newEvent);
        }
      }
      selectedEventIds = [newId];
      description = `Inserted ${command.kind}${isNote ? ` ${formatWrittenPitch(writtenPitch)}` : ""} (${durationTick} ticks, ripple shift)`;
      break;
    }

    case "delete-event": {
      const idx = events.findIndex((e) => e.id === command.eventId);
      if (idx < 0) {
        throw new Error(`Event ${command.eventId} not found.`);
      }
      const target = events[idx]!;
      if (command.policy === "leave-rest") {
        target.kind = "rest";
        delete target.midi;
        delete target.writtenPitch;
        delete target.tieIn;
        delete target.tieOut;
        target.origin = "derived";
        selectedEventIds = [target.id];
        description = "Deleted note and left explicit rest (timeline positions preserved)";
      } else {
        events.splice(idx, 1);
        const fallback = events[Math.min(idx, events.length - 1)];
        selectedEventIds = fallback ? [fallback.id] : [];
        description = "Deleted event and closed gap (subsequent events shifted earlier)";
      }
      break;
    }

    case "split-event": {
      const idx = events.findIndex((e) => e.id === command.eventId);
      if (idx < 0) {
        throw new Error(`Event ${command.eventId} not found.`);
      }
      const target = events[idx]!;
      if (target.durationTick < 120) {
        throw new Error("Event is too short to split.");
      }
      const firstDur =
        command.offsetTick && command.offsetTick > 0 && command.offsetTick < target.durationTick
          ? Math.round(command.offsetTick)
          : Math.floor(target.durationTick / 2);
      const secondDur = target.durationTick - firstDur;
      const firstId = deriveEventId(sourceHash, candidateId, nextSeq, 0);
      const secondId = deriveEventId(sourceHash, candidateId, nextSeq, 1);

      const firstPart: EditableEvent = {
        ...target,
        id: firstId,
        durationTick: firstDur,
        writtenPitch: target.writtenPitch ? { ...target.writtenPitch } : undefined,
        sourceEventIds: [...target.sourceEventIds],
        warnings: target.warnings.map((w) => ({ ...w })),
        origin: "split",
      };
      const secondPart: EditableEvent = {
        ...target,
        id: secondId,
        startTick: target.startTick + firstDur,
        durationTick: secondDur,
        writtenPitch: target.writtenPitch ? { ...target.writtenPitch } : undefined,
        tieIn: target.kind === "note" ? Boolean(firstPart.tieOut) : undefined,
        sourceEventIds: [...target.sourceEventIds],
        warnings: target.warnings.map((w) => ({ ...w })),
        origin: "split",
      };
      events.splice(idx, 1, firstPart, secondPart);
      selectedEventIds = [firstId, secondId];
      description = `Split ${target.kind} into ${firstDur} + ${secondDur} ticks`;
      break;
    }

    case "merge-events": {
      if (command.eventIds.length < 2) {
        throw new Error("Select at least two adjacent events to merge.");
      }
      const indices = command.eventIds
        .map((id) => events.findIndex((e) => e.id === id))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b);
      if (indices.length < 2) {
        throw new Error("Events to merge were not found.");
      }
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] !== indices[i - 1]! + 1) {
          throw new Error("Only contiguous adjacent events can be merged.");
        }
      }
      const group = indices.map((i) => events[i]!);
      const first = group[0]!;
      const allSameKind = group.every((e) => e.kind === first.kind);
      if (!allSameKind) {
        throw new Error("Cannot merge notes and rests together.");
      }
      if (first.kind === "note" && !group.every((e) => e.midi === first.midi)) {
        throw new Error("Adjacent notes must have the same pitch to merge.");
      }
      const mergedId = deriveEventId(sourceHash, candidateId, nextSeq, 0);
      const totalDuration = group.reduce((sum, e) => sum + e.durationTick, 0);
      const merged: EditableEvent = {
        ...first,
        id: mergedId,
        durationTick: totalDuration,
        writtenPitch: first.writtenPitch ? { ...first.writtenPitch } : undefined,
        tieIn: first.tieIn,
        tieOut: group.at(-1)?.tieOut,
        sourceEventIds: [...new Set(group.flatMap((e) => e.sourceEventIds))],
        warnings: group.flatMap((e) => e.warnings),
        origin: "derived",
      };
      events.splice(indices[0]!, group.length, merged);
      selectedEventIds = [mergedId];
      description = `Merged ${group.length} adjacent ${first.kind}s (${totalDuration} ticks)`;
      break;
    }

    case "toggle-tie": {
      const idx = events.findIndex((e) => e.id === command.eventId);
      if (idx < 0) {
        throw new Error(`Event ${command.eventId} not found.`);
      }
      const target = events[idx]!;
      if (target.kind !== "note") {
        throw new Error("Only notes can be tied.");
      }
      const next = events[idx + 1];
      const nextTie = command.tieOut !== undefined ? command.tieOut : !target.tieOut;
      if (nextTie && (!next || next.kind !== "note" || next.midi !== target.midi)) {
        throw new Error("A tie requires an adjacent next note with the same pitch.");
      }
      target.tieOut = nextTie;
      if (next && next.kind === "note") {
        next.tieIn = nextTie;
      }
      selectedEventIds = [target.id];
      description = nextTie ? "Tied note to next equal-pitch note" : "Removed tie to next note";
      break;
    }

    case "transpose-selection": {
      const idSet =
        command.eventIds.length > 0
          ? new Set(command.eventIds)
          : new Set(events.filter((e) => e.kind === "note").map((e) => e.id));
      let count = 0;
      for (const e of events) {
        if (e.kind === "note" && idSet.has(e.id) && e.midi !== undefined) {
          const nextMidi = Math.max(12, Math.min(108, e.midi + command.semitones));
          e.midi = nextMidi;
          e.writtenPitch = writtenPitchFromMidiAndPolicy(nextMidi, arrangement.key.prefer);
          count++;
        }
      }
      selectedEventIds = [...idSet];
      description = `Transposed ${count} note${count === 1 ? "" : "s"} by ${command.semitones > 0 ? `+${command.semitones}` : command.semitones} semitone${Math.abs(command.semitones) === 1 ? "" : "s"}`;
      break;
    }

    case "shift-octave": {
      const idSet =
        command.eventIds.length > 0
          ? new Set(command.eventIds)
          : new Set(events.filter((e) => e.kind === "note").map((e) => e.id));
      let count = 0;
      for (const e of events) {
        if (e.kind === "note" && idSet.has(e.id) && e.midi !== undefined) {
          const nextMidi = Math.max(12, Math.min(108, e.midi + command.octaves * 12));
          e.midi = nextMidi;
          if (e.writtenPitch) {
            e.writtenPitch = {
              ...e.writtenPitch,
              octave: Math.floor(nextMidi / 12) - 1,
            };
          } else {
            e.writtenPitch = writtenPitchFromMidiAndPolicy(nextMidi, arrangement.key.prefer);
          }
          count++;
        }
      }
      selectedEventIds = [...idSet];
      description = `Shifted ${count} note${count === 1 ? "" : "s"} by ${command.octaves > 0 ? `+${command.octaves}` : command.octaves} octave${Math.abs(command.octaves) === 1 ? "" : "s"}`;
      break;
    }

    case "crop-to-selection": {
      if (command.eventIds.length === 0) {
        throw new Error("Select one or more events to crop.");
      }
      const indices = command.eventIds
        .map((id) => events.findIndex((e) => e.id === id))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b);
      if (indices.length === 0) {
        throw new Error("Selected events for crop were not found.");
      }
      const startIdx = indices[0]!;
      const endIdx = indices.at(-1)!;
      const cropped = events.slice(startIdx, endIdx + 1);
      if (cropped.length > 0) {
        delete cropped[0]!.tieIn;
        delete cropped.at(-1)!.tieOut;
      }
      arrangement.events.splice(0, arrangement.events.length, ...cropped);
      selectedEventIds = cropped.map((e) => e.id);
      description = `Cropped arrangement to ${cropped.length} event${cropped.length === 1 ? "" : "s"}`;
      break;
    }

    case "set-metadata": {
      if (command.title !== undefined) arrangement.title = command.title.trim() || "Untitled arrangement";
      if (command.composer !== undefined) arrangement.composer = command.composer.trim();
      if (command.tempoQpm !== undefined) {
        arrangement.tempoQpm = Math.max(30, Math.min(260, Math.round(command.tempoQpm)));
      }
      if (command.meter !== undefined) {
        arrangement.meter = {
          numerator: Math.max(1, Math.min(16, Math.round(command.meter.numerator))),
          denominator: [2, 4, 8, 16].includes(command.meter.denominator) ? command.meter.denominator : 4,
        };
      }
      if (command.key !== undefined) {
        const prevPrefer = arrangement.key.prefer;
        arrangement.key = {
          ...arrangement.key,
          ...command.key,
        };
        if (command.key.prefer && command.key.prefer !== prevPrefer) {
          for (const e of events) {
            if (e.kind === "note" && e.midi !== undefined) {
              e.writtenPitch = writtenPitchFromMidiAndPolicy(e.midi, arrangement.key.prefer);
            }
          }
        }
      }
      description = "Updated arrangement metadata";
      break;
    }
  }

  arrangement.events = normalizeMonophonicTimeline(
    arrangement.events,
    sourceHash,
    candidateId,
    nextSeq,
  );
  const editLog = [...currentProject.editLog, command];
  const settingsHash = deterministicSettingsHash(
    stableStringify({
      sourceHash,
      candidateId,
      arrangement,
      editLog,
    }),
  );

  return {
    project: {
      ...currentProject,
      arrangement,
      editLog,
      settingsHash,
    },
    selectedEventIds,
    description,
  };
}

export class EditorCommandHistory {
  private baseProject: EditableArrangementProject;
  private currentProject: EditableArrangementProject;
  private past: { project: EditableArrangementProject; selection: string[]; description: string }[] = [];
  private future: {
    command: EditCommand;
    project: EditableArrangementProject;
    selection: string[];
    description: string;
  }[] = [];
  private currentSelection: string[] = [];
  private lastActionDescription = "Created editable arrangement from candidate";

  constructor(initialProject: EditableArrangementProject) {
    this.baseProject = initialProject;
    this.currentProject = initialProject;
    const firstId = initialProject.arrangement.events[0]?.id;
    this.currentSelection = firstId ? [firstId] : [];
  }

  get project(): EditableArrangementProject {
    return this.currentProject;
  }

  get base(): EditableArrangementProject {
    return this.baseProject;
  }

  get selection(): string[] {
    return this.currentSelection;
  }

  get lastDescription(): string {
    return this.lastActionDescription;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  setSelection(eventIds: string[]): void {
    const validIds = new Set(this.currentProject.arrangement.events.map((e) => e.id));
    this.currentSelection = eventIds.filter((id) => validIds.has(id));
  }

  execute(command: EditCommand): CommandApplicationResult {
    const prevSnapshot = {
      project: this.currentProject,
      selection: [...this.currentSelection],
      description: this.lastActionDescription,
    };
    const result = applyEditCommand(this.currentProject, command);
    this.past.push(prevSnapshot);
    this.future = [];
    this.currentProject = result.project;
    if (result.selectedEventIds.length > 0) {
      this.currentSelection = result.selectedEventIds;
    } else {
      this.setSelection(this.currentSelection);
    }
    this.lastActionDescription = result.description;
    return result;
  }

  undo(): EditableArrangementProject {
    const previous = this.past.pop();
    if (!previous) return this.currentProject;
    const undoneCommand = this.currentProject.editLog.at(-1)!;
    this.future.push({
      command: undoneCommand,
      project: this.currentProject,
      selection: [...this.currentSelection],
      description: this.lastActionDescription,
    });
    this.currentProject = previous.project;
    this.currentSelection = previous.selection;
    this.lastActionDescription = `Undid: ${this.future.at(-1)!.description}`;
    return this.currentProject;
  }

  redo(): EditableArrangementProject {
    const next = this.future.pop();
    if (!next) return this.currentProject;
    this.past.push({
      project: this.currentProject,
      selection: [...this.currentSelection],
      description: this.lastActionDescription,
    });
    this.currentProject = next.project;
    this.currentSelection = next.selection;
    this.lastActionDescription = `Redid: ${next.description}`;
    return this.currentProject;
  }

  resetToBase(): EditableArrangementProject {
    this.past = [];
    this.future = [];
    this.currentProject = createEditableArrangementFromCandidate(
      this.baseProject.sourceProject,
      this.baseProject.sourceCandidateId,
    );
    const firstId = this.currentProject.arrangement.events[0]?.id;
    this.currentSelection = firstId ? [firstId] : [];
    this.lastActionDescription = "Reset arrangement to imported candidate";
    return this.currentProject;
  }
}

export function compareOriginalAndEdited(
  baseProject: EditableArrangementProject,
  editedProject: EditableArrangementProject,
  minMidi = 48,
  maxMidi = 84,
): ArrangementDiffSummary {
  const baseEvents = baseProject.arrangement.events;
  const editedEvents = editedProject.arrangement.events;
  const baseById = new Map(baseEvents.map((e) => [e.id, e]));
  const editedById = new Map(editedEvents.map((e) => [e.id, e]));

  let pitchesChanged = 0;
  let spellingsChanged = 0;
  let durationsChanged = 0;
  let notesInserted = 0;
  let notesDeleted = 0;
  let restsInserted = 0;
  let restsDeleted = 0;
  let tiesChanged = 0;
  const changedEventIds: string[] = [];

  for (const e of editedEvents) {
    const orig = baseById.get(e.id) ?? (e.sourceEventIds[0] ? baseById.get(e.sourceEventIds[0]) : undefined);
    if (!orig) {
      if (e.kind === "note") notesInserted++;
      else restsInserted++;
      changedEventIds.push(e.id);
      continue;
    }
    let changed = false;
    if (orig.kind !== e.kind) {
      if (e.kind === "note") {
        restsDeleted++;
        notesInserted++;
      } else {
        notesDeleted++;
        restsInserted++;
      }
      changed = true;
    } else if (e.kind === "note") {
      if (orig.midi !== e.midi) {
        pitchesChanged++;
        changed = true;
      } else if (
        orig.writtenPitch?.step !== e.writtenPitch?.step ||
        orig.writtenPitch?.accidental !== e.writtenPitch?.accidental ||
        orig.writtenPitch?.octave !== e.writtenPitch?.octave
      ) {
        spellingsChanged++;
        changed = true;
      }
      if (Boolean(orig.tieIn) !== Boolean(e.tieIn) || Boolean(orig.tieOut) !== Boolean(e.tieOut)) {
        tiesChanged++;
        changed = true;
      }
    }
    if (orig.durationTick !== e.durationTick) {
      durationsChanged++;
      changed = true;
    }
    if (changed) changedEventIds.push(e.id);
  }

  for (const orig of baseEvents) {
    const stillExists =
      editedById.has(orig.id) || editedEvents.some((e) => e.sourceEventIds.includes(orig.id));
    if (!stillExists) {
      if (orig.kind === "note") notesDeleted++;
      else restsDeleted++;
    }
  }

  const baseOutOfRange = baseEvents.filter(
    (e) => e.kind === "note" && e.midi !== undefined && (e.midi < minMidi || e.midi > maxMidi),
  ).length;
  const editedOutOfRange = editedEvents.filter(
    (e) => e.kind === "note" && e.midi !== undefined && (e.midi < minMidi || e.midi > maxMidi),
  ).length;

  return {
    pitchesChanged,
    spellingsChanged,
    durationsChanged,
    notesInserted,
    notesDeleted,
    restsInserted,
    restsDeleted,
    tiesChanged,
    rangeWarningsDelta: editedOutOfRange - baseOutOfRange,
    changedEventIds,
  };
}
