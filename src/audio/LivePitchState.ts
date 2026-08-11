import { AdaptivePitchTracker, rmsToDb, type MicrophoneSensitivity, type SignalState, type TrackerFrame } from "./tracking";
import type { PitchTracePoint } from "../exercises/evaluation";

export type { MicrophoneSensitivity } from "./tracking";

export interface RawPitchEstimate {
  frequencyHz: number;
  midiFloat: number;
  clarity: number;
  rms: number;
}

export interface MicrophoneFrameBundle {
  time: number;
  signalState: SignalState;
  rawEstimate?: RawPitchEstimate;
  candidate?: TrackerFrame;
  display?: TrackerFrame;
  accepted?: TrackerFrame;
  gate: {
    rms: number;
    rmsDb: number;
    noiseFloorDb: number;
    openThresholdDb: number;
    closeThresholdDb: number;
    isOpen: boolean;
    confidence: number;
    sensitivity: MicrophoneSensitivity;
  };
}

/** Separates estimator output, visually latched pitch, and exercise-grade pitch. */
export class LivePitchState {
  private display?: TrackerFrame;
  private accepted?: TrackerFrame;
  private displaySeenAt = -Infinity;
  private acceptedSeenAt = -Infinity;

  constructor(
    readonly tracker = new AdaptivePitchTracker(),
    private readonly displayLatchMs = 210,
    private readonly acceptedLatchMs = 165,
  ) {}

  update(point: Omit<PitchTracePoint, "midiFloat"> & { midiFloat?: number; frequencyHz?: number }): MicrophoneFrameBundle {
    const candidate = this.tracker.update(point) ?? undefined;
    if (candidate && this.tracker.isOpen && (candidate.state === "attack" || candidate.state === "stable")) {
      this.display = candidate;
      this.displaySeenAt = point.time;
    }
    if (candidate?.state === "stable") {
      this.accepted = candidate;
      this.acceptedSeenAt = point.time;
    }
    if (point.time - this.displaySeenAt > this.displayLatchMs) this.display = undefined;
    if (point.time - this.acceptedSeenAt > this.acceptedLatchMs) this.accepted = undefined;
    return {
      time: point.time,
      signalState: this.tracker.lastState,
      rawEstimate: point.midiFloat !== undefined && point.frequencyHz !== undefined
        ? { frequencyHz: point.frequencyHz, midiFloat: point.midiFloat, clarity: point.clarity, rms: point.rms }
        : undefined,
      candidate,
      display: this.display ? { ...this.display, time: point.time } : undefined,
      accepted: this.accepted ? { ...this.accepted, time: point.time } : undefined,
      gate: {
        rms: point.rms,
        rmsDb: rmsToDb(point.rms),
        noiseFloorDb: this.tracker.noiseFloorDb,
        openThresholdDb: this.tracker.openThresholdDb,
        closeThresholdDb: this.tracker.closeThresholdDb,
        isOpen: this.tracker.isOpen,
        confidence: candidate?.clarity ?? point.clarity,
        sensitivity: this.tracker.sensitivity,
      },
    };
  }

  reset(): void {
    this.tracker.reset();
    this.display = undefined;
    this.accepted = undefined;
    this.displaySeenAt = -Infinity;
    this.acceptedSeenAt = -Infinity;
  }
}
