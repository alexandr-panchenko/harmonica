import type { MelodyEvent } from "../music/melody";

export type PracticeMode = "step" | "realtime";
export type TransportStatus = "idle" | "count-in" | "playing" | "paused" | "complete";
export type MistakePolicy = "pause" | "restart-note" | "restart-measure";

export interface PracticeTransportState {
  mode: PracticeMode;
  status: TransportStatus;
  positionBeat: number;
  startBeat: number;
  totalBeats: number;
  tempoQpm: number;
  countInBeats: number;
}

export interface StepPracticeState {
  activeEventIndex: number;
  heldBeats: number;
  completedEventIds: string[];
  awaitingRearticulation: boolean;
  feedback: "ready" | "correct" | "wrong" | "release" | "complete";
}

export interface PracticeSignal {
  midi?: number;
  sounding: boolean;
  articulation: number;
}

export function totalBeats(events: readonly MelodyEvent[]): number {
  return events.reduce((end, event) => Math.max(end, event.startBeat + event.durationBeats), 0);
}
