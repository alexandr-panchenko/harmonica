import { STANDARD_C10, STANDARD_C12, type HarmonicaProfile } from "../harmonica/profile";
import { noteName } from "../music/pitch";

export type PitchControlMode = "discrete" | "continuous" | "hybrid";
export type ArticulationMode = "breath" | "key" | "pluck" | "strike" | "bow";

export interface InstrumentPlacement {
  id: string;
  pitchMidi: number;
  label: string;
  /** For harmonica */
  hole?: number;
  breath?: "blow" | "draw";
  slide?: "out" | "in";
  /** For melodica / MIDI keyboard */
  discreteKey?: number;
  isBlackKey?: boolean;
  /** For kalimba */
  tineIndex?: number;
  side?: "left" | "center" | "right";
  rankFromCenter?: number;
  /** For continuous fretless instruments (Pontic lyra) */
  stringIndex?: number;
  stringName?: string;
  normalizedPosition?: number;
  fingering?: string;
  articulationHint?: string;
}

export interface PortableInstrumentProfile {
  id: string;
  name: string;
  shortName: string;
  family: "harmonica" | "melodica" | "midi-keyboard" | "kalimba" | "pontic-lyra";
  pitchControl: PitchControlMode;
  articulation: ArticulationMode;
  minMidi: number;
  maxMidi: number;
  isResearchConcept?: boolean;
  description: string;
  placementsForPitch(midi: number): InstrumentPlacement[];
  allPlacements(): InstrumentPlacement[];
}

function buildHarmonicaInstrumentProfile(profile: HarmonicaProfile): PortableInstrumentProfile {
  const all: InstrumentPlacement[] = profile.physicalActions.map((a) => ({
    id: a.id,
    pitchMidi: a.canonicalMidi,
    label: `Hole ${a.hole} · ${a.breath}${a.slide === "in" ? " + slide" : ""}`,
    hole: a.hole,
    breath: a.breath,
    slide: a.slide,
    articulationHint: `${a.breath === "blow" ? "↑ Blow" : "↓ Draw"}${a.slide === "in" ? " · Slide in" : ""}`,
  }));
  const midis = all.map((p) => p.pitchMidi);
  return {
    id: profile.id === "standard-c-10" ? "harmonica-c10" : "harmonica-c12",
    name: `${profile.holeCount}-Hole Chromatic Harmonica (C)`,
    shortName: `Harmonica (${profile.holeCount}H)`,
    family: "harmonica",
    pitchControl: "discrete",
    articulation: "breath",
    minMidi: Math.min(...midis),
    maxMidi: Math.max(...midis),
    description: `Solo-tuned ${profile.holeCount}-hole C chromatic harmonica (breath + slide).`,
    placementsForPitch: (midi) => all.filter((p) => p.pitchMidi === Math.round(midi)),
    allPlacements: () => all,
  };
}

function isBlackPianoKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}

function buildKeyboardProfile(
  id: string,
  name: string,
  shortName: string,
  family: "melodica" | "midi-keyboard",
  minMidi: number,
  maxMidi: number,
  articulation: ArticulationMode,
  description: string,
): PortableInstrumentProfile {
  const all: InstrumentPlacement[] = [];
  for (let m = minMidi; m <= maxMidi; m++) {
    all.push({
      id: `key-${m}`,
      pitchMidi: m,
      label: `Key ${noteName(m)} (MIDI ${m})`,
      discreteKey: m,
      isBlackKey: isBlackPianoKey(m),
      articulationHint:
        family === "melodica" ? "Press key + steady breath" : "Direct key press / WebMIDI",
    });
  }
  return {
    id,
    name,
    shortName,
    family,
    pitchControl: "discrete",
    articulation,
    minMidi,
    maxMidi,
    description,
    placementsForPitch: (midi) => all.filter((p) => p.pitchMidi === Math.round(midi)),
    allPlacements: () => all,
  };
}

/**
 * 17-key C Major Kalimba with real alternating left/right metal tines outward from center C4 (MIDI 60).
 * Center = 0 (C4), Left1 = D4, Right1 = E4, Left2 = F4, Right2 = G4, ...
 */
function buildKalimba17Profile(): PortableInstrumentProfile {
  const cMajorDegrees = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88];
  // Build physical left-to-right order: odd indices on left (descending toward center), center 0, even indices on right (ascending outward)
  const leftDegrees: { midi: number; rank: number }[] = [];
  const rightDegrees: { midi: number; rank: number }[] = [];
  for (let i = 1; i < cMajorDegrees.length; i++) {
    const rank = Math.ceil(i / 2);
    if (i % 2 === 1) {
      leftDegrees.unshift({ midi: cMajorDegrees[i]!, rank });
    } else {
      rightDegrees.push({ midi: cMajorDegrees[i]!, rank });
    }
  }
  const ordered = [
    ...leftDegrees.map((d) => ({ ...d, side: "left" as const })),
    { midi: 60, rank: 0, side: "center" as const },
    ...rightDegrees.map((d) => ({ ...d, side: "right" as const })),
  ];

  const all: InstrumentPlacement[] = ordered.map((item, idx) => ({
    id: `tine-${idx + 1}-${item.midi}`,
    pitchMidi: item.midi,
    label: `Tine ${idx + 1} (${item.side.toUpperCase()} ${item.rank === 0 ? "center" : item.rank}) · ${noteName(item.midi)}`,
    tineIndex: idx,
    side: item.side,
    rankFromCenter: item.rank,
    articulationHint:
      item.side === "left"
        ? "Left thumb pluck"
        : item.side === "right"
          ? "Right thumb pluck"
          : "Center tine (either thumb)",
  }));

  return {
    id: "kalimba-17c",
    name: "17-Tine Kalimba (Alternating C Major)",
    shortName: "Kalimba (17-Tine)",
    family: "kalimba",
    pitchControl: "discrete",
    articulation: "pluck",
    minMidi: 60,
    maxMidi: 88,
    description:
      "Alternating left/right metal tines radiating outward from center C4 (diatonic C4–E6).",
    placementsForPitch: (midi) => all.filter((p) => p.pitchMidi === Math.round(midi)),
    allPlacements: () => all,
  };
}

/**
 * Exploratory Pontic Lyra (Karadeniz kemençesi) — 3 fretless strings tuned in fourths (A3=57, D4=62, G4=67).
 * Stress-tests continuous-pitch string position + separate bow direction without claiming microphone string detection.
 */
function buildPonticLyraProfile(): PortableInstrumentProfile {
  const strings = [
    { index: 0, name: "String III (Low A3)", openMidi: 57, maxSemitones: 14 },
    { index: 1, name: "String II (Middle D4)", openMidi: 62, maxSemitones: 14 },
    { index: 2, name: "String I (High G4)", openMidi: 67, maxSemitones: 17 },
  ];

  return {
    id: "pontic-lyra",
    name: "Pontic Lyra / Karadeniz Kemençesi (Research Map)",
    shortName: "Pontic Lyra (3-String)",
    family: "pontic-lyra",
    pitchControl: "continuous",
    articulation: "bow",
    minMidi: 57,
    maxMidi: 84,
    isResearchConcept: true,
    description:
      "Fretless 3-string bowed instrument (research mapping: continuous finger position + separate bow cue; microphone detects pitch/cents, not string).",
    placementsForPitch: (midi) => {
      const results: InstrumentPlacement[] = [];
      for (const s of strings) {
        const offset = midi - s.openMidi;
        if (offset >= 0 && offset <= s.maxSemitones) {
          const norm = Math.round((offset / s.maxSemitones) * 1000) / 1000;
          const finger =
            offset === 0
              ? "Open string"
              : offset <= 2
                ? "1st finger zone"
                : offset <= 4
                  ? "2nd finger zone"
                  : offset <= 5
                    ? "3rd finger zone"
                    : "4th / upper position";
          results.push({
            id: `lyra-s${s.index + 1}-${Math.round(midi * 10)}`,
            pitchMidi: midi,
            label: `${s.name} · ${finger} (${Math.round(norm * 100)}% stop)`,
            stringIndex: s.index,
            stringName: s.name,
            normalizedPosition: norm,
            fingering: finger,
            articulationHint: "Suggested bow ↓/↑ (not detected by microphone)",
          });
        }
      }
      // Prefer highest string where the note lies in first position (smallest normalizedPosition)
      return results.sort((a, b) => (a.normalizedPosition ?? 0) - (b.normalizedPosition ?? 0));
    },
    allPlacements: () => [],
  };
}

export const PORTABLE_INSTRUMENTS: readonly PortableInstrumentProfile[] = [
  buildHarmonicaInstrumentProfile(STANDARD_C12),
  buildHarmonicaInstrumentProfile(STANDARD_C10),
  buildKalimba17Profile(),
  buildKeyboardProfile(
    "melodica-37",
    "37-Key Melodica (F3–F6)",
    "Melodica (37-Key)",
    "melodica",
    53,
    89,
    "breath",
    "37-key breath-driven keyboard instrument (F3–F6).",
  ),
  buildKeyboardProfile(
    "midi-keyboard-49",
    "MIDI Keyboard (C2–C6 · WebMIDI Ready)",
    "MIDI Keyboard",
    "midi-keyboard",
    36,
    84,
    "key",
    "Chromatic keyboard with deterministic WebMIDI key-on/velocity support.",
  ),
  buildPonticLyraProfile(),
] as const;

export type PortableInstrumentId =
  | "harmonica-c12"
  | "harmonica-c10"
  | "kalimba-17c"
  | "melodica-37"
  | "midi-keyboard-49"
  | "pontic-lyra"
  | string;

export function getPortableInstrument(id: string): PortableInstrumentProfile {
  return (
    PORTABLE_INSTRUMENTS.find((item) => item.id === id) ??
    (id === "standard-c-10" || id === "harmonica-10-c"
      ? PORTABLE_INSTRUMENTS[1]!
      : id === "kalimba-17-c"
        ? PORTABLE_INSTRUMENTS[2]!
        : id === "pontic-lyra-3"
          ? PORTABLE_INSTRUMENTS[5]!
          : PORTABLE_INSTRUMENTS[0]!)
  );
}

export const getPortableInstrumentProfile = getPortableInstrument;

export function getPrimaryInstrumentPlacement(
  profile: PortableInstrumentProfile,
  midi: number,
): InstrumentPlacement | null {
  const list = profile.placementsForPitch(midi);
  return list[0] ?? null;
}

export function findContinuousFingerPlacement(
  profile: PortableInstrumentProfile,
  midi: number,
): InstrumentPlacement | null {
  const list = profile.placementsForPitch(midi);
  return list[0] ?? null;
}

