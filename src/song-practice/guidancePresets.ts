export type SongGuidancePreset="learn"|"practice"|"perform";
export interface SongGuidance { notation:boolean; fingering:boolean; noteNames:boolean; defaultMode:"step"|"realtime"; countIn:boolean; label:string }
export const SONG_GUIDANCE_PRESETS:Record<SongGuidancePreset,SongGuidance>={
  learn:{notation:true,fingering:true,noteNames:true,defaultMode:"step",countIn:false,label:"Learn"},
  practice:{notation:true,fingering:false,noteNames:false,defaultMode:"step",countIn:false,label:"Practice"},
  perform:{notation:true,fingering:false,noteNames:false,defaultMode:"realtime",countIn:true,label:"Perform"},
};
