import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { GameStage, type TimelinePerformance } from "../game/GameStage";
import { VirtualHarmonica } from "../harmonica-ui/VirtualHarmonica";
import { Tuner } from "../components/Tuner";
import { MicrophoneInput, type MicrophoneDiagnostics, type MicrophoneObservation } from "../audio/MicrophoneInput";
import { PlaybackEngine } from "../audio/PlaybackEngine";
import { NoteSegmenter, type TrackerFrame } from "../audio/tracking";
import { SONGS, parseAbc, type Melody, type MelodyEvent } from "../music/melody";
import { STANDARD_C12, actionsForMidi, type HarmonicaAction } from "../harmonica/profile";
import { noteName } from "../music/pitch";
import { writtenPitchFromMidi } from "../notation/layout";
import { alignPerformance, relativeTargets, transpositionDelta, type InputNoteSegment, type PitchTracePoint } from "../exercises/evaluation";

type Mode = "find" | "score" | "ear";
type Input = "virtual" | "microphone";
type Practice = "step" | "flow";
type FindRange = "beginner" | "chromatic" | "full";
const player = new PlaybackEngine();
const EAR_TARGETS = [60,64,62,67];
const FIND_RANGES: Record<FindRange, number[]> = {
  beginner: [60,62,64,65,67,69,71,72],
  chromatic: Array.from({length:13},(_,index)=>60+index),
  full: [...new Set(STANDARD_C12.physicalActions.map((action)=>action.canonicalMidi))].sort((a,b)=>a-b),
};

export function App() {
  const [screen, setScreen] = useState<"menu"|"game">("menu");
  const [mode, setMode] = useState<Mode>("find"), [input, setInput] = useState<Input>("virtual"), [practice, setPractice] = useState<Practice>("step");
  const [active, setActive] = useState(0), [status, setStatus] = useState<"idle"|"hit"|"miss">("idle"), [message, setMessage] = useState("Read the staff, then play");
  const [frame, setFrame] = useState<TrackerFrame|null>(null), [observation,setObservation]=useState<MicrophoneObservation>(), [trace, setTrace] = useState<PitchTracePoint[]>([]), [renderedPerformance,setPerformance]=useState<TimelinePerformance[]>([]);
  const [micError, setMicError] = useState(""), [diagnostics, setDiagnostics] = useState<MicrophoneDiagnostics>(), [micDevices,setMicDevices]=useState<MediaDeviceInfo[]>([]), [deviceId,setDeviceId]=useState("");
  const [strict, setStrict] = useState(false), [songKey, setSongKey] = useState("twinkle"), [customAbc, setCustomAbc] = useState(SONGS.twinkle!.abc), [melody, setMelody] = useState(() => parseAbc(SONGS.twinkle!.abc, "twinkle"));
  const [flow, setFlow] = useState(0), [flowResults, setFlowResults] = useState<ReturnType<typeof alignPerformance>>([]), [earRelative, setEarRelative] = useState(true), [earRevealed, setEarRevealed] = useState(false), [earPlayed, setEarPlayed] = useState<number[]>([]);
  const [session, setSession] = useState({ hits: 0, attempts: 0 }), [showSettings, setShowSettings] = useState(false), [showPitchLabels,setShowPitchLabels]=useState(false), [findRange,setFindRange]=useState<FindRange>("beginner");
  const microphone = useRef(new MicrophoneInput()), segmenter=useRef(new NoteSegmenter(110)), flowTimer = useRef<number | undefined>(undefined), flowStart = useRef(0), performed = useRef<InputNoteSegment[]>([]), submitRef=useRef<(segment:InputNoteSegment,action?:HarmonicaAction)=>void>(()=>{});
  const findEvents = useMemo<MelodyEvent[]>(()=>Array.from({length:Math.min(5,active+1)},(_,offset)=>{const round=active-Math.min(4,active)+offset,midi=FIND_RANGES[findRange]![round%FIND_RANGES[findRange]!.length]!;return{id:`find-${round}`,kind:"note",startBeat:round,durationBeats:.82,midi,writtenPitch:writtenPitchFromMidi(midi),measureIndex:Math.floor(round/4)}}),[active,findRange]);
  const earExerciseMidis = earRevealed && earPlayed.length === EAR_TARGETS.length ? earPlayed : EAR_TARGETS;
  const earMelody = useMemo<Melody>(()=>({id:"ear-exercise",title:"Discovered ear phrase",tempoQpm:melody.tempoQpm,meter:{numerator:4,denominator:4},events:earExerciseMidis.map((midi,index)=>({id:`ear-${index}`,kind:"note",startBeat:index,durationBeats:1,midi,writtenPitch:writtenPitchFromMidi(midi),measureIndex:0}))}),[earExerciseMidis.join(","),melody.tempoQpm]);
  const exerciseMelody = mode === "ear" ? earMelody : melody;
  const sourceEvents = mode === "find" ? findEvents : exerciseMelody.events;
  const targetNotes = sourceEvents.filter((event) => event.kind === "note"), target = mode === "find" ? targetNotes.at(-1) : targetNotes[Math.min(active,targetNotes.length-1)];
  const activeEventIndex = Math.max(0,sourceEvents.findIndex((event)=>event.id===target?.id));
  const calibrationSamples = useMemo(() => JSON.parse(localStorage.getItem("harmonica-calibration-samples") ?? "{}") as Record<number, number[]>, [showSettings]);
  const expectedOffset = (midi?: number) => { const values = midi === undefined ? [] : calibrationSamples[midi] ?? []; const sorted = [...values].sort((a,b)=>a-b); return sorted[Math.floor(sorted.length/2)] ?? 0; };

  useEffect(() => { const warm=()=>void player.preload(); addEventListener("pointerdown",warm,{once:true}); return()=>removeEventListener("pointerdown",warm); },[]);
  useEffect(() => () => { microphone.current.stop(); player.stop(); if (flowTimer.current) cancelAnimationFrame(flowTimer.current); }, []);
  useEffect(() => {
    if (input !== "microphone") { microphone.current.stop(); setFrame(null); setObservation(undefined); return; }
    segmenter.current.reset(); setMicError("");
    void microphone.current.start((next, nextObservation) => {
      setObservation(nextObservation);
      const now=performance.now();
      if(player.guard.isBlocked(now)){setFrame(null);microphone.current.resetTracker();segmenter.current.reset();return;}
      setFrame(next);
      if(next?.state==="stable")setTrace((value)=>[...value.filter((point)=>now-point.time<8_000),{time:next.time,midiFloat:next.midiFloat,clarity:next.clarity,rms:next.rms}]);
      const completed=segmenter.current.update(next,now,"microphone");
      if(completed)submitRef.current(completed);
    }, deviceId || undefined).then((value)=>{setDiagnostics(value);void MicrophoneInput.devices().then(setMicDevices)}).catch((error: unknown) => { setMicError(error instanceof Error ? error.message : "Microphone unavailable"); setInput("virtual"); });
    return()=>microphone.current.stop();
  }, [input, deviceId]);

  const flash = (next: "hit"|"miss", text: string) => { setStatus(next); setMessage(text); window.setTimeout(() => setStatus("idle"), 520); };
  const addTimelinePerformance=(segment:InputNoteSegment,outcome:TimelinePerformance["outcome"])=>setPerformance((value)=>[...value.filter((item)=>performance.now()-item.startedAt<8_000),{id:segment.id,midi:segment.classifiedMidi,startedAt:segment.startedAt,durationMs:segment.durationMs,outcome}]);
  const submitSegment = (segment: InputNoteSegment, action?: HarmonicaAction) => {
    if (!target) return;
    if(practice==="flow"&&mode!=="find"){
      addTimelinePerformance(segment,"performed");
      performed.current.push({...segment,startedAt:segment.startedAt-flowStart.current,stableStartedAt:segment.stableStartedAt-flowStart.current,endedAt:segment.endedAt-flowStart.current});
      return;
    }
    setSession((value) => ({ ...value, attempts: value.attempts + 1 }));
    const midi=segment.classifiedMidi;
    if (mode === "ear"&&!earRevealed) { handleEar(midi); return; }
    const exactAction = mode === "find" && input === "virtual" ? action?.canonicalMidi === target.midi : midi === target.midi;
    const centsOkay = !strict || Math.abs(segment.medianCentsFromEt - expectedOffset(midi)) <= 20;
    if (exactAction && centsOkay) {
      addTimelinePerformance(segment,"correct"); flash("hit", `Hit · ${noteName(midi)}${input === "microphone" ? ` · ${actionsForMidi(STANDARD_C12,midi).length} possible fingerings` : ""}`);
      setSession((value) => ({ attempts: value.attempts, hits: value.hits + 1 })); window.setTimeout(() => setActive((value) => mode === "find" ? value + 1 : Math.min(value + 1, targetNotes.length - 1)), 320);
    } else { addTimelinePerformance(segment,"incorrect"); flash("miss", midi === target.midi ? "Right note · adjust intonation" : `${noteName(midi)} · ${midi < (target.midi ?? 0) ? "play higher" : "play lower"}`); window.setTimeout(()=>setPerformance((value)=>value.filter((item)=>item.id!==segment.id)),1400); }
  };
  submitRef.current=submitSegment;
  const handleEar = (midi: number) => {
    const acceptedTargets = earRelative && earPlayed.length ? relativeTargets(EAR_TARGETS, earPlayed[0]!) : EAR_TARGETS;
    const expected = acceptedTargets[earPlayed.length] ?? acceptedTargets.at(-1)!;
    if (earRelative && !earPlayed.length) { setEarPlayed([midi]); setActive(1); flash("hit", `Anchor locked at ${noteName(midi)} · phrase transposed`); return; }
    if (midi === expected) { const next = [...earPlayed, midi]; setEarPlayed(next); setActive(Math.min(next.length, EAR_TARGETS.length - 1)); flash("hit", next.length === EAR_TARGETS.length ? "Pitches found · choose Flow to perform the rhythm" : "Interval found"); if (next.length === EAR_TARGETS.length) setEarRevealed(true); }
    else { const candidate = [...earPlayed, midi], delta = !earRelative ? transpositionDelta(EAR_TARGETS, candidate) : null; flash("miss", delta && delta !== 0 ? `Intervals match · phrase is ${Math.abs(delta)} semitone${Math.abs(delta)===1?"":"s"} ${delta>0?"high":"low"}` : `${noteName(midi)} · target remains hidden`); }
  };
  const onVirtualStart=(action:HarmonicaAction)=>{void player.noteOn(action.id,action.canonicalMidi)};
  const onVirtualEnd = (action: HarmonicaAction, duration: number) => { player.noteOff(action.id); const ended=performance.now(),segment=segmentFromVirtual(action.canonicalMidi,ended-duration,duration); submitSegment(segment,action); };
  const listen = () => { microphone.current.resetTracker(); segmenter.current.reset(); if (mode === "find" && target?.midi !== undefined) void player.playNote(target.midi); else if (mode === "ear") void player.playMelody({...earMelody,events:EAR_TARGETS.map((midi,index)=>({id:`reference-${index}`,kind:"note",startBeat:index,durationBeats:1,midi,writtenPitch:writtenPitchFromMidi(midi),measureIndex:0}))}); else void player.playMelody(melody); };
  const startFlow = () => { player.stop(); performed.current = []; setPerformance([]); setFlowResults([]); setActive(0); setMessage("Count in · 4 beats"); const beatMs=60_000/exerciseMelody.tempoQpm, begins=performance.now()+beatMs*4; flowStart.current=begins; const tick=()=>{ const progress=(performance.now()-begins)/beatMs; setFlow(Math.max(0,progress)); const next=targetNotes.findIndex((event)=>event.startBeat+event.durationBeats>progress);setActive(Math.max(0,Math.min(targetNotes.length-1,next<0?targetNotes.length-1:next))); const end=Math.max(...exerciseMelody.events.map((event)=>event.startBeat+event.durationBeats));if(progress<=end){flowTimer.current=requestAnimationFrame(tick)}else{setFlowResults(alignPerformance(exerciseMelody.events,performed.current,exerciseMelody.tempoQpm));setMessage("Run complete · review separate scores below")}};flowTimer.current=requestAnimationFrame(tick); };
  const loadSong = (key: string) => { const item=SONGS[key]!; setSongKey(key); setCustomAbc(item.abc); setMelody(parseAbc(item.abc,key)); setActive(0); setFlow(0); setFlowResults([]); };
  const resetMode = (next: Mode) => { setMode(next); setPractice("step"); setActive(0); setEarPlayed([]); setEarRevealed(false); setPerformance([]); setTrace([]); setMessage(next === "ear" ? "Listen first · pitches stay hidden" : next==="find"?"Read the staff, then play":"Ready"); };
  const startMode = (next: Mode) => { resetMode(next); setScreen("game"); };
  const exitMode = () => { player.stop(); microphone.current.stop(); if (flowTimer.current) cancelAnimationFrame(flowTimer.current); setInput("virtual"); setScreen("menu"); };
  const stageBeat=practice==="flow"&&mode!=="find"?flow:sourceEvents[activeEventIndex]?.startBeat??0;

  if (screen === "menu") return <MainMenu onStart={startMode} onSettings={()=>setShowSettings(true)} settings={showSettings ? <SettingsDrawer strict={strict} setStrict={setStrict} showPitchLabels={showPitchLabels} setShowPitchLabels={setShowPitchLabels} findRange={findRange} setFindRange={(value)=>{setFindRange(value);setActive(0)}} diagnostics={diagnostics} onClose={()=>setShowSettings(false)}/> : null}/>;

  return <div className={`app-shell game-shell mode-${mode}`}><header className="game-header"><button className="menu-exit" onClick={exitMode}><span>←</span> Menu</button><div className="game-brand"><span className="brand-mark">H</span><span><b>HARMONICA</b><small>TRAINER</small></span></div><div className="session-stats"><span><b>{session.hits}</b><small>HITS</small></span><span><b>{session.attempts ? Math.round(session.hits/session.attempts*100):100}%</b><small>ACCURACY</small></span></div><button className="icon-button" aria-label="Settings" onClick={()=>setShowSettings(!showSettings)}>⚙</button></header>
    <main className="play-scene"><div className="mode-strip"><div><span className="eyebrow">{mode === "find" ? "NOTE QUEST" : mode === "score" ? "SCORE RUN" : "EAR MISSION"}</span><h1>{mode === "find" ? "Find the note" : mode === "score" ? "Play the score" : "Play it by ear"}</h1><p>{mode === "find" ? "Read the target on the staff, then find its exact action." : mode === "score" ? "Follow the notation one note at a time or perform the full run." : "Listen to the phrase and discover each interval."}</p></div><span className={`feedback-chip ${status}`}>{status==="hit"?"✓":status==="miss"?"↕":"◇"} {message}</span></div>
      <div className="toolbar"><div className="segmented" aria-label="Input source"><button className={input==="virtual"?"active":""} onClick={()=>setInput("virtual")}>Virtual</button><button className={input==="microphone"?"active":""} onClick={()=>setInput("microphone")}>Microphone</button></div>{mode!=="find"&&<div className="segmented" aria-label="Practice style"><button className={practice==="step"?"active":""} onClick={()=>setPractice("step")}>Step</button><button className={practice==="flow"?"active":""} disabled={mode==="ear"&&!earRevealed} onClick={()=>setPractice("flow")}>Flow</button></div>}{mode==="ear"&&<div className="segmented" aria-label="Ear mode"><button className={!earRelative?"active":""} onClick={()=>{setEarRelative(false);setEarPlayed([]);setActive(0);setEarRevealed(false)}}>Absolute</button><button className={earRelative?"active":""} onClick={()=>{setEarRelative(true);setEarPlayed([]);setActive(0);setEarRevealed(false)}}>Relative</button></div>}<button className="listen" onClick={listen}><span>▶</span> Listen</button>{practice==="flow"&&mode!=="find"&&<button className="primary" onClick={startFlow}>Count in + perform</button>}</div>
      {mode==="score"&&<div className="score-source"><select value={songKey} onChange={(event)=>loadSong(event.target.value)}>{Object.entries(SONGS).map(([key,value])=><option key={key} value={key}>{value.title}</option>)}</select><details><summary>Import ABC</summary><textarea value={customAbc} onChange={(event)=>setCustomAbc(event.target.value)}/><button onClick={()=>{try{setMelody(parseAbc(customAbc));setActive(0)}catch(error){setMessage(error instanceof Error?error.message:"Invalid ABC")}}}>Load monody</button></details><label>Tempo <input type="range" min="50" max="160" value={melody.tempoQpm} onChange={(event)=>setMelody((value)=>({...value,tempoQpm:Number(event.target.value)}))}/>{melody.tempoQpm} BPM</label></div>}
      <GameStage events={sourceEvents} activeIndex={activeEventIndex} hidden={mode==="ear"&&!earRevealed} currentBeat={stageBeat} trace={trace} performance={renderedPerformance} nowMs={input==="microphone"||practice==="flow"?performance.now():performanceNow(trace,renderedPerformance)} status={status} title={mode==="score"?melody.title:mode==="ear"?(earRevealed?"Discovered phrase":"Hidden phrase"):"Read the target · answer hidden"} showNoteNames={showPitchLabels&&mode!=="find"} pixelsPerBeat={mode==="find"?48:undefined}/>
      {input === "microphone" ? <section className="input-deck">{micDevices.length > 1 && <label className="device-select">Input device <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="">System default</option>{micDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label>}<Tuner frame={frame} observation={observation} message={micError} expectedOffset={expectedOffset(frame?.classifiedMidi)}/><div className="mic-actions"><button onClick={()=>microphone.current.recalibrate()}>Recalibrate noise</button><span>Floor {(observation?.noiseFloor??0).toFixed(4)} · opens {(observation?.openThreshold??0).toFixed(4)}</span></div><p className="privacy">🔒 Audio is analyzed on this device and is never uploaded.</p></section> : <VirtualHarmonica onStart={onVirtualStart} onEnd={onVirtualEnd} showLabels={showPitchLabels}/>}
      {mode==="ear"&&<div className="ear-tools"><button onClick={()=>setMessage(earPlayed.length?`Next interval: ${EAR_TARGETS[earPlayed.length]! - EAR_TARGETS[Math.max(0,earPlayed.length-1)]! >= 0?"up":"down"}`:"Replay the reference")}>Hint</button><button onClick={()=>{setEarRevealed(true);setEarPlayed(earRelative&&earPlayed.length?relativeTargets(EAR_TARGETS,earPlayed[0]!):EAR_TARGETS);setMessage("Revealed · exercise marked assisted")}}>Reveal</button><span>{earPlayed.length}/{EAR_TARGETS.length} pitches found</span></div>}
      {!!flowResults.length&&<Review rows={flowResults}/>}
      {showSettings&&<SettingsDrawer strict={strict} setStrict={setStrict} showPitchLabels={showPitchLabels} setShowPitchLabels={setShowPitchLabels} findRange={findRange} setFindRange={(value)=>{setFindRange(value);setActive(0)}} diagnostics={diagnostics} onClose={()=>setShowSettings(false)}/>}
    </main></div>;
}

function MainMenu({onStart,onSettings,settings}:{onStart:(mode:Mode)=>void;onSettings:()=>void;settings:ReactNode}) {
  const modes: {id:Mode;number:string;title:string;description:string;symbol:string}[] = [
    {id:"find",number:"01",title:"Find a note",description:"Read the staff and find the pitch",symbol:"♪"},
    {id:"score",number:"02",title:"Play the score",description:"Follow the notation and rhythm",symbol:"♫"},
    {id:"ear",number:"03",title:"Play by ear",description:"Hear the phrase and discover it",symbol:"◖"},
  ];
  return <div className="main-menu"><div className="menu-aurora" aria-hidden="true"/><header className="menu-header"><div className="menu-brand"><span className="brand-mark">H</span><span><b>HARMONICA</b><small>TRAINER</small></span></div><div className="menu-tools"><a href="?lab=pitch">Labs</a><button className="icon-button" aria-label="Settings" onClick={onSettings}>⚙</button></div></header><main className="menu-content"><div className="menu-copy"><span className="eyebrow">YOUR INSTRUMENT · YOUR GAME</span><h1>Train your ear.<br/><em>Own the score.</em></h1><p>Choose a challenge and turn the chromatic harmonica into muscle memory.</p></div><div className="mode-select" aria-label="Choose a game mode"><span className="select-label">SELECT MODE</span>{modes.map((item)=><button key={item.id} className={`mode-choice ${item.id}`} onClick={()=>onStart(item.id)}><span className="mode-number">{item.number}</span><span className="mode-symbol" aria-hidden="true">{item.symbol}</span><span className="mode-copy"><b>{item.title}</b><small>{item.description}</small></span><span className="mode-play">PLAY <i>→</i></span></button>)}</div></main><footer className="menu-footer"><span>STANDARD C · 12 HOLES · A4 440 HZ</span><span>LOCAL AUDIO · NO UPLOADS</span></footer>{settings}</div>;
}

function SettingsDrawer({strict,setStrict,showPitchLabels,setShowPitchLabels,findRange,setFindRange,diagnostics,onClose}:{strict:boolean;setStrict:(value:boolean)=>void;showPitchLabels:boolean;setShowPitchLabels:(value:boolean)=>void;findRange:FindRange;setFindRange:(value:FindRange)=>void;diagnostics?:MicrophoneDiagnostics;onClose:()=>void}) {
  return <aside className="settings-drawer"><button className="close" aria-label="Close settings" onClick={onClose}>×</button><span className="eyebrow">PLAYER SETUP</span><h2>Practice settings</h2><label><input type="checkbox" checked={strict} onChange={(event)=>setStrict(event.target.checked)}/> Strict intonation ±20¢</label><label><input type="checkbox" checked={showPitchLabels} onChange={(event)=>setShowPitchLabels(event.target.checked)}/> Show pitch labels</label><label>Find-note range<select value={findRange} onChange={(event)=>setFindRange(event.target.value as FindRange)}><option value="beginner">Beginner naturals</option><option value="chromatic">One chromatic octave</option><option value="full">Full 12-hole range</option></select></label><p>Pitch labels stay hidden by default during assessment. Note identity and intonation are scored separately.</p><a href="?lab=calibration">Instrument calibration →</a><a href="?lab=fixtures">Fixture recorder →</a><a href="?lab=timing">Timing calibration →</a><pre>{JSON.stringify({...diagnostics,...player.diagnostics},null,2)}</pre></aside>;
}

function Review({rows}:{rows:ReturnType<typeof alignPerformance>}) { const score=(key:"pitch"|"timing"|"length"|"stability"|"intonation")=>Math.round(rows.reduce((sum,row)=>sum+row[key],0)/Math.max(1,rows.length)); return <section className="review"><div><span>Notes</span><b>{score("pitch")}%</b></div><div><span>Timing</span><b>{score("timing")}%</b></div><div><span>Length</span><b>{score("length")}%</b></div><div><span>Stability</span><b>{score("stability")}%</b></div><div><span>Intonation</span><b>{score("intonation")}%</b></div></section> }
function segmentFromVirtual(midi:number,startedAt:number,durationMs:number):InputNoteSegment{return{id:`virtual-${startedAt}`,source:"virtual-harmonica",startedAt,stableStartedAt:startedAt,endedAt:startedAt+durationMs,durationMs,medianFrequencyHz:0,medianMidiFloat:midi,classifiedMidi:midi,medianCentsFromEt:0,centsVariability:0,medianClarity:1,medianRms:1,pitchTrace:[]}}
function performanceNow(trace:PitchTracePoint[],items:TimelinePerformance[]):number{return trace.at(-1)?.time??items.at(-1)?.startedAt??performance.now()}
