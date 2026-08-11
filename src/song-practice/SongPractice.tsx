import { SONG_GUIDANCE_PRESETS, type SongGuidancePreset } from "./guidancePresets";

export function SongPracticePresetControl({preset,onChange}:{preset:SongGuidancePreset;onChange:(preset:SongGuidancePreset)=>void}){
  return <section className="song-practice-presets" aria-label="Song Practice guidance preset"><div><span className="eyebrow">Song Practice</span><b>{SONG_GUIDANCE_PRESETS[preset].label} preset</b></div><div className="segmented">{(Object.keys(SONG_GUIDANCE_PRESETS) as SongGuidancePreset[]).map(value=><button key={value} className={preset===value?"active":""} aria-pressed={preset===value} onClick={()=>onChange(value)}>{SONG_GUIDANCE_PRESETS[value].label}</button>)}</div><small>{preset==="learn"?"Notation, note names and recommended fingering":preset==="practice"?"Notation with optional aids and normal feedback":"In time with minimal guidance and post-run review"}</small></section>;
}
