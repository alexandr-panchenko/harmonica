import abcjs from "abcjs";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { InputNoteSegment, PitchTracePoint } from "../../exercises/evaluation";
import { teachingNoteName, type NamingSystem } from "../../music/naming";
import { buildTimelineGeometry } from "./timelineGeometry";
import { bindAbcRender, extendStaffLines, type AbcDocument, type RenderAnchor } from "./AbcAdapter";

export type StaffDisplayMode="timeline"|"score";
export type StaffDensity="spacious"|"balanced"|"compact";
export interface MusicStageProps {
  document:AbcDocument; mode:StaffDisplayMode; activeBeat:number; activeWrittenEventId?:string;
  hiddenWrittenEventIds?:Set<string>; performedSegments?:InputNoteSegment[]; pitchTrace?:PitchTracePoint[];
  feedback?:"idle"|"hit"|"miss"; showNoteNames?:boolean; namingSystem?:NamingSystem;
  density?:StaffDensity; accessibleLabel:string; nowMs?:number;
  ribbons?:"none"|"duration"; showPlayhead?:boolean;
}
const DENSITY:Record<StaffDensity,{padding:number;width:number;beat:number}>={spacious:{padding:15,width:65,beat:68},balanced:{padding:12,width:55,beat:60},compact:{padding:10,width:45,beat:50}};
const ENGRAVING_SCALE=1.08, HORIZONTAL_PAPER_PADDING=24, FIRST_NOTE_OFFSET=90;

export function MusicStage({document,mode,activeBeat,activeWrittenEventId,hiddenWrittenEventIds=new Set(),performedSegments=[],pitchTrace=[],feedback="idle",showNoteNames=false,namingSystem="letters",density="balanced",accessibleLabel,nowMs=performance.now(),ribbons="duration",showPlayhead=false}:MusicStageProps){
  const renderRoot=useRef<HTMLDivElement>(null),canvasRoot=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null),manualUntil=useRef(0);
  const [anchors,setAnchors]=useState<RenderAnchor[]>([]),[viewportWidth,setViewportWidth]=useState(0),timeline=mode==="timeline",settings=DENSITY[density];
  useLayoutEffect(()=>{const element=viewport.current;if(!element)return;const update=()=>setViewportWidth(Math.round(element.clientWidth));update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect()},[]);
  const leadingInset=timeline&&showPlayhead?Math.max(0,viewportWidth*.38-FIRST_NOTE_OFFSET):0;
  const fittedStaffWidth=Math.max(280,(Math.max(320,viewportWidth-leadingInset)/ENGRAVING_SCALE)-HORIZONTAL_PAPER_PADDING);
  const staffWidth=timeline?Math.max(fittedStaffWidth,document.totalBeats*settings.beat):fittedStaffWidth;
  useEffect(()=>{const root=renderRoot.current,coordinateRoot=canvasRoot.current;if(!root||!coordinateRoot||!viewportWidth)return;const cleanSource=canvasAbcSource(document.source),renderSource=timeline?timelineAbcSource(cleanSource):cleanSource;const visual=abcjs.renderAbc(root,renderSource,{add_classes:true,staffwidth:staffWidth,scale:ENGRAVING_SCALE,wrap:timeline?undefined:{minSpacing:1.8,maxSpacing:2.8,preferredMeasuresPerLine:4},timeBasedLayout:timeline?{minPadding:settings.padding,minWidth:settings.width,align:"left"}:undefined,paddingleft:12,paddingright:12,paddingtop:20,paddingbottom:showNoteNames?58:32});
    let frame=0;const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{extendStaffLines(root);setAnchors(bindAbcRender(root,coordinateRoot,document.writtenEvents,visual[0]))})};update();void globalThis.document.fonts?.ready.then(update);const observer=new ResizeObserver(update);observer.observe(root);observer.observe(coordinateRoot);return()=>{cancelAnimationFrame(frame);observer.disconnect()};
  },[document,timeline,settings.padding,settings.width,showNoteNames,staffWidth,viewportWidth]);
  const geometry=useMemo(()=>buildTimelineGeometry(document.writtenEvents,document.soundingEvents,anchors),[document,anchors]);
  useEffect(()=>{const root=renderRoot.current;if(!root)return;for(const element of root.querySelectorAll<SVGElement>("[data-written-event-id]")){const id=element.dataset.writtenEventId!;element.classList.toggle("music-active",id===activeWrittenEventId);element.classList.toggle("music-hidden",hiddenWrittenEventIds.has(id));element.setAttribute("aria-hidden",hiddenWrittenEventIds.has(id)?"true":"false")}},[anchors,activeWrittenEventId,hiddenWrittenEventIds]);
  useEffect(()=>{const scroll=viewport.current,anchor=anchors.find(value=>value.eventId===activeWrittenEventId);if(!scroll||!anchor||performance.now()<manualUntil.current)return;const target=timeline?anchor.temporalX-scroll.clientWidth*.38:Math.max(0,anchor.eventBounds.top-scroll.clientHeight*.3);if(timeline){const safeLeft=scroll.scrollLeft+scroll.clientWidth*.27,safeRight=scroll.scrollLeft+scroll.clientWidth*.72;if(anchor.temporalX>=safeLeft&&anchor.temporalX<=safeRight)return;scroll.scrollTo({left:Math.max(0,target),behavior:"smooth"})}else scroll.scrollTo({top:Math.max(0,target),behavior:"smooth"})},[activeWrittenEventId,anchors,timeline]);
  const active=document.writtenEvents.find(event=>event.id===activeWrittenEventId),held=active?Math.max(0,Math.min(1,(activeBeat-active.startBeat)/active.durationBeats)):0;
  const yForMidi=(midi:number)=>{const notes=document.writtenEvents.filter(event=>event.kind==="note"&&event.midi!==undefined).map(event=>({event,anchor:anchors.find(a=>a.eventId===event.id)})).filter(value=>value.anchor?.notehead);const closest=notes.sort((a,b)=>Math.abs((a.event.midi??0)-midi)-Math.abs((b.event.midi??0)-midi))[0];if(!closest?.anchor?.notehead)return 100;return closest.anchor.notehead.centerY-(midi-(closest.event.midi??midi))*3.8};
  return <section className={`music-stage mode-${mode} ${feedback}`} aria-label={accessibleLabel} style={{"--timeline-leading-inset":`${leadingInset}px`} as React.CSSProperties}>
    <div className="music-viewport" ref={viewport} onPointerDown={()=>{manualUntil.current=performance.now()+3000}} onScroll={()=>{if(!timeline)manualUntil.current=performance.now()+1200}}>
      {timeline&&showPlayhead&&<div className="music-playhead" aria-label="Playback position"/>}
      <div className="music-canvas" ref={canvasRoot}>
        {ribbons==="duration"&&<div className="ribbon-underlay" aria-hidden="true">{geometry.segments.map(segment=>{const event=document.writtenEvents.find(value=>value.id===segment.writtenEventId)!;const sound=document.soundingEvents.find(value=>value.id===segment.soundEventId);const progress=sound?Math.max(0,Math.min(1,(activeBeat-sound.startBeat)/sound.durationBeats)):event.startBeat<activeBeat?1:0;const eventIndex=document.writtenEvents.findIndex(value=>value.id===segment.writtenEventId),activeIndex=document.writtenEvents.findIndex(value=>value.id===activeWrittenEventId),distance=eventIndex-activeIndex,state=distance===0?"active":distance>0&&distance<=2?"upcoming":"distant";return <span key={segment.writtenEventId} className={`music-ribbon ${state}`} data-written-event-id={segment.writtenEventId} style={{left:segment.startX,top:segment.centerY-3,width:Math.max(5,segment.endX-segment.startX)}}><i style={{width:`${progress*100}%`}}/></span>})}</div>}
        <div className="abc-production-render" ref={renderRoot}/>
        <div className="music-performance-overlay" aria-hidden="true">
          {hiddenWrittenEventIds.size>0&&anchors.filter(anchor=>hiddenWrittenEventIds.has(anchor.eventId)).map(anchor=><span key={anchor.eventId} className="hidden-pitch-marker" style={{left:anchor.temporalX-12}}/>)}
          {showNoteNames&&anchors.map(anchor=>{const event=document.writtenEvents.find(value=>value.id===anchor.eventId);return event?.kind==="note"&&event.midi!==undefined&&!hiddenWrittenEventIds.has(event.id)?<span key={event.id} className="abc-note-name" style={{left:anchor.temporalX-26,top:anchor.eventBounds.top+anchor.eventBounds.height+8}}>{teachingNoteName(event.midi,namingSystem)}</span>:null})}
          {performedSegments.map(segment=>{const beat=activeBeat+(segment.startedAt-nowMs)/60000*document.tempoQpm;return <span key={segment.id} className="performed-segment" style={{left:geometry.beatToX(beat),top:yForMidi(segment.classifiedMidi),width:Math.max(10,segment.durationMs/60000*document.tempoQpm*settings.beat)}}/>})}
          {pitchTrace.length>1&&<svg className="production-pitch-trace"><polyline points={pitchTrace.filter(point=>nowMs-point.time<8000).map(point=>{const beat=activeBeat+(point.time-nowMs)/60000*document.tempoQpm;return`${geometry.beatToX(beat)},${yForMidi(point.midiFloat)}`}).join(" ")}/></svg>}
        </div>
      </div>
    </div>
    {active&&ribbons==="duration"&&<div className="music-progress" aria-label={`${Math.round(held*100)}% of current note held`}><i style={{width:`${held*100}%`}}/></div>}
  </section>;
}

/** Preserve source offsets while preventing authored body newlines from creating systems. */
function timelineAbcSource(source:string):string{const key=source.search(/^K:.*$/m);if(key<0)return source.replace(/\n/g," ");const body=source.indexOf("\n",key);return body<0?source:source.slice(0,body+1)+source.slice(body+1).replace(/\n/g," ")}
/** Titles and other page chrome do not belong inside the notation SVG. */
function canvasAbcSource(source:string):string{return source.replace(/^T:.*$/gm,line=>" ".repeat(line.length))}
