import { describe, expect, test } from "bun:test";
import { activeBeat, eventWidth, eventX, traceX } from "../../src/game/timeline";

describe("musical timeline", () => {
  test("positions score material by beat around a fixed playhead", () => {
    expect(eventX({ startBeat: 4 }, 2, 80, 300)).toBe(460);
    expect(eventX({ startBeat: 1 }, 2, 80, 300)).toBe(220);
    expect(eventWidth({ durationBeats: 1.5 }, 80)).toBe(120);
  });
  test("positions audio history by monotonic time", () => {
    expect(traceX(9_000, 10_000, 100, 300)).toBe(200);
  });
  test("step mode anchors to the active event's beat", () => {
    expect(activeBeat([{ id:"a", kind:"note", startBeat:0, durationBeats:1, measureIndex:0 }, { id:"b", kind:"note", startBeat:3, durationBeats:1, measureIndex:0 }], 1)).toBe(3);
  });
});
