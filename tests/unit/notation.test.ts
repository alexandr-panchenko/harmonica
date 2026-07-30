import { describe, expect, test } from "bun:test";
import { layoutWrittenPitch, writtenPitchFromMidi } from "../../src/notation/layout";

const pitch = (step: "C"|"D"|"E"|"F"|"G"|"A"|"B", octave: number, accidental?: "sharp"|"flat"|"natural") => ({ step, octave, accidental });

describe("treble staff notation", () => {
  test("uses diatonic positions from bottom-line E4", () => {
    expect(layoutWrittenPitch(pitch("C", 4))).toMatchObject({ y: 174, ledgerLines: [174] });
    expect(layoutWrittenPitch(pitch("D", 4)).y).toBe(166);
    expect(layoutWrittenPitch(pitch("E", 4)).y).toBe(158);
    expect(layoutWrittenPitch(pitch("G", 4)).y).toBe(142);
    expect(layoutWrittenPitch(pitch("B", 4)).y).toBe(126);
    expect(layoutWrittenPitch(pitch("D", 5)).y).toBe(110);
    expect(layoutWrittenPitch(pitch("F", 5)).y).toBe(94);
  });
  test("accidentals share their natural's vertical position", () => {
    expect(layoutWrittenPitch(pitch("C", 4, "sharp")).y).toBe(layoutWrittenPitch(pitch("C", 4)).y);
    expect(layoutWrittenPitch(pitch("B", 4, "flat")).y).toBe(layoutWrittenPitch(pitch("B", 4)).y);
  });
  test("creates all ledger lines across the chromatic profile range", () => {
    expect(layoutWrittenPitch(writtenPitchFromMidi(60)).ledgerLines).toEqual([174]);
    expect(layoutWrittenPitch(writtenPitchFromMidi(97)).ledgerLines.length).toBeGreaterThan(3);
  });
});
