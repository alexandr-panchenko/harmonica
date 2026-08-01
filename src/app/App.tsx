import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { GameStage, type TimelinePerformance } from "../game/GameStage";
import { VirtualHarmonica } from "../harmonica-ui/VirtualHarmonica";
import { Tuner } from "../components/Tuner";
import { MicrophoneInput, type MicrophoneDiagnostics, type MicrophoneObservation } from "../audio/MicrophoneInput";
import { PlaybackEngine } from "../audio/PlaybackEngine";
import { NoteSegmenter, type TrackerFrame } from "../audio/tracking";
import { SONGS, parseAbc, type Melody, type MelodyEvent } from "../music/melody";
import { HARMONICA_PROFILES, STANDARD_C12, actionsForMidi, type HarmonicaAction, type HarmonicaProfile } from "../harmonica/profile";
import { noteName } from "../music/pitch";
import { teachingNoteName, type NamingSystem } from "../music/naming";
import { writtenPitchFromMidi } from "../notation/layout";
import { alignPerformance, relativeTargets, transpositionDelta, type InputNoteSegment, type PitchTracePoint } from "../exercises/evaluation";
import { createRandomSequence, findPitchPool, nextRandomPitch, type AccidentalMode, type FindRange } from "../exercises/findGenerator";

type Mode = "find" | "score" | "ear" | "rhythm" | "guided";
type Screen = "menu" | "songs" | "game";
type Input = "virtual" | "microphone";
type Practice = "step" | "flow";
const player = new PlaybackEngine();
const PREFERENCES = {
  profile: "harmonica-profile",
  staffLabels: "harmonica-staff-note-names",
  harmonicaLabels: "harmonica-instrument-note-names",
  namingSystem: "harmonica-note-naming",
} as const;
const EAR_TARGETS = [60, 64, 62, 67];
const RHYTHM_MELODY: Melody = {
  id: "rhythm-one", title: "Pulse builder", tempoQpm: 88, meter: { numerator: 4, denominator: 4 },
  events: [
    ["note",0,1],["note",1,.5],["note",1.5,.5],["rest",2,1],["note",3,1.5],["note",4.5,.5],["rest",5,1],["note",6,2],
  ].map(([kind,start,duration],index)=>({id:`rhythm-${index}`,kind:kind as "note"|"rest",startBeat:start as number,durationBeats:duration as number,midi:kind==="note"?60:undefined,writtenPitch:kind==="note"?writtenPitchFromMidi(60):undefined,measureIndex:Math.floor((start as number)/4)})),
};

export function App() {
  const [screen, setScreen] = useState<Screen>("menu"), [pendingSongMode,setPendingSongMode]=useState<"score"|"guided">("score");
  const [mode, setMode] = useState<Mode>("find"), [input, setInput] = useState<Input>("virtual"), [practice, setPractice] = useState<Practice>("step");
  const [active, setActive] = useState(0), [status, setStatus] = useState<"idle"|"hit"|"miss">("idle"), [message, setMessage] = useState("Read the staff, then play");
  const [frame, setFrame] = useState<TrackerFrame|null>(null), [observation,setObservation]=useState<MicrophoneObservation>(), [trace, setTrace] = useState<PitchTracePoint[]>([]), [renderedPerformance,setPerformance]=useState<TimelinePerformance[]>([]);
  const [micError, setMicError] = useState(""), [diagnostics, setDiagnostics] = useState<MicrophoneDiagnostics>(), [micDevices,setMicDevices]=useState<MediaDeviceInfo[]>([]), [deviceId,setDeviceId]=useState("");
  const [strict, setStrict] = useState(false), [songKey, setSongKey] = useState("twinkle"), [customAbc, setCustomAbc] = useState(SONGS.twinkle!.abc), [melody, setMelody] = useState(() => parseAbc(SONGS.twinkle!.abc, "twinkle"));
  const [flow, setFlow] = useState(0), [flowResults, setFlowResults] = useState<ReturnType<typeof alignPerformance>>([]), [earRelative, setEarRelative] = useState(true), [earRevealed, setEarRevealed] = useState(false), [earPlayed, setEarPlayed] = useState<number[]>([]);
  const [session, setSession] = useState({ hits: 0, attempts: 0 }), [showSettings, setShowSettings] = useState(false);
  const [staffLabels,setStaffLabels]=useState(()=>readBooleanPreference(PREFERENCES.staffLabels, false));
  const [harmonicaLabels,setHarmonicaLabels]=useState(()=>readBooleanPreference(PREFERENCES.harmonicaLabels, false));
  const [namingSystem,setNamingSystem]=useState<NamingSystem>(()=>localStorage.getItem(PREFERENCES.namingSystem)==="solfege"?"solfege":"letters");
  const [findRange,setFindRange]=useState<FindRange>("beginner"), [accidentals,setAccidentals]=useState<AccidentalMode>("naturals");
  const [profileId,setProfileId]=useState(()=>HARMONICA_PROFILES.some((item)=>item.id===localStorage.getItem(PREFERENCES.profile))?localStorage.getItem(PREFERENCES.profile)!:STANDARD_C12.id);
  const [actionFeedback,setActionFeedback]=useState<{actionId:string;outcome:"correct"|"incorrect"}>();
  const profile = HARMONICA_PROFILES.find((item)=>item.id===profileId) ?? STANDARD_C12;
  const pool = useMemo(()=>findPitchPool(profile,findRange,accidentals),[profile,findRange,accidentals]);
  const [findSequence,setFindSequence]=useState(()=>createRandomSequence(findPitchPool(STANDARD_C12,"beginner","naturals"),64));
  const microphone = useRef(new MicrophoneInput()), segmenter=useRef(new NoteSegmenter(110)), flowTimer = useRef<number | undefined>(undefined), flowStart = useRef(0), performed = useRef<InputNoteSegment[]>([]), submitRef=useRef<(segment:InputNoteSegment,action?:HarmonicaAction)=>void>(()=>{});

  useEffect(()=>{setFindSequence(createRandomSequence(pool,64));setActive(0);setPerformance([])},[pool]);
  useEffect(()=>localStorage.setItem(PREFERENCES.profile,profile.id),[profile.id]);
  useEffect(()=>localStorage.setItem(PREFERENCES.staffLabels,String(staffLabels)),[staffLabels]);
  useEffect(()=>localStorage.setItem(PREFERENCES.harmonicaLabels,String(harmonicaLabels)),[harmonicaLabels]);
  useEffect(()=>localStorage.setItem(PREFERENCES.namingSystem,namingSystem),[namingSystem]);
  useEffect(()=>setActionFeedback(undefined),[profile.id]);
  const findEvents = useMemo<MelodyEvent[]>(()=>{
    const first=Math.max(0,active-4);
    return findSequence.slice(first,active+1).map((midi,index)=>{const round=first+index;return{id:`find-${round}`,kind:"note",startBeat:round,durationBeats:1,midi,writtenPitch:writtenPitchFromMidi(midi,round%2===1),measureIndex:Math.floor(round/4)}});
  },[active,findSequence]);
  const earExerciseMidis = earRevealed && earPlayed.length === EAR_TARGETS.length ? earPlayed : EAR_TARGETS;
  const earMelody = useMemo<Melody>(()=>({id:"ear-exercise",title:"Discovered ear phrase",tempoQpm:melody.tempoQpm,meter:{numerator:4,denominator:4},events:earExerciseMidis.map((midi,index)=>({id:`ear-${index}`,kind:"note",startBeat:index,durationBeats:1,midi,writtenPitch:writtenPitchFromMidi(midi),measureIndex:0}))}),[earExerciseMidis.join(","),melody.tempoQpm]);
  const exerciseMelody = mode === "ear" ? earMelody : mode === "rhythm" ? RHYTHM_MELODY : melody;
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
      setObservation(nextObservation); const now=performance.now();
      if(player.guard.isBlocked(now)){setFrame(null);microphone.current.resetTracker();segmenter.current.reset();return;}
      setFrame(next);
      if(next?.state==="stable")setTrace((value)=>[...value.filter((point)=>now-point.time<8_000),{time:next.time,midiFloat:next.midiFloat,clarity:next.clarity,rms:next.rms}]);
      const completed=segmenter.current.update(next,now,"microphone"); if(completed)submitRef.current(completed);
    }, deviceId || undefined).then((value)=>{setDiagnostics(value);void MicrophoneInput.devices().then(setMicDevices)}).catch((error: unknown) => { setMicError(error instanceof Error ? error.message : "Microphone unavailable"); setInput("virtual"); });
    return()=>microphone.current.stop();
  }, [input, deviceId]);

  const flash = (next: "hit"|"miss", text: string) => { setStatus(next); setMessage(text); window.setTimeout(() => setStatus("idle"), 520); };
  const addTimelinePerformance=(segment:InputNoteSegment,outcome:TimelinePerformance["outcome"])=>setPerformance((value)=>[...value.filter((item)=>performance.now()-item.startedAt<8_000),{id:segment.id,midi:segment.classifiedMidi,startedAt:segment.startedAt,durationMs:segment.durationMs,outcome}]);
  const advance = () => setActive((value)=>{ if(mode==="find"&&value>findSequence.length-8)setFindSequence((items)=>{const next=[...items];while(next.length<items.length+32)next.push(nextRandomPitch(pool,next));return next}); return mode==="find"?value+1:Math.min(value+1,targetNotes.length-1); });
  const submitSegment = (segment: InputNoteSegment, action?: HarmonicaAction) => {
    if (!target) return;
    if(practice==="flow"&&mode!=="find"){
      addTimelinePerformance(segment,"performed"); performed.current.push({...segment,startedAt:segment.startedAt-flowStart.current,stableStartedAt:segment.stableStartedAt-flowStart.current,endedAt:segment.endedAt-flowStart.current}); return;
    }
    setSession((value) => ({ ...value, attempts: value.attempts + 1 })); const midi=segment.classifiedMidi;
    if (mode === "ear"&&!earRevealed) { handleEar(midi); return; }
    if(mode==="rhythm"){
      const wanted=(target.durationBeats*60_000/RHYTHM_MELODY.tempoQpm), ratio=segment.durationMs/wanted, okay=ratio>=.65&&ratio<=1.4;
      addTimelinePerformance(segment,okay?"correct":"incorrect"); flash(okay?"hit":"miss",okay?"Rhythm matched · clean release":ratio<.65?"Hold a little longer":"Release a little sooner");
      if(okay){setSession((value)=>({attempts:value.attempts,hits:value.hits+1}));window.setTimeout(advance,280)} return;
    }
    const exactAction = mode === "find" && action ? action.canonicalMidi === target.midi : midi === target.midi;
    const centsOkay = !strict || Math.abs(segment.medianCentsFromEt - expectedOffset(midi)) <= 20;
    if (exactAction && centsOkay) {
      if(action){setActionFeedback({actionId:action.id,outcome:"correct"});window.setTimeout(()=>setActionFeedback(undefined),900)}
      addTimelinePerformance(segment,"correct"); flash("hit", `Hit · ${teachingNoteName(midi,namingSystem)}${segment.source === "microphone" ? ` · ${actionsForMidi(profile,midi).length} matching position${actionsForMidi(profile,midi).length===1?"":"s"}` : ""}`);
      setSession((value) => ({ attempts: value.attempts, hits: value.hits + 1 })); window.setTimeout(advance, 320);
    } else { if(action){setActionFeedback({actionId:action.id,outcome:"incorrect"});window.setTimeout(()=>setActionFeedback(undefined),900)} addTimelinePerformance(segment,"incorrect"); flash("miss", midi === target.midi ? "Right note · adjust intonation" : `${teachingNoteName(midi,namingSystem)} · ${midi < (target.midi ?? 0) ? "play higher" : "play lower"}`); window.setTimeout(()=>setPerformance((value)=>value.filter((item)=>item.id!==segment.id)),1400); }
  };
  submitRef.current=submitSegment;
  const handleEar = (midi: number) => {
    const acceptedTargets = earRelative && earPlayed.length ? relativeTargets(EAR_TARGETS, earPlayed[0]!) : EAR_TARGETS; const expected = acceptedTargets[earPlayed.length] ?? acceptedTargets.at(-1)!;
    if (earRelative && !earPlayed.length) { setEarPlayed([midi]); setActive(1); flash("hit", `Anchor locked at ${noteName(midi)} · phrase transposed`); return; }
    if (midi === expected) { const next = [...earPlayed, midi]; setEarPlayed(next); setActive(Math.min(next.length, EAR_TARGETS.length - 1)); flash("hit", next.length === EAR_TARGETS.length ? "Pitches found · choose Flow to perform the rhythm" : "Interval found"); if (next.length === EAR_TARGETS.length) setEarRevealed(true); }
    else { const candidate = [...earPlayed, midi], delta = !earRelative ? transpositionDelta(EAR_TARGETS, candidate) : null; flash("miss", delta && delta !== 0 ? `Intervals match · phrase is ${Math.abs(delta)} semitone${Math.abs(delta)===1?"":"s"} ${delta>0?"high":"low"}` : `${noteName(midi)} · target remains hidden`); }
  };
  const onVirtualStart=(action:HarmonicaAction)=>{void player.noteOn(action.id,action.canonicalMidi)};
  const onVirtualEnd = (action: HarmonicaAction, duration: number) => { player.noteOff(action.id); const ended=performance.now(); submitSegment(segmentFromVirtual(action.canonicalMidi,ended-duration,duration),action); };
  const listen = () => { microphone.current.resetTracker(); segmenter.current.reset(); if (mode === "find" && target?.midi !== undefined) void player.playNote(target.midi); else if (mode === "ear") void player.playMelody({...earMelody,events:EAR_TARGETS.map((midi,index)=>({id:`reference-${index}`,kind:"note",startBeat:index,durationBeats:1,midi,writtenPitch:writtenPitchFromMidi(midi),measureIndex:0}))}); else void player.playMelody(exerciseMelody); };
  const startFlow = () => { player.stop(); performed.current = []; setPerformance([]); setFlowResults([]); setActive(0); setMessage("Count in · 4 beats"); const beatMs=60_000/exerciseMelody.tempoQpm, begins=performance.now()+beatMs*4; flowStart.current=begins; const tick=()=>{ const progress=(performance.now()-begins)/beatMs; setFlow(Math.max(0,progress)); const next=targetNotes.findIndex((event)=>event.startBeat+event.durationBeats>progress);setActive(Math.max(0,Math.min(targetNotes.length-1,next<0?targetNotes.length-1:next))); const end=Math.max(...exerciseMelody.events.map((event)=>event.startBeat+event.durationBeats));if(progress<=end){flowTimer.current=requestAnimationFrame(tick)}else{setFlowResults(alignPerformance(exerciseMelody.events,performed.current,exerciseMelody.tempoQpm));setMessage(mode==="rhythm"?"Rhythm run complete · review timing and length":"Run complete · review separate scores below")}};flowTimer.current=requestAnimationFrame(tick); };
  const loadSong = (key: string, nextMode=pendingSongMode) => { const item=SONGS[key]!; setSongKey(key); setCustomAbc(item.abc); setMelody(parseAbc(item.abc,key)); resetMode(nextMode); setScreen("game"); };
  const resetMode = (next: Mode) => { setMode(next); setPractice(next==="guided"?"step":"step"); setActive(0); setEarPlayed([]); setEarRevealed(false); setPerformance([]); setTrace([]); setFlowResults([]); setMessage(next === "ear" ? "Listen first · pitches stay hidden" : next==="find"?"Read the staff, then play":next==="rhythm"?"Match each note length and rest":"Ready"); };
  const startMode = (next: Mode) => { if(next==="score"||next==="guided"){setPendingSongMode(next);setScreen("songs");return} resetMode(next); setScreen("game"); };
  const exitMode = () => { player.stop(); microphone.current.stop(); if (flowTimer.current) cancelAnimationFrame(flowTimer.current); setInput("virtual"); setScreen("menu"); };
  const stageBeat=practice==="flow"&&mode!=="find"?flow:sourceEvents[activeEventIndex]?.startBeat??0;
  const detectedMidis=frame?.state==="stable"&&frame.classifiedMidi!==undefined?[frame.classifiedMidi]:[];
  const guideMidis=mode==="guided"&&target?.midi!==undefined?[target.midi]:[];
  const playerSetup=<PlayerSetup profileId={profile.id} setProfileId={setProfileId} staffLabels={staffLabels} setStaffLabels={setStaffLabels} harmonicaLabels={harmonicaLabels} setHarmonicaLabels={setHarmonicaLabels} namingSystem={namingSystem} setNamingSystem={setNamingSystem}/>;
  const settings=<SettingsDrawer strict={strict} setStrict={setStrict} diagnostics={diagnostics} onClose={()=>setShowSettings(false)}/>;

  if (screen === "menu") return <MainMenu onStart={startMode} onSettings={()=>setShowSettings(true)} profile={profile} settings={showSettings ? settings : null}/>;
  if (screen === "songs") return <SongLibrary mode={pendingSongMode} selected={songKey} onChoose={loadSong} onBack={()=>setScreen("menu")}/>;

  const modeCopy:Record<Mode,[string,string,string]>={find:["NOTE QUEST","Find the note","Read the target, then find its exact position."],score:["SCORE RUN","Play the score","Follow the notation one note at a time or perform the full run."],ear:["EAR MISSION","Play it by ear","Listen to the phrase and discover each interval."],rhythm:["RHYTHM LAB","Rhythm training","Match starts, holds, releases, and rests on one friendly pitch."],guided:["SONG GUIDE","Learn a song","Follow the highlighted note and harmonica position. Nothing is hidden."]};
  const copy=modeCopy[mode];
  return <div className={`app-shell game-shell mode-${mode}`}><header className="game-header"><button className="menu-exit" onClick={exitMode}><span>←</span> Menu</button><div className="game-brand"><span className="brand-mark">H</span><span><b>HARMONICA</b><small>TRAINER</small></span></div><div className="session-stats"><span><b>{session.hits}</b><small>HITS</small></span><span><b>{session.attempts ? Math.round(session.hits/session.attempts*100):100}%</b><small>ACCURACY</small></span></div><button className="icon-button" aria-label="Settings" onClick={()=>setShowSettings(!showSettings)}>⚙</button></header>
    <main className="play-scene"><div className="mode-strip"><div><span className="eyebrow">{copy[0]}</span><h1>{copy[1]}</h1><p>{copy[2]}</p></div><span className={`feedback-chip ${status}`}>{status==="hit"?"✓":status==="miss"?"↕":"◇"} {message}</span></div>
      <div className="toolbar"><div className="segmented" aria-label="Input source"><button className={input==="virtual"?"active":""} onClick={()=>setInput("virtual")}>Touch</button><button className={input==="microphone"?"active":""} onClick={()=>setInput("microphone")}>Microphone + touch</button></div>{mode!=="find"&&<div className="segmented" aria-label="Practice style"><button className={practice==="step"?"active":""} onClick={()=>setPractice("step")}>Step</button><button className={practice==="flow"?"active":""} disabled={mode==="ear"&&!earRevealed} onClick={()=>setPractice("flow")}>In time</button></div>}{mode==="ear"&&<div className="segmented" aria-label="Ear mode"><button className={!earRelative?"active":""} onClick={()=>{setEarRelative(false);setEarPlayed([]);setActive(0);setEarRevealed(false)}}>Absolute</button><button className={earRelative?"active":""} onClick={()=>{setEarRelative(true);setEarPlayed([]);setActive(0);setEarRevealed(false)}}>Relative</button></div>}<button className="listen" onClick={listen}><span>▶</span> Listen</button>{practice==="flow"&&mode!=="find"&&<button className="primary" onClick={startFlow}>Count in + perform</button>}</div>
      {mode==="find"&&<div className="find-setup"><label>Range<select aria-label="Find note range" value={findRange} onChange={(event)=>setFindRange(event.target.value as FindRange)}><option value="beginner">Beginner · C4–C5</option><option value="medium">Medium · C4–C6</option><option value="full">Full {profile.holeCount}-hole range</option></select></label><label>Notes<select aria-label="Accidentals" value={accidentals} onChange={(event)=>setAccidentals(event.target.value as AccidentalMode)}><option value="naturals">Naturals only</option><option value="accidentals">Mix in accidentals</option><option value="chromatic">Full chromatic</option></select></label><span>{pool.length} possible pitches · anti-repeat shuffle</span></div>}
      {(mode==="score"||mode==="guided")&&<div className="score-source"><button className="song-change" onClick={()=>{setPendingSongMode(mode);setScreen("songs")}}>♫ {melody.title} <span>Change song →</span></button><details><summary>Import ABC</summary><textarea value={customAbc} onChange={(event)=>setCustomAbc(event.target.value)}/><button onClick={()=>{try{setMelody(parseAbc(customAbc));setActive(0)}catch(error){setMessage(error instanceof Error?error.message:"Invalid ABC")}}}>Load monody</button></details><label>Tempo <input type="range" min="50" max="160" value={melody.tempoQpm} onChange={(event)=>setMelody((value)=>({...value,tempoQpm:Number(event.target.value)}))}/>{melody.tempoQpm} BPM</label></div>}
      <GameStage events={sourceEvents} activeIndex={activeEventIndex} hidden={mode==="ear"&&!earRevealed} currentBeat={stageBeat} trace={trace} performance={renderedPerformance} nowMs={input==="microphone"||practice==="flow"?performance.now():performanceNow(trace,renderedPerformance)} status={status} title={mode==="score"||mode==="guided"?melody.title:mode==="ear"?(earRevealed?"Discovered phrase":"Hidden phrase"):mode==="rhythm"?"Read the rhythm · pitch stays on C":"Read the target · answer hidden"} showNoteNames={staffLabels} namingSystem={namingSystem} pixelsPerBeat={mode==="find"?48:undefined}/>
      {input === "microphone" && <section className="input-deck compact-mic">{micDevices.length > 1 && <label className="device-select">Input device <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="">System default</option>{micDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label>}<Tuner frame={frame} observation={observation} message={micError} expectedOffset={expectedOffset(frame?.classifiedMidi)}/><div className="mic-actions"><button onClick={()=>microphone.current.recalibrate()}>Recalibrate</button><span>Mic pitch lights every matching position below</span></div></section>}
      <VirtualHarmonica profile={profile} onStart={onVirtualStart} onEnd={onVirtualEnd} showLabels={harmonicaLabels} namingSystem={namingSystem} detectedMidis={detectedMidis} guideMidis={guideMidis} feedback={actionFeedback}/>
      {playerSetup}
      {mode==="ear"&&<div className="ear-tools"><button onClick={()=>setMessage(earPlayed.length?`Next interval: ${EAR_TARGETS[earPlayed.length]! - EAR_TARGETS[Math.max(0,earPlayed.length-1)]! >= 0?"up":"down"}`:"Replay the reference")}>Hint</button><button onClick={()=>{setEarRevealed(true);setEarPlayed(earRelative&&earPlayed.length?relativeTargets(EAR_TARGETS,earPlayed[0]!):EAR_TARGETS);setMessage("Revealed · exercise marked assisted")}}>Reveal</button><span>{earPlayed.length}/{EAR_TARGETS.length} pitches found</span></div>}
      {!!flowResults.length&&<Review rows={flowResults} rhythm={mode==="rhythm"}/>} {showSettings&&settings}
    </main></div>;
}

function MainMenu({onStart,onSettings,settings,profile}:{onStart:(mode:Mode)=>void;onSettings:()=>void;settings:ReactNode;profile:HarmonicaProfile}) {
  const modes: {id:Mode;number:string;title:string;description:string;symbol:string}[] = [
    {id:"find",number:"01",title:"Find a note",description:"Randomized staff-to-instrument challenge",symbol:"♪"},
    {id:"score",number:"02",title:"Play the score",description:"Read pitch and rhythm in step or flow",symbol:"♫"},
    {id:"ear",number:"03",title:"Play by ear",description:"Hear the phrase and discover it",symbol:"◖"},
    {id:"rhythm",number:"04",title:"Rhythm training",description:"Practice starts, holds, releases, and rests",symbol:"♩"},
    {id:"guided",number:"05",title:"Learn a song",description:"Beginner guidance with every answer visible",symbol:"→"},
  ];
  return <div className="main-menu"><div className="menu-aurora" aria-hidden="true"/><header className="menu-header"><div className="menu-brand"><span className="brand-mark">H</span><span><b>HARMONICA</b><small>TRAINER</small></span></div><div className="menu-tools"><a href="?lab=pitch">Labs</a><button className="icon-button" aria-label="Settings" onClick={onSettings}>⚙</button></div></header><main className="menu-content"><div className="menu-copy"><span className="eyebrow">YOUR INSTRUMENT · YOUR GAME</span><h1>Train your ear.<br/><em>Own the score.</em></h1><p>Choose a challenge and turn the chromatic harmonica into muscle memory.</p></div><div className="mode-select" aria-label="Choose a game mode"><span className="select-label">SELECT MODE</span>{modes.map((item)=><button key={item.id} className={`mode-choice ${item.id}`} onClick={()=>onStart(item.id)}><span className="mode-number">{item.number}</span><span className="mode-symbol" aria-hidden="true">{item.symbol}</span><span className="mode-copy"><b>{item.title}</b><small>{item.description}</small></span><span className="mode-play">PLAY <i>→</i></span></button>)}</div></main><footer className="menu-footer"><span>STANDARD C · {profile.holeCount} HOLES · A4 440 HZ</span><span>LOCAL AUDIO · NO UPLOADS</span></footer>{settings}</div>;
}

function SongLibrary({mode,selected,onChoose,onBack}:{mode:"score"|"guided";selected:string;onChoose:(key:string)=>void;onBack:()=>void}) {
  return <div className="song-library"><header><button className="menu-exit" onClick={onBack}>← Main menu</button><span className="eyebrow">SONG LIBRARY</span><span/></header><main><div className="library-copy"><span className="eyebrow">{mode==="guided"?"BEGINNER GUIDANCE":"SCORE PRACTICE"}</span><h1>Choose your song</h1><p>{mode==="guided"?"Every note and matching harmonica position will be highlighted as you go.":"Choose a melody, then practice it step-by-step or in time."}</p></div><div className="song-grid">{Object.entries(SONGS).map(([key,song],index)=>{const parsed=parseAbc(song.abc,key),notes=parsed.events.filter((event)=>event.kind==="note").length;return <button key={key} className={`song-card ${key===selected?"selected":""}`} onClick={()=>onChoose(key)}><span className="song-index">{String(index+1).padStart(2,"0")}</span><span className="song-symbol">♫</span><b>{song.title}</b><small>{parsed.meter.numerator}/{parsed.meter.denominator} · {parsed.tempoQpm} BPM · {notes} notes</small><i>{key===selected?"CURRENT":"CHOOSE"} →</i></button>})}</div></main></div>;
}

function PlayerSetup({profileId,setProfileId,staffLabels,setStaffLabels,harmonicaLabels,setHarmonicaLabels,namingSystem,setNamingSystem}:{profileId:string;setProfileId:(value:string)=>void;staffLabels:boolean;setStaffLabels:(value:boolean)=>void;harmonicaLabels:boolean;setHarmonicaLabels:(value:boolean)=>void;namingSystem:NamingSystem;setNamingSystem:(value:NamingSystem)=>void}) {
  return <section className="player-setup" aria-label="Player setup">
    <fieldset className="instrument-control"><legend>INSTRUMENT</legend><div className="choice-row" role="group" aria-label="Instrument">{HARMONICA_PROFILES.map((item)=><button key={item.id} className={profileId===item.id?"active":""} aria-pressed={profileId===item.id} aria-label={`Instrument: ${item.holeCount} holes`} onClick={()=>setProfileId(item.id)}><b>{item.holeCount} holes</b><small>{item.holeCount}-hole chromatic</small></button>)}</div></fieldset>
    <fieldset className="learning-aids"><legend>LEARNING AIDS</legend><div className="aid-control"><span>Staff note names</span><div className="choice-row compact" role="group" aria-label="Staff note names"><button className={!staffLabels?"active":""} aria-pressed={!staffLabels} onClick={()=>setStaffLabels(false)}>Off</button><button className={staffLabels?"active":""} aria-pressed={staffLabels} onClick={()=>setStaffLabels(true)}>On</button></div></div><div className="aid-control"><span>Harmonica note names</span><div className="choice-row compact" role="group" aria-label="Harmonica note names"><button className={!harmonicaLabels?"active":""} aria-pressed={!harmonicaLabels} onClick={()=>setHarmonicaLabels(false)}>Off</button><button className={harmonicaLabels?"active":""} aria-pressed={harmonicaLabels} onClick={()=>setHarmonicaLabels(true)}>On</button></div></div><div className="aid-control"><span>Note naming</span><div className="choice-row compact naming" role="group" aria-label="Note naming"><button className={namingSystem==="letters"?"active":""} aria-pressed={namingSystem==="letters"} onClick={()=>setNamingSystem("letters")}>Letters <small>C D E</small></button><button className={namingSystem==="solfege"?"active":""} aria-pressed={namingSystem==="solfege"} onClick={()=>setNamingSystem("solfege")}>Solfège <small>Do Re Mi</small></button></div></div></fieldset>
  </section>;
}

function SettingsDrawer({strict,setStrict,diagnostics,onClose}:{strict:boolean;setStrict:(value:boolean)=>void;diagnostics?:MicrophoneDiagnostics;onClose:()=>void}) {
  return <aside className="settings-drawer"><button className="close" aria-label="Close settings" onClick={onClose}>×</button><span className="eyebrow">ADVANCED</span><h2>Audio & diagnostics</h2><label><input type="checkbox" checked={strict} onChange={(event)=>setStrict(event.target.checked)}/> Strict intonation ±20¢</label><p>Instrument and learning-aid controls are directly below the harmonica during training.</p><a href="?lab=calibration">Instrument calibration →</a><a href="?lab=fixtures">Fixture recorder →</a><a href="?lab=timing">Timing calibration →</a><pre>{JSON.stringify({...diagnostics,...player.diagnostics},null,2)}</pre></aside>;
}

function Review({rows,rhythm=false}:{rows:ReturnType<typeof alignPerformance>;rhythm?:boolean}) { const score=(key:"pitch"|"timing"|"length"|"stability"|"intonation")=>Math.round(rows.reduce((sum,row)=>sum+row[key],0)/Math.max(1,rows.length)); return <section className={`review ${rhythm?"rhythm-review":""}`}>{!rhythm&&<div><span>Notes</span><b>{score("pitch")}%</b></div>}<div><span>Timing</span><b>{score("timing")}%</b></div><div><span>Length</span><b>{score("length")}%</b></div>{!rhythm&&<><div><span>Stability</span><b>{score("stability")}%</b></div><div><span>Intonation</span><b>{score("intonation")}%</b></div></>}</section> }
function segmentFromVirtual(midi:number,startedAt:number,durationMs:number):InputNoteSegment{return{id:`virtual-${startedAt}`,source:"virtual-harmonica",startedAt,stableStartedAt:startedAt,endedAt:startedAt+durationMs,durationMs,medianFrequencyHz:0,medianMidiFloat:midi,classifiedMidi:midi,medianCentsFromEt:0,centsVariability:0,medianClarity:1,medianRms:1,pitchTrace:[]}}
function performanceNow(trace:PitchTracePoint[],items:TimelinePerformance[]):number{return trace.at(-1)?.time??items.at(-1)?.startedAt??performance.now()}
function readBooleanPreference(key:string,fallback:boolean):boolean{const value=localStorage.getItem(key);return value===null?fallback:value==="true"}
