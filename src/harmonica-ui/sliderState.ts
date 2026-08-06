import type { HarmonicaAction } from "../harmonica/profile";
export type VisualSlideState="out"|"in"|"neutral";
export function slideStateForActions(actions:readonly HarmonicaAction[]):VisualSlideState{if(!actions.length)return"neutral";const states=new Set(actions.map(action=>action.slide));return states.size===1?actions[0]!.slide:"neutral"}
export function breathStateForActions(actions:readonly HarmonicaAction[]):"blow"|"draw"|"mixed"|"none"{if(!actions.length)return"none";const states=new Set(actions.map(action=>action.breath));return states.size===1?actions[0]!.breath:"mixed"}
