import { describe, expect, test } from "bun:test";
import { ABCJS_TESTED_VERSION, adaptAbc } from "../../src/labs/staff/AbcAdapter";
import { STAFF_FIXTURES } from "../../src/labs/staff/fixtures";

describe("staff lab abcjs boundary", () => {
  test("keeps the tested engraver version explicit", () => {
    expect(ABCJS_TESTED_VERSION).toBe("6.5.2");
  });

  test("maps every fixture to canonical written and sounding events", () => {
    for (const fixture of STAFF_FIXTURES) {
      const document = adaptAbc(fixture.abc);
      expect(document.writtenEvents.length).toBeGreaterThan(8);
      expect(document.soundingEvents.length).toBeGreaterThan(5);
      expect(document.totalBeats).toBeGreaterThan(12);
      expect(document.diagnostics).toEqual([]);
      expect(document.writtenEvents.every((event) => event.durationBeats > 0)).toBe(true);
    }
  });

  test("applies key signatures and explicit sharp, flat, and natural spelling", () => {
    const document = adaptAbc(STAFF_FIXTURES[0]!.abc);
    const spelled = document.writtenEvents.filter((event) => event.writtenPitch?.accidental).map((event) => event.writtenPitch!.accidental);
    expect(spelled).toContain("sharp");
    expect(spelled).toContain("flat");
    expect(spelled).toContain("natural");
    const keySignatureF = document.writtenEvents.find((event) => event.writtenPitch?.step === "F" && !event.writtenPitch.accidental);
    expect(keySignatureF?.midi && keySignatureF.midi % 12).toBe(6);
  });

  test("merges tied written notes into one sounding event across a bar", () => {
    const document = adaptAbc("X:9\nM:4/4\nL:1/4\nK:C\nC2-C2 | C2-C2 | z4 |");
    const tied = document.soundingEvents.filter((event) => event.midi === 60);
    expect(tied).toHaveLength(2);
    expect(tied[0]).toMatchObject({ durationBeats: 4 });
    expect(tied[0]!.writtenEventIds).toHaveLength(2);
  });
});
