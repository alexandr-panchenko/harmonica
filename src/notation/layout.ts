import type { WrittenPitch } from "../music/melody";

const STEPS = ["C", "D", "E", "F", "G", "A", "B"] as const;
const BOTTOM_LINE_ORDINAL = 4 * 7 + 2; // E4

export interface StaffLayout {
  y: number;
  diatonicOffset: number;
  ledgerLines: number[];
}

export function diatonicOrdinal(pitch: WrittenPitch): number {
  const step = STEPS.indexOf(pitch.step);
  if (step < 0) throw new Error(`Unsupported written pitch step: ${pitch.step}`);
  return pitch.octave * 7 + step;
}

export function layoutWrittenPitch(pitch: WrittenPitch, bottomLineY = 158, lineSpacing = 16): StaffLayout {
  const diatonicOffset = diatonicOrdinal(pitch) - BOTTOM_LINE_ORDINAL;
  const halfSpace = lineSpacing / 2;
  const ledgerOffsets: number[] = [];
  if (diatonicOffset <= -2) for (let offset = -2; offset >= diatonicOffset; offset -= 2) ledgerOffsets.push(offset);
  if (diatonicOffset >= 10) for (let offset = 10; offset <= diatonicOffset; offset += 2) ledgerOffsets.push(offset);
  return {
    y: bottomLineY - diatonicOffset * halfSpace,
    diatonicOffset,
    ledgerLines: ledgerOffsets.map((offset) => bottomLineY - offset * halfSpace),
  };
}

const SHARP_SPELLINGS = [
  ["C"], ["C", "sharp"], ["D"], ["D", "sharp"], ["E"], ["F"],
  ["F", "sharp"], ["G"], ["G", "sharp"], ["A"], ["A", "sharp"], ["B"],
] as const;

export function writtenPitchFromMidi(midi: number): WrittenPitch {
  const [step, accidental] = SHARP_SPELLINGS[((midi % 12) + 12) % 12]!;
  return { step, accidental, octave: Math.floor(midi / 12) - 1 };
}
