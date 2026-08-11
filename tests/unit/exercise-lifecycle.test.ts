import { describe,expect,test } from "bun:test";
import { STANDARD_C12 } from "../../src/harmonica/profile";
import { generateRandomPhrase } from "../../src/exercises/ear/phraseGenerator";
import { EarSession } from "../../src/exercises/ear/earSession";
import { parseAbc } from "../../src/music/melody";
import { songExcerpt } from "../../src/exercises/ear/songExcerpt";
import { generateRhythm, type RhythmSettings } from "../../src/exercises/rhythm/rhythmGenerator";
import { rhythmPitchMatches } from "../../src/exercises/rhythm/rhythmSession";
import { SONG_GUIDANCE_PRESETS } from "../../src/song-practice/guidancePresets";

describe("explicit exercise lifecycle",()=>{
 test("random phrases obey playable range, length, and interval constraints",()=>{let seed=3;const random=()=>((seed=seed*16807%2147483647)-1)/2147483646,phrase=generateRandomPhrase(STANDARD_C12,{length:8,maxInterval:4,tempoQpm:90},random),midis=phrase.events.map(event=>event.midi!);expect(midis).toHaveLength(8);expect(midis.every(midi=>STANDARD_C12.physicalActions.some(action=>action.canonicalMidi===midi))).toBeTrue();expect(midis.slice(1).every((midi,index)=>Math.abs(midi-midis[index]!)<=4)).toBeTrue()});
 test("ear session changes state only through explicit answer, reveal, or skip actions",()=>{const phrase=generateRandomPhrase(STANDARD_C12,{length:3,maxInterval:3,tempoQpm:90},()=>.2),session=new EarSession(phrase,"relative");const id=session.state.phraseId,first=phrase.events[0]!.midi!;expect(session.answer(first+5).accepted).toBeTrue();expect(session.state.phraseId).toBe(id);session.reveal();expect(session.state.assisted).toBeTrue();expect(session.state.complete).toBeTrue();session.skip();expect(session.state.skipped).toBeTrue()});
 test("song excerpt is contiguous and rebased",()=>{const song=parseAbc("X:1\nT:Song\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c |","song"),excerpt=songExcerpt(song,1,1);expect(excerpt.events.map(event=>event.midi)).toEqual([67,69,71,72]);expect(excerpt.events[0]!.startBeat).toBe(0)});
 test("generated rhythm fills meter and enforces any/fixed pitch policy",()=>{const settings:RhythmSettings={meter:"6/8",measures:2,difficulty:"medium",tempoQpm:90,allowedValues:[.5,1],allowRests:true,pitchPolicy:"any",fixedMidi:60},pattern=generateRhythm(settings,()=>.4);expect(pattern.events.at(-1)!.startBeat+pattern.events.at(-1)!.durationBeats).toBe(6);expect(rhythmPitchMatches(settings,72)).toBeTrue();expect(rhythmPitchMatches({...settings,pitchPolicy:"fixed"},72)).toBeFalse()});
 test("both song shortcuts share one preset contract",()=>{expect(SONG_GUIDANCE_PRESETS.learn.defaultMode).toBe("step");expect(SONG_GUIDANCE_PRESETS.practice.defaultMode).toBe("step");expect(SONG_GUIDANCE_PRESETS.perform.defaultMode).toBe("realtime")});
});
