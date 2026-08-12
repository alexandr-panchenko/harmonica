import type { RenderAnchor, WrittenMusicEvent } from "./AbcAdapter";

export interface TransportPoint { beat:number;x:number;y:number;systemIndex:number;eventId:string }

export function transportPoints(events:readonly WrittenMusicEvent[],anchors:readonly RenderAnchor[]):TransportPoint[]{
  return events.flatMap(event=>{const anchor=anchors.find(item=>item.eventId===event.id);return anchor?[{beat:event.startBeat,x:anchor.temporalX,y:anchor.eventBounds.top+anchor.eventBounds.height/2,systemIndex:anchor.systemIndex,eventId:event.id}]:[]});
}

export function pointToBeat(points:readonly TransportPoint[],x:number,y:number,mode:"timeline"|"score"):number{
  if(!points.length)return 0;
  const system=mode==="timeline"?points[0]!.systemIndex:closestSystem(points,y);
  const candidates=points.filter(point=>point.systemIndex===system).sort((a,b)=>a.x-b.x);
  if(x<=candidates[0]!.x)return candidates[0]!.beat;
  if(x>=candidates.at(-1)!.x)return candidates.at(-1)!.beat;
  const rightIndex=candidates.findIndex(point=>point.x>=x),left=candidates[rightIndex-1]!,right=candidates[rightIndex]!;
  return left.beat+(x-left.x)/Math.max(1,right.x-left.x)*(right.beat-left.beat);
}

export function beatToPoint(points:readonly TransportPoint[],beat:number):TransportPoint|undefined{
  if(!points.length)return;
  let left=points[0]!,right=points.at(-1)!;
  for(let index=1;index<points.length;index++)if(beat<=points[index]!.beat){left=points[index-1]!;right=points[index]!;break}
  if(left.systemIndex!==right.systemIndex)return Math.abs(beat-left.beat)<=Math.abs(right.beat-beat)?left:right;
  const ratio=(beat-left.beat)/Math.max(.001,right.beat-left.beat);
  return {...left,beat,x:left.x+ratio*(right.x-left.x),y:left.y+ratio*(right.y-left.y)};
}

function closestSystem(points:readonly TransportPoint[],y:number):number{
  const systems=[...new Set(points.map(point=>point.systemIndex))];
  return systems.sort((a,b)=>distance(points,a,y)-distance(points,b,y))[0]!;
}
function distance(points:readonly TransportPoint[],system:number,y:number):number{const values=points.filter(point=>point.systemIndex===system).map(point=>point.y);return Math.abs(values.reduce((sum,value)=>sum+value,0)/values.length-y)}
