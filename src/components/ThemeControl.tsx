import { useEffect, useState } from "react";
import { applyTheme, readThemePreference, resolvedTheme, THEME_STORAGE_KEY, type ThemePreference } from "../design/theme";

const OPTIONS: ThemePreference[] = ["system", "light", "dark"];

export function ThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>(() => readThemePreference());
  useEffect(() => {
    const sync = (event: Event) => setPreference((event as CustomEvent<ThemePreference>).detail);
    addEventListener("harmonica-theme-change", sync);
    return () => removeEventListener("harmonica-theme-change", sync);
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      document.documentElement.dataset.themePreference = preference;
      document.documentElement.dataset.theme = resolvedTheme(preference, media.matches);
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", media.matches && preference === "system" || preference === "dark" ? "#1b1c1b" : "#f6f4ef");
    };
    localStorage.setItem(THEME_STORAGE_KEY, preference);
    applyTheme(preference);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [preference]);
  return <div className="theme-control" role="group" aria-label="Theme">
    {OPTIONS.map(option => <button key={option} aria-pressed={preference === option} onClick={() => { setPreference(option); dispatchEvent(new CustomEvent("harmonica-theme-change", { detail: option })); }}>{option[0]!.toUpperCase() + option.slice(1)}</button>)}
  </div>;
}
