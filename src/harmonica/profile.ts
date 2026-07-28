export type Breath = "blow" | "draw";
export type Slide = "out" | "in";
export interface HarmonicaAction { id: string; hole: number; breath: Breath; slide: Slide; canonicalMidi: number; label?: string }
export interface PlayablePitch { id: string; midi: number; actionId?: string; technique: "normal" | "bend" | "overbend" | "alternate" | "unknown"; bendDepthCents?: number; expectedOffsetCents?: number; hint?: string }
export interface CalibrationSample { medianCents: number; medianRms: number; variabilityCents: number; durationMs: number; dynamicLabel?: "soft" | "medium" | "loud" }
export interface CalibratedPitch { expectedOffsetCents: number; comfortableBandCents: [number, number]; strictBandCents?: [number, number]; variabilityCents?: number; samples: CalibrationSample[] }
export interface HarmonicaCalibration { createdAt: string; inputDeviceId?: string; sampleRate?: number; notes: Record<number, CalibratedPitch> }
export interface HarmonicaProfile { id: string; name: string; description?: string; holeCount: number; keyLabel: string; concertPitchTranspositionSemitones: number; referenceA4Hz: number; valveConfiguration?: "valved" | "valveless" | "mixed" | "unknown"; physicalActions: HarmonicaAction[]; playablePitches: PlayablePitch[]; calibration?: HarmonicaCalibration }

export function actionMidi(hole: number, breath: Breath, slide: Slide): number {
  const octave = Math.floor((hole - 1) / 4) * 12;
  const pattern = (hole - 1) % 4;
  const base = breath === "blow" ? [60, 64, 67, 72][pattern]! : [62, 65, 69, 71][pattern]!;
  return base + octave + (slide === "in" ? 1 : 0);
}

const actions: HarmonicaAction[] = [];
for (let hole = 1; hole <= 12; hole++) for (const breath of ["blow", "draw"] as const) for (const slide of ["out", "in"] as const) {
  actions.push({ id: `${hole}-${breath}-${slide}`, hole, breath, slide, canonicalMidi: actionMidi(hole, breath, slide) });
}

export const STANDARD_C12: HarmonicaProfile = {
  id: "standard-c-12", name: "12-hole Chromatic · C", description: "Solo tuning, preserving the legacy trainer mapping", holeCount: 12,
  keyLabel: "C", concertPitchTranspositionSemitones: 0, referenceA4Hz: 440, valveConfiguration: "unknown", physicalActions: actions,
  playablePitches: actions.map((action) => ({ id: `pitch-${action.id}`, midi: action.canonicalMidi, actionId: action.id, technique: "normal" })),
};

export function actionsForMidi(profile: HarmonicaProfile, midi: number): HarmonicaAction[] { return profile.physicalActions.filter((action) => action.canonicalMidi === midi); }
export function profileRange(profile: HarmonicaProfile): [number, number] { const values = profile.playablePitches.map((pitch) => pitch.midi); return [Math.min(...values), Math.max(...values)]; }
