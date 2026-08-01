import { describe, expect, test } from "bun:test";
import {
  STANDARD_C10,
  STANDARD_C10_ACTIONS,
  STANDARD_C12,
  STANDARD_C12_ACTIONS,
  actionFor,
  actionsForMidi,
  profileRange,
  type HarmonicaHoleLayout,
  type HarmonicaProfile,
} from "../../src/harmonica/profile";

function expectCompleteLayout(profile: HarmonicaProfile, layout: readonly HarmonicaHoleLayout[]) {
  expect(profile.holeCount).toBe(layout.length);
  expect(profile.physicalActions).toHaveLength(layout.length * 4);
  for (const hole of layout) {
    expect(actionFor(profile, hole.hole, "blow", "out").canonicalMidi).toBe(hole.slideOut.blow);
    expect(actionFor(profile, hole.hole, "draw", "out").canonicalMidi).toBe(hole.slideOut.draw);
    expect(actionFor(profile, hole.hole, "blow", "in").canonicalMidi).toBe(hole.slideIn.blow);
    expect(actionFor(profile, hole.hole, "draw", "in").canonicalMidi).toBe(hole.slideIn.draw);
  }
}

describe("harmonica profiles", () => {
  test("matches the complete explicit 10-hole owner table", () => {
    expectCompleteLayout(STANDARD_C10, STANDARD_C10_ACTIONS);
    expect(STANDARD_C10.holeCount).toBe(10);
    expect(STANDARD_C10.physicalActions).toHaveLength(40);
    expect(profileRange(STANDARD_C10)).toEqual([60, 92]);
    expect(actionFor(STANDARD_C10, 9, "blow", "out").canonicalMidi).toBe(88);
    expect(actionFor(STANDARD_C10, 9, "draw", "out").canonicalMidi).toBe(86);
    expect(actionFor(STANDARD_C10, 10, "blow", "out").canonicalMidi).toBe(91);
    expect(actionFor(STANDARD_C10, 10, "draw", "out").canonicalMidi).toBe(89);
    expect(actionFor(STANDARD_C10, 10, "blow", "in").canonicalMidi).toBe(92);
  });

  test("matches the complete explicit 12-hole owner table", () => {
    expectCompleteLayout(STANDARD_C12, STANDARD_C12_ACTIONS);
    expect(STANDARD_C12.holeCount).toBe(12);
    expect(STANDARD_C12.physicalActions).toHaveLength(48);
    expect(profileRange(STANDARD_C12)).toEqual([60, 97]);
    expect(actionFor(STANDARD_C12, 9, "blow", "out").canonicalMidi).toBe(84);
    expect(actionFor(STANDARD_C12, 12, "blow", "in").canonicalMidi).toBe(97);
  });

  test("keeps every physical position that produces the same pitch", () => {
    expect(actionsForMidi(STANDARD_C12, 72).length).toBeGreaterThan(1);
    expect(actionsForMidi(STANDARD_C10, 89).map((action) => action.id)).toEqual([
      "9-blow-in",
      "10-draw-out",
    ]);
  });
});
