import type { PracticeTransportState } from "../practice/practiceTypes";

export function MusicTransportControls({state,meter,onToggle,onRestart}:{state:PracticeTransportState;meter:number;onToggle:()=>void;onRestart:()=>void}){
  const measure=Math.floor(state.positionBeat/meter)+1,beat=state.positionBeat%meter+1,totalSeconds=state.totalBeats/state.tempoQpm*60,currentSeconds=state.positionBeat/state.tempoQpm*60;
  const primary=state.status==="playing"||state.status==="count-in"?"Pause":state.status==="paused"?"Resume":state.mode==="realtime"?"Count in + start":"Pause";
  const ready=state.mode==="realtime"||state.status!=="idle";
  return <div className="staff-transport" role="region" aria-label="Practice transport">
    <div className="transport-actions">{ready&&<button className="primary" onClick={onToggle}>{primary}</button>}<button onClick={onRestart}>Restart</button>{!ready&&<span className="input-needed">Enable an input to arm Wait for me</span>}</div>
    <div className="transport-position"><b>Measure {measure} · beat {beat.toFixed(1)}</b><span>{state.status==="count-in"?`Count in · ${state.countInBeats} beats`:`${formatTime(currentSeconds)} / ${formatTime(totalSeconds)}`}</span></div>
  </div>;
}

const formatTime=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,"0")}`;
