import type { MelodyEvent } from "../music/melody";
import { totalBeats, type PracticeMode, type PracticeTransportState } from "./practiceTypes";

export class PracticeTransport {
  private anchorMs = 0;
  private anchorBeat = 0;
  state: PracticeTransportState;

  constructor(events: readonly MelodyEvent[], tempoQpm: number, mode: PracticeMode = "step", private readonly now: () => number = () => performance.now()) {
    this.state = { mode, status: "idle", positionBeat: 0, startBeat: 0, totalBeats: totalBeats(events), tempoQpm, countInBeats: 0 };
  }

  configure(events: readonly MelodyEvent[], tempoQpm: number): PracticeTransportState {
    this.state = { ...this.state, status: "idle", positionBeat: 0, startBeat: 0, totalBeats: totalBeats(events), tempoQpm, countInBeats: 0 };
    return this.state;
  }

  setMode(mode: PracticeMode): PracticeTransportState {
    this.state = { ...this.state, mode, status: "idle", positionBeat: this.state.startBeat, countInBeats: 0 };
    return this.state;
  }

  play(countInBeats = this.state.mode === "realtime" ? 4 : 0): PracticeTransportState {
    if (this.state.status === "complete") this.seek(this.state.startBeat);
    this.anchorMs = this.now();
    this.anchorBeat = this.state.positionBeat;
    this.state = { ...this.state, status: countInBeats > 0 ? "count-in" : "playing", countInBeats };
    return this.state;
  }

  pause(): PracticeTransportState {
    this.tick();
    this.state = { ...this.state, status: "paused", countInBeats: 0 };
    return this.state;
  }

  restart(): PracticeTransportState {
    this.state = { ...this.state, status: "idle", positionBeat: this.state.startBeat, countInBeats: 0 };
    return this.state;
  }

  seek(beat: number): PracticeTransportState {
    const positionBeat = clamp(beat, 0, this.state.totalBeats);
    this.anchorBeat = positionBeat;
    this.anchorMs = this.now();
    this.state = { ...this.state, status: this.state.status === "playing" || this.state.status === "count-in" ? "paused" : this.state.status, positionBeat, startBeat: positionBeat, countInBeats: 0 };
    return this.state;
  }

  advanceStep(positionBeat: number): PracticeTransportState {
    if (this.state.mode !== "step") return this.state;
    const next = clamp(positionBeat, 0, this.state.totalBeats);
    this.state = { ...this.state, status: next >= this.state.totalBeats ? "complete" : "playing", positionBeat: next };
    return this.state;
  }

  tick(atMs = this.now()): PracticeTransportState {
    if (this.state.mode !== "realtime" || (this.state.status !== "playing" && this.state.status !== "count-in")) return this.state;
    const elapsedBeats = (atMs - this.anchorMs) / 60_000 * this.state.tempoQpm;
    if (this.state.status === "count-in") {
      if (elapsedBeats < this.state.countInBeats) return this.state;
      this.anchorMs += this.state.countInBeats * 60_000 / this.state.tempoQpm;
      this.anchorBeat = this.state.positionBeat;
      this.state = { ...this.state, status: "playing", countInBeats: 0 };
      return this.tick(atMs);
    }
    const positionBeat = clamp(this.anchorBeat + elapsedBeats, 0, this.state.totalBeats);
    this.state = { ...this.state, positionBeat, status: positionBeat >= this.state.totalBeats ? "complete" : "playing" };
    return this.state;
  }

  activeEvent(events: readonly MelodyEvent[]): MelodyEvent | undefined {
    return events.find(event => this.state.positionBeat >= event.startBeat && this.state.positionBeat < event.startBeat + event.durationBeats) ?? events.at(-1);
  }
}

function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)); }
