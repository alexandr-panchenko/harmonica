import type { RenderAnchor, SoundEvent, WrittenMusicEvent } from "./AbcAdapter";

export interface TimelineSegment { writtenEventId:string; soundEventId?:string; startX:number; endX:number; centerY:number; systemIndex:number }
export interface TimelineGeometry { segments:TimelineSegment[]; beatToX:(beat:number,systemIndex?:number)=>number }

export function buildTimelineGeometry(events:readonly WrittenMusicEvent[],sounds:readonly SoundEvent[],anchors:readonly RenderAnchor[],endGap=5):TimelineGeometry{
  const measured=events.map(event=>({event,anchor:anchors.find(anchor=>anchor.eventId===event.id)})).filter((item):item is {event:WrittenMusicEvent;anchor:RenderAnchor}=>Boolean(item.anchor)).sort((a,b)=>a.event.startBeat-b.event.startBeat);
  const points=measured.map(item=>({beat:item.event.startBeat,x:item.anchor.temporalX,systemIndex:item.anchor.systemIndex}));
  const localPixelsPerBeat=(index:number)=>{
    const current=measured[index]!, previous=measured[index-1], next=measured[index+1];
    if(next&&next.anchor.systemIndex===current.anchor.systemIndex)return(next.anchor.temporalX-current.anchor.temporalX)/Math.max(.001,next.event.startBeat-current.event.startBeat);
    if(previous&&previous.anchor.systemIndex===current.anchor.systemIndex)return(current.anchor.temporalX-previous.anchor.temporalX)/Math.max(.001,current.event.startBeat-previous.event.startBeat);
    return 52;
  };
  const segments=measured.flatMap((item,index)=>{if(item.event.kind==="rest"||!item.anchor.notehead)return[];
    const next=measured[index+1], intervalEnd=next&&next.anchor.systemIndex===item.anchor.systemIndex?next.anchor.temporalX-endGap:item.anchor.temporalX+item.event.durationBeats*localPixelsPerBeat(index)-endGap;
    const sound=sounds.find(value=>value.writtenEventIds.includes(item.event.id));
    return[{writtenEventId:item.event.id,soundEventId:sound?.id,startX:item.anchor.notehead.centerX-Math.min(2,(item.anchor.notehead.right-item.anchor.notehead.left)*.12),endX:Math.max(item.anchor.notehead.right+8,intervalEnd),centerY:item.anchor.notehead.centerY,systemIndex:item.anchor.systemIndex}];
  });
  const beatToX=(beat:number,systemIndex?:number)=>{const candidates=systemIndex===undefined?points:points.filter(point=>point.systemIndex===systemIndex);if(!candidates.length)return 0;let left=candidates[0]!,right=candidates.at(-1)!;for(let i=1;i<candidates.length;i++)if(beat<=candidates[i]!.beat){left=candidates[i-1]!;right=candidates[i]!;break}const span=Math.max(.001,right.beat-left.beat);return left.x+(beat-left.beat)/span*(right.x-left.x)};
  return{segments,beatToX};
}
