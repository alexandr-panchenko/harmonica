export const DEFAULT_A4 = 440;

export function frequencyToMidi(frequencyHz: number, referenceA4Hz = DEFAULT_A4): number {
  if (!(frequencyHz > 0) || !(referenceA4Hz > 0)) throw new RangeError("Frequencies must be positive");
  return 69 + 12 * Math.log2(frequencyHz / referenceA4Hz);
}

export function midiToFrequency(midi: number, referenceA4Hz = DEFAULT_A4): number {
  return referenceA4Hz * 2 ** ((midi - 69) / 12);
}

export function centsFromMidi(midiFloat: number, midi = Math.round(midiFloat)): number {
  return 100 * (midiFloat - midi);
}

export function classifyPitch(midiFloat: number, expectedOffsets: Readonly<Record<number, number>> = {}): number {
  const low = Math.floor(midiFloat);
  const high = low + 1;
  const lowCenter = low + (expectedOffsets[low] ?? 0) / 100;
  const highCenter = high + (expectedOffsets[high] ?? 0) / 100;
  return midiFloat < (lowCenter + highCenter) / 2 ? low : high;
}

export const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"] as const;

export function noteName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
