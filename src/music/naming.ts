import { noteName } from "./pitch";

export type NamingSystem = "letters" | "solfege";
const SOLFEGE: Record<string, string> = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };

export function teachingNoteName(midi: number, system: NamingSystem, withOctave = true): string {
  const letters = noteName(midi);
  if (system === "letters") return withOctave ? letters : letters.replace(/-?\d+$/, "");
  const match = letters.match(/^([A-G])([♯♭]?)(-?\d+)$/);
  if (!match) return letters;
  const [, step = "C", accidental = "", octave = ""] = match;
  return `${SOLFEGE[step]}${accidental}${withOctave ? octave : ""}`;
}
