import { classifyPitch, centsFromMidi, midiToFrequency } from "../music/pitch";
import type { InputNoteSegment, PitchTracePoint } from "../exercises/evaluation";

export type SignalState = "silence" | "attack" | "tonal-unstable" | "stable" | "release";
export interface TrackerFrame extends PitchTracePoint { frequencyHz: number; classifiedMidi: number; state: SignalState }

export class AdaptivePitchTracker {
  private history: number[] = [];
  private currentMidi?: number;
  private stableFrames = 0;
  private credibleFrames = 0;
  private releaseFrames = 0;
  private open = false;
  public lastState: SignalState = "silence";
  constructor(public noiseFloor = .004, private readonly clarityGate = .72, private readonly range: readonly [number, number] = [58, 99], public sensitivity = 1) {}
  calibrateNoise(rmsValues: readonly number[]): void {
    const sorted = [...rmsValues].filter(Number.isFinite).sort((a, b) => a - b);
    this.noiseFloor = Math.max(.0008, percentile(sorted, .8));
    this.reset();
  }
  get openThreshold(): number { return Math.max(this.noiseFloor + .002 * this.sensitivity, this.noiseFloor * (1.45 + .15 * this.sensitivity)); }
  get closeThreshold(): number { return Math.max(this.noiseFloor + .001 * this.sensitivity, this.noiseFloor * (1.18 + .1 * this.sensitivity)); }
  shouldEstimate(rms: number): boolean { return this.open || rms >= this.openThreshold * .72; }
  reset(): void { this.history = []; this.currentMidi = undefined; this.stableFrames = 0; this.credibleFrames = 0; this.releaseFrames = 0; this.open = false; this.lastState = "silence"; }
  update(point: Omit<PitchTracePoint, "midiFloat"> & { midiFloat?: number }): TrackerFrame | null {
    const inRange = point.midiFloat !== undefined && point.midiFloat >= this.range[0] && point.midiFloat <= this.range[1];
    const credible = point.rms >= this.openThreshold && point.clarity >= this.clarityGate && inRange;
    if (!this.open) {
      if (point.rms < this.openThreshold * .75 && (!inRange || point.clarity < this.clarityGate)) this.noiseFloor = this.noiseFloor * .997 + point.rms * .003;
      this.credibleFrames = credible ? this.credibleFrames + 1 : 0;
      if (this.credibleFrames < 3) { this.lastState = credible ? "attack" : point.rms >= this.openThreshold ? "tonal-unstable" : "silence"; return null; }
      this.open = true; this.releaseFrames = 0;
    }
    if (point.rms < this.closeThreshold || !inRange || point.clarity < this.clarityGate * .75) {
      this.releaseFrames++;
      this.lastState = "release";
      if (this.releaseFrames >= 5) this.reset();
      return null;
    }
    this.releaseFrames = 0;
    this.history.push(point.midiFloat!); if (this.history.length > 5) this.history.shift();
    const midiFloat = median(this.history);
    let nextMidi = classifyPitch(midiFloat);
    if (this.currentMidi !== undefined && nextMidi !== this.currentMidi && Math.abs(midiFloat - this.currentMidi) < .58) nextMidi = this.currentMidi;
    if (nextMidi === this.currentMidi) this.stableFrames++; else { this.currentMidi = nextMidi; this.stableFrames = 1; }
    const stable = this.stableFrames >= 3 && point.clarity >= this.clarityGate;
    this.lastState = stable ? "stable" : "attack";
    return { ...point, midiFloat, frequencyHz: midiToFrequency(midiFloat), classifiedMidi: nextMidi, state: this.lastState };
  }
}

export class NoteSegmenter {
  private active?: { midi: number; attack: number; stable: number; last: number; trace: PitchTracePoint[] };
  constructor(private readonly releaseGraceMs = 100) {}
  reset(): void { this.active = undefined; }
  update(frame: TrackerFrame | null, nowMs: number, source: InputNoteSegment["source"] = "fixture"): InputNoteSegment | null {
    if (frame?.state === "stable") {
      if (this.active && this.active.midi !== frame.classifiedMidi) {
        const completed = this.finalize(source);
        this.active = { midi: frame.classifiedMidi, attack: nowMs, stable: nowMs, last: nowMs, trace: [{ time: nowMs, midiFloat: frame.midiFloat, clarity: frame.clarity, rms: frame.rms }] };
        return completed;
      }
      this.active ??= { midi: frame.classifiedMidi, attack: nowMs, stable: nowMs, last: nowMs, trace: [] };
      this.active.last = nowMs;
      this.active.trace.push({ time: nowMs, midiFloat: frame.midiFloat, clarity: frame.clarity, rms: frame.rms });
      return null;
    }
    if (this.active && nowMs - this.active.last >= this.releaseGraceMs) return this.finalize(source);
    return null;
  }
  private finalize(source: InputNoteSegment["source"]): InputNoteSegment | null {
    if (!this.active) return null;
    const current = this.active; this.active = undefined;
    const midis = current.trace.map((item) => item.midiFloat), cents = midis.map((midi) => centsFromMidi(midi));
    const medianMidi = median(midis) || current.midi, medianCents = median(cents), mean = cents.reduce((sum, value) => sum + value, 0) / Math.max(1, cents.length);
    return { id: `${source}-${current.attack}`, source, startedAt: current.attack, stableStartedAt: current.stable, endedAt: current.last, durationMs: current.last - current.attack, medianFrequencyHz: midiToFrequency(medianMidi), medianMidiFloat: medianMidi, classifiedMidi: current.midi, medianCentsFromEt: medianCents, centsVariability: Math.sqrt(cents.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, cents.length)), medianClarity: median(current.trace.map((item) => item.clarity)), medianRms: median(current.trace.map((item) => item.rms)), pitchTrace: current.trace };
  }
}
function percentile(values: readonly number[], p: number): number { return values[Math.floor(Math.max(0, values.length - 1) * p)] ?? 0; }
function median(values: readonly number[]): number { return percentile([...values].sort((a, b) => a - b), .5); }
