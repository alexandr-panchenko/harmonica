import { classifyPitch, centsFromMidi, midiToFrequency } from "../music/pitch";
import type { InputNoteSegment, PitchTracePoint } from "../exercises/evaluation";

export type SignalState = "silence" | "attack" | "tonal-unstable" | "stable" | "release";
export type MicrophoneSensitivity = "high" | "normal" | "low";
export interface TrackerFrame extends PitchTracePoint { frequencyHz: number; classifiedMidi: number; state: SignalState }

export class AdaptivePitchTracker {
  private history: number[] = [];
  private currentMidi?: number;
  private attackStartedAt?: number;
  private pitchStartedAt?: number;
  private dropoutStartedAt?: number;
  private open = false;
  public lastState: SignalState = "silence";
  public sensitivity: MicrophoneSensitivity;
  constructor(public noiseFloor = .004, private readonly clarityGate = .7, private readonly range: readonly [number, number] = [58, 99], sensitivity: MicrophoneSensitivity | number = "normal") {
    this.sensitivity = typeof sensitivity === "string" ? sensitivity : sensitivity <= .8 ? "high" : sensitivity >= 1.2 ? "low" : "normal";
  }
  calibrateNoise(rmsValues: readonly number[]): void {
    const sorted = [...rmsValues].filter(Number.isFinite).sort((a, b) => a - b);
    this.noiseFloor = Math.max(.0008, percentile(sorted, .8));
    this.reset();
  }
  setSensitivity(sensitivity: MicrophoneSensitivity): void { this.sensitivity = sensitivity; this.reset(); }
  get noiseFloorDb(): number { return rmsToDb(this.noiseFloor); }
  get openThresholdDb(): number { return this.noiseFloorDb + ({ high: 4, normal: 6.5, low: 10 } as const)[this.sensitivity]; }
  get closeThresholdDb(): number { return this.noiseFloorDb + ({ high: 2, normal: 3.5, low: 6.5 } as const)[this.sensitivity]; }
  get openThreshold(): number { return Math.max(.0012, dbToRms(this.openThresholdDb)); }
  get closeThreshold(): number { return Math.max(.0009, dbToRms(this.closeThresholdDb)); }
  get isOpen(): boolean { return this.open; }
  shouldEstimate(rms: number): boolean { return this.open || rms >= this.closeThreshold * .72; }
  reset(): void { this.history = []; this.currentMidi = undefined; this.attackStartedAt = undefined; this.pitchStartedAt = undefined; this.dropoutStartedAt = undefined; this.open = false; this.lastState = "silence"; }
  update(point: Omit<PitchTracePoint, "midiFloat"> & { midiFloat?: number }): TrackerFrame | null {
    const inRange = point.midiFloat !== undefined && point.midiFloat >= this.range[0] && point.midiFloat <= this.range[1];
    const credible = point.rms >= this.openThreshold && point.clarity >= this.clarityGate && inRange;
    if (!this.open) {
      if (point.rms < this.openThreshold * .75 && (!inRange || point.clarity < this.clarityGate)) this.noiseFloor = this.noiseFloor * .997 + point.rms * .003;
      if (!credible) {
        this.attackStartedAt = undefined;
        this.lastState = point.rms >= this.openThreshold ? "tonal-unstable" : "silence";
        return null;
      }
      this.attackStartedAt ??= point.time;
      this.lastState = "attack";
      const attackMs = ({ high: 90, normal: 120, low: 155 } as const)[this.sensitivity];
      if (point.time - this.attackStartedAt < attackMs) return makeFrame(point, classifyPitch(point.midiFloat!), "attack");
      this.open = true;
      this.dropoutStartedAt = undefined;
    }
    const sustainCredible = point.rms >= this.closeThreshold && inRange && point.clarity >= this.clarityGate * .62;
    if (!sustainCredible) {
      this.dropoutStartedAt ??= point.time;
      this.lastState = "release";
      if (point.time - this.dropoutStartedAt >= 320) this.reset();
      return this.currentMidi === undefined || point.midiFloat === undefined ? null : makeFrame(point, this.currentMidi, "release", median(this.history));
    }
    this.dropoutStartedAt = undefined;
    this.history.push(point.midiFloat!); if (this.history.length > 5) this.history.shift();
    const midiFloat = median(this.history);
    let nextMidi = classifyPitch(midiFloat);
    if (this.currentMidi !== undefined && nextMidi !== this.currentMidi && Math.abs(midiFloat - this.currentMidi) < .58) nextMidi = this.currentMidi;
    if (nextMidi !== this.currentMidi) { this.currentMidi = nextMidi; this.pitchStartedAt = point.time; }
    this.pitchStartedAt ??= point.time;
    const stable = point.time - this.pitchStartedAt >= 55 && point.clarity >= this.clarityGate * .82;
    this.lastState = stable ? "stable" : "attack";
    return makeFrame(point, nextMidi, this.lastState, midiFloat);
  }
}

export class NoteSegmenter {
  private active?: { midi: number; attack: number; stable: number; last: number; trace: PitchTracePoint[] };
  constructor(private readonly releaseGraceMs = 320) {}
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
function makeFrame(point: Omit<PitchTracePoint, "midiFloat"> & { midiFloat?: number }, midi: number, state: SignalState, filteredMidi = point.midiFloat ?? midi): TrackerFrame {
  return { ...point, midiFloat: filteredMidi, frequencyHz: midiToFrequency(filteredMidi), classifiedMidi: midi, state };
}
function percentile(values: readonly number[], p: number): number { return values[Math.floor(Math.max(0, values.length - 1) * p)] ?? 0; }
function median(values: readonly number[]): number { return percentile([...values].sort((a, b) => a - b), .5); }
export function rmsToDb(rms: number): number { return rms > 0 ? 20 * Math.log10(rms) : -120; }
export function dbToRms(db: number): number { return 10 ** (db / 20); }
