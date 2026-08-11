import type { MelodyEvent } from "../music/melody";
import type { MistakePolicy, PracticeSignal, StepPracticeState } from "./practiceTypes";

export class StepPracticeEngine {
  state: StepPracticeState = { activeEventIndex: 0, heldBeats: 0, completedEventIds: [], awaitingRearticulation: false, feedback: "ready" };
  private lastTime?: number;
  private lastArticulation = -1;

  constructor(readonly events: readonly MelodyEvent[], public policy: MistakePolicy = "pause") {}

  seek(beat: number): StepPracticeState {
    const index = Math.max(0, this.events.findIndex(event => beat < event.startBeat + event.durationBeats));
    this.state = { activeEventIndex: index < 0 ? this.events.length - 1 : index, heldBeats: 0, completedEventIds: [], awaitingRearticulation: false, feedback: "ready" };
    this.lastTime = undefined;
    return this.state;
  }

  update(signal: PracticeSignal, nowMs: number, tempoQpm: number): StepPracticeState {
    const event = this.events[this.state.activeEventIndex];
    if (!event || this.state.feedback === "complete") return this.state;
    const deltaBeats = this.lastTime === undefined ? 0 : Math.max(0, nowMs - this.lastTime) / 60_000 * tempoQpm;
    this.lastTime = nowMs;
    const newArticulation = signal.articulation !== this.lastArticulation;
    if (newArticulation) this.lastArticulation = signal.articulation;
    if (this.state.awaitingRearticulation) {
      if (!signal.sounding) this.state = { ...this.state, awaitingRearticulation: false, feedback: "ready" };
      else if (!newArticulation) return this.state;
      else this.state = { ...this.state, awaitingRearticulation: false };
    }
    const correct = event.kind === "rest" ? !signal.sounding : signal.sounding && signal.midi === event.midi;
    if (correct) {
      const heldBeats = Math.min(event.durationBeats, this.state.heldBeats + deltaBeats);
      this.state = { ...this.state, heldBeats, feedback: "correct" };
      if (heldBeats >= event.durationBeats) this.completeCurrent(signal.sounding);
      return this.state;
    }
    const prematureRelease = event.kind === "note" && !signal.sounding && this.state.heldBeats > 0;
    if ((signal.sounding && event.kind === "rest") || (signal.sounding && signal.midi !== event.midi) || prematureRelease) this.applyMistake(prematureRelease ? "release" : "wrong");
    return this.state;
  }

  private completeCurrent(stillSounding: boolean): void {
    const event = this.events[this.state.activeEventIndex]!;
    const nextIndex = this.state.activeEventIndex + 1;
    const next = this.events[nextIndex];
    const repeated = stillSounding && event.kind === "note" && next?.kind === "note" && event.midi === next.midi;
    this.state = {
      activeEventIndex: Math.min(nextIndex, this.events.length - 1),
      heldBeats: 0,
      completedEventIds: [...this.state.completedEventIds, event.id],
      awaitingRearticulation: repeated,
      feedback: nextIndex >= this.events.length ? "complete" : "correct",
    };
  }

  private applyMistake(feedback: "wrong" | "release"): void {
    if (this.policy === "pause") this.state = { ...this.state, feedback };
    else if (this.policy === "restart-note") this.state = { ...this.state, heldBeats: 0, feedback };
    else {
      const measure = this.events[this.state.activeEventIndex]?.measureIndex ?? 0;
      const measureStart = Math.max(0, this.events.findIndex(event => event.measureIndex === measure));
      this.state = { ...this.state, activeEventIndex: measureStart, heldBeats: 0, feedback };
    }
  }
}
