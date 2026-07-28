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
  test("parses rests, accidentals, octaves, and durations", () => { const melody=parseAbc("X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\n^C2 z/2 d'3/2 |"); expect(melody.tempoQpm).toBe(120); expect(melody.events.map((event)=>[event.kind,event.midi,event.durationBeats])).toEqual([["note",61,1],["rest",undefined,.25],["note",86,.75]]); });
  test("rejects polyphony", () => expect(()=>parseAbc("X:1\nV:one\nK:C\nC")).toThrow("Polyphonic"));
});
