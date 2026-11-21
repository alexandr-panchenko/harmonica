import { describe, expect, test } from "bun:test";
import { Midi } from "@tonejs/midi";
import {
  arrangementProjectToCollabModel,
  collabModelToArrangement,
  CollabProjectDocument,
  DEFAULT_BOARD_CARDS,
  DEFAULT_BOARD_CONNECTORS,
  PORTABLE_INSTRUMENTS_SCHEMA,
} from "../../src/collab/portableInstrumentsSchema";
import {
  buildCallPromptMidis,
  buildScaleMidisInRange,
  CALL_AND_RESPONSE_PROMPTS,
  getRecommendedInstrumentScale,
  getScaleFormula,
  IMPROVISATION_CONSTRAINT_CARDS,
} from "../../src/improvisation/scaleCatalog";
import { drawPortableInstrumentToCanvasIr } from "../../src/instruments/instrumentCanvasRenderer";
import {
  findContinuousFingerPlacement,
  getPortableInstrumentProfile,
  getPrimaryInstrumentPlacement,
  PORTABLE_INSTRUMENTS,
} from "../../src/instruments/instrumentProfiles";
import { createEditableArrangementFromCandidate } from "../../src/score-editor/EditableArrangement";
import { importMidi } from "../../src/score-import/core";
import { parseDocument, serializeDocument } from "../../src/vendor/ml-collab-codec/index";
import { RecordingContext, Scene } from "../../src/vendor/canvas-ir/index";

async function createSampleEditorProject(pitches = [60, 62, 64, 67], durationTicks = 480) {
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
  const project = await importMidi(new Uint8Array(midi.toArray()), "synthetic-fixture.mid");
  return createEditableArrangementFromCandidate(project, project.candidates[0]!.id);
}

describe("Layer 2: ml-collab-codec <project> tagged artifact & OT rebase", () => {
  test("serializes EditableArrangementProject into <project> tagged artifact and parses back losslessly", async () => {
    const editorProject = await createSampleEditorProject();
    const collabModel = arrangementProjectToCollabModel(
      editorProject,
      "kalimba-17c",
      DEFAULT_BOARD_CARDS,
      DEFAULT_BOARD_CONNECTORS,
      [
        "Morning light across the valley",
        "Silver tines ring clear and bright",
      ],
    );

    const serialized = serializeDocument(collabModel, PORTABLE_INSTRUMENTS_SCHEMA);
    expect(serialized).toContain("<project ");
    expect(serialized).toContain('active-instrument="kalimba-17c"');
    expect(serialized).toContain("<arrangement ");
    expect(serialized).toContain("<measure ");
    expect(serialized).toContain("<note ");
    expect(serialized).toContain("<lyrics ");
    expect(serialized).toContain("<board ");
    expect(serialized).toContain("<card ");
    expect(serialized).toContain("<connector ");

    const parsed = parseDocument(serialized, PORTABLE_INSTRUMENTS_SCHEMA);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const roundTripped = collabModelToArrangement(parsed.value, editorProject.arrangement.id);
    expect(roundTripped.arrangement.events.length).toBe(editorProject.arrangement.events.length);
    expect(roundTripped.arrangement.events[0]!.midi!).toBe(
      editorProject.arrangement.events[0]!.midi!,
    );
    expect(roundTripped.lyrics.length).toBe(2);
  });

  test("CollabProjectDocument isolates <board> card drag from musical DerivedGraph and rebases agent proposals over concurrent human edits", async () => {
    const editorProject = await createSampleEditorProject();
    const doc = new CollabProjectDocument(editorProject, "harmonica-c12");

    const statsBeforeMove = doc.getMusicalSummary();
    const computeCountBefore = statsBeforeMove.computeCount;

    // Moving a card on <board> only touches the board path; musical:summary should remain cached
    doc.moveBoardCard("card-score", 410, 120);
    const statsAfterMove = doc.getMusicalSummary();
    expect(statsAfterMove.computeCount).toBe(computeCountBefore);

    const cardScore = doc.getDecodedState().cards.find((c) => c.id === "card-score");
    expect(cardScore?.x).toBe(410);
    expect(cardScore?.y).toBe(120);

    // Agent proposes an edit (shift-octave-up) at current revision
    const proposal = doc.proposeAgentSkill("shift-octave-up", []);
    expect(proposal.changedEventIds.length).toBeGreaterThan(0);

    // Concurrent human edit occurs on the board BEFORE the agent proposal is applied
    doc.moveBoardCard("card-instrument", 880, 140);

    // Apply pending agent proposal: rebaseProposal cleanly merges over the concurrent human board edit
    const applyRes = doc.applyPendingProposal();
    expect(applyRes.status).toBe("applied");

    const decodedAfter = doc.getDecodedState();
    const firstOriginalMidi = editorProject.arrangement.events[0]!.midi!;
    const firstMergedMidi = decodedAfter.arrangement.events[0]!.midi!;
    expect(firstMergedMidi).toBe(firstOriginalMidi + 12);

    // Verify the concurrent human board move was preserved after OT rebase
    const cardInstrument = decodedAfter.cards.find((c) => c.id === "card-instrument");
    expect(cardInstrument?.x).toBe(880);
    expect(cardInstrument?.y).toBe(140);
  });
});

describe("Multi-Instrument Physical Profiles & CanvasIR 2D Scene", () => {
  test("provides physical layouts for 12/10-hole Harmonica, 17-tine Kalimba, Melodica, MIDI Keyboard, and fretless Pontic Lyra", () => {
    expect(PORTABLE_INSTRUMENTS.length).toBe(6);

    const kalimba = getPortableInstrumentProfile("kalimba-17c");
    expect(kalimba.family).toBe("kalimba");
    const c4Placement = getPrimaryInstrumentPlacement(kalimba, 60);
    expect(c4Placement).not.toBeNull();
    expect(c4Placement!.label).toContain("CENTER");

    const lyra = getPortableInstrumentProfile("pontic-lyra");
    expect(lyra.pitchControl).toBe("continuous");
    expect(lyra.articulation).toBe("bow");
    const lyraPlacement = findContinuousFingerPlacement(lyra, 69); // A4
    expect(lyraPlacement).not.toBeNull();
    expect(lyraPlacement!.stringIndex).toBeGreaterThanOrEqual(0);
  });

  test("renders all portable instruments into CanvasIR RecordingContext and builds queryable Scene with hit regions", () => {
    for (const instrument of PORTABLE_INSTRUMENTS) {
      const rc = new RecordingContext({
        measureText: (text) => ({
          width: text.length * 7,
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: text.length * 7,
          actualBoundingBoxAscent: 9,
          actualBoundingBoxDescent: 3,
          fontBoundingBoxAscent: 11,
          fontBoundingBoxDescent: 4,
        }),
      });
      drawPortableInstrumentToCanvasIr(rc, {
        profile: instrument,
        x: 0,
        y: 0,
        width: 480,
        height: 220,
        targetMidi: 64,
        detectedMidis: [64],
        scalePitchClasses: new Set([0, 2, 4, 7, 9]),
        tonicPitchClass: 0,
        centsDeviation: 8,
      });
      const scene = new Scene(rc.getDocument());
      expect(scene.document.ops.length).toBeGreaterThan(0);
    }
  });
});

describe("Improvisation Scale Explorer & Constraint Cards", () => {
  test("builds scale tones in range and evaluates constraint cards deterministically", () => {
    const blues = getScaleFormula("blues");
    const cBluesMidis = buildScaleMidisInRange(0, blues, 60, 72);
    expect(cBluesMidis).toEqual([60, 63, 65, 66, 67, 70, 72]);

    const homecoming = IMPROVISATION_CONSTRAINT_CARDS.find((c) => c.id === "resolve-to-tonic")!;
    const failResult = homecoming.checkPass([60, 63, 65, 67], 60, blues.intervals);
    expect(failResult.passed).toBe(false);

    const passResult = homecoming.checkPass([60, 63, 65, 67, 72], 60, blues.intervals);
    expect(passResult.passed).toBe(true);

    const callMidis = buildCallPromptMidis(CALL_AND_RESPONSE_PROMPTS[0]!);
    expect(callMidis.length).toBe(5);

    const lyraRec = getRecommendedInstrumentScale("pontic-lyra");
    expect(lyraRec.scaleId).toBe("hijaz-klezmer");
  });
});
