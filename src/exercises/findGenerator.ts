import type { HarmonicaProfile } from "../harmonica/profile";

export type FindRange = "beginner" | "medium" | "full";
export type AccidentalMode = "naturals" | "accidentals" | "chromatic";
const NATURAL_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);

export function findPitchPool(profile: HarmonicaProfile, range: FindRange, accidentals: AccidentalMode): number[] {
  const available = [...new Set(profile.physicalActions.map((action) => action.canonicalMidi))].sort((a, b) => a - b);
  const [low, high] = range === "beginner" ? [60, 72] : range === "medium" ? [60, Math.min(84, available.at(-1)!)] : [available[0]!, available.at(-1)!];
  const ranged = available.filter((midi) => midi >= low && midi <= high);
  if (accidentals === "chromatic") return ranged;
  if (accidentals === "naturals") return ranged.filter((midi) => NATURAL_CLASSES.has(midi % 12));
  const naturals = ranged.filter((midi) => NATURAL_CLASSES.has(midi % 12));
  const chromatics = ranged.filter((midi) => !NATURAL_CLASSES.has(midi % 12));
  return [...naturals, ...chromatics.filter((_, index) => index % 2 === 0)].sort((a, b) => a - b);
}

export function nextRandomPitch(pool: number[], history: number[], random = Math.random): number {
  if (!pool.length) throw new Error("Find-note pitch pool is empty");
  const previous = history.at(-1);
  const recent = new Set(history.slice(-3));
  let candidates = pool.filter((midi) => midi !== previous && !recent.has(midi) && (previous === undefined || Math.abs(midi - previous) !== 2));
  if (!candidates.length) candidates = pool.filter((midi) => midi !== previous);
  if (!candidates.length) candidates = pool;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]!;
}

export function createRandomSequence(pool: number[], count: number, random = Math.random): number[] {
  const result: number[] = [];
  while (result.length < count) result.push(nextRandomPitch(pool, result, random));
  return result;
}
