import type { Breath, HarmonicaAction, HarmonicaProfile, Slide } from "../../harmonica/profile";

export type HarmonicaConcept = "steel" | "pearl" | "illustration";
export type HarmonicaDemoState = "idle" | "guided" | "pressed" | "mic-single" | "mic-ambiguous" | "correct" | "incorrect";
export type VisualSlideState = "out" | "in" | "neutral";

export interface NormalizedHitZone {
  id: string;
  hole: number;
  breath: Breath;
  slide: Slide;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Stable normalized geometry; art never encodes the musical mapping. */
export function harmonicaHitZones(holeCount: number): NormalizedHitZone[] {
  const holeWidth = 1 / holeCount;
  return Array.from({ length: holeCount }, (_, index) => index + 1).flatMap((hole) => [
    { id: `${hole}-blow-out`, hole, breath: "blow" as const, slide: "out" as const, x: (hole - 1) * holeWidth, y: 0, width: holeWidth / 2, height: 0.5 },
    { id: `${hole}-blow-in`, hole, breath: "blow" as const, slide: "in" as const, x: (hole - 0.5) * holeWidth, y: 0, width: holeWidth / 2, height: 0.5 },
    { id: `${hole}-draw-out`, hole, breath: "draw" as const, slide: "out" as const, x: (hole - 1) * holeWidth, y: 0.5, width: holeWidth / 2, height: 0.5 },
    { id: `${hole}-draw-in`, hole, breath: "draw" as const, slide: "in" as const, x: (hole - 0.5) * holeWidth, y: 0.5, width: holeWidth / 2, height: 0.5 },
  ]);
}

export function slideStateForActions(actions: readonly HarmonicaAction[]): VisualSlideState {
  if (!actions.length) return "neutral";
  const values = new Set(actions.map((action) => action.slide));
  return values.size === 1 ? actions[0]!.slide : "neutral";
}

export function demoActions(profile: HarmonicaProfile, state: HarmonicaDemoState): HarmonicaAction[] {
  if (state === "idle") return [];
  if (state === "mic-ambiguous") return profile.physicalActions.filter((action) => action.canonicalMidi === 72);
  const id = state === "mic-single" ? "3-draw-out" : state === "pressed" ? "5-blow-in" : state === "incorrect" ? "7-draw-out" : "4-draw-in";
  return profile.physicalActions.filter((action) => action.id === id);
}
