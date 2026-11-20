import { describe, expect, test } from "bun:test";
import { Midi } from "@tonejs/midi";
import { parseAbc } from "../../src/music/melody";
import {
  EditorCommandHistory,
  applyEditCommand,
  compareOriginalAndEdited,
  createEditableArrangementFromCandidate,
  formatWrittenPitch,
  midiFromWrittenPitch,
  moveWrittenPitchDiatonically,
  respellMidiPitch,
} from "../../src/score-editor/EditableArrangement";
import { selectAdjacentEvent, selectContiguousRange, selectSingleEvent } from "../../src/score-editor/editorSelection";
import { CANONICAL_PPQ } from "../../src/score-editor/editorTypes";
import {
  parseEditorProjectJson,
  serializeArrangementToAbc,
  serializeArrangementToMidi,
  serializeArrangementToMusicXml,
  serializeCanonicalArrangementJson,
  serializeEditorProjectJson,
} from "../../src/score-editor/serialization";
import { analyzeHarmonicaRange, validateArrangement } from "../../src/score-editor/validation";
import { importMidi, stableStringify } from "../../src/score-import/core";

async function makeFixtureProject(pitches = [60, 62, 64, 67], durationTicks = 480) {
  const midi = new Midi();
  midi.header.fromJSON({ ...midi.header.toJSON(), ppq: 480 });
  midi.header.setTempo(100);
  const track = midi.addTrack();
  track.name = "Test Lead";
  pitches.forEach((m, idx) => {
    track.addNote({
      midi: m,
      ticks: idx * durationTicks,
      durationTicks,
      velocity: 0.85,
    });
  });
  return importMidi(new Uint8Array(midi.toArray()), "synthetic-fixture.mid");
}

describe("EditableArrangement domain and reversible command system", () => {
  test("creates an immutable arrangement draft without mutating sourceProject or candidate", async () => {
    const source = await makeFixtureProject([60, 63, 65, 67]);
    const beforeSourceJson = stableStringify(source);
    const editorProject = createEditableArrangementFromCandidate(source);

    expect(editorProject.schemaVersion).toBe(1);
    expect(editorProject.arrangement.canonicalPpq).toBe(960);
    expect(editorProject.arrangement.events).toHaveLength(4);
    expect(editorProject.arrangement.events.map((e) => e.midi)).toEqual([60, 63, 65, 67]);

    const history = new EditorCommandHistory(editorProject);
    history.execute({
      type: "set-pitch",
      eventId: editorProject.arrangement.events[1]!.id,
      midi: 64,
    });

    expect(stableStringify(source)).toBe(beforeSourceJson);
    expect(source.candidates[0]!.canonicalEvents[1]!.midi).toBe(63);
    expect(history.project.arrangement.events[1]!.midi).toBe(64);
  });

  test("supports diatonic pitch movement, exact pitch setting, and enharmonic respelling with round-trip undo/redo", async () => {
    const source = await makeFixtureProject([60, 61, 64, 67]);
    const initial = createEditableArrangementFromCandidate(source);
    const history = new EditorCommandHistory(initial);
    const initialSnapshot = stableStringify(history.project);

    const firstId = initial.arrangement.events[0]!.id;
    const secondId = initial.arrangement.events[1]!.id;

    // Move C4 up 2 diatonic steps -> E4 (MIDI 64)
    history.execute({
      type: "move-pitch-diatonically",
      eventId: firstId,
      deltaSteps: 2,
    });
    expect(history.project.arrangement.events[0]!.midi).toBe(64);
    expect(formatWrittenPitch(history.project.arrangement.events[0]!.writtenPitch)).toBe("E4");

    // Respell C#4 (MIDI 61) to Db4 without changing MIDI
    const db4 = respellMidiPitch(61, "flat", history.project.arrangement.events[1]!.writtenPitch);
    expect(midiFromWrittenPitch(db4)).toBe(61);
    expect(db4.step).toBe("D");
    expect(db4.accidental).toBe("flat");

    history.execute({
      type: "respell-pitch",
      eventId: secondId,
      writtenPitch: db4,
    });
    expect(history.project.arrangement.events[1]!.midi).toBe(61);
    expect(formatWrittenPitch(history.project.arrangement.events[1]!.writtenPitch)).toBe("D♭4");

    // Undo both and verify exact restoration
    history.undo();
    expect(formatWrittenPitch(history.project.arrangement.events[1]!.writtenPitch)).toBe("C♯4");
    history.undo();
    expect(stableStringify(history.project)).toBe(initialSnapshot);

    // Redo both
    history.redo();
    expect(history.project.arrangement.events[0]!.midi).toBe(64);
    history.redo();
    expect(formatWrittenPitch(history.project.arrangement.events[1]!.writtenPitch)).toBe("D♭4");
  });

  test("preserves accidental class during diatonic drag and updates MIDI deterministically", () => {
    const moved = moveWrittenPitchDiatonically({ step: "F", accidental: "sharp", octave: 4 }, 1);
    expect(moved.writtenPitch).toEqual({ step: "G", accidental: "sharp", octave: 4 });
    expect(moved.midi).toBe(68);
  });

  test("applies ripple duration changes, note/rest conversion, insertion, and both deletion policies", async () => {
    const source = await makeFixtureProject([60, 62, 64, 65], 480); // 4 quarter notes (960 ticks each)
    const initial = createEditableArrangementFromCandidate(source);
    const history = new EditorCommandHistory(initial);
    const [e0, e1] = initial.arrangement.events;

    // 1. Change first note duration from 960 to 1440 (dotted quarter) -> ripples e1 startTick to 1440
    history.execute({
      type: "set-duration",
      eventId: e0!.id,
      durationTick: 1440,
    });
    expect(history.project.arrangement.events[0]!.durationTick).toBe(1440);
    expect(history.project.arrangement.events[1]!.startTick).toBe(1440);

    // 2. Convert second note to rest while preserving duration
    history.execute({
      type: "convert-note-rest",
      eventId: e1!.id,
      targetKind: "rest",
    });
    expect(history.project.arrangement.events[1]!.kind).toBe("rest");
    expect(history.project.arrangement.events[1]!.durationTick).toBe(960);

    // 3. Convert rest back to note
    history.execute({
      type: "convert-note-rest",
      eventId: e1!.id,
      targetKind: "note",
      defaultMidi: 67,
    });
    expect(history.project.arrangement.events[1]!.kind).toBe("note");
    expect(history.project.arrangement.events[1]!.midi).toBe(67);

    // 4. Insert note before e0 -> shifts timeline by 480 ticks
    const insertRes = history.execute({
      type: "insert-event",
      targetEventId: e0!.id,
      placement: "before",
      kind: "note",
      durationTick: 480,
      midi: 72,
    });
    const insertedId = insertRes.selectedEventIds[0]!;
    expect(history.project.arrangement.events).toHaveLength(5);
    expect(history.project.arrangement.events[0]!.id).toBe(insertedId);
    expect(history.project.arrangement.events[1]!.startTick).toBe(480);

    // 5. Delete inserted note and leave rest -> length stays 5, first event is rest
    history.execute({
      type: "delete-event",
      eventId: insertedId,
      policy: "leave-rest",
    });
    expect(history.project.arrangement.events).toHaveLength(5);
    expect(history.project.arrangement.events[0]!.kind).toBe("rest");
    expect(history.project.arrangement.events[1]!.startTick).toBe(480);

    // 6. Delete first rest and close gap -> length becomes 4, e0 returns to startTick 0
    history.execute({
      type: "delete-event",
      eventId: insertedId,
      policy: "close-gap",
    });
    expect(history.project.arrangement.events).toHaveLength(4);
    expect(history.project.arrangement.events[0]!.id).toBe(e0!.id);
    expect(history.project.arrangement.events[0]!.startTick).toBe(0);
  });

  test("splits, ties, unties, and merges adjacent compatible events deterministically", async () => {
    const source = await makeFixtureProject([60, 62], 480);
    const initial = createEditableArrangementFromCandidate(source);
    const history = new EditorCommandHistory(initial);
    const firstId = initial.arrangement.events[0]!.id;

    // Split 960-tick C4 into two 480-tick C4 notes
    const splitRes = history.execute({
      type: "split-event",
      eventId: firstId,
    });
    expect(splitRes.selectedEventIds).toHaveLength(2);
    const [partA, partB] = splitRes.selectedEventIds;
    expect(history.project.arrangement.events).toHaveLength(3);
    expect(history.project.arrangement.events[0]!.durationTick).toBe(480);
    expect(history.project.arrangement.events[1]!.durationTick).toBe(480);
    expect(history.project.arrangement.events[1]!.midi).toBe(60);

    // Tie partA to partB
    history.execute({
      type: "toggle-tie",
      eventId: partA!,
    });
    expect(history.project.arrangement.events[0]!.tieOut).toBe(true);
    expect(history.project.arrangement.events[1]!.tieIn).toBe(true);

    // Untie
    history.execute({
      type: "toggle-tie",
      eventId: partA!,
    });
    expect(history.project.arrangement.events[0]!.tieOut).toBe(false);
    expect(history.project.arrangement.events[1]!.tieIn).toBe(false);

    // Merge partA and partB back into a single 960-tick C4 note
    history.execute({
      type: "merge-events",
      eventIds: [partA!, partB!],
    });
    expect(history.project.arrangement.events).toHaveLength(2);
    expect(history.project.arrangement.events[0]!.durationTick).toBe(960);
    expect(history.project.arrangement.events[0]!.midi).toBe(60);
  });

  test("transposes, shifts octave, crops to selection, updates metadata, and computes diff summary", async () => {
    const source = await makeFixtureProject([60, 62, 64, 65]);
    const initial = createEditableArrangementFromCandidate(source);
    const history = new EditorCommandHistory(initial);
    const ids = initial.arrangement.events.map((e) => e.id);

    // Transpose first two notes +2 semitones
    history.execute({
      type: "transpose-selection",
      eventIds: [ids[0]!, ids[1]!],
      semitones: 2,
    });
    expect(history.project.arrangement.events[0]!.midi).toBe(62);
    expect(history.project.arrangement.events[1]!.midi).toBe(64);

    // Shift octave +1 on first note
    history.execute({
      type: "shift-octave",
      eventIds: [ids[0]!],
      octaves: 1,
    });
    expect(history.project.arrangement.events[0]!.midi).toBe(74);

    // Metadata update
    history.execute({
      type: "set-metadata",
      title: "Corrected Exercise",
      composer: "Public Domain",
      tempoQpm: 112,
      meter: { numerator: 3, denominator: 4 },
      key: { tonic: "D", mode: "minor", prefer: "flats" },
    });
    expect(history.project.arrangement.title).toBe("Corrected Exercise");
    expect(history.project.arrangement.tempoQpm).toBe(112);
    expect(history.project.arrangement.meter).toEqual({ numerator: 3, denominator: 4 });
    expect(history.project.arrangement.key.prefer).toBe("flats");

    // Diff summary vs base
    const diff = compareOriginalAndEdited(history.base, history.project);
    expect(diff.pitchesChanged).toBe(2);

    // Crop to first 2 notes
    history.execute({
      type: "crop-to-selection",
      eventIds: [ids[0]!, ids[1]!],
    });
    expect(history.project.arrangement.events).toHaveLength(2);
  });

  test("produces byte-identical ABC, MIDI, MusicXML, canonical JSON, and project JSON across repeated runs and round-trips", async () => {
    const sourceA = await makeFixtureProject([60, 64, 67, 72]);
    const sourceB = await makeFixtureProject([60, 64, 67, 72]);

    const runPipeline = (src: typeof sourceA) => {
      let proj = createEditableArrangementFromCandidate(src);
      const firstId = proj.arrangement.events[0]!.id;
      const secondId = proj.arrangement.events[1]!.id;
      proj = applyEditCommand(proj, { type: "move-pitch-diatonically", eventId: firstId, deltaSteps: 1 }).project;
      proj = applyEditCommand(proj, { type: "set-duration", eventId: secondId, durationTick: 1440 }).project;
      proj = applyEditCommand(proj, {
        type: "insert-event",
        targetEventId: secondId,
        placement: "after",
        kind: "rest",
        durationTick: 480,
      }).project;
      return proj;
    };

    const editedA = runPipeline(sourceA);
    const editedB = runPipeline(sourceB);

    expect(serializeEditorProjectJson(editedA)).toBe(serializeEditorProjectJson(editedB));
    expect(serializeCanonicalArrangementJson(editedA.arrangement)).toBe(
      serializeCanonicalArrangementJson(editedB.arrangement),
    );
    expect(serializeArrangementToAbc(editedA.arrangement)).toBe(
      serializeArrangementToAbc(editedB.arrangement),
    );
    expect(serializeArrangementToMusicXml(editedA.arrangement)).toBe(
      serializeArrangementToMusicXml(editedB.arrangement),
    );
    expect([...serializeArrangementToMidi(editedA.arrangement)]).toEqual([
      ...serializeArrangementToMidi(editedB.arrangement),
    ]);

    // Round-trip reopen editor project JSON
    const reopened = parseEditorProjectJson(serializeEditorProjectJson(editedA));
    expect(serializeEditorProjectJson(reopened)).toBe(serializeEditorProjectJson(editedA));

    // Confirm exported ABC parses cleanly in Song Practice parser
    const parsedForPractice = parseAbc(serializeArrangementToAbc(editedA.arrangement), "edited");
    expect(parsedForPractice.events.length).toBeGreaterThanOrEqual(4);
  });

  test("validates 10-hole and 12-hole harmonica ranges, barline splitting, and blocking errors", async () => {
    // MIDI 89 (F6) is playable on 12-hole (up to C7/D7) but outside 10-hole (max C6=84 or D6=86)
    // MIDI 40 (E2) is below both 10-hole and 12-hole C chromatic (min C4=60)
    const source = await makeFixtureProject([48, 60, 64, 91]);
    const proj = createEditableArrangementFromCandidate(source);

    const range10 = analyzeHarmonicaRange(proj.arrangement, "standard-c-10");
    const range12 = analyzeHarmonicaRange(proj.arrangement, "standard-c-12");
    expect(range10.outOfRangeEventIds.length).toBeGreaterThan(0);
    expect(range12.outOfRangeEventIds.length).toBeGreaterThan(0);
    expect(range10.suggestedTransposeSemitones).not.toBe(0);

    const report = validateArrangement(proj.arrangement, "standard-c-10");
    expect(report.valid).toBe(true); // Out-of-range is a warning, not a blocking error
    expect(report.warnings.some((w) => w.code === "OUT_OF_HARMONICA_RANGE")).toBe(true);

    // Note crossing barline (duration 4800 ticks in 4/4 = 3840 + 960)
    const barCross = applyEditCommand(proj, {
      type: "set-duration",
      eventId: proj.arrangement.events[0]!.id,
      durationTick: 4800,
    }).project;
    const abc = serializeArrangementToAbc(barCross.arrangement);
    expect(abc).toContain("-"); // tied across barline
    const xml = serializeArrangementToMusicXml(barCross.arrangement);
    expect(xml).toContain('<tie type="start"/>');
    expect(xml).toContain('<tie type="stop"/>');
  });

  test("supports contiguous range and keyboard selection navigation", async () => {
    const source = await makeFixtureProject([60, 62, 64, 65]);
    const proj = createEditableArrangementFromCandidate(source);
    const events = proj.arrangement.events;

    let sel = selectSingleEvent(events[0]!.id);
    expect(sel.selectedIds).toEqual([events[0]!.id]);

    sel = selectContiguousRange(events, sel, events[2]!.id);
    expect(sel.selectedIds).toEqual([events[0]!.id, events[1]!.id, events[2]!.id]);

    sel = selectAdjacentEvent(events, sel, 1, false);
    expect(sel.selectedIds).toEqual([events[3]!.id]);
    expect(CANONICAL_PPQ).toBe(960);
  });
});
