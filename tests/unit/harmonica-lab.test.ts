import { describe, expect, test } from "bun:test";
import { STANDARD_C10, STANDARD_C12 } from "../../src/harmonica/profile";
import { demoActions, harmonicaHitZones, slideStateForActions } from "../../src/labs/harmonica/geometry";

describe("harmonica lab geometry and state", () => {
  test("creates four non-overlapping normalized actions for every physical hole", () => {
    for (const count of [10, 12]) {
      const zones = harmonicaHitZones(count);
      expect(zones).toHaveLength(count * 4);
      expect(new Set(zones.map((zone) => zone.id)).size).toBe(count * 4);
      expect(zones.every((zone) => zone.x >= 0 && zone.y >= 0 && zone.x + zone.width <= 1.000001 && zone.y + zone.height <= 1)).toBe(true);
    }
  });

  test("does not claim a slider position for ambiguous microphone matches", () => {
    const matches = demoActions(STANDARD_C12, "mic-ambiguous");
    expect(matches.length).toBeGreaterThan(1);
    expect(new Set(matches.map((action) => action.slide))).toEqual(new Set(["out", "in"]));
    expect(slideStateForActions(matches)).toBe("neutral");
  });

  test("supports both profile sizes with the same state model", () => {
    expect(harmonicaHitZones(STANDARD_C10.holeCount)).toHaveLength(STANDARD_C10.physicalActions.length);
    expect(harmonicaHitZones(STANDARD_C12.holeCount)).toHaveLength(STANDARD_C12.physicalActions.length);
    expect(slideStateForActions(demoActions(STANDARD_C12, "guided"))).toBe("in");
  });
});
