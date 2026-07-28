import { describe, expect, test } from "bun:test";
import { acceptsStep, alignPerformance, relativeTargets, timingTolerances, transpositionDelta, type InputNoteSegment } from "../../src/exercises/evaluation";
import type { MelodyEvent } from "../../src/music/melody";

const segment=(midi:number,start=0,duration=500,cents=0):InputNoteSegment=>({id:`${midi}-${start}`,source:"fixture",startedAt:start,stableStartedAt:start+50,endedAt:start+duration,durationMs:duration,medianFrequencyHz:440,medianMidiFloat:midi+cents/100,classifiedMidi:midi,medianCentsFromEt:cents,centsVariability:3,medianClarity:.95,medianRms:.2,pitchTrace:[]});
describe("exercise evaluation",()=>{
  test("separates identity and strict intonation",()=>{expect(acceptsStep(segment(60,0,500,28),{targetMidi:60,holdMs:120,strictIntonation:false,strictToleranceCents:20}).accepted).toBeTrue();expect(acceptsStep(segment(60,0,500,28),{targetMidi:60,holdMs:120,strictIntonation:true,strictToleranceCents:20}).accepted).toBeFalse()});
  test("transposes relative phrases",()=>{expect(relativeTargets([60,64,62],65)).toEqual([65,69,67]);expect(transpositionDelta([60,64,62],[62,66,64])).toBe(2);expect(transpositionDelta([60,64,62],[62,65,64])).toBeNull()});
  test("tempo scales tolerances",()=>{expect(timingTolerances(60)).toEqual({onset:160,release:220});expect(timingTolerances(180).onset).toBe(60)});
  test("alignment survives an extra note",()=>{const targets:MelodyEvent[]=[60,62,64].map((midi,index)=>({id:`t${index}`,kind:"note",startBeat:index,durationBeats:1,midi,measureIndex:0}));const rows=alignPerformance(targets,[segment(60,0),segment(61,250),segment(62,500),segment(64,1000)],120);expect(rows.filter((row)=>row.kind==="match").map((row)=>row.input?.classifiedMidi)).toEqual([60,62,64]);expect(rows.some((row)=>row.kind==="extra")).toBeTrue()});
});
