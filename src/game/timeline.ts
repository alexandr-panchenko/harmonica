import type { MelodyEvent } from "../music/melody";

export const PLAYHEAD_X = 300;
export const DEFAULT_PIXELS_PER_BEAT = 82;

export function eventX(event: Pick<MelodyEvent, "startBeat">, currentBeat: number, pixelsPerBeat = DEFAULT_PIXELS_PER_BEAT, playheadX = PLAYHEAD_X): number {
  return playheadX + (event.startBeat - currentBeat) * pixelsPerBeat;
}

export function eventWidth(event: Pick<MelodyEvent, "durationBeats">, pixelsPerBeat = DEFAULT_PIXELS_PER_BEAT): number {
  return Math.max(18, event.durationBeats * pixelsPerBeat);
}

export function traceX(timeMs: number, nowMs: number, pixelsPerSecond = 96, playheadX = PLAYHEAD_X): number {
  return playheadX + (timeMs - nowMs) / 1000 * pixelsPerSecond;
}

export function activeBeat(events: readonly MelodyEvent[], activeIndex: number): number {
  return events[activeIndex]?.startBeat ?? 0;
}
