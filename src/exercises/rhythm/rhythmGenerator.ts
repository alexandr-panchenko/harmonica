import { writtenPitchFromMidi } from "../../notation/layout";
import type { Melody, MelodyEvent } from "../../music/melody";

export type RhythmMeter = "4/4"|"3/4"|"6/8";
export type RhythmDifficulty = "easy"|"medium"|"hard";
export interface RhythmSettings { meter:RhythmMeter; measures:number; difficulty:RhythmDifficulty; tempoQpm:number; allowedValues:number[]; allowRests:boolean; pitchPolicy:"any"|"fixed"; fixedMidi:number }

export function generateRhythm(settings:RhythmSettings, random:()=>number=Math.random):Melody{
  const [numerator,denominator]=settings.meter.split("/").map(Number) as [number,number],beatsPerMeasure=numerator*4/denominator,total=beatsPerMeasure*settings.measures,events:MelodyEvent[]=[];
  let beat=0,index=0;
  while(beat<total-.001){const values=settings.allowedValues.filter(value=>value<=total-beat+.001),duration=values[Math.floor(random()*values.length)]??Math.min(1,total-beat),rest=settings.allowRests&&index>0&&random()<({easy:.12,medium:.2,hard:.28}as const)[settings.difficulty];events.push({id:`rhythm-${index++}`,kind:rest?"rest":"note",startBeat:beat,durationBeats:duration,measureIndex:Math.min(settings.measures-1,Math.floor(beat/beatsPerMeasure)),midi:rest?undefined:settings.fixedMidi,writtenPitch:rest?undefined:writtenPitchFromMidi(settings.fixedMidi)});beat+=duration;}
  return{id:`rhythm-${events.map(event=>`${event.kind[0]}${event.durationBeats}`).join("-")}`,title:"Generated rhythm",tempoQpm:settings.tempoQpm,meter:{numerator,denominator},events,source:{type:"legacy"}};
}

export const RHYTHM_PRESETS:Record<string,Melody>={
  "steady-quarter":generateRhythm({meter:"4/4",measures:1,difficulty:"easy",tempoQpm:84,allowedValues:[1],allowRests:false,pitchPolicy:"any",fixedMidi:60},()=>0),
  "rest-and-release":generateRhythm({meter:"4/4",measures:2,difficulty:"medium",tempoQpm:92,allowedValues:[.5,1],allowRests:true,pitchPolicy:"any",fixedMidi:60},()=>.1),
};
