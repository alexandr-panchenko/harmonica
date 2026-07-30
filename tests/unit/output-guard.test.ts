import { describe, expect, test } from "bun:test";
import { OutputContaminationGuard } from "../../src/audio/OutputContaminationGuard";

describe("speaker-output contamination guard", () => {
  test("blocks scoring for playback plus its output tail", () => {
    const guard = new OutputContaminationGuard(180);
    guard.blockFor(700, 1000);
    expect(guard.isBlocked(1800)).toBeTrue();
    expect(guard.isBlocked(1881)).toBeFalse();
  });
});
