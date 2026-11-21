import { noteName as midiToPitchName } from "../music/pitch";
import type { PortableInstrumentId } from "../instruments/instrumentProfiles";

export function parsePitchName(pitchStr: string): number | null {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(pitchStr.trim());
  if (!m) return null;
  const stepMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const base = stepMap[m[1]!.toUpperCase()];
  if (base === undefined) return null;
  const alter = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  const octave = Number(m[3]);
  return (octave + 1) * 12 + base + alter;
}

export type ScaleFormulaId =
  | "major"
  | "natural-minor"
  | "harmonic-minor"
  | "major-pentatonic"
  | "minor-pentatonic"
  | "blues"
  | "dorian"
  | "mixolydian"
  | "hijaz-klezmer";

export interface ScaleFormula {
  readonly id: ScaleFormulaId;
  readonly label: string;
  readonly shortDescription: string;
  readonly intervals: readonly number[];
  readonly characteristicIntervals: readonly number[];
  readonly avoidIntervals: readonly number[];
}

export interface ImprovisationConstraintCard {
  readonly id: string;
  readonly title: string;
  readonly category: "phrasing" | "rhythm" | "interval" | "ear";
  readonly prompt: string;
  readonly evaluationHint: string;
  readonly checkPass: (playedMidis: readonly number[], rootMidi: number, scaleIntervals: readonly number[]) => {
    readonly passed: boolean;
    readonly feedback: string;
  };
}

export interface CallAndResponsePrompt {
  readonly id: string;
  readonly title: string;
  readonly difficulty: "starter" | "intermediate" | "advanced";
  readonly rootPitch: string;
  readonly scaleId: ScaleFormulaId;
  readonly callOffsets: readonly number[];
  readonly instruction: string;
}

export const SCALE_FORMULAS: readonly ScaleFormula[] = [
  {
    id: "major",
    label: "Major (Ionian)",
    shortDescription: "Bright, stable 7-note home scale for folk, pop, and nursery melodies.",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    characteristicIntervals: [0, 4, 7],
    avoidIntervals: [1, 3, 6, 8, 10],
  },
  {
    id: "natural-minor",
    label: "Natural Minor (Aeolian)",
    shortDescription: "Lyrical minor mood with flat 3rd, 6th, and 7th.",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    characteristicIntervals: [0, 3, 7, 10],
    avoidIntervals: [1, 4, 6, 9, 11],
  },
  {
    id: "harmonic-minor",
    label: "Harmonic Minor",
    shortDescription: "Dramatic minor with a raised leading tone (major 7th).",
    intervals: [0, 2, 3, 5, 7, 8, 11],
    characteristicIntervals: [0, 3, 8, 11],
    avoidIntervals: [1, 4, 6, 9, 10],
  },
  {
    id: "major-pentatonic",
    label: "Major Pentatonic",
    shortDescription: "Open 5-note melody scale without half-step tension—ideal for Kalimba & Harmonica.",
    intervals: [0, 2, 4, 7, 9],
    characteristicIntervals: [0, 4, 7, 9],
    avoidIntervals: [1, 3, 5, 6, 8, 10, 11],
  },
  {
    id: "minor-pentatonic",
    label: "Minor Pentatonic",
    shortDescription: "Soulful 5-note foundation for vocal hooks and solo improvisation.",
    intervals: [0, 3, 5, 7, 10],
    characteristicIntervals: [0, 3, 7, 10],
    avoidIntervals: [1, 2, 4, 6, 8, 9, 11],
  },
  {
    id: "blues",
    label: "Blues Scale",
    shortDescription: "Minor pentatonic plus the expressive flat-5 blue note.",
    intervals: [0, 3, 5, 6, 7, 10],
    characteristicIntervals: [0, 3, 6, 7, 10],
    avoidIntervals: [1, 2, 4, 8, 9, 11],
  },
  {
    id: "dorian",
    label: "Dorian Mode",
    shortDescription: "Minor scale with a bright natural 6th—classic Celtic, jazz, and groove feel.",
    intervals: [0, 2, 3, 5, 7, 9, 10],
    characteristicIntervals: [0, 3, 7, 9],
    avoidIntervals: [1, 4, 6, 8, 11],
  },
  {
    id: "mixolydian",
    label: "Mixolydian Mode",
    shortDescription: "Major scale with a bluesy flat-7th—traditional folk & rock solo sound.",
    intervals: [0, 2, 4, 5, 7, 9, 10],
    characteristicIntervals: [0, 4, 7, 10],
    avoidIntervals: [1, 3, 6, 8, 11],
  },
  {
    id: "hijaz-klezmer",
    label: "Hijaz / Phrygian Dominant",
    shortDescription: "Expressive augmented-2nd interval prized on Pontic Lyra and Eastern Mediterranean melodies.",
    intervals: [0, 1, 4, 5, 7, 8, 10],
    characteristicIntervals: [0, 1, 4, 7],
    avoidIntervals: [2, 3, 6, 9, 11],
  },
] as const;

export const ROOT_PITCH_CLASSES: readonly { readonly label: string; readonly semitone: number; readonly defaultMidi: number }[] = [
  { label: "C", semitone: 0, defaultMidi: 60 },
  { label: "C#", semitone: 1, defaultMidi: 61 },
  { label: "D", semitone: 2, defaultMidi: 62 },
  { label: "Eb", semitone: 3, defaultMidi: 63 },
  { label: "E", semitone: 4, defaultMidi: 64 },
  { label: "F", semitone: 5, defaultMidi: 65 },
  { label: "F#", semitone: 6, defaultMidi: 66 },
  { label: "G", semitone: 7, defaultMidi: 67 },
  { label: "Ab", semitone: 8, defaultMidi: 68 },
  { label: "A", semitone: 9, defaultMidi: 69 },
  { label: "Bb", semitone: 10, defaultMidi: 70 },
  { label: "B", semitone: 11, defaultMidi: 71 },
] as const;

export function getScaleFormula(scaleId: ScaleFormulaId): ScaleFormula {
  return SCALE_FORMULAS.find((item) => item.id === scaleId) ?? SCALE_FORMULAS[0]!;
}

export function isMidiInScale(midi: number, rootSemitone: number, formula: ScaleFormula): boolean {
  const rel = ((midi - rootSemitone) % 12 + 12) % 12;
  return formula.intervals.includes(rel);
}

export function buildScaleMidisInRange(
  rootSemitone: number,
  formula: ScaleFormula,
  minMidi: number,
  maxMidi: number,
): number[] {
  const result: number[] = [];
  for (let midi = minMidi; midi <= maxMidi; midi += 1) {
    if (isMidiInScale(midi, rootSemitone, formula)) {
      result.push(midi);
    }
  }
  return result;
}

export const IMPROVISATION_CONSTRAINT_CARDS: readonly ImprovisationConstraintCard[] = [
  {
    id: "resolve-to-tonic",
    title: "Homecoming Cadence",
    category: "phrasing",
    prompt: "Play a 4-to-7 note phrase using only scale tones and land your final note on the root (tonic).",
    evaluationHint: "Checks that every note belongs to the active scale and the last note resolves to the root pitch class.",
    checkPass: (playedMidis, rootMidi, scaleIntervals) => {
      if (playedMidis.length < 4) {
        return { passed: false, feedback: `Play at least 4 notes (${playedMidis.length}/4 captured).` };
      }
      const rootClass = ((rootMidi % 12) + 12) % 12;
      const outOfScale = playedMidis.filter((m) => !scaleIntervals.includes(((m - rootClass) % 12 + 12) % 12));
      if (outOfScale.length > 0) {
        return {
          passed: false,
          feedback: `Out-of-scale note detected (${midiToPitchName(outOfScale[0]!)}). Stay inside the highlighted scale tones.`,
        };
      }
      const lastMidi = playedMidis[playedMidis.length - 1]!;
      if (((lastMidi - rootClass) % 12 + 12) % 12 !== 0) {
        return {
          passed: false,
          feedback: `Final note was ${midiToPitchName(lastMidi)}. Resolve your phrase on the root (${midiToPitchName(rootMidi)}).`,
        };
      }
      return {
        passed: true,
        feedback: `Resolved cleanly to ${midiToPitchName(lastMidi)} after ${playedMidis.length} in-scale notes!`,
      };
    },
  },
  {
    id: "no-adjacent-repeat",
    title: "Flowing Motion (No Immediate Repeats)",
    category: "interval",
    prompt: "Improvise at least 5 notes in the scale without repeating the exact same pitch twice in a row.",
    evaluationHint: "Encourages melodic contour instead of percussive single-note repetition.",
    checkPass: (playedMidis, rootMidi, scaleIntervals) => {
      if (playedMidis.length < 5) {
        return { passed: false, feedback: `Play at least 5 notes (${playedMidis.length}/5 captured).` };
      }
      const rootClass = ((rootMidi % 12) + 12) % 12;
      for (let i = 0; i < playedMidis.length; i += 1) {
        const midi = playedMidis[i]!;
        if (!scaleIntervals.includes(((midi - rootClass) % 12 + 12) % 12)) {
          return {
            passed: false,
            feedback: `${midiToPitchName(midi)} is outside the scale.`,
          };
        }
        if (i > 0 && playedMidis[i - 1] === midi) {
          return {
            passed: false,
            feedback: `Repeated ${midiToPitchName(midi)} twice in a row. Keep the melody moving!`,
          };
        }
      }
      return {
        passed: true,
        feedback: `Smooth ${playedMidis.length}-note contour with zero adjacent repeats!`,
      };
    },
  },
  {
    id: "stepwise-and-one-leap",
    title: "Stepwise Story + One Expressive Leap",
    category: "interval",
    prompt: "Play 5+ scale notes containing at least one expressive leap (≥ 4 semitones) and mostly stepwise motion.",
    evaluationHint: "Balances singable steps with one memorable melodic jump.",
    checkPass: (playedMidis) => {
      if (playedMidis.length < 5) {
        return { passed: false, feedback: `Play at least 5 notes (${playedMidis.length}/5 captured).` };
      }
      let leaps = 0;
      for (let i = 1; i < playedMidis.length; i += 1) {
        const diff = Math.abs(playedMidis[i]! - playedMidis[i - 1]!);
        if (diff >= 4) leaps += 1;
      }
      if (leaps === 0) {
        return {
          passed: false,
          feedback: "All motion was narrow steps—include at least one leap of a major 3rd (4 semitones) or wider.",
        };
      }
      return {
        passed: true,
        feedback: `Great melodic shape: ${playedMidis.length} notes with ${leaps} expressive leap(s).`,
      };
    },
  },
  {
    id: "question-and-answer",
    title: "Question (Non-Tonic) → Answer (Tonic)",
    category: "ear",
    prompt: "Play a 6-note phrase where note #3 pauses on a non-root scale degree (question) and the final note lands on the root (answer).",
    evaluationHint: "Teaches open vs. closed phrase endings by ear.",
    checkPass: (playedMidis, rootMidi) => {
      if (playedMidis.length < 6) {
        return { passed: false, feedback: `Play at least 6 notes (${playedMidis.length}/6 captured).` };
      }
      const rootClass = ((rootMidi % 12) + 12) % 12;
      const midClass = ((playedMidis[2]! - rootClass) % 12 + 12) % 12;
      const endClass = ((playedMidis[playedMidis.length - 1]! - rootClass) % 12 + 12) % 12;
      if (midClass === 0) {
        return {
          passed: false,
          feedback: "Your 3rd note landed on the root—leave the middle 'question' open on a 2nd, 3rd, or 5th!",
        };
      }
      if (endClass !== 0) {
        return {
          passed: false,
          feedback: `Your final 'answer' landed on ${midiToPitchName(playedMidis[playedMidis.length - 1]!)}. Close on the root!`,
        };
      }
      return {
        passed: true,
        feedback: "Open question on note #3 followed by a clear tonic answer!",
      };
    },
  },
] as const;

export const CALL_AND_RESPONSE_PROMPTS: readonly CallAndResponsePrompt[] = [
  {
    id: "pentatonic-sunrise",
    title: "Pentatonic Sunrise Echo",
    difficulty: "starter",
    rootPitch: "C4",
    scaleId: "major-pentatonic",
    callOffsets: [0, 2, 4, 7, 4],
    instruction: "Listen to the 5-note Major Pentatonic call, then echo it back or answer with a phrase ending on C.",
  },
  {
    id: "blues-bend-call",
    title: "Cross-Harp Blues Turnaround",
    difficulty: "intermediate",
    rootPitch: "G4",
    scaleId: "blues",
    callOffsets: [0, 3, 5, 6, 5, 3, 0],
    instruction: "Echo the G Blues phrase featuring the flat-5 blue note (C#/Db).",
  },
  {
    id: "pontic-kemence-motif",
    title: "Black Sea Lyra Motif (A Dorian / Hijaz)",
    difficulty: "advanced",
    rootPitch: "A4",
    scaleId: "hijaz-klezmer",
    callOffsets: [0, 1, 4, 5, 4, 1, 0],
    instruction: "Trace the augmented-2nd Hijaz motif on the fretless fingerboard or keyboard and resolve to A4.",
  },
] as const;

export function getRecommendedInstrumentScale(instrumentId: PortableInstrumentId): {
  readonly rootSemitone: number;
  readonly rootMidi: number;
  readonly scaleId: ScaleFormulaId;
} {
  switch (instrumentId) {
    case "kalimba-17c":
    case "kalimba-17-c":
      return { rootSemitone: 0, rootMidi: 60, scaleId: "major-pentatonic" };
    case "pontic-lyra":
    case "pontic-lyra-3":
      return { rootSemitone: 9, rootMidi: 69, scaleId: "hijaz-klezmer" };
    case "harmonica-c10":
    case "harmonica-10-c":
      return { rootSemitone: 7, rootMidi: 67, scaleId: "blues" };
    case "melodica-37":
      return { rootSemitone: 2, rootMidi: 62, scaleId: "dorian" };
    default:
      return { rootSemitone: 0, rootMidi: 60, scaleId: "major" };
  }
}

export function buildCallPromptMidis(prompt: CallAndResponsePrompt): number[] {
  const rootMidi = parsePitchName(prompt.rootPitch) ?? 60;
  return prompt.callOffsets.map((offset) => rootMidi + offset);
}
