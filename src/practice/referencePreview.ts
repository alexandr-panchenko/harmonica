import type { MelodyEvent } from "../music/melody";
import type { PracticeEventVisuals } from "../notation/abc/practiceEventState";

export function referencePreview(events: readonly MelodyEvent[], positionBeat: number): { activeEventIndex:number; visuals:PracticeEventVisuals } {
  const found=events.findIndex(event=>positionBeat>=event.startBeat&&positionBeat<event.startBeat+event.durationBeats);
  const activeEventIndex=found>=0?found:Math.max(0,events.length-1);
  const visuals=Object.fromEntries(events.map((event,index)=>{
    const progress=index===activeEventIndex?Math.max(0,Math.min(1,(positionBeat-event.startBeat)/Math.max(.001,event.durationBeats))):index<activeEventIndex?1:0;
    return[event.id,{state:index===activeEventIndex?"preview-active":index<activeEventIndex?"preview-complete":"pending",progress}];
  })) as PracticeEventVisuals;
  return{activeEventIndex,visuals};
}
