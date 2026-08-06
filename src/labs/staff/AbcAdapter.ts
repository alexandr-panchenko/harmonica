import abcjs from "abcjs";
import type { WrittenPitch } from "../../music/melody";

export interface WrittenMusicEvent {
  id: string;
  kind: "note" | "rest";
  writtenPitch?: WrittenPitch;
  midi?: number;
  startBeat: number;
  durationBeats: number;
  measureIndex: number;
  tie?: "start" | "continue" | "end";
  sourceRange?: { start: number; end: number };
}

export interface SoundEvent {
  id: string;
  midi: number;
  startBeat: number;
  durationBeats: number;
  writtenEventIds: string[];
}

export interface AbcDocument {
  title: string;
  meter: { numerator: number; denominator: number };
  pickupBeats: number;
  totalBeats: number;
  writtenEvents: WrittenMusicEvent[];
  soundingEvents: SoundEvent[];
  diagnostics: string[];
}

interface InternalPitch {
  pitch: number;
  name: string;
  accidental?: "sharp" | "flat" | "natural" | "dblsharp" | "dblflat";
  startTie?: object;
  endTie?: boolean;
}

interface InternalVoiceItem {
  el_type: string;
  type?: string;
  duration?: number;
  pitches?: InternalPitch[];
  rest?: { type?: string };
  startChar?: number;
  endChar?: number;
}

interface InternalStaff {
  voices?: InternalVoiceItem[][];
  key?: { accidentals?: { acc: "sharp" | "flat" | "natural"; note: string }[] };
}

interface InternalTune {
  lines: { staff?: InternalStaff[] }[];
  metaText?: { title?: string };
  warnings?: string[];
  getMeterFraction(): { num: number; den: number };
  getPickupLength(): number;
}

const STEPS = ["C", "D", "E", "F", "G", "A", "B"] as const;
const SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const accidentalOffset = (value?: string) => value === "sharp" ? 1 : value === "flat" ? -1 : value === "dblsharp" ? 2 : value === "dblflat" ? -2 : 0;

function pitchIdentity(diatonic: number) {
  const stepIndex = ((diatonic % 7) + 7) % 7;
  return { step: STEPS[stepIndex]!, octave: 4 + Math.floor(diatonic / 7), stepIndex };
}

/**
 * The only application boundary allowed to inspect abcjs's parsed tune shape.
 * abcjs documents that this shape can change, so production code consumes only
 * the canonical document returned here and the DOM anchors returned below.
 */
export function adaptAbc(source: string): AbcDocument {
  const tune = abcjs.parseOnly(source)[0] as unknown as InternalTune | undefined;
  if (!tune) throw new Error("abcjs did not return a tune");
  const meterValue = tune.getMeterFraction();
  const meter = { numerator: Number(meterValue.num || 4), denominator: Number(meterValue.den || 4) };
  const firstStaff = tune.lines.find((line) => line.staff?.[0])?.staff?.[0];
  const keyOffsets = new Map<string, number>();
  for (const accidental of firstStaff?.key?.accidentals ?? []) keyOffsets.set(accidental.note.toUpperCase(), accidentalOffset(accidental.acc));

  const writtenEvents: WrittenMusicEvent[] = [];
  let beat = 0;
  let measureIndex = 0;
  let measureAccidentals = new Map<string, number>();
  for (const line of tune.lines) {
    const voice = line.staff?.[0]?.voices?.[0] ?? [];
    for (const item of voice) {
      if (item.el_type === "bar") {
        measureIndex += 1;
        measureAccidentals = new Map();
        continue;
      }
      if (item.el_type !== "note" || !item.duration) continue;
      const durationBeats = item.duration * 4;
      const sourceRange = item.startChar !== undefined && item.endChar !== undefined ? { start: item.startChar, end: item.endChar } : undefined;
      const pitch = item.pitches?.[0];
      if (!pitch || item.rest) {
        writtenEvents.push({ id: `abc-${item.startChar ?? writtenEvents.length}`, kind: "rest", startBeat: beat, durationBeats, measureIndex, sourceRange });
        beat += durationBeats;
        continue;
      }
      const identity = pitchIdentity(pitch.pitch);
      const accidentalKey = `${identity.step}${identity.octave}`;
      if (pitch.accidental) measureAccidentals.set(accidentalKey, accidentalOffset(pitch.accidental));
      const offset = pitch.accidental ? accidentalOffset(pitch.accidental) : (measureAccidentals.get(accidentalKey) ?? keyOffsets.get(identity.step) ?? 0);
      const midi = 12 * (identity.octave + 1) + SEMITONES[identity.stepIndex]! + offset;
      const tie = pitch.startTie && pitch.endTie ? "continue" : pitch.startTie ? "start" : pitch.endTie ? "end" : undefined;
      writtenEvents.push({
        id: `abc-${item.startChar ?? writtenEvents.length}`,
        kind: "note",
        writtenPitch: { step: identity.step, octave: identity.octave, accidental: pitch.accidental === "sharp" ? "sharp" : pitch.accidental === "flat" ? "flat" : pitch.accidental === "natural" ? "natural" : undefined },
        midi,
        startBeat: beat,
        durationBeats,
        measureIndex,
        tie,
        sourceRange,
      });
      beat += durationBeats;
    }
  }

  const soundingEvents: SoundEvent[] = [];
  let openTie: SoundEvent | undefined;
  for (const event of writtenEvents) {
    if (event.kind === "rest" || event.midi === undefined) { openTie = undefined; continue; }
    if ((event.tie === "end" || event.tie === "continue") && openTie?.midi === event.midi) {
      openTie.durationBeats += event.durationBeats;
      openTie.writtenEventIds.push(event.id);
      if (event.tie === "end") openTie = undefined;
      continue;
    }
    const sound: SoundEvent = { id: `sound-${soundingEvents.length}`, midi: event.midi, startBeat: event.startBeat, durationBeats: event.durationBeats, writtenEventIds: [event.id] };
    soundingEvents.push(sound);
    openTie = event.tie === "start" || event.tie === "continue" ? sound : undefined;
  }

  return {
    title: tune.metaText?.title ?? "Untitled fixture",
    meter,
    pickupBeats: tune.getPickupLength() * 4,
    totalBeats: beat,
    writtenEvents,
    soundingEvents,
    diagnostics: tune.warnings ?? [],
  };
}

export interface RenderAnchor {
  eventId: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface RenderedTuneBoundary {
  getSelectableArray(): { absEl: { type: string; abcelem: { startChar?: number } }; svgEl: SVGElement }[];
}

/** The only boundary that depends on abcjs-generated SVG class structure. */
export function bindAbcRender(container: HTMLElement, events: readonly WrittenMusicEvent[], tune?: RenderedTuneBoundary): RenderAnchor[] {
  const elements = new Map<string, SVGElement>();
  for (const selectable of tune?.getSelectableArray() ?? []) {
    const event = events.find((item) => item.kind === "note" && item.sourceRange?.start === selectable.absEl.abcelem.startChar);
    if (event) elements.set(event.id, selectable.svgEl);
  }
  const rests = [...container.querySelectorAll<SVGElement>("svg g.abcjs-rest")];
  events.filter((event) => event.kind === "rest").forEach((event, index) => { if (rests[index]) elements.set(event.id, rests[index]!); });
  return events.flatMap((event) => {
    const element = elements.get(event.id);
    if (!element) return [];
    element.dataset.writtenEventId = event.id;
    const box = element.getBoundingClientRect();
    const parentBox = container.getBoundingClientRect();
    return [{ eventId: event.id, left: box.left - parentBox.left, top: box.top - parentBox.top, width: box.width, height: box.height }];
  });
}

export const ABCJS_TESTED_VERSION = "6.5.2";
