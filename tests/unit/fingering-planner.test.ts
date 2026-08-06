import {describe,expect,test} from "bun:test";
import {planFingerings} from "../../src/harmonica-ui/fingeringPlanner";
import {STANDARD_C10,STANDARD_C12} from "../../src/harmonica/profile";
import type {SoundEvent} from "../../src/notation/abc/AbcAdapter";
const sound=(id:string,midi:number):SoundEvent=>({id,midi,startBeat:Number(id.slice(1))||0,durationBeats:1,writtenEventIds:[`w-${id}`]});
describe("phrase fingering planner",()=>{
 test("is deterministic, preserves alternatives, and avoids duplicate-pitch jumps",()=>{const phrase=[sound("s0",72),sound("s1",74),sound("s2",72)];const first=planFingerings(phrase,STANDARD_C12),second=planFingerings(phrase,STANDARD_C12);expect(first.map(p=>p.recommended?.id)).toEqual(second.map(p=>p.recommended?.id));expect(first[0]!.alternatives.length).toBeGreaterThan(0);expect(Math.abs(first[0]!.recommended!.hole-first[1]!.recommended!.hole)).toBeLessThanOrEqual(1)});
 test("uses typed profile differences and reports impossible pitch",()=>{expect(planFingerings([sound("s0",95)],STANDARD_C12)[0]!.recommended).toBeDefined();expect(planFingerings([sound("s0",95)],STANDARD_C10)[0]!.unplayable).toBe(true);expect(planFingerings([sound("s0",20)],STANDARD_C12)[0]!.unplayable).toBe(true)});
});
