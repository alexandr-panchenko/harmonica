import { describe, expect, test } from "bun:test";
import { STANDARD_C10, STANDARD_C12, actionMidi, actionsForMidi, profileRange } from "../../src/harmonica/profile";

describe("harmonica profile", () => {
  test("preserves solo tuning", () => { expect(actionMidi(1,"blow","out")).toBe(60); expect(actionMidi(4,"draw","out")).toBe(71); expect(actionMidi(4,"blow","out")).toBe(72); expect(actionMidi(12,"blow","in")).toBe(97); });
  test("represents alternate physical actions", () => { expect(actionsForMidi(STANDARD_C12,72).length).toBeGreaterThan(1); });
  test("exposes full profile", () => { expect(STANDARD_C12.physicalActions).toHaveLength(48); expect(profileRange(STANDARD_C12)).toEqual([60,97]); });
  test("models the compact ten-hole instrument independently", () => { expect(STANDARD_C10.holeCount).toBe(10); expect(STANDARD_C10.physicalActions).toHaveLength(40); expect(profileRange(STANDARD_C10)).toEqual([60,90]); expect(STANDARD_C10.physicalActions.every((action)=>action.hole<=10)).toBeTrue(); });
});
