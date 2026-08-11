import type { InputNoteSegment } from "../exercises/evaluation";
import { alignPerformance, type Alignment } from "../exercises/evaluation";
import type { MelodyEvent } from "../music/melody";

export class RealtimePerformanceEngine {
  private segments: InputNoteSegment[] = [];
  constructor(readonly events: readonly MelodyEvent[], readonly tempoQpm: number, readonly startBeat = 0) {}
  record(segment: InputNoteSegment): void { this.segments.push(segment); }
  clear(): void { this.segments = []; }
  review(): Alignment[] {
    const startMs = this.startBeat * 60_000 / this.tempoQpm;
    const scoped = this.events.filter(event => event.startBeat + event.durationBeats > this.startBeat).map(event => ({ ...event, startBeat: event.startBeat - this.startBeat }));
    return alignPerformance(scoped, this.segments.map(segment => ({ ...segment, startedAt: segment.startedAt - startMs, stableStartedAt: segment.stableStartedAt - startMs, endedAt: segment.endedAt - startMs })), this.tempoQpm);
  }
}
