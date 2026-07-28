import { classifyPitch, centsFromMidi, midiToFrequency } from "../music/pitch";
import type { InputNoteSegment, PitchTracePoint } from "../exercises/evaluation";

export type SignalState = "silence" | "attack" | "tonal-unstable" | "stable" | "release";
export interface TrackerFrame extends PitchTracePoint { frequencyHz: number; classifiedMidi: number; state: SignalState }

export class AdaptivePitchTracker {
  private history: number[] = [];
  private currentMidi?: number;
  private stableFrames = 0;
  constructor(public noiseFloor = .004, private readonly clarityGate = .72) {}
  calibrateNoise(rmsValues: readonly number[]): void { const sorted = [...rmsValues].sort((a, b) => a - b); this.noiseFloor = (sorted[Math.floor(sorted.length * .8)] ?? .004) * 1.6; }
  update(point: Omit<PitchTracePoint, "midiFloat"> & { midiFloat?: number }): TrackerFrame | null {
    if (point.rms < this.noiseFloor || point.midiFloat === undefined) { this.stableFrames = 0; return null; }
    this.history.push(point.midiFloat); if (this.history.length > 5) this.history.shift();
    const sorted = [...this.history].sort((a, b) => a - b), midiFloat = sorted[Math.floor(sorted.length / 2)]!;
    let nextMidi = classifyPitch(midiFloat);
    if (this.currentMidi !== undefined && nextMidi !== this.currentMidi && Math.abs(midiFloat - this.currentMidi) < .58) nextMidi = this.currentMidi;
    if (nextMidi === this.currentMidi) this.stableFrames++; else { this.currentMidi = nextMidi; this.stableFrames = 1; }
    const stable = this.stableFrames >= 3 && point.clarity >= this.clarityGate;
    return { ...point, midiFloat, frequencyHz: midiToFrequency(midiFloat), classifiedMidi: nextMidi, state: stable ? "stable" : point.clarity >= this.clarityGate ? "attack" : "tonal-unstable" };
  }
}

export class NoteSegmenter {
  private active?: { midi: number; attack: number; stable: number; last: number; trace: PitchTracePoint[] };
  constructor(private readonly releaseGraceMs = 100) {}
  update(frame: TrackerFrame | null, nowMs: number, source: InputNoteSegment["source"] = "fixture"): InputNoteSegment | null {
    if (frame?.state === "stable") {
      if (!this.active) this.active = { midi: frame.classifiedMidi, attack: nowMs, stable: nowMs, last: nowMs, trace: [] };
      if (this.active.midi !== frame.classifiedMidi && nowMs - this.active.last < this.releaseGraceMs) return null;
      this.active.last = nowMs; this.active.trace.push({ time: nowMs, midiFloat: frame.midiFloat, clarity: frame.clarity, rms: frame.rms }); return null;
    }
    if (this.active && nowMs - this.active.last >= this.releaseGraceMs) {
      const current = this.active; this.active = undefined;
      const midis = current.trace.map((item) => item.midiFloat).sort((a, b) => a - b), cents = midis.map((midi) => centsFromMidi(midi)); const medianMidi = midis[Math.floor(midis.length / 2)] ?? current.midi;
      const medianCents = cents.sort((a, b) => a - b)[Math.floor(cents.length / 2)] ?? 0; const mean = cents.reduce((sum, value) => sum + value, 0) / Math.max(1, cents.length);
      return { id: `${source}-${current.attack}`, source, startedAt: current.attack, stableStartedAt: current.stable, endedAt: current.last, durationMs: current.last - current.attack, medianFrequencyHz: midiToFrequency(medianMidi), medianMidiFloat: medianMidi, classifiedMidi: current.midi, medianCentsFromEt: medianCents, centsVariability: Math.sqrt(cents.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, cents.length)), medianClarity: median(current.trace.map((item) => item.clarity)), medianRms: median(current.trace.map((item) => item.rms)), pitchTrace: current.trace };
    }
    return null;
  }
}
function median(values: number[]): number { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] ?? 0; }
