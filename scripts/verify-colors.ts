import { contrastRatio, modePalette, neutralPalette, paletteCss } from "../src/design/palette";
import { readFileSync } from "node:fs";

const failures: string[] = [];
const check = (label: string, foreground: string, background: string, minimum: number) => {
  const ratio = contrastRatio(foreground, background);
  console.log(`${label.padEnd(34)} ${foreground} / ${background}  ${ratio.toFixed(2)}:1`);
  if (ratio < minimum) failures.push(`${label}: ${ratio.toFixed(2)} < ${minimum}`);
};

for (const [id, pair] of Object.entries(modePalette)) {
  check(`${id} reversible pair`, pair.dark, pair.light, 4.5);
  check(`${id} light-theme accent`, pair.dark, neutralPalette.light.surface1, 4.5);
  check(`${id} dark-theme accent`, pair.light, neutralPalette.dark.surface1, 4.5);
}
for (const [theme, tokens] of Object.entries(neutralPalette)) {
  check(`${theme} primary/canvas`, tokens.textPrimary, tokens.canvas, 7);
  check(`${theme} secondary/canvas`, tokens.textSecondary, tokens.canvas, 4.5);
  check(`${theme} muted/surface`, tokens.textMuted, tokens.surface1, 4.5);
  check(`${theme} focus/canvas`, tokens.focusRing, tokens.canvas, 3);
  check(`${theme} focus/raised`, tokens.focusRing, tokens.surfaceRaised, 3);
  check(`${theme} success/canvas`, tokens.success, tokens.canvas, 4.5);
  check(`${theme} warning/canvas`, tokens.warning, tokens.canvas, 4.5);
  check(`${theme} error/canvas`, tokens.error, tokens.canvas, 4.5);
}
if (paletteCss() !== paletteCss()) failures.push("palette output is not deterministic");
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
for (const [id, pair] of Object.entries(modePalette)) {
  if (!css.includes(`--mode-${id}-dark: ${pair.dark}`) || !css.includes(`--mode-${id}-light: ${pair.light}`)) failures.push(`${id}: generated CSS tokens are stale`);
}
if (failures.length) throw new Error(`Colour verification failed:\n${failures.join("\n")}`);
console.log("All required colour contrasts pass.");
