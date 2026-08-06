import type { SoundEvent } from "../notation/abc/AbcAdapter";
import type { HarmonicaAction, HarmonicaProfile } from "../harmonica/profile";

export interface FingeringPlan{soundEventId:string;recommended?:HarmonicaAction;alternatives:HarmonicaAction[];unplayable?:true}
export interface FingeringPreferences{slideChangeCost?:number;breathChangeCost?:number;holeDistanceCost?:number}
const rank=(action:HarmonicaAction)=>action.hole*10+(action.slide==="in"?2:0)+(action.breath==="draw"?1:0);
export function planFingerings(events:readonly SoundEvent[],profile:HarmonicaProfile,preferences:FingeringPreferences={}):FingeringPlan[]{
  const slideCost=preferences.slideChangeCost??2.8,breathCost=preferences.breathChangeCost??1.2,holeCost=preferences.holeDistanceCost??1;
  const choices=events.map(event=>profile.physicalActions.filter(action=>action.canonicalMidi===event.midi).sort((a,b)=>rank(a)-rank(b)));
  const costs:Map<string,{cost:number;previous?:HarmonicaAction}>[]=[], selected:HarmonicaAction[]=[];
  choices.forEach((actions,index)=>{const row=new Map<string,{cost:number;previous?:HarmonicaAction}>();for(const action of actions){if(index===0){row.set(action.id,{cost:rank(action)*.001});continue}let best:{cost:number;previous?:HarmonicaAction}|undefined;for(const previous of choices[index-1]??[]){const prior=costs[index-1]?.get(previous.id);if(!prior)continue;const transition=Math.abs(action.hole-previous.hole)*holeCost+(action.slide!==previous.slide?slideCost:0)+(action.breath!==previous.breath?breathCost:0)+(action.canonicalMidi===previous.canonicalMidi&&action.id!==previous.id?1.5:0);const candidate={cost:prior.cost+transition+rank(action)*.001,previous};if(!best||candidate.cost<best.cost)best=candidate}if(best)row.set(action.id,best)}costs.push(row)});
  let current=choices.at(-1)?.reduce<HarmonicaAction|undefined>((best,action)=>!best||(costs.at(-1)?.get(action.id)?.cost??Infinity)<(costs.at(-1)?.get(best.id)?.cost??Infinity)?action:best,undefined);
  for(let i=choices.length-1;i>=0;i--){if(current)selected[i]=current;current=current?costs[i]?.get(current.id)?.previous:undefined}
  return events.map((event,index)=>{const recommended=selected[index]??choices[index]?.[0],alternatives=(choices[index]??[]).filter(action=>action.id!==recommended?.id);return{soundEventId:event.id,recommended,alternatives,...(!recommended?{unplayable:true as const}:{})}});
}
