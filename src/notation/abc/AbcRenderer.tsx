import abcjs from "abcjs";
import { useEffect, useMemo, useRef, useState } from "react";
import type { InputNoteSegment, PitchTracePoint } from "../../exercises/evaluation";
import { teachingNoteName, type NamingSystem } from "../../music/naming";
import { buildTimelineGeometry } from "./timelineGeometry";
import { bindAbcRender, type AbcDocument, type RenderAnchor } from "./AbcAdapter";

export type StaffDisplayMode="timeline"|"score";
export type StaffDensity="spacious"|"balanced"|"compact";
export interface MusicStageProps {
  document:AbcDocument; mode:StaffDisplayMode; activeBeat:number; activeWrittenEventId?:string;
  hiddenWrittenEventIds?:Set<string>; performedSegments?:InputNoteSegment[]; pitchTrace?:PitchTracePoint[];
  feedback?:"idle"|"hit"|"miss"; showNoteNames?:boolean; namingSystem?:NamingSystem;
  density?:StaffDensity; title:string; nowMs?:number;
}
const DENSITY:Record<StaffDensity,{padding:number;width:number;beat:number}>={spacious:{padding:15,width:65,beat:68},balanced:{padding:12,width:55,beat:60},compact:{padding:10,width:45,beat:50}};

export function MusicStage({document,mode,activeBeat,activeWrittenEventId,hiddenWrittenEventIds=new Set(),performedSegments=[],pitchTrace=[],feedback="idle",showNoteNames=false,namingSystem="letters",density="balanced",title,nowMs=performance.now()}:MusicStageProps){
  const renderRoot=useRef<HTMLDivElement>(null),canvasRoot=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null),manualUntil=useRef(0);
  const [anchors,setAnchors]=useState<RenderAnchor[]>([]),timeline=mode==="timeline",settings=DENSITY[density];
  useEffect(()=>{const root=renderRoot.current,coordinateRoot=canvasRoot.current;if(!root||!coordinateRoot)return;const renderSource=timeline?timelineAbcSource(document.source):document.source;const visual=abcjs.renderAbc(root,renderSource,{add_classes:true,responsive:timeline?undefined:"resize",staffwidth:timeline?Math.max(1100,document.totalBeats*settings.beat):1050,scale:1.08,wrap:timeline?undefined:{minSpacing:1.8,maxSpacing:2.8,preferredMeasuresPerLine:4},timeBasedLayout:timeline?{minPadding:settings.padding,minWidth:settings.width,align:"left"}:undefined,paddingtop:20,paddingbottom:showNoteNames?58:32});
    let frame=0;const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>setAnchors(bindAbcRender(root,coordinateRoot,document.writtenEvents,visual[0])))};update();void globalThis.document.fonts?.ready.then(update);const observer=new ResizeObserver(update);observer.observe(root);observer.observe(coordinateRoot);return()=>{cancelAnimationFrame(frame);observer.disconnect()};
  },[document,timeline,settings.padding,settings.width,settings.beat,showNoteNames]);
  const geometry=useMemo(()=>buildTimelineGeometry(document.writtenEvents,document.soundingEvents,anchors),[document,anchors]);
  useEffect(()=>{const root=renderRoot.current;if(!root)return;for(const element of root.querySelectorAll<SVGElement>("[data-written-event-id]")){const id=element.dataset.writtenEventId!;element.classList.toggle("music-active",id===activeWrittenEventId);element.classList.toggle("music-hidden",hiddenWrittenEventIds.has(id));element.setAttribute("aria-hidden",hiddenWrittenEventIds.has(id)?"true":"false")}},[anchors,activeWrittenEventId,hiddenWrittenEventIds]);
  useEffect(()=>{const scroll=viewport.current,anchor=anchors.find(value=>value.eventId===activeWrittenEventId);if(!scroll||!anchor||performance.now()<manualUntil.current)return;const target=timeline?anchor.temporalX-scroll.clientWidth*.38:Math.max(0,anchor.eventBounds.top-scroll.clientHeight*.3);if(timeline){const safeLeft=scroll.scrollLeft+scroll.clientWidth*.27,safeRight=scroll.scrollLeft+scroll.clientWidth*.72;if(anchor.temporalX>=safeLeft&&anchor.temporalX<=safeRight)return;scroll.scrollTo({left:Math.max(0,target),behavior:"smooth"})}else scroll.scrollTo({top:Math.max(0,target),behavior:"smooth"})},[activeWrittenEventId,anchors,timeline]);
  const active=document.writtenEvents.find(event=>event.id===activeWrittenEventId),held=active?Math.max(0,Math.min(1,(activeBeat-active.startBeat)/active.durationBeats)):0;
  const yForMidi=(midi:number)=>{const notes=document.writtenEvents.filter(event=>event.kind==="note"&&event.midi!==undefined).map(event=>({event,anchor:anchors.find(a=>a.eventId===event.id)})).filter(value=>value.anchor?.notehead);const closest=notes.sort((a,b)=>Math.abs((a.event.midi??0)-midi)-Math.abs((b.event.midi??0)-midi))[0];if(!closest?.anchor?.notehead)return 100;return closest.anchor.notehead.centerY-(midi-(closest.event.midi??midi))*3.8};
  return <section className={`music-stage mode-${mode} ${feedback}`} aria-label={`${title} music staff`}>
    <div className="stage-heading"><div><span className="eyebrow">{timeline?"Timeline staff":"Engraved score"}</span><h2>{title}</h2></div><div className="stage-legend"><span>◆ target</span><span>━ duration</span><span>✓ / × result</span><span>⌁ played pitch</span></div></div>
    <div className="music-viewport" ref={viewport} onPointerDown={()=>{manualUntil.current=performance.now()+3000}} onScroll={()=>{if(!timeline)manualUntil.current=performance.now()+1200}}>
      {timeline&&<div className="music-judgment" aria-label="Fixed judgment line"><span>JUDGMENT</span></div>}
      <div className="music-canvas" ref={canvasRoot}>
        <div className="ribbon-underlay" aria-hidden="true">{geometry.segments.map(segment=>{const event=document.writtenEvents.find(value=>value.id===segment.writtenEventId)!;const sound=document.soundingEvents.find(value=>value.id===segment.soundEventId);const progress=sound?Math.max(0,Math.min(1,(activeBeat-sound.startBeat)/sound.durationBeats)):event.startBeat<activeBeat?1:0;return <span key={segment.writtenEventId} className={`music-ribbon ${sound?.writtenEventIds.includes(activeWrittenEventId??"")?"active":""}`} data-written-event-id={segment.writtenEventId} style={{left:segment.startX,top:segment.centerY-5,width:Math.max(8,segment.endX-segment.startX)}}><i style={{width:`${progress*100}%`}}/></span>})}</div>
        <div className="abc-production-render" ref={renderRoot}/>
        <div className="music-performance-overlay" aria-hidden="true">
          {hiddenWrittenEventIds.size>0&&anchors.filter(anchor=>hiddenWrittenEventIds.has(anchor.eventId)).map(anchor=><span key={anchor.eventId} className="hidden-pitch-marker" style={{left:anchor.temporalX-13,top:anchor.eventBounds.top+44}}>?</span>)}
          {showNoteNames&&anchors.map(anchor=>{const event=document.writtenEvents.find(value=>value.id===anchor.eventId);return event?.kind==="note"&&event.midi!==undefined&&!hiddenWrittenEventIds.has(event.id)?<span key={event.id} className="abc-note-name" style={{left:anchor.temporalX-26,top:anchor.eventBounds.top+anchor.eventBounds.height+8}}>{teachingNoteName(event.midi,namingSystem)}</span>:null})}
          {performedSegments.map(segment=>{const beat=activeBeat+(segment.startedAt-nowMs)/60000*document.tempoQpm;return <span key={segment.id} className="performed-segment" style={{left:geometry.beatToX(beat),top:yForMidi(segment.classifiedMidi),width:Math.max(10,segment.durationMs/60000*document.tempoQpm*settings.beat)}}/>})}
          {pitchTrace.length>1&&<svg className="production-pitch-trace"><polyline points={pitchTrace.filter(point=>nowMs-point.time<8000).map(point=>{const beat=activeBeat+(point.time-nowMs)/60000*document.tempoQpm;return`${geometry.beatToX(beat)},${yForMidi(point.midiFloat)}`}).join(" ")}/></svg>}
        </div>
      </div>
    </div>
    <div className="music-stage-status"><span>abcjs 6.5.2 · {density} density</span>{active&&<strong>{Math.round(held*100)}% held</strong>}</div>
  </section>;
}

/** Preserve source offsets while preventing authored body newlines from creating systems. */
function timelineAbcSource(source:string):string{const key=source.search(/^K:.*$/m);if(key<0)return source.replace(/\n/g," ");const body=source.indexOf("\n",key);return body<0?source:source.slice(0,body+1)+source.slice(body+1).replace(/\n/g," ")}
