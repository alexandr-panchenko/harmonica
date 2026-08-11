import { describe, expect, test } from "bun:test";
import { contrastRatio, modePalette, neutralPalette, paletteCss } from "../../src/design/palette";

describe("CIELAB/LCh palette", () => {
  test("generation is deterministic", () => expect(paletteCss()).toBe(paletteCss()));
  test("all five reversible pairs pass WCAG AA", () => {
    expect(Object.keys(modePalette)).toHaveLength(5);
    for (const pair of Object.values(modePalette)) {
      expect(contrastRatio(pair.dark, pair.light)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(pair.dark, neutralPalette.light.surface1)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(pair.light, neutralPalette.dark.surface1)).toBeGreaterThanOrEqual(4.5);
    }
  });
  test("neutral copy passes on theme surfaces", () => {
    for (const tokens of Object.values(neutralPalette)) {
      expect(contrastRatio(tokens.textPrimary, tokens.canvas)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(tokens.textSecondary, tokens.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.textMuted, tokens.surface1)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
