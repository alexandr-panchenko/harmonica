import abcjs from "abcjs";
import type { WrittenPitch } from "../../music/melody";

export interface WrittenMusicEvent {
  id: string; kind: "note" | "rest"; writtenPitch?: WrittenPitch; midi?: number;
  startBeat: number; durationBeats: number; measureIndex: number;
  tie?: "start" | "continue" | "end"; sourceRange?: { start: number; end: number };
}
export interface SoundEvent { id: string; midi: number; startBeat: number; durationBeats: number; writtenEventIds: string[] }
export interface AbcDocument {
  source: string; title: string; meter: { numerator: number; denominator: number }; tempoQpm: number;
  pickupBeats: number; totalBeats: number; writtenEvents: WrittenMusicEvent[]; soundingEvents: SoundEvent[]; diagnostics: string[];
}
export interface RectBounds { left: number; top: number; width: number; height: number }
export interface NoteheadBounds { left: number; right: number; top: number; bottom: number; centerX: number; centerY: number }
export interface RenderAnchor {
  eventId: string; eventBounds: RectBounds; notehead?: NoteheadBounds; temporalX: number; systemIndex: number;
}

interface InternalPitch { pitch: number; name: string; accidental?: "sharp"|"flat"|"natural"|"dblsharp"|"dblflat"; startTie?: object; endTie?: boolean }
interface InternalItem { el_type: string; duration?: number; pitches?: InternalPitch[]; rest?: object; startChar?: number; endChar?: number; startTriplet?: number; tripletMultiplier?: number; endTriplet?: boolean }
interface InternalStaff { voices?: InternalItem[][]; key?: { accidentals?: { acc: "sharp"|"flat"|"natural"; note: string }[] } }
interface InternalTune { lines: { staff?: InternalStaff[] }[]; metaText?: { title?: string; tempo?: { bpm?: number } }; warnings?: string[]; getMeterFraction(): {num:number;den:number}; getPickupLength(): number }
interface RenderedTuneBoundary { getSelectableArray(): { absEl: { type: string; abcelem: { startChar?: number } }; svgEl: SVGElement }[] }

const STEPS = ["C","D","E","F","G","A","B"] as const;
const SEMITONES = [0,2,4,5,7,9,11];
const offset = (value?: string) => value === "sharp" ? 1 : value === "flat" ? -1 : value === "dblsharp" ? 2 : value === "dblflat" ? -2 : 0;
const identity = (pitch: number) => { const stepIndex=((pitch%7)+7)%7; return {step:STEPS[stepIndex]!,octave:4+Math.floor(pitch/7),stepIndex}; };

export function adaptAbc(source: string): AbcDocument {
  const tune=abcjs.parseOnly(source)[0] as unknown as InternalTune|undefined;
  if(!tune) throw new Error("abcjs did not return a tune");
  const mf=tune.getMeterFraction(), meter={numerator:Number(mf.num||4),denominator:Number(mf.den||4)};
  const first=tune.lines.find(line=>line.staff?.[0])?.staff?.[0], key=new Map<string,number>();
  for(const accidental of first?.key?.accidentals??[]) key.set(accidental.note.toUpperCase(),offset(accidental.acc));
  const writtenEvents:WrittenMusicEvent[]=[]; let beat=0,measureIndex=0,measure=new Map<string,number>(),tupletMultiplier=1;
  for(const line of tune.lines) for(const item of line.staff?.[0]?.voices?.[0]??[]) {
    if(item.el_type==="bar"){measureIndex++;measure=new Map();continue}
    if(item.el_type!=="note"||!item.duration) continue;
    if(item.startTriplet)tupletMultiplier=item.tripletMultiplier??(2/item.startTriplet);
    const durationBeats=item.duration*4*tupletMultiplier, sourceRange=item.startChar!==undefined&&item.endChar!==undefined?{start:item.startChar,end:item.endChar}:undefined;
    const pitch=item.pitches?.[0], id=`abc-${item.startChar??writtenEvents.length}`;
    if(!pitch||item.rest){writtenEvents.push({id,kind:"rest",startBeat:beat,durationBeats,measureIndex,sourceRange});beat+=durationBeats;if(item.endTriplet)tupletMultiplier=1;continue}
    const value=identity(pitch.pitch), accidentalKey=`${value.step}${value.octave}`;
    if(pitch.accidental) measure.set(accidentalKey,offset(pitch.accidental));
    const accidentalOffset=pitch.accidental?offset(pitch.accidental):(measure.get(accidentalKey)??key.get(value.step)??0);
    const tie=pitch.startTie&&pitch.endTie?"continue":pitch.startTie?"start":pitch.endTie?"end":undefined;
    writtenEvents.push({id,kind:"note",writtenPitch:{step:value.step,octave:value.octave,accidental:pitch.accidental==="sharp"?"sharp":pitch.accidental==="flat"?"flat":pitch.accidental==="natural"?"natural":undefined},midi:12*(value.octave+1)+SEMITONES[value.stepIndex]!+accidentalOffset,startBeat:beat,durationBeats,measureIndex,tie,sourceRange});
    beat+=durationBeats;
    if(item.endTriplet)tupletMultiplier=1;
  }
  const soundingEvents:SoundEvent[]=[]; let open:SoundEvent|undefined;
  for(const event of writtenEvents){
    if(event.kind==="rest"||event.midi===undefined){open=undefined;continue}
    if((event.tie==="end"||event.tie==="continue")&&open?.midi===event.midi){open.durationBeats+=event.durationBeats;open.writtenEventIds.push(event.id);if(event.tie==="end")open=undefined;continue}
    const sound={id:`sound-${soundingEvents.length}`,midi:event.midi,startBeat:event.startBeat,durationBeats:event.durationBeats,writtenEventIds:[event.id]};soundingEvents.push(sound);open=event.tie==="start"||event.tie==="continue"?sound:undefined;
  }
  const tempo=Number(source.match(/^Q:.*=(\d+)/m)?.[1]??tune.metaText?.tempo?.bpm??100);
  return {source,title:tune.metaText?.title??"Untitled",meter,tempoQpm:tempo,pickupBeats:tune.getPickupLength()*4,totalBeats:beat,writtenEvents,soundingEvents,diagnostics:tune.warnings??[]};
}

const relativeBounds=(element:Element,coordinateRoot:HTMLElement):RectBounds=>{const a=element.getBoundingClientRect(),b=coordinateRoot.getBoundingClientRect();return{left:a.left-b.left+coordinateRoot.scrollLeft,top:a.top-b.top+coordinateRoot.scrollTop,width:a.width,height:a.height}};
const NOTEHEAD_SELECTORS=[".abcjs-notehead","[class*='notehead']","path.abcjs-note"];

/** The sole boundary that inspects abcjs selectable objects and generated SVG. */
export function bindAbcRender(container:HTMLElement,coordinateRoot:HTMLElement,events:readonly WrittenMusicEvent[],tune?:RenderedTuneBoundary):RenderAnchor[]{
  const elements=new Map<string,SVGElement>();
  for(const selectable of tune?.getSelectableArray()??[]){const event=events.find(item=>item.sourceRange?.start===selectable.absEl.abcelem.startChar);if(event)elements.set(event.id,selectable.svgEl)}
  const rests=[...container.querySelectorAll<SVGElement>("svg g.abcjs-rest")];
  events.filter(event=>event.kind==="rest").forEach((event,index)=>{if(rests[index])elements.set(event.id,rests[index]!)});
  const svgs=[...container.querySelectorAll("svg")],systems=[...container.querySelectorAll<SVGGElement>(".abcjs-staff-wrapper")];
  return events.flatMap(event=>{const element=elements.get(event.id);if(!element)return[];element.dataset.writtenEventId=event.id;
    const eventBounds=relativeBounds(element,coordinateRoot), svg=element.closest("svg"), system=element.closest<SVGGElement>(".abcjs-staff-wrapper"), systemIndex=system?Math.max(0,systems.indexOf(system)):Math.max(0,svgs.indexOf(svg as SVGSVGElement));
    let noteElement:Element|null=null;
    if(event.kind==="note") for(const selector of NOTEHEAD_SELECTORS){noteElement=element.matches(selector)?element:element.querySelector(selector);if(noteElement)break}
    if(event.kind==="note"&&!noteElement) console.warn(`[AbcAdapter] notehead fallback for ${event.id}; abcjs SVG classes may have changed`);
    const bounds=noteElement?relativeBounds(noteElement,coordinateRoot):eventBounds;
    const notehead=event.kind==="note"&&noteElement?{left:bounds.left,right:bounds.left+bounds.width,top:bounds.top,bottom:bounds.top+bounds.height,centerX:bounds.left+bounds.width/2,centerY:bounds.top+bounds.height/2}:undefined;
    return[{eventId:event.id,eventBounds,notehead,temporalX:notehead?.centerX??eventBounds.left+eventBounds.width/2,systemIndex}];
  });
}

/** abcjs time-based layout shortens the five staff rules to the event span; production keeps each system readable across its full paper width. */
export function extendStaffLines(container:HTMLElement,scale=1.08):void{
  for(const svg of container.querySelectorAll<SVGSVGElement>("svg")){
    const paperWidth=Number(svg.getAttribute("width"));if(!Number.isFinite(paperWidth))continue;const endX=paperWidth/scale-14;
    for(const staff of svg.querySelectorAll<SVGGElement>("g.abcjs-staff"))for(const path of staff.querySelectorAll<SVGPathElement>(":scope > path")){
      const values=path.getAttribute("d")?.match(/-?\d+(?:\.\d+)?/g)?.map(Number);if(!values||values.length!==8)continue;
      path.setAttribute("d",`M ${values[0]} ${values[1]} L ${endX} ${values[3]} L ${endX} ${values[5]} L ${values[6]} ${values[7]} z`);
    }
  }
}

export const ABCJS_TESTED_VERSION="6.5.2";
