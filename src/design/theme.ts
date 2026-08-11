export const THEME_STORAGE_KEY = "harmonica-theme";
export type ThemePreference = "system" | "light" | "dark";

export function readThemePreference(storage: Pick<Storage, "getItem"> = localStorage): ThemePreference {
  const value = storage.getItem(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export function resolvedTheme(preference: ThemePreference, darkSystem = matchMedia("(prefers-color-scheme: dark)").matches): "light" | "dark" {
  return preference === "system" ? darkSystem ? "dark" : "light" : preference;
}

export function applyTheme(preference: ThemePreference, root = document.documentElement): void {
  root.dataset.themePreference = preference;
  root.dataset.theme = resolvedTheme(preference);
}
