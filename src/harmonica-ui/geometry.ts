import type { Breath, Slide } from "../harmonica/profile";
export interface NormalizedHitZone{id:string;hole:number;breath:Breath;slide:Slide;x:number;y:number;width:number;height:number}
export interface HarmonicaLayout { holeCount:number; holeWidth:number; leftCapWidth:number; rightCapWidth:number; chassisWidth:number; sliderReach:number; overallWidth:number }
export function harmonicaLayout(holeCount:number):HarmonicaLayout{
  if(holeCount!==10&&holeCount!==12)throw new Error(`Unsupported harmonica hole count: ${holeCount}`);
  const holeWidth=64,leftCapWidth=34,rightCapWidth=38,sliderReach=56,chassisWidth=leftCapWidth+holeCount*holeWidth+rightCapWidth;
  return{holeCount,holeWidth,leftCapWidth,rightCapWidth,chassisWidth,sliderReach,overallWidth:chassisWidth+sliderReach};
}
export function harmonicaHitZones(holeCount:number):NormalizedHitZone[]{const width=1/holeCount;return Array.from({length:holeCount},(_,i)=>i+1).flatMap(hole=>[
  {id:`${hole}-blow-out`,hole,breath:"blow",slide:"out",x:(hole-1)*width,y:0,width:width/2,height:.5},
  {id:`${hole}-blow-in`,hole,breath:"blow",slide:"in",x:(hole-.5)*width,y:0,width:width/2,height:.5},
  {id:`${hole}-draw-out`,hole,breath:"draw",slide:"out",x:(hole-1)*width,y:.5,width:width/2,height:.5},
  {id:`${hole}-draw-in`,hole,breath:"draw",slide:"in",x:(hole-.5)*width,y:.5,width:width/2,height:.5},
])}
