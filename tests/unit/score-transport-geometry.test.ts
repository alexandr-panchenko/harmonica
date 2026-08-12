import {describe,expect,test} from "bun:test";
import {beatToPoint,pointToBeat,transportPoints} from "../../src/notation/abc/scoreTransportGeometry";
import type {RenderAnchor,WrittenMusicEvent} from "../../src/notation/abc/AbcAdapter";

const events:WrittenMusicEvent[]=[0,1,2,3].map((beat,index)=>({id:`e${index}`,kind:"note",midi:60+index,startBeat:beat,durationBeats:1,measureIndex:index<2?0:1}));
const anchors:RenderAnchor[]=[{eventId:"e0",temporalX:100,systemIndex:0,eventBounds:{left:90,top:20,width:20,height:20}},{eventId:"e1",temporalX:300,systemIndex:0,eventBounds:{left:290,top:20,width:20,height:20}},{eventId:"e2",temporalX:80,systemIndex:1,eventBounds:{left:70,top:180,width:20,height:20}},{eventId:"e3",temporalX:280,systemIndex:1,eventBounds:{left:270,top:180,width:20,height:20}}];

describe("notation transport geometry",()=>{
  test("timeline pointer interpolation maps measured X to beat",()=>{const points=transportPoints(events,anchors.slice(0,2));expect(pointToBeat(points,200,30,"timeline")).toBeCloseTo(.5)});
  test("score pointer mapping selects the nearest system and beat-to-point follows systems",()=>{const points=transportPoints(events,anchors);expect(pointToBeat(points,180,190,"score")).toBeCloseTo(2.5);expect(beatToPoint(points,2.5)?.systemIndex).toBe(1)});
});
