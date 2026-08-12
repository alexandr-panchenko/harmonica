import { describe, expect, test } from "bun:test";
import { centsFromMidi, classifyPitch, frequencyToMidi, midiToFrequency, noteName } from "../../src/music/pitch";
import { parseAbc, SONGS } from "../../src/music/melody";

describe("pitch math", () => {
  test("round trips A4 and custom references", () => { expect(frequencyToMidi(440)).toBe(69); expect(midiToFrequency(69)).toBe(440); expect(frequencyToMidi(442, 442)).toBe(69); });
  test("calculates cents and note names", () => { expect(centsFromMidi(60.17,60)).toBeCloseTo(17); expect(noteName(61)).toBe("C♯4"); });
  test("uses calibrated midpoints", () => { expect(classifyPitch(60.51,{60:20,61:0})).toBe(60); expect(classifyPitch(60.61,{60:20,61:0})).toBe(61); });
});

describe("ABC adapter", () => {
  test("preserves legacy examples", () => { for (const [id,song] of Object.entries(SONGS)) expect(parseAbc(song.abc,id).events.some((event)=>event.kind==="note")).toBeTrue(); });
  test("parses rests, accidentals, octaves, durations, and written spelling", () => { const melody=parseAbc("X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\n^C2 _D z/2 d'3/2 |"); expect(melody.tempoQpm).toBe(120); expect(melody.events.map((event)=>[event.kind,event.midi,event.durationBeats])).toEqual([["note",61,1],["note",61,.5],["rest",undefined,.25],["note",86,.75]]); expect(melody.events[0]!.writtenPitch).toEqual({step:"C",octave:4,accidental:"sharp"}); expect(melody.events[1]!.writtenPitch).toEqual({step:"D",octave:4,accidental:"flat"}); });
  test("preserves ties across barlines", () => { const melody=parseAbc("X:1\nM:4/4\nL:1/4\nK:C\nC4- | C2 z2 |"); expect(melody.events.map(event=>event.tie)).toEqual(["start","end",undefined]); });
  test("applies explicit ABC tuplet ratios", () => { const melody=parseAbc("X:1\nM:4/4\nL:1/16\nK:C\n(3:2:3 C2 D2 E2 z12 |"); expect(melody.events.map(event=>event.durationBeats)).toEqual([1/3,1/3,1/3,3]); });
  test("includes a playable Pink Panther lead converted from MIDI", () => { const melody=parseAbc(SONGS.pinkPanther!.abc,"pink-panther"),pitches=melody.events.flatMap(event=>event.midi===undefined?[]:[event.midi]); expect(melody.title).toBe("The Pink Panther Theme"); expect(melody.tempoQpm).toBe(120); expect(Math.min(...pitches)).toBe(62); expect(Math.max(...pitches)).toBe(88); expect(melody.events.at(-1)!.startBeat+melody.events.at(-1)!.durationBeats).toBeCloseTo(132.25); });
  test("rejects polyphony", () => expect(()=>parseAbc("X:1\nV:one\nK:C\nC")).toThrow("Polyphonic"));
});
