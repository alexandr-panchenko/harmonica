import { describe, expect, test } from "bun:test";
import { readThemePreference, resolvedTheme } from "../../src/design/theme";

describe("theme preference", () => {
  test("defaults to system and resolves its fallback", () => {
    expect(readThemePreference({ getItem: () => null })).toBe("system");
    expect(resolvedTheme("system", false)).toBe("light");
    expect(resolvedTheme("system", true)).toBe("dark");
  });
  test("keeps explicit light and dark preferences", () => {
    expect(readThemePreference({ getItem: () => "light" })).toBe("light");
    expect(readThemePreference({ getItem: () => "dark" })).toBe("dark");
    expect(readThemePreference({ getItem: () => "invalid" })).toBe("system");
  });
});
