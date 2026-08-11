import {describe,expect,test} from "bun:test";
import {buildTimelineGeometry} from "../../src/notation/abc/timelineGeometry";
import type {RenderAnchor,SoundEvent,WrittenMusicEvent} from "../../src/notation/abc/AbcAdapter";
const events:WrittenMusicEvent[]=[
 {id:"a",kind:"note",midi:60,startBeat:0,durationBeats:1,measureIndex:0},
 {id:"b",kind:"note",midi:62,startBeat:1,durationBeats:2,measureIndex:0},
 {id:"r",kind:"rest",startBeat:3,durationBeats:1,measureIndex:0},
 {id:"c",kind:"note",midi:64,startBeat:4,durationBeats:1,measureIndex:1},
];
const anchor=(eventId:string,x:number,y=70):RenderAnchor=>({eventId,eventBounds:{left:x-10,top:y-20,width:24,height:50},notehead:eventId==="r"?undefined:{left:x-6,right:x+6,top:y-4,bottom:y+4,centerX:x,centerY:y},temporalX:x,systemIndex:0});
const anchors=[anchor("a",100),anchor("b",150),anchor("r",250),anchor("c",300)];
const sounds:SoundEvent[]=[{id:"s0",midi:60,startBeat:0,durationBeats:1,writtenEventIds:["a"]},{id:"s1",midi:62,startBeat:1,durationBeats:2,writtenEventIds:["b"]},{id:"s2",midi:64,startBeat:4,durationBeats:1,writtenEventIds:["c"]}];
describe("measured timeline geometry",()=>{
 test("starts after the notehead at its height and ends near the next temporal anchor",()=>{const geometry=buildTimelineGeometry(events,sounds,anchors);expect(geometry.segments[0]!.centerY).toBe(70);expect(geometry.segments[0]!.startX).toBe(110);expect(geometry.segments[0]!.endX).toBe(145);expect(geometry.segments[1]!.endX).toBe(245)});
 test("rests interrupt ribbons and final notes extrapolate locally",()=>{const geometry=buildTimelineGeometry(events,sounds,anchors);expect(geometry.segments.some(segment=>segment.writtenEventId==="r")).toBe(false);expect(geometry.segments[2]!.endX).toBeGreaterThan(geometry.segments[2]!.startX+20)});
});
