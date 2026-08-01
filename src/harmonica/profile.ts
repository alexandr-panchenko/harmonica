export type Breath = "blow" | "draw";
export type Slide = "out" | "in";

export interface HarmonicaAction {
  id: string;
  hole: number;
  breath: Breath;
  slide: Slide;
  canonicalMidi: number;
  label?: string;
}

export interface HarmonicaHoleLayout {
  hole: number;
  slideOut: Record<Breath, number>;
  slideIn: Record<Breath, number>;
}

export interface PlayablePitch { id: string; midi: number; actionId?: string; technique: "normal" | "bend" | "overbend" | "alternate" | "unknown"; bendDepthCents?: number; expectedOffsetCents?: number; hint?: string }
export interface CalibrationSample { medianCents: number; medianRms: number; variabilityCents: number; durationMs: number; dynamicLabel?: "soft" | "medium" | "loud" }
export interface CalibratedPitch { expectedOffsetCents: number; comfortableBandCents: [number, number]; strictBandCents?: [number, number]; variabilityCents?: number; samples: CalibrationSample[] }
export interface HarmonicaCalibration { createdAt: string; inputDeviceId?: string; sampleRate?: number; notes: Record<number, CalibratedPitch> }
export interface HarmonicaProfile { id: string; name: string; description?: string; holeCount: number; keyLabel: string; concertPitchTranspositionSemitones: number; referenceA4Hz: number; valveConfiguration?: "valved" | "valveless" | "mixed" | "unknown"; physicalActions: HarmonicaAction[]; playablePitches: PlayablePitch[]; calibration?: HarmonicaCalibration }

/** Explicit solo-tuned 12-hole C layout. C4 is MIDI 60. */
export const STANDARD_C12_ACTIONS: readonly HarmonicaHoleLayout[] = [
  { hole: 1, slideOut: { blow: 60, draw: 62 }, slideIn: { blow: 61, draw: 63 } },
  { hole: 2, slideOut: { blow: 64, draw: 65 }, slideIn: { blow: 65, draw: 66 } },
  { hole: 3, slideOut: { blow: 67, draw: 69 }, slideIn: { blow: 68, draw: 70 } },
  { hole: 4, slideOut: { blow: 72, draw: 71 }, slideIn: { blow: 73, draw: 72 } },
  { hole: 5, slideOut: { blow: 72, draw: 74 }, slideIn: { blow: 73, draw: 75 } },
  { hole: 6, slideOut: { blow: 76, draw: 77 }, slideIn: { blow: 77, draw: 78 } },
  { hole: 7, slideOut: { blow: 79, draw: 81 }, slideIn: { blow: 80, draw: 82 } },
  { hole: 8, slideOut: { blow: 84, draw: 83 }, slideIn: { blow: 85, draw: 84 } },
  { hole: 9, slideOut: { blow: 84, draw: 86 }, slideIn: { blow: 85, draw: 87 } },
  { hole: 10, slideOut: { blow: 88, draw: 89 }, slideIn: { blow: 89, draw: 90 } },
  { hole: 11, slideOut: { blow: 91, draw: 93 }, slideIn: { blow: 92, draw: 94 } },
  { hole: 12, slideOut: { blow: 96, draw: 95 }, slideIn: { blow: 97, draw: 96 } },
];

/** Explicit owner-supplied compact 10-hole C layout; holes 9–10 are not a truncated 12-hole pattern. */
export const STANDARD_C10_ACTIONS: readonly HarmonicaHoleLayout[] = [
  { hole: 1, slideOut: { blow: 60, draw: 62 }, slideIn: { blow: 61, draw: 63 } },
  { hole: 2, slideOut: { blow: 64, draw: 65 }, slideIn: { blow: 65, draw: 66 } },
  { hole: 3, slideOut: { blow: 67, draw: 69 }, slideIn: { blow: 68, draw: 70 } },
  { hole: 4, slideOut: { blow: 72, draw: 71 }, slideIn: { blow: 73, draw: 72 } },
  { hole: 5, slideOut: { blow: 72, draw: 74 }, slideIn: { blow: 73, draw: 75 } },
  { hole: 6, slideOut: { blow: 76, draw: 77 }, slideIn: { blow: 77, draw: 78 } },
  { hole: 7, slideOut: { blow: 79, draw: 81 }, slideIn: { blow: 80, draw: 82 } },
  { hole: 8, slideOut: { blow: 84, draw: 83 }, slideIn: { blow: 85, draw: 84 } },
  { hole: 9, slideOut: { blow: 88, draw: 86 }, slideIn: { blow: 89, draw: 87 } },
  { hole: 10, slideOut: { blow: 91, draw: 89 }, slideIn: { blow: 92, draw: 90 } },
];

function createActions(layout: readonly HarmonicaHoleLayout[]): HarmonicaAction[] {
  return layout.flatMap(({ hole, slideOut, slideIn }) =>
    (["blow", "draw"] as const).flatMap((breath) =>
      (["out", "in"] as const).map((slide) => ({
        id: `${hole}-${breath}-${slide}`,
        hole,
        breath,
        slide,
        canonicalMidi: (slide === "out" ? slideOut : slideIn)[breath],
      })),
    ),
  );
}

function chromaticProfile(layout: readonly HarmonicaHoleLayout[]): HarmonicaProfile {
  const holeCount = layout.length;
  const physicalActions = createActions(layout);
  return {
    id: `standard-c-${holeCount}`,
    name: `${holeCount}-hole chromatic · C`,
    description: "Solo-tuned chromatic harmonica with direct slide-in and slide-out actions",
    holeCount,
    keyLabel: "C",
    concertPitchTranspositionSemitones: 0,
    referenceA4Hz: 440,
    valveConfiguration: "unknown",
    physicalActions,
    playablePitches: physicalActions.map((action) => ({ id: `pitch-${action.id}`, midi: action.canonicalMidi, actionId: action.id, technique: "normal" })),
  };
}

export const STANDARD_C10 = chromaticProfile(STANDARD_C10_ACTIONS);
export const STANDARD_C12 = chromaticProfile(STANDARD_C12_ACTIONS);
export const HARMONICA_PROFILES = [STANDARD_C10, STANDARD_C12] as const;

export function actionFor(profile: HarmonicaProfile, hole: number, breath: Breath, slide: Slide): HarmonicaAction {
  const action = profile.physicalActions.find((item) => item.hole === hole && item.breath === breath && item.slide === slide);
  if (!action) throw new Error(`No ${breath}/${slide} action for hole ${hole} in ${profile.id}`);
  return action;
}

export function actionsForMidi(profile: HarmonicaProfile, midi: number): HarmonicaAction[] {
  return profile.physicalActions.filter((action) => action.canonicalMidi === midi);
}

export function profileRange(profile: HarmonicaProfile): [number, number] {
  const values = profile.playablePitches.map((pitch) => pitch.midi);
  return [Math.min(...values), Math.max(...values)];
}
