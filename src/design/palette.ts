export type Lch = Readonly<{ l: number; c: number; h: number }>;

export type ModeId = "find" | "score" | "ear" | "rhythm" | "guided";

export interface ModePalette {
  hue: number;
  darkLch: Lch;
  lightLch: Lch;
  dark: string;
  light: string;
}

const MODE_LCH: Record<ModeId, { hue: number; dark: [number, number]; light: [number, number] }> = {
  find: { hue: 272, dark: [34, 42], light: [92, 18] },
  score: { hue: 205, dark: [34, 34], light: [92, 17] },
  ear: { hue: 318, dark: [34, 38], light: [92, 17] },
  rhythm: { hue: 78, dark: [34, 34], light: [92, 18] },
  guided: { hue: 142, dark: [34, 34], light: [92, 18] },
};

export const neutralPalette = {
  light: {
    canvas: "#f6f4ef", surface1: "#fffdf9", surface2: "#f0eee8", surfaceRaised: "#ffffff",
    textPrimary: "#252725", textSecondary: "#505450", textMuted: "#676c67", borderSubtle: "#d9d7d0", borderStrong: "#8a8e88",
    focusRing: "#155eb5", success: "#267147", warning: "#805b08", error: "#a33a32",
  },
  dark: {
    canvas: "#1b1c1b", surface1: "#242624", surface2: "#2c2f2c", surfaceRaised: "#333633",
    textPrimary: "#f4f2ec", textSecondary: "#d0d0c9", textMuted: "#afb1aa", borderSubtle: "#454943", borderStrong: "#7a7f77",
    focusRing: "#9bc7ff", success: "#89d5a6", warning: "#e8c36b", error: "#ffaaa2",
  },
} as const;

export const modePalette = Object.fromEntries(Object.entries(MODE_LCH).map(([id, source]) => {
  const darkLch = { l: source.dark[0], c: source.dark[1], h: source.hue };
  const lightLch = { l: source.light[0], c: source.light[1], h: source.hue };
  return [id, { hue: source.hue, darkLch, lightLch, dark: lchToHex(darkLch), light: lchToHex(lightLch) }];
})) as Record<ModeId, ModePalette>;

export function lchToHex(lch: Lch): string {
  const radians = lch.h * Math.PI / 180;
  return labToHex(lch.l, lch.c * Math.cos(radians), lch.c * Math.sin(radians));
}

function labToHex(l: number, a: number, b: number): string {
  const fy = (l + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const pivot = (value: number) => value ** 3 > 216 / 24389 ? value ** 3 : (116 * value - 16) / 903.3;
  const x50 = 0.96422 * pivot(fx), y50 = pivot(fy), z50 = 0.82521 * pivot(fz);
  const x = x50 * 0.9555766 + y50 * -0.0230393 + z50 * 0.0631636;
  const y = x50 * -0.0282895 + y50 * 1.0099416 + z50 * 0.0210077;
  const z = x50 * 0.0122982 + y50 * -0.020483 + z50 * 1.3299098;
  const linear = [x * 3.2404542 + y * -1.5371385 + z * -0.4985314, x * -0.969266 + y * 1.8760108 + z * 0.041556, x * 0.0556434 + y * -0.2040259 + z * 1.0572252];
  const gamma = (value: number) => value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
  return `#${linear.map(value => Math.round(Math.max(0, Math.min(1, gamma(value))) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function relativeLuminance(hex: string): number {
  const values = hex.slice(1).match(/.{2}/g)!.map(value => Number.parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
}

export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter! + 0.05) / (darker! + 0.05);
}

export function paletteCss(): string {
  return (Object.entries(modePalette) as [ModeId, ModePalette][]).flatMap(([id, value]) => [`--mode-${id}-dark:${value.dark}`, `--mode-${id}-light:${value.light}`]).join(";");
}
