import type { RhythmSettings } from "./rhythmGenerator";

export function rhythmPitchMatches(settings:RhythmSettings, playedMidi:number|undefined):boolean{return playedMidi!==undefined&&(settings.pitchPolicy==="any"||playedMidi===settings.fixedMidi)}
