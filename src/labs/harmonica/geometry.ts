import type { HarmonicaAction, HarmonicaProfile } from "../../harmonica/profile";
export { harmonicaHitZones } from "../../harmonica-ui/geometry";

export type HarmonicaConcept = "steel" | "pearl" | "illustration";
export type HarmonicaDemoState = "idle" | "guided" | "pressed" | "mic-single" | "mic-ambiguous" | "correct" | "incorrect";
export type VisualSlideState = "out" | "in" | "neutral";

export { slideStateForActions } from "../../harmonica-ui/sliderState";

export function demoActions(profile: HarmonicaProfile, state: HarmonicaDemoState): HarmonicaAction[] {
  if (state === "idle") return [];
  if (state === "mic-ambiguous") return profile.physicalActions.filter((action) => action.canonicalMidi === 72);
  const id = state === "mic-single" ? "3-draw-out" : state === "pressed" ? "5-blow-in" : state === "incorrect" ? "7-draw-out" : "4-draw-in";
  return profile.physicalActions.filter((action) => action.id === id);
}
