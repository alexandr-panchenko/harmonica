import { clamp } from "../music/pitch";
import type { MelodyEvent } from "../music/melody";

export interface InputNoteSegment {
  id: string; source: "microphone" | "virtual-harmonica" | "fixture"; startedAt: number; stableStartedAt: number; endedAt: number; durationMs: number;
  medianFrequencyHz: number; medianMidiFloat: number; classifiedMidi: number; medianCentsFromEt: number; medianCentsFromExpected?: number;
  centsVariability: number; medianClarity: number; medianRms: number; pitchTrace: PitchTracePoint[];
}
export interface PitchTracePoint { time: number; midiFloat: number; clarity: number; rms: number }
export interface StepRule { targetMidi: number; holdMs: number; strictIntonation: boolean; strictToleranceCents: number; expectedOffsetCents?: number }

export function acceptsStep(segment: InputNoteSegment, rule: StepRule): { accepted: boolean; reason: string } {
  if (segment.classifiedMidi !== rule.targetMidi) return { accepted: false, reason: segment.classifiedMidi < rule.targetMidi ? "Play higher" : "Play lower" };
  if (segment.durationMs < rule.holdMs) return { accepted: false, reason: `Hold for ${rule.holdMs} ms` };
  const cents = segment.medianCentsFromExpected ?? segment.medianCentsFromEt - (rule.expectedOffsetCents ?? 0);
  if (rule.strictIntonation && Math.abs(cents) > rule.strictToleranceCents) return { accepted: false, reason: cents < 0 ? "Right note, tune higher" : "Right note, tune lower" };
  return { accepted: true, reason: "Correct note" };
}

export function transpositionDelta(target: readonly number[], played: readonly number[]): number | null {
  if (played.length < 2 || target.length < played.length) return null;
  const delta = played[0]! - target[0]!;
  return played.every((midi, index) => midi - target[index]! === delta) ? delta : null;
}

export function relativeTargets(target: readonly number[], anchor: number): number[] { const delta = anchor - target[0]!; return target.map((midi) => midi + delta); }

export interface Alignment { target?: MelodyEvent; input?: InputNoteSegment; kind: "match" | "extra" | "missing"; pitch: number; timing: number; length: number; stability: number; intonation: number }

export function timingTolerances(tempoQpm: number): { onset: number; release: number } {
  const beatMs = 60_000 / tempoQpm;
  return { onset: clamp(beatMs * 0.18, 60, 160), release: clamp(beatMs * 0.22, 80, 220) };
}

export function alignPerformance(targets: readonly MelodyEvent[], inputs: readonly InputNoteSegment[], tempoQpm: number): Alignment[] {
  const notes = targets.filter((event) => event.kind === "note");
  const beatMs = 60_000 / tempoQpm;
  const rows = notes.length + 1, cols = inputs.length + 1;
  const cost = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  const move = Array.from({ length: rows }, () => Array<"match" | "extra" | "missing">(cols).fill("match"));
  for (let i = 1; i < rows; i++) { cost[i]![0] = i * 2; move[i]![0] = "missing"; }
  for (let j = 1; j < cols; j++) { cost[0]![j] = j * 2; move[0]![j] = "extra"; }
  for (let i = 1; i < rows; i++) for (let j = 1; j < cols; j++) {
    const target = notes[i - 1]!, input = inputs[j - 1]!;
    const matchCost = cost[i - 1]![j - 1]! + Math.min(3, Math.abs((target.midi ?? 0) - input.classifiedMidi)) + Math.min(2, Math.abs(target.startBeat * beatMs - input.startedAt) / beatMs);
    const candidates = [{ v: matchCost, m: "match" as const }, { v: cost[i - 1]![j]! + 2, m: "missing" as const }, { v: cost[i]![j - 1]! + 2, m: "extra" as const }].sort((a, b) => a.v - b.v);
    cost[i]![j] = candidates[0]!.v; move[i]![j] = candidates[0]!.m;
  }
  const result: Alignment[] = [];
  let i = notes.length, j = inputs.length;
  while (i || j) {
    const kind = move[i]![j]!;
    if (kind === "match") {
      const target = notes[--i]!, input = inputs[--j]!;
      const expectedStart = target.startBeat * beatMs, expectedLength = target.durationBeats * beatMs;
      result.push({ target, input, kind, pitch: target.midi === input.classifiedMidi ? 100 : 0, timing: clamp(100 - Math.abs(expectedStart - input.startedAt) / 2, 0, 100), length: clamp(100 - Math.abs(expectedLength - input.durationMs) / 3, 0, 100), stability: clamp(100 - input.centsVariability * 2, 0, 100), intonation: clamp(100 - Math.abs(input.medianCentsFromExpected ?? input.medianCentsFromEt) * 2, 0, 100) });
    } else if (kind === "missing") result.push({ target: notes[--i], kind, pitch: 0, timing: 0, length: 0, stability: 0, intonation: 0 });
    else result.push({ input: inputs[--j], kind, pitch: 0, timing: 0, length: 0, stability: 0, intonation: 0 });
  }
  return result.reverse();
}
