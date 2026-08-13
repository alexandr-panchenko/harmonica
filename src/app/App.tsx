import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MusicStage } from "../notation/abc/AbcRenderer";
import { adaptAbc } from "../notation/abc/AbcAdapter";
import { generatedExerciseToAbc } from "../notation/abc/generatedExerciseToAbc";
import { HarmonicaStage } from "../harmonica-ui/HarmonicaStage";
import { planFingerings } from "../harmonica-ui/fingeringPlanner";
import { Tuner } from "../components/Tuner";
import { ThemeControl } from "../components/ThemeControl";
import { MicrophoneInput, type MicrophoneDiagnostics, type MicrophoneObservation } from "../audio/MicrophoneInput";
import type { MicrophoneFrameBundle } from "../audio/LivePitchState";
import { PlaybackEngine } from "../audio/PlaybackEngine";
import { NoteSegmenter, type MicrophoneSensitivity, type TrackerFrame } from "../audio/tracking";
import { SONGS, parseAbc, type Melody, type MelodyEvent } from "../music/melody";
import { HARMONICA_PROFILES, STANDARD_C12, actionsForMidi, type HarmonicaAction, type HarmonicaProfile } from "../harmonica/profile";
import { noteName } from "../music/pitch";
import { teachingNoteName, type NamingSystem } from "../music/naming";
import { writtenPitchFromMidi } from "../notation/layout";
import { alignPerformance, relativeTargets, transpositionDelta, type InputNoteSegment, type PitchTracePoint } from "../exercises/evaluation";
import { createRandomSequence, findPitchPool, nextRandomPitch, type AccidentalMode, type FindRange } from "../exercises/findGenerator";
import { PracticeTransport } from "../practice/PracticeTransport";
import { StepPracticeEngine } from "../practice/StepPracticeEngine";
import { RealtimePerformanceEngine } from "../practice/RealtimePerformanceEngine";
import type { MistakePolicy, PracticeMode, PracticeSignal, PracticeTransportState } from "../practice/practiceTypes";
import { generateRandomPhrase } from "../exercises/ear/phraseGenerator";
import { songExcerpt } from "../exercises/ear/songExcerpt";
import { generateRhythm, RHYTHM_PRESETS, type RhythmDifficulty, type RhythmMeter, type RhythmSettings } from "../exercises/rhythm/rhythmGenerator";
import { ControlDock, ControlGroup, CompactField, SettingsPopover } from "../practice-ui/ControlDock";
import { PracticeWorkspace } from "../practice-ui/PracticeWorkspace";
import { MusicTransportControls } from "../practice-ui/MusicTransportControls";
import type { PracticeEventVisuals } from "../notation/abc/practiceEventState";
import { referencePreview } from "../practice/referencePreview";

type Mode = "find" | "song" | "ear" | "rhythm";
type Screen = "menu" | "songs" | "game";
type Input = "virtual" | "microphone";
type Practice = PracticeMode;
interface TimelinePerformance { id:string; midi:number; startedAt:number; durationMs:number; outcome:"correct"|"incorrect"|"performed" }
type ReferencePlaybackView = {status:"idle"|"starting"|"playing"|"complete";positionBeat:number};
const player = new PlaybackEngine();
const PREFERENCES = {
  profile: "harmonica-profile",
  staffLabels: "harmonica-staff-note-names",
  harmonicaLabels: "harmonica-instrument-note-names",
  namingSystem: "harmonica-note-naming",
  input: "harmonica-input-source",
  sensitivity: "harmonica-microphone-sensitivity",
  device: "harmonica-microphone-device",
  fingering: "harmonica-song-fingering",
  mistakePolicy:"harmonica-song-mistake-policy",
} as const;

const DEFAULT_RHYTHM_SETTINGS:RhythmSettings={meter:"4/4",measures:2,difficulty:"easy",tempoQpm:88,allowedValues:[.5,1,2],allowRests:true,pitchPolicy:"any",fixedMidi:60};

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<Mode>("find"), [input, setInput] = useState<Input>(()=>localStorage.getItem(PREFERENCES.input)==="virtual"?"virtual":"microphone"), [practice, setPractice] = useState<Practice>("step");
  const [micEnabled,setMicEnabled]=useState(false);
  const [active, setActive] = useState(0), [status, setStatus] = useState<"idle"|"hit"|"miss">("idle"), [message, setMessage] = useState("Read the staff, then play");
  const [frame, setFrame] = useState<TrackerFrame|null>(null), [micBundle,setMicBundle]=useState<MicrophoneFrameBundle>(), [observation,setObservation]=useState<MicrophoneObservation>(), [trace, setTrace] = useState<PitchTracePoint[]>([]), [renderedPerformance,setPerformance]=useState<TimelinePerformance[]>([]);
  const [micError, setMicError] = useState(""), [diagnostics, setDiagnostics] = useState<MicrophoneDiagnostics>(), [micDevices,setMicDevices]=useState<MediaDeviceInfo[]>([]), [deviceId,setDeviceId]=useState(()=>localStorage.getItem(PREFERENCES.device)??""), [sensitivity,setSensitivity]=useState<MicrophoneSensitivity>(()=>{const value=localStorage.getItem(PREFERENCES.sensitivity);return value==="high"||value==="low"?value:"normal"});
  const [strict, setStrict] = useState(false), [songKey, setSongKey] = useState("twinkle"), [customAbc, setCustomAbc] = useState(SONGS.twinkle!.abc), [melody, setMelody] = useState(() => parseAbc(SONGS.twinkle!.abc, "twinkle"));
  const [flowResults, setFlowResults] = useState<ReturnType<typeof alignPerformance>>([]), [earRelative, setEarRelative] = useState(true), [earRevealed, setEarRevealed] = useState(false), [earPlayed, setEarPlayed] = useState<number[]>([]), [earSource,setEarSource]=useState<"random"|"song">("random"), [earAssisted,setEarAssisted]=useState(false), [earSkipped,setEarSkipped]=useState(false);
  const [showFingering,setShowFingering]=useState(()=>readBooleanPreference(PREFERENCES.fingering,true)),[mistakePolicy,setMistakePolicy]=useState<MistakePolicy>(()=>{const value=localStorage.getItem(PREFERENCES.mistakePolicy);return value==="restart-note"||value==="restart-measure"?value:"pause"}),[stepEventIndex,setStepEventIndex]=useState(0);
  const [rhythmSettings,setRhythmSettings]=useState<RhythmSettings>(DEFAULT_RHYTHM_SETTINGS),[rhythmSource,setRhythmSource]=useState<"generated"|"preset">("generated");
  const [session, setSession] = useState({ hits: 0, attempts: 0 }), [showSettings, setShowSettings] = useState(false);
  const [playbackStatus,setPlaybackStatus]=useState(player.diagnostics);
  const [staffLabels,setStaffLabels]=useState(()=>readBooleanPreference(PREFERENCES.staffLabels, false));
  const [harmonicaLabels,setHarmonicaLabels]=useState(()=>readBooleanPreference(PREFERENCES.harmonicaLabels, false));
  const [namingSystem,setNamingSystem]=useState<NamingSystem>(()=>localStorage.getItem(PREFERENCES.namingSystem)==="solfege"?"solfege":"letters");
  const [findRange,setFindRange]=useState<FindRange>("beginner"), [accidentals,setAccidentals]=useState<AccidentalMode>("naturals");
  const [profileId,setProfileId]=useState(()=>HARMONICA_PROFILES.some((item)=>item.id===localStorage.getItem(PREFERENCES.profile))?localStorage.getItem(PREFERENCES.profile)!:STANDARD_C12.id);
  const [actionFeedback,setActionFeedback]=useState<{actionId:string;outcome:"correct"|"incorrect"}>();
  const profile = HARMONICA_PROFILES.find((item)=>item.id===profileId) ?? STANDARD_C12;
  const pool = useMemo(()=>findPitchPool(profile,findRange,accidentals),[profile,findRange,accidentals]);
  const [findSequence,setFindSequence]=useState(()=>createRandomSequence(findPitchPool(STANDARD_C12,"beginner","naturals"),64));
  const [earPhrase,setEarPhrase]=useState(()=>generateRandomPhrase(STANDARD_C12,{length:4,maxInterval:5,tempoQpm:92}));
  const [rhythmMelody,setRhythmMelody]=useState(()=>generateRhythm(DEFAULT_RHYTHM_SETTINGS));
  const microphone = useRef(new MicrophoneInput(sensitivity)), segmenter=useRef(new NoteSegmenter()), performed = useRef<InputNoteSegment[]>([]), takeStartedAt=useRef(0), submitRef=useRef<(segment:InputNoteSegment,action?:HarmonicaAction)=>void>(()=>{}), liveAcceptRef=useRef<(midi:number)=>void>(()=>{});
  const transport=useRef(new PracticeTransport([],100)),stepEngine=useRef(new StepPracticeEngine([])),realtimeEngine=useRef(new RealtimePerformanceEngine([],100)),signalRef=useRef<PracticeSignal>({sounding:false,articulation:0}),acceptedWasPresent=useRef(false),acceptedConsumed=useRef(false);
  const [transportState,setTransportState]=useState<PracticeTransportState>(transport.current.state);
  const [referencePlayback,setReferencePlayback]=useState<ReferencePlaybackView>({status:"idle",positionBeat:0}),referenceActive=useRef(false),referencePosition=useRef(0);

  useEffect(()=>{setFindSequence(createRandomSequence(pool,64));setActive(0);setPerformance([])},[pool]);
  useEffect(()=>localStorage.setItem(PREFERENCES.profile,profile.id),[profile.id]);
  useEffect(()=>localStorage.setItem(PREFERENCES.staffLabels,String(staffLabels)),[staffLabels]);
  useEffect(()=>localStorage.setItem(PREFERENCES.harmonicaLabels,String(harmonicaLabels)),[harmonicaLabels]);
  useEffect(()=>localStorage.setItem(PREFERENCES.namingSystem,namingSystem),[namingSystem]);
  useEffect(()=>localStorage.setItem(PREFERENCES.input,input),[input]);
  useEffect(()=>{localStorage.setItem(PREFERENCES.sensitivity,sensitivity);microphone.current.setSensitivity(sensitivity)},[sensitivity]);
  useEffect(()=>localStorage.setItem(PREFERENCES.device,deviceId),[deviceId]);
  useEffect(()=>localStorage.setItem(PREFERENCES.fingering,String(showFingering)),[showFingering]);
  useEffect(()=>localStorage.setItem(PREFERENCES.mistakePolicy,mistakePolicy),[mistakePolicy]);
  useEffect(()=>setActionFeedback(undefined),[profile.id]);
  useEffect(()=>window.scrollTo({top:0,left:0,behavior:"instant"}),[screen,mode]);
  const findEvents = useMemo<MelodyEvent[]>(()=>{const midi=findSequence[active]??findSequence[0]!;return[{id:`find-${active}`,kind:"note",startBeat:0,durationBeats:1,midi,writtenPitch:writtenPitchFromMidi(midi,active%2===1),measureIndex:0}]},[active,findSequence]);
  const earTargets=earPhrase.events.filter(event=>event.kind==="note").map(event=>event.midi!);
  const earExerciseMidis = earRevealed && earPlayed.length === earTargets.length ? earPlayed : earTargets;
  const earMelody = useMemo<Melody>(()=>({...earPhrase,events:earPhrase.events.map((event,index)=>event.kind==="note"?{...event,midi:earExerciseMidis[index]??event.midi,writtenPitch:writtenPitchFromMidi(earExerciseMidis[index]??event.midi!)}:event)}),[earPhrase,earExerciseMidis.join(",")]);
  const exerciseMelody = mode === "ear" ? earMelody : mode === "rhythm" ? rhythmMelody : melody;
  const sourceEvents = mode === "find" ? findEvents : exerciseMelody.events;
  const targetNotes = sourceEvents.filter((event) => event.kind === "note");
  const transportEventIndex=Math.max(0,sourceEvents.findIndex(event=>transportState.positionBeat>=event.startBeat&&transportState.positionBeat<event.startBeat+event.durationBeats));
  const activeEventIndex=mode==="find"?0:mode==="ear"&&!earRevealed?Math.max(0,sourceEvents.findIndex(event=>event.id===targetNotes[Math.min(active,targetNotes.length-1)]?.id)):practice==="step"?stepEventIndex:transportEventIndex;
  const target=sourceEvents[activeEventIndex]??sourceEvents.at(-1);
  const calibrationSamples = useMemo(() => JSON.parse(localStorage.getItem("harmonica-calibration-samples") ?? "{}") as Record<number, number[]>, [showSettings]);
  const expectedOffset = (midi?: number) => { const values = midi === undefined ? [] : calibrationSamples[midi] ?? []; const sorted = [...values].sort((a,b)=>a-b); return sorted[Math.floor(sorted.length/2)] ?? 0; };

  useEffect(() => () => { microphone.current.stop(); player.stop(); }, []);
  useEffect(()=>{let animation=0;const tick=()=>{if(referenceActive.current){const snapshot=player.referenceSnapshot();referencePosition.current=snapshot.positionBeat;if(snapshot.status==="complete"){referenceActive.current=false;setReferencePlayback({status:"complete",positionBeat:snapshot.positionBeat});setMessage("Example complete · listen again when ready")}else if(snapshot.status==="playing")setReferencePlayback({status:"playing",positionBeat:snapshot.positionBeat})}animation=requestAnimationFrame(tick)};animation=requestAnimationFrame(tick);return()=>cancelAnimationFrame(animation)},[]);
  useEffect(()=>{player.stopReferencePlayback();referenceActive.current=false;referencePosition.current=0;setReferencePlayback({status:"idle",positionBeat:0})},[screen,mode,practice,exerciseMelody.id,exerciseMelody.events,exerciseMelody.tempoQpm,target?.id]);
  useEffect(() => {
    if (input !== "microphone"||!micEnabled) { microphone.current.stop(); setFrame(null); setMicBundle(undefined); setObservation(undefined); return; }
    segmenter.current.reset(); setMicError("");
    void microphone.current.start((bundle, nextObservation) => {
      setObservation(nextObservation); setMicBundle(bundle); const now=bundle.time;
      if(player.guard.isBlocked(now)){setFrame(null);microphone.current.resetTracker();segmenter.current.reset();signalRef.current={...signalRef.current,sounding:false};return;}
      setFrame(bundle.display??null);
      signalRef.current={midi:bundle.accepted?.classifiedMidi,sounding:Boolean(bundle.accepted),articulation:signalRef.current.articulation};
      if(bundle.accepted&&!acceptedWasPresent.current){acceptedWasPresent.current=true;acceptedConsumed.current=false;signalRef.current={...signalRef.current,articulation:signalRef.current.articulation+1};}
      if(!bundle.accepted){acceptedWasPresent.current=false;acceptedConsumed.current=false;}
      if(bundle.accepted&&!acceptedConsumed.current&&(mode==="find"||(mode==="ear"&&!earRevealed))){acceptedConsumed.current=true;liveAcceptRef.current(bundle.accepted.classifiedMidi);}
      if(bundle.display)setTrace((value)=>[...value.filter((point)=>now-point.time<8_000),{time:now,midiFloat:bundle.display!.midiFloat,clarity:bundle.display!.clarity,rms:bundle.display!.rms}]);
      const completed=segmenter.current.update(bundle.accepted??null,now,"microphone"); if(completed)submitRef.current(completed);
    }, deviceId || undefined).then((value)=>{setDiagnostics(value);void MicrophoneInput.devices().then(setMicDevices)}).catch((error: unknown) => { setMicError(error instanceof Error ? error.message : "Microphone unavailable"); setInput("virtual"); });
    return()=>microphone.current.stop();
  }, [input, micEnabled, deviceId, mode, earRevealed]);

  const flash = (next: "hit"|"miss", text: string) => { setStatus(next); setMessage(text); window.setTimeout(() => setStatus("idle"), 520); };
  const addTimelinePerformance=(segment:InputNoteSegment,outcome:TimelinePerformance["outcome"])=>setPerformance((value)=>[...value.filter((item)=>performance.now()-item.startedAt<8_000),{id:segment.id,midi:segment.classifiedMidi,startedAt:segment.startedAt,durationMs:segment.durationMs,outcome}]);
  const advance = () => setActive((value)=>{ if(mode==="find"&&value>findSequence.length-8)setFindSequence((items)=>{const next=[...items];while(next.length<items.length+32)next.push(nextRandomPitch(pool,next));return next}); return mode==="find"?value+1:Math.min(value+1,targetNotes.length-1); });
  const submitSegment = (segment: InputNoteSegment, action?: HarmonicaAction) => {
    if (!target) return;
    if(practice==="realtime"&&mode!=="find"){
      addTimelinePerformance(segment,"performed"); const offsetMs=transport.current.state.startBeat*60_000/exerciseMelody.tempoQpm,relative={...segment,startedAt:segment.startedAt-takeStartedAt.current+offsetMs,stableStartedAt:segment.stableStartedAt-takeStartedAt.current+offsetMs,endedAt:segment.endedAt-takeStartedAt.current+offsetMs};performed.current.push(relative);realtimeEngine.current.record(relative); return;
    }
    if(mode!=="find"&&!(mode==="ear"&&!earRevealed))return;
    setSession((value) => ({ ...value, attempts: value.attempts + 1 })); const midi=segment.classifiedMidi;
    if (mode === "ear"&&!earRevealed) { handleEar(midi); return; }
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
    const acceptedTargets = earRelative && earPlayed.length ? relativeTargets(earTargets, earPlayed[0]!) : earTargets; const expected = acceptedTargets[earPlayed.length] ?? acceptedTargets.at(-1)!;
    if (earRelative && !earPlayed.length) { setEarPlayed([midi]); setActive(1); flash("hit", `Anchor locked at ${noteName(midi)} · phrase transposed`); return; }
    if (midi === expected) { const next = [...earPlayed, midi]; setEarPlayed(next); setActive(Math.min(next.length, earTargets.length - 1)); flash("hit", next.length === earTargets.length ? "Pitches found · perform the phrase in rhythm when ready" : "Interval found"); if (next.length === earTargets.length) setEarRevealed(true); }
    else { const candidate = [...earPlayed, midi], delta = !earRelative ? transpositionDelta(earTargets, candidate) : null; flash("miss", delta && delta !== 0 ? `Intervals match · phrase is ${Math.abs(delta)} semitone${Math.abs(delta)===1?"":"s"} ${delta>0?"high":"low"}` : `${noteName(midi)} · target remains hidden`); }
  };
  liveAcceptRef.current=(midi)=>{if(mode==="ear"&&!earRevealed)handleEar(midi);else submitSegment(segmentFromVirtual(midi,performance.now()-180,180,"microphone"));};
  const stopReferencePlayback=()=>{player.stopReferencePlayback();referenceActive.current=false;setReferencePlayback({status:"idle",positionBeat:referencePosition.current});setTransportState({...transport.current.state})};
  const onVirtualStart=(action:HarmonicaAction)=>{if(referenceActive.current)stopReferencePlayback();signalRef.current={midi:action.canonicalMidi,sounding:true,articulation:signalRef.current.articulation+1};setPlaybackStatus(player.diagnostics);void player.noteOn(action.id,action.canonicalMidi).finally(()=>setPlaybackStatus(player.diagnostics))};
  const onVirtualEnd = (action: HarmonicaAction, duration: number) => { player.noteOff(action.id); const ended=performance.now(); submitSegment(segmentFromVirtual(action.canonicalMidi,ended-duration,duration),action);signalRef.current={...signalRef.current,sounding:false,midi:undefined}; };
  const listen = () => {
    if(referenceActive.current){stopReferencePlayback();setMessage("Example stopped");return}
    const practiceState=transport.current.state;if(practiceState.status==="playing"||practiceState.status==="count-in")setTransportState({...transport.current.pause()});
    microphone.current.resetTracker();segmenter.current.reset();setPlaybackStatus(player.diagnostics);referenceActive.current=true;
    const previewMelody:Melody=mode==="find"&&target?.midi!==undefined?{id:`find-reference-${target.id}`,title:"Find note",tempoQpm:80,meter:{numerator:4,denominator:4},events:[{...target,startBeat:0,durationBeats:1}]}:exerciseMelody;
    const requestedBeat=mode==="find"?0:referencePlayback.status==="complete"?referencePlayback.positionBeat:transport.current.state.positionBeat;referencePosition.current=requestedBeat;setReferencePlayback({status:"starting",positionBeat:requestedBeat});setMessage("Loading sampled harmonica…");
    void player.startReferencePlayback(previewMelody,requestedBeat).then(session=>{if(!session||!referenceActive.current)return;referencePosition.current=session.state.startedAtBeat;setReferencePlayback({status:"playing",positionBeat:session.state.startedAtBeat});setMessage("Playing example · score follows the audio clock")}).finally(()=>setPlaybackStatus(player.diagnostics));
  };
  const referenceLabel=(idle:string)=>referencePlayback.status==="starting"||referencePlayback.status==="playing"?"■ Stop":referencePlayback.status==="complete"?"▶ Listen again":idle;
  const retryPlayback=()=>{setPlaybackStatus(player.diagnostics);void player.preload().catch(()=>{}).finally(()=>setPlaybackStatus(player.diagnostics))};
  useEffect(()=>{
    if(mode==="find")return;
    transport.current=new PracticeTransport(exerciseMelody.events,exerciseMelody.tempoQpm,practice);
    stepEngine.current=new StepPracticeEngine(exerciseMelody.events,mistakePolicy);
    realtimeEngine.current=new RealtimePerformanceEngine(exerciseMelody.events,exerciseMelody.tempoQpm);
    setStepEventIndex(0);setTransportState(transport.current.state);performed.current=[];setFlowResults([]);
  },[mode,exerciseMelody.id,exerciseMelody.events,exerciseMelody.tempoQpm,practice,mistakePolicy]);
  useEffect(()=>{
    const inputReady=input==="virtual"||(input==="microphone"&&micEnabled);
    if(screen==="game"&&mode!=="find"&&!(mode==="ear"&&!earRevealed)&&practice==="step"&&inputReady&&transport.current.state.status==="idle"){
      setTransportState({...transport.current.play()});setMessage(value=>value.includes("New pattern ready")?value:"Wait for me is armed · play the highlighted note");
    }
  },[screen,mode,practice,input,micEnabled,earRevealed,exerciseMelody.id,mistakePolicy]);
  useEffect(()=>{
    if(screen!=="game"||mode==="find")return;
    let animation=0,reviewed=false;
    const tick=()=>{
      const now=performance.now();if(referenceActive.current){animation=requestAnimationFrame(tick);return}
      if(practice==="realtime"){
        const state=transport.current.tick(now);setTransportState({...state});
        const eventIndex=Math.max(0,exerciseMelody.events.findIndex(event=>state.positionBeat>=event.startBeat&&state.positionBeat<event.startBeat+event.durationBeats));setStepEventIndex(eventIndex);
        if(state.status==="complete"&&!reviewed){reviewed=true;setFlowResults(realtimeEngine.current.review());setMessage(mode==="rhythm"?"Rhythm run complete · timing continued through every mistake":"Run complete · review pitch, timing and duration separately");}
      }else if(transport.current.state.status==="playing"||(transport.current.state.status==="idle"&&(input==="virtual"||micEnabled))){
        const currentEvent=exerciseMelody.events[stepEngine.current.state.activeEventIndex],signal=mode==="rhythm"&&rhythmSettings.pitchPolicy==="any"&&signalRef.current.sounding?{...signalRef.current,midi:currentEvent?.midi}:signalRef.current,state=stepEngine.current.update(signal,now,exerciseMelody.tempoQpm),event=exerciseMelody.events[state.activeEventIndex];setStepEventIndex(state.activeEventIndex);
        if(event)setTransportState({...transport.current.advanceStep(event.startBeat+state.heldBeats)});
        if(state.feedback==="wrong"){setStatus("miss");const played=signal.midi===undefined?"Sound":teachingNoteName(signal.midi,namingSystem),expected=currentEvent?.midi===undefined?"silence":teachingNoteName(currentEvent.midi,namingSystem),action=state.lastMistakeAction==="kept"?`Progress kept at ${Math.round(state.heldBeats/Math.max(.001,currentEvent?.durationBeats??1)*100)}%`:state.lastMistakeAction==="note-restarted"?"Current note restarted":`Measure ${(currentEvent?.measureIndex??0)+1} restarted`;setMessage(`Played ${played} · expected ${expected} · ${action}`)}
        if(state.feedback==="release"){setStatus("miss");const action=state.lastMistakeAction==="kept"?`Progress kept at ${Math.round(state.heldBeats/Math.max(.001,currentEvent?.durationBeats??1)*100)}%`:state.lastMistakeAction==="note-restarted"?"Current note restarted":`Measure ${(currentEvent?.measureIndex??0)+1} restarted`;setMessage(`Released early · ${action}`)}
        if(state.feedback==="correct")setStatus("hit");
        if(state.feedback==="complete"){setStatus("hit");setMessage("Wait for me complete");}
      }
      animation=requestAnimationFrame(tick);
    };
    animation=requestAnimationFrame(tick);return()=>cancelAnimationFrame(animation);
  },[screen,mode,practice,exerciseMelody,mistakePolicy,namingSystem,rhythmSettings.pitchPolicy,input,micEnabled]);
  const toggleTransport=()=>{if(referenceActive.current)stopReferencePlayback();const current=transport.current.state;if(current.status==="playing"||current.status==="count-in")setTransportState({...transport.current.pause()});else{const countIn=practice==="realtime"&&current.status!=="paused"?4:0;takeStartedAt.current=performance.now()+countIn*60_000/exerciseMelody.tempoQpm;performed.current=[];realtimeEngine.current.clear();setFlowResults([]);setTransportState({...transport.current.play(countIn)});setMessage(countIn?"Count in · 4 beats":"Practice started");}};
  const restartTransport=()=>{if(referenceActive.current)stopReferencePlayback();stepEngine.current.seek(0);realtimeEngine.current.clear();setStepEventIndex(0);setFlowResults([]);setTransportState({...transport.current.restart()});setMessage("Ready from the beginning");};
  const seekTransport=(beat:number)=>{if(referenceActive.current)stopReferencePlayback();setReferencePlayback({status:"idle",positionBeat:beat});setTransportState({...transport.current.seek(beat)});stepEngine.current.seek(beat);setStepEventIndex(stepEngine.current.state.activeEventIndex);realtimeEngine.current=new RealtimePerformanceEngine(exerciseMelody.events,exerciseMelody.tempoQpm,beat);performed.current=[];setFlowResults([]);setMessage(`Start position · beat ${beat.toFixed(1)}`);};
  const loadSong = (key: string) => { stopReferencePlayback();const item=SONGS[key]!; setSongKey(key); setCustomAbc(item.abc); setMelody(parseAbc(item.abc,key)); resetMode("song"); setScreen("game"); };
  const loadImportedSong = (abc: string) => { try { const imported=parseAbc(abc,"imported");setCustomAbc(abc);setMelody(imported);resetMode("song");setScreen("game") } catch(error) { window.alert(error instanceof Error?error.message:"Invalid ABC") } };
  const resetMode = (next: Mode) => { player.stopReferencePlayback();referenceActive.current=false;setReferencePlayback({status:"idle",positionBeat:0});setMode(next);setPractice("step");setActive(0);setStepEventIndex(0); setEarPlayed([]); setEarRevealed(false);setEarAssisted(false);setEarSkipped(false); setPerformance([]); setTrace([]); setFlowResults([]); setMessage(next === "ear" ? "Listen first · pitches stay hidden" : next==="find"?"Read the staff, then play":next==="rhythm"?"Choose a pattern, then start Wait for me or In time":"Ready · enable an input to begin"); };
  const startMode = (next: Mode) => { if(next==="song"){setScreen("songs");return} if(next==="ear")setEarPhrase(generateRandomPhrase(profile,{length:4,maxInterval:5,tempoQpm:92}));if(next==="rhythm")setRhythmMelody(generateRhythm(rhythmSettings));resetMode(next); setScreen("game"); };
  const exitMode = () => { player.stop(); microphone.current.stop(); setInput("virtual"); setScreen("menu"); };
  const referenceVisible=referencePlayback.status!=="idle",preview=referencePreview(sourceEvents,referencePlayback.positionBeat),previewEventIndex=preview.activeEventIndex;
  const displayedEventIndex=referenceVisible?previewEventIndex:activeEventIndex;
  const stageBeat=referenceVisible?referencePlayback.positionBeat:mode==="find"?0:mode==="ear"&&!earRevealed?sourceEvents[activeEventIndex]?.startBeat??0:transportState.positionBeat;
  const detectedMidis=micBundle?.display?[micBundle.display.classifiedMidi]:[];
  const notationSource=useMemo(()=>mode==="song"?customAbc:generatedExerciseToAbc(sourceEvents,{title:mode==="ear"?"Ear phrase":mode==="rhythm"?"Rhythm training":"Find a note",meter:exerciseMelody.meter,tempoQpm:exerciseMelody.tempoQpm}),[mode,customAbc,sourceEvents,exerciseMelody.meter.numerator,exerciseMelody.meter.denominator,exerciseMelody.tempoQpm]);
  const notationDocument=useMemo(()=>adaptAbc(notationSource),[notationSource]);
  const activeWritten=notationDocument.writtenEvents[displayedEventIndex]??notationDocument.writtenEvents.find(event=>event.kind==="note");
  const hiddenWrittenIds=useMemo(()=>new Set(mode==="ear"&&!earRevealed?notationDocument.writtenEvents.filter(event=>event.kind==="note").map(event=>event.id):[]),[mode,earRevealed,notationDocument]);
  const plans=useMemo(()=>planFingerings(notationDocument.soundingEvents,profile),[notationDocument,profile]);
  const activeSound=notationDocument.soundingEvents.find(sound=>sound.writtenEventIds.includes(activeWritten?.id??""));
  const planned=plans.find(plan=>plan.soundEventId===activeSound?.id)?.recommended;
  const guideAction=((mode==="song"&&showFingering)||mode==="rhythm"||(mode==="ear"&&earRevealed))?planned:undefined;
  const detectedActions=detectedMidis.flatMap(midi=>actionsForMidi(profile,midi));
  const playerSetup=<PlayerSetup profileId={profile.id} setProfileId={setProfileId} staffLabels={staffLabels} setStaffLabels={setStaffLabels} harmonicaLabels={harmonicaLabels} setHarmonicaLabels={setHarmonicaLabels} namingSystem={namingSystem} setNamingSystem={setNamingSystem}/>;
  const settings=<SettingsDrawer strict={strict} setStrict={setStrict} diagnostics={diagnostics} observation={observation} sensitivity={sensitivity} setSensitivity={setSensitivity} onClose={()=>setShowSettings(false)}/>;
  const resetEarAttempt=(next:Melody,skipped=false)=>{setEarPhrase(next);setEarPlayed([]);setEarRevealed(false);setEarAssisted(false);setEarSkipped(skipped);setActive(0);setMessage(skipped?"Phrase skipped · a new phrase is ready":"New phrase · listen when ready");};
  const createEarPhrase=()=>earSource==="song"?songExcerpt(melody,0,2):generateRandomPhrase(profile,{length:4,maxInterval:5,tempoQpm:92});
  const newEarPhrase=()=>resetEarAttempt(createEarPhrase());
  const skipEarPhrase=()=>resetEarAttempt(createEarPhrase(),true);
  const newRhythmPattern=()=>{const next=rhythmSource==="preset"?RHYTHM_PRESETS[Object.keys(RHYTHM_PRESETS)[Math.floor(Math.random()*Object.keys(RHYTHM_PRESETS).length)]!]!:generateRhythm(rhythmSettings);setRhythmMelody(next);setMessage("New pattern ready · it changes only on New or Next");};

  if (screen === "menu") return <MainMenu onStart={startMode} onSettings={()=>setShowSettings(true)} profile={profile} settings={showSettings ? settings : null}/>;
  if (screen === "songs") return <SongLibrary selected={songKey} initialAbc={customAbc} onChoose={loadSong} onImport={loadImportedSong} onBack={()=>setScreen("menu")}/>;

  const modeCopy:Record<Mode,[string,string,string]>={find:["Staff to instrument","Find the note","Read the target, then find its exact position."],song:["Song practice","Practice a song","Choose a song, guidance, and practise one note at a time or play it in tempo."],ear:["Listening practice","Play it by ear","Listen to the phrase and discover each interval."],rhythm:["Timing practice","Rhythm training","Match starts, holds, releases and rests on one friendly pitch."]};
  const copy=modeCopy[mode];
  const currentStep=stepEngine.current.state,currentSourceEvent=sourceEvents[currentStep.activeEventIndex];
  const eventVisuals=referenceVisible?Object.fromEntries(notationDocument.writtenEvents.map((event,index)=>[event.id,preview.visuals[sourceEvents[index]?.id??""]??{state:"pending",progress:0}])) as PracticeEventVisuals:Object.fromEntries(notationDocument.writtenEvents.map((event,index)=>{const source=sourceEvents[index],completed=source&&currentStep.completedEventIds.includes(source.id);let state:"pending"|"active"|"partial"|"correct"|"wrong"|"missed"=completed?"correct":"pending",progress=completed?1:0;if(index===activeEventIndex){progress=practice==="step"?currentStep.heldBeats/Math.max(.001,source?.durationBeats??event.durationBeats):Math.max(0,Math.min(1,(stageBeat-event.startBeat)/event.durationBeats));state=currentStep.feedback==="wrong"||currentStep.feedback==="release"?"wrong":progress>0?"partial":"active"}else if(practice==="realtime"&&event.startBeat+event.durationBeats<stageBeat)state="missed";return[event.id,{state,progress,earlyReleaseAt:state==="wrong"&&currentStep.feedback==="release"?progress:undefined}]})) as PracticeEventVisuals;
  const findDock=mode==="find"?<ControlDock label="Find note controls">
    <ControlGroup label="Reference"><button className="listen" aria-pressed={referenceActive.current} onClick={listen}>{referenceLabel("▶ Listen")}</button></ControlGroup>
    <ControlGroup label="Range"><select aria-label="Find note range" value={findRange} onChange={(event)=>setFindRange(event.target.value as FindRange)}><option value="beginner">Beginner C4–C5</option><option value="medium">Medium C4–C6</option><option value="full">Full {profile.holeCount}-hole</option></select></ControlGroup>
    <ControlGroup label="Notes"><select aria-label="Accidentals" value={accidentals} onChange={(event)=>setAccidentals(event.target.value as AccidentalMode)}><option value="naturals">Naturals only</option><option value="accidentals">Mix in accidentals</option><option value="chromatic">Full chromatic</option></select></ControlGroup>
    <span className="dock-summary">{pool.length} possible pitches · anti-repeat shuffle</span>
  </ControlDock>:null;
  const rhythmDock=mode==="rhythm"?<ControlDock label="Rhythm practice controls">
    <div className="source-summary"><b>{rhythmSource==="generated"?"Generated":"Preset"} · {rhythmSettings.measures} bars · {rhythmSettings.meter} · {rhythmSettings.difficulty}</b><small>{rhythmSettings.pitchPolicy==="any"?"Any stable pitch":"Fixed C4"} · changes only on New</small></div>
    <ControlGroup label="Source"><select aria-label="Rhythm source" value={rhythmSource} onChange={event=>setRhythmSource(event.target.value as "generated"|"preset")}><option value="generated">Generated pattern</option><option value="preset">Preset pattern</option></select></ControlGroup>
    <ControlGroup label="Meter"><select aria-label="Rhythm meter" value={rhythmSettings.meter} onChange={event=>setRhythmSettings(value=>({...value,meter:event.target.value as RhythmMeter}))}><option>4/4</option><option>3/4</option><option>6/8</option></select></ControlGroup>
    <ControlGroup label="Bars"><select aria-label="Rhythm measures" value={rhythmSettings.measures} onChange={event=>setRhythmSettings(value=>({...value,measures:Number(event.target.value)}))}><option value="1">1</option><option value="2">2</option><option value="4">4</option></select></ControlGroup>
    <ControlGroup label="Difficulty"><select aria-label="Rhythm difficulty" value={rhythmSettings.difficulty} onChange={event=>setRhythmSettings(value=>({...value,difficulty:event.target.value as RhythmDifficulty}))}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></ControlGroup>
    <ControlGroup label="Pitch"><select aria-label="Rhythm pitch policy" value={rhythmSettings.pitchPolicy} onChange={event=>setRhythmSettings(value=>({...value,pitchPolicy:event.target.value as "any"|"fixed"}))}><option value="any">Any stable note</option><option value="fixed">Fixed C4</option></select></ControlGroup>
    <ControlGroup label="Behavior"><div className="segmented" aria-label="Practice style"><button className={practice==="step"?"active":""} onClick={()=>setPractice("step")}>Wait for me</button><button className={practice==="realtime"?"active":""} onClick={()=>setPractice("realtime")}>In time</button></div></ControlGroup>
    {practice==="step"&&<ControlGroup label="Mistakes"><select aria-label="Mistake policy" value={mistakePolicy} onChange={event=>setMistakePolicy(event.target.value as MistakePolicy)}><option value="pause">Keep note progress</option><option value="restart-note">Restart current note</option><option value="restart-measure">Restart current measure</option></select></ControlGroup>}
    <ControlGroup label="Pattern"><button onClick={newRhythmPattern}>New pattern</button></ControlGroup>
    <ControlGroup label="Reference"><button className="listen" aria-pressed={referenceActive.current} onClick={listen}>{referenceLabel("▶ Repeat / listen")}</button></ControlGroup>
  </ControlDock>:null;
  const songDock=mode==="song"?<ControlDock label="Song practice controls">
    <ControlGroup wide><button className="song-change compact-song" onClick={()=>setScreen("songs")}>♫ <b>{melody.title}</b><span>Change</span></button></ControlGroup>
    <ControlGroup label="Behavior"><div className="segmented" aria-label="Practice style"><button className={practice==="step"?"active":""} onClick={()=>setPractice("step")}>Wait for me</button><button className={practice==="realtime"?"active":""} onClick={()=>setPractice("realtime")}>In time</button></div></ControlGroup>
    <ControlGroup label="Tempo"><CompactField label={`${melody.tempoQpm} BPM`}><input aria-label="Song tempo" type="range" min="50" max="160" value={melody.tempoQpm} onChange={event=>setMelody(value=>({...value,tempoQpm:Number(event.target.value)}))}/></CompactField></ControlGroup>
    {practice==="step"&&<ControlGroup label="Mistakes"><select aria-label="Mistake policy" value={mistakePolicy} onChange={event=>setMistakePolicy(event.target.value as MistakePolicy)}><option value="pause">Keep note progress</option><option value="restart-note">Restart current note</option><option value="restart-measure">Restart current measure</option></select></ControlGroup>}
    <ControlGroup label="Reference"><button className="listen" aria-pressed={referenceActive.current} onClick={listen}>{referenceLabel("▶ Listen")}</button></ControlGroup>
    <ControlGroup label="Guidance"><SettingsPopover label="Guidance" summary={[showFingering?"harmonica":"no fingering",staffLabels?"staff names":"",harmonicaLabels?"harmonica names":""].filter(Boolean).join(" · ")}><label><input type="checkbox" checked={showFingering} onChange={event=>setShowFingering(event.target.checked)}/> Show harmonica fingering</label><label><input type="checkbox" checked={staffLabels} onChange={event=>setStaffLabels(event.target.checked)}/> Show staff note names</label><label><input type="checkbox" checked={harmonicaLabels} onChange={event=>setHarmonicaLabels(event.target.checked)}/> Show harmonica note names</label></SettingsPopover></ControlGroup>
  </ControlDock>:null;
  return <div className={`app-shell game-shell mode-${mode}`}><header className="game-header"><button className="menu-exit" onClick={exitMode}><span>←</span> Menu</button><div className="game-brand"><span className="brand-mark">H</span><span><b>Harmonica</b><small>Trainer</small></span></div><div className="game-actions"><ThemeControl/><div className="session-stats"><span><b>{session.hits}</b><small>Hits</small></span><span><b>{session.attempts ? Math.round(session.hits/session.attempts*100):100}%</b><small>Accuracy</small></span></div><button className="icon-button" aria-label="Settings" onClick={()=>setShowSettings(!showSettings)}>⚙</button></div></header>
    <main className="play-scene"><div className="mode-strip"><div><span className="eyebrow">{copy[0]}</span><h1>{copy[1]}</h1><p>{copy[2]}</p></div><span className={`feedback-chip ${status}`}>{status==="hit"?"✓":status==="miss"?"↕":"◇"} {message}</span></div>
      <PracticeWorkspace>{songDock}{findDock}{rhythmDock}{playbackStatus.status==="degraded"&&<div className="playback-warning" role="status"><span><b>Sampled harmonica is degraded.</b> {playbackStatus.error}</span><button onClick={retryPlayback}>Retry samples</button></div>}
      {mode==="ear"&&<section className="exercise-lifecycle ear-lifecycle" aria-label="Ear phrase lifecycle"><div className="source-summary"><b>{earPhrase.title} · {earTargets.length} notes · {earRelative?"Relative":"Absolute"}</b><small>{earSource==="song"?`${melody.title} · measures 1–2`:"Playable random phrase · intervals up to 5 semitones"}{earAssisted?" · assisted":""}{earSkipped?" · previous skipped":""}</small></div><label>Source<select aria-label="Ear phrase source" value={earSource} onChange={event=>setEarSource(event.target.value as "random"|"song")}><option value="random">Random phrase</option><option value="song">Song excerpt</option></select></label><div className="segmented" aria-label="Ear mode"><button className={!earRelative?"active":""} onClick={()=>{setEarRelative(false);setEarPlayed([]);setActive(0);setEarRevealed(false)}}>Absolute</button><button className={earRelative?"active":""} onClick={()=>{setEarRelative(true);setEarPlayed([]);setActive(0);setEarRevealed(false)}}>Relative</button></div><button className="listen" aria-pressed={referenceActive.current} onClick={listen}>{referenceLabel(`▶ ${earPlayed.length?"Replay":"Listen"}`)}</button><button onClick={newEarPhrase}>New phrase</button><button onClick={skipEarPhrase}>Skip</button><button onClick={()=>setMessage(earPlayed.length?`Next interval goes ${earTargets[earPlayed.length]!-(earTargets[Math.max(0,earPlayed.length-1)]??earTargets[0]!)>=0?"up":"down"}`:"Replay once, then choose an anchor")}>Hint</button><button onClick={()=>{const revealed=earRelative&&earPlayed.length?relativeTargets(earTargets,earPlayed[0]!):earTargets;setEarPlayed(revealed);setEarRevealed(true);setEarAssisted(true);setMessage("Revealed · attempt marked assisted")}}>Reveal</button>{earRevealed&&<button className="primary" onClick={newEarPhrase}>Next phrase</button>}<strong>{earPlayed.length} of {earTargets.length} pitches found</strong></section>}
      {mode==="ear"&&<div className="toolbar music-controls"><div className="segmented" aria-label="Practice style"><button className={practice==="step"?"active":""} onClick={()=>setPractice("step")}>Wait for me</button><button className={practice==="realtime"?"active":""} disabled={!earRevealed} onClick={()=>setPractice("realtime")}>In time</button></div>{earRevealed&&practice==="step"&&<label className="mistake-policy">Mistakes<select aria-label="Mistake policy" value={mistakePolicy} onChange={event=>setMistakePolicy(event.target.value as MistakePolicy)}><option value="pause">Keep note progress</option><option value="restart-note">Restart current note</option><option value="restart-measure">Restart current measure</option></select></label>}</div>}
      <section className="music-surface" aria-label="Music and transport">
        {mode!=="find"&&!(mode==="ear"&&!earRevealed)&&<MusicTransportControls state={transportState} meter={exerciseMelody.meter.numerator} onToggle={toggleTransport} onRestart={restartTransport}/>}
        <MusicStage document={notationDocument} mode="timeline" activeBeat={stageBeat} activeWrittenEventId={activeWritten?.id} hiddenWrittenEventIds={hiddenWrittenIds} pitchTrace={trace} feedback={status} accessibleLabel={`${copy[1]} notation`} ribbons={mode==="find"||(mode==="ear"&&!earRevealed)?"none":"duration"} showPlayhead={referenceVisible||practice==="realtime"&&mode!=="find"&&(mode!=="ear"||earRevealed)} showNoteNames={staffLabels} namingSystem={namingSystem} nowMs={input==="microphone"||practice==="realtime"?performance.now():performanceNow(trace,renderedPerformance)} transport={mode!=="find"&&(!(mode==="ear"&&!earRevealed)||referenceVisible)?{positionBeat:referenceVisible?referencePlayback.positionBeat:transportState.positionBeat,status:referencePlayback.status==="playing"?"playing":transportState.status,seekable:true,onSeek:seekTransport}:undefined} eventVisuals={eventVisuals} playedMidi={referenceVisible?undefined:signalRef.current.midi}/>
        <div className={`practice-feedback ${status}`} aria-live="polite">{message}</div>
      </section>
      <section className="harmonica-cluster" aria-label="Harmonica and input controls">
        <HarmonicaStage view={input==="microphone"?"compact":"interactive"} profile={profile} target={guideAction} detected={detectedActions} onStart={onVirtualStart} onEnd={onVirtualEnd} showLabels={harmonicaLabels} namingSystem={namingSystem} feedback={actionFeedback}/>
        <div className="harmonica-input segmented" aria-label="Input source"><button className={input==="microphone"?"active":""} onClick={()=>setInput("microphone")}>Microphone · recommended</button><button className={input==="virtual"?"active":""} onClick={()=>setInput("virtual")}>Touch · alternative</button></div>
        {input === "microphone" && <section className="input-deck compact-mic">{!micEnabled&&<button className="primary enable-microphone" onClick={()=>setMicEnabled(true)}>Enable microphone</button>}{micEnabled&&micDevices.length > 1 && <label className="device-select">Input device <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="">System default</option>{micDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label>}{micEnabled&&<div className="sensitivity-control"><span>Sensitivity</span><div className="segmented" role="group" aria-label="Microphone sensitivity">{(["high","normal","low"] as MicrophoneSensitivity[]).map(value=><button key={value} className={sensitivity===value?"active":""} aria-pressed={sensitivity===value} onClick={()=>setSensitivity(value)}>{value[0]!.toUpperCase()+value.slice(1)}</button>)}</div></div>}{micEnabled&&<Tuner frame={frame} observation={observation} message={micError} expectedOffset={expectedOffset(frame?.classifiedMidi)}/>}<div className="mic-actions">{micEnabled&&<button onClick={()=>microphone.current.recalibrate()}>Recalibrate</button>}<span>{observation?.status==="calibrating"?"Keep quiet while ambient noise is measured.":observation?.status==="calibration-contaminated"?"Calibration heard a tone or changing noise and is retrying — stay quiet.":"Pitch highlights every possible position; it never guesses hole, breath, or slide."}</span></div></section>}
        {playerSetup}
      </section>
      {!!flowResults.length&&<Review rows={flowResults} rhythm={mode==="rhythm"}/>}</PracticeWorkspace> {showSettings&&settings}
    </main><footer className="build-identity">Build <code>{__BUILD_META__.sourceCommit.slice(0,12)}</code> · v{__BUILD_META__.version}</footer></div>;
}

function MainMenu({onStart,onSettings,settings,profile}:{onStart:(mode:Mode)=>void;onSettings:()=>void;settings:ReactNode;profile:HarmonicaProfile}) {
  const modes: {id:Mode;title:string;description:string;symbol:string}[] = [
    {id:"find",title:"Find a note",description:"Read a note on the staff and find the matching pitch on the harmonica.",symbol:"♪"},
    {id:"song",title:"Practice a song",description:"Choose a song, guidance and mistake response, then practise note by note or in tempo.",symbol:"♫"},
    {id:"ear",title:"Play by ear",description:"Listen to a short phrase, work out its notes or intervals, and then perform it in rhythm.",symbol:"◖"},
    {id:"rhythm",title:"Rhythm training",description:"Practise starts, holds, releases and rests without the added difficulty of learning a melody.",symbol:"♩"},
  ];
  return <div className="main-menu"><header className="menu-header"><div className="menu-brand"><span className="brand-mark">H</span><span><b>Harmonica</b><small>Trainer</small></span></div><div className="menu-tools"><ThemeControl/><button className="icon-button" aria-label="Settings" onClick={onSettings}>⚙</button></div></header><main className="menu-content"><div className="menu-copy"><h1>Choose what to practise</h1><p>Learn where notes are on a chromatic harmonica, read music, train rhythm and your ear, and play complete songs with microphone or touch guidance.</p></div><div className="mode-select" aria-label="Choose a practice mode">{modes.map((item)=><button key={item.id} className={`mode-choice ${item.id}`} onClick={()=>onStart(item.id)}><span className="mode-symbol" aria-hidden="true">{item.symbol}</span><span className="mode-copy"><b>{item.title}</b><small>{item.description}</small></span><span className="mode-play">Start <i aria-hidden="true">→</i></span></button>)}</div></main><footer className="menu-footer"><span>Standard C · {profile.holeCount} holes · A4 440 Hz</span><span>Audio stays on this device · Build <code>{__BUILD_META__.sourceCommit.slice(0,12)}</code></span></footer>{settings}</div>;
}

function SongLibrary({selected,initialAbc,onChoose,onImport,onBack}:{selected:string;initialAbc:string;onChoose:(key:string)=>void;onImport:(abc:string)=>void;onBack:()=>void}) {
  const [importAbc,setImportAbc]=useState(initialAbc);
  return <div className="song-library"><header><button className="menu-exit" onClick={onBack}>← Main menu</button><span>Song library</span><ThemeControl/></header><main><div className="library-copy"><span className="eyebrow">Song practice</span><h1>Choose your song</h1><p>Choose a melody, then decide how much guidance you want and practise it note by note or in time.</p></div><div className="song-grid">{Object.entries(SONGS).map(([key,song])=><button key={key} className={`song-card ${key===selected?"selected":""}`} onClick={()=>onChoose(key)}><span className="song-symbol">♫</span><b>{song.title}</b><i>{key===selected?"Current":"Choose"} →</i></button>)}</div><details className="import-source"><summary>Import ABC</summary><p>Use your own monodic ABC notation as a separate source.</p><textarea aria-label="ABC notation" value={importAbc} onChange={(event)=>setImportAbc(event.target.value)}/><button className="primary" onClick={()=>onImport(importAbc)}>Open imported score</button></details></main></div>;
}

function PlayerSetup({profileId,setProfileId,staffLabels,setStaffLabels,harmonicaLabels,setHarmonicaLabels,namingSystem,setNamingSystem}:{profileId:string;setProfileId:(value:string)=>void;staffLabels:boolean;setStaffLabels:(value:boolean)=>void;harmonicaLabels:boolean;setHarmonicaLabels:(value:boolean)=>void;namingSystem:NamingSystem;setNamingSystem:(value:NamingSystem)=>void}) {
  return <section className="player-setup" aria-label="Player setup">
    <fieldset className="instrument-control"><legend>INSTRUMENT</legend><div className="choice-row" role="group" aria-label="Instrument">{HARMONICA_PROFILES.map((item)=><button key={item.id} className={profileId===item.id?"active":""} aria-pressed={profileId===item.id} aria-label={`Instrument: ${item.holeCount} holes`} onClick={()=>setProfileId(item.id)}><b>{item.holeCount} holes</b><small>{item.holeCount}-hole chromatic</small></button>)}</div></fieldset>
    <fieldset className="learning-aids"><legend>LEARNING AIDS</legend><div className="aid-control"><span>Staff note names</span><div className="choice-row compact" role="group" aria-label="Staff note names"><button className={!staffLabels?"active":""} aria-pressed={!staffLabels} onClick={()=>setStaffLabels(false)}>Off</button><button className={staffLabels?"active":""} aria-pressed={staffLabels} onClick={()=>setStaffLabels(true)}>On</button></div></div><div className="aid-control"><span>Harmonica note names</span><div className="choice-row compact" role="group" aria-label="Harmonica note names"><button className={!harmonicaLabels?"active":""} aria-pressed={!harmonicaLabels} onClick={()=>setHarmonicaLabels(false)}>Off</button><button className={harmonicaLabels?"active":""} aria-pressed={harmonicaLabels} onClick={()=>setHarmonicaLabels(true)}>On</button></div></div><div className="aid-control"><span>Note naming</span><div className="choice-row compact naming" role="group" aria-label="Note naming"><button disabled={!staffLabels&&!harmonicaLabels} className={namingSystem==="letters"?"active":""} aria-pressed={namingSystem==="letters"} onClick={()=>setNamingSystem("letters")}>Letters <small>C D E</small></button><button disabled={!staffLabels&&!harmonicaLabels} className={namingSystem==="solfege"?"active":""} aria-pressed={namingSystem==="solfege"} onClick={()=>setNamingSystem("solfege")}>Solfège <small>Do Re Mi</small></button></div></div></fieldset>
  </section>;
}

function SettingsDrawer({strict,setStrict,diagnostics,observation,sensitivity,setSensitivity,onClose}:{strict:boolean;setStrict:(value:boolean)=>void;diagnostics?:MicrophoneDiagnostics;observation?:MicrophoneObservation;sensitivity:MicrophoneSensitivity;setSensitivity:(value:MicrophoneSensitivity)=>void;onClose:()=>void}) {
  return <aside className="settings-drawer" aria-label="Settings"><button className="close" aria-label="Close settings" onClick={onClose}>×</button><span className="eyebrow">Preferences</span><h2>Settings</h2><div className="settings-theme"><span>Theme</span><ThemeControl/></div><label><input type="checkbox" checked={strict} onChange={(event)=>setStrict(event.target.checked)}/> Strict intonation ±20¢</label><div className="settings-theme"><span>Microphone sensitivity</span><div className="segmented">{(["high","normal","low"] as MicrophoneSensitivity[]).map(value=><button key={value} className={sensitivity===value?"active":""} onClick={()=>setSensitivity(value)}>{value}</button>)}</div></div><p>Instrument and learning-aid controls are directly below the harmonica during training.</p><details><summary>Audio diagnostics</summary><pre>{JSON.stringify({...diagnostics,...player.diagnostics,signal:observation&&{rmsDb:round(observation.rmsDb),noiseFloorDb:round(observation.noiseFloorDb),openThresholdDb:round(observation.openThresholdDb),closeThresholdDb:round(observation.closeThresholdDb),clarity:round(observation.clarity),gateOpen:observation.gateOpen,state:observation.status,sensitivity:observation.sensitivity}},null,2)}</pre></details><p className="settings-build">Build <code>{__BUILD_META__.sourceCommit}</code><br/>{new Date(__BUILD_META__.builtAt).toLocaleString()}</p></aside>;
}

function Review({rows,rhythm=false}:{rows:ReturnType<typeof alignPerformance>;rhythm?:boolean}) { const score=(key:"pitch"|"timing"|"length"|"stability"|"intonation")=>Math.round(rows.reduce((sum,row)=>sum+row[key],0)/Math.max(1,rows.length)); return <section className={`review ${rhythm?"rhythm-review":""}`}>{!rhythm&&<div><span>Notes</span><b>{score("pitch")}%</b></div>}<div><span>Timing</span><b>{score("timing")}%</b></div><div><span>Length</span><b>{score("length")}%</b></div>{!rhythm&&<><div><span>Stability</span><b>{score("stability")}%</b></div><div><span>Intonation</span><b>{score("intonation")}%</b></div></>}</section> }
function segmentFromVirtual(midi:number,startedAt:number,durationMs:number,source:InputNoteSegment["source"]="virtual-harmonica"):InputNoteSegment{return{id:`${source}-${startedAt}`,source,startedAt,stableStartedAt:startedAt,endedAt:startedAt+durationMs,durationMs,medianFrequencyHz:0,medianMidiFloat:midi,classifiedMidi:midi,medianCentsFromEt:0,centsVariability:0,medianClarity:1,medianRms:1,pitchTrace:[]}}
function performanceNow(trace:PitchTracePoint[],items:TimelinePerformance[]):number{return trace.at(-1)?.time??items.at(-1)?.startedAt??performance.now()}
function readBooleanPreference(key:string,fallback:boolean):boolean{const value=localStorage.getItem(key);return value===null?fallback:value==="true"}
function round(value:number):number{return Math.round(value*10)/10}
