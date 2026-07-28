import type { MelodyEvent } from "../music/melody";
import { noteName } from "../music/pitch";
import type { PitchTracePoint } from "../exercises/evaluation";

interface Props { events: MelodyEvent[]; activeIndex: number; hidden?: boolean; flowProgress?: number; trace?: PitchTracePoint[]; status?: "idle" | "hit" | "miss"; title: string }
const yForMidi = (midi: number) => 142 - (midi - 60) * 4;

export function GameStage({ events, activeIndex, hidden, flowProgress = 0, trace = [], status = "idle", title }: Props) {
  const visible = events.slice(0, 24), width = Math.max(900, visible.length * 82 + 180), playheadX = 300;
  return <section className={`game-stage ${status}`} aria-label={`${title} music staff`}>
    <div className="stage-heading"><div><span className="eyebrow">LIVE STAFF</span><h2>{title}</h2></div><div className="stage-legend"><span>◆ target</span><span>━ duration</span><span>⌁ played pitch</span></div></div>
    <div className="staff-viewport">
      <svg className="staff" viewBox={`0 0 ${width} 260`} role="img" aria-label="Interactive treble staff">
        <defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="ribbon" x1="0" x2="1"><stop stopColor="#54e7d4"/><stop offset="1" stopColor="#805dff"/></linearGradient></defs>
        <rect width={width} height="260" rx="22" fill="#081722" />
        {[94,110,126,142,158].map((y) => <line key={y} x1="45" x2={width - 25} y1={y} y2={y} className="staff-line" />)}
        <text x="66" y="158" className="clef">𝄞</text>
        {visible.map((event, index) => {
          const x = 150 + index * 82 - flowProgress * 82, active = index === activeIndex, y = event.kind === "note" ? yForMidi(event.midi ?? 60) : 126;
          if (event.kind === "rest") return <g key={event.id} className={active ? "active-event" : ""}><text x={x} y={y + 8} className="rest">𝄽</text></g>;
          return <g key={event.id} className={`${active ? "active-event" : ""} ${index < activeIndex ? "completed-event" : ""}`}>
            <rect x={x - 8} y={y - 7} width={Math.max(30, event.durationBeats * 62)} height="14" rx="7" className="target-ribbon" />
            {hidden && index >= activeIndex ? <g><circle cx={x} cy="126" r="14" className="hidden-slot"/><text x={x} y="131" textAnchor="middle" className="slot-text">?</text></g> : <g><ellipse cx={x} cy={y} rx="11" ry="8" className="note-head"/><line x1={x + 9} x2={x + 9} y1={y} y2={y - 42} className="note-stem"/><text x={x} y="205" textAnchor="middle" className="note-label">{noteName(event.midi ?? 60)}</text></g>}
          </g>;
        })}
        <line x1={playheadX} x2={playheadX} y1="50" y2="188" className="playhead" filter="url(#glow)"/><path d={`M ${playheadX - 7} 48 L ${playheadX + 7} 48 L ${playheadX} 60 Z`} className="playhead-tip"/>
        {trace.length > 1 && <polyline className="pitch-trace" points={trace.slice(-100).map((point, index) => `${playheadX - 160 + index * 2},${yForMidi(point.midiFloat)}`).join(" ")} />}
      </svg>
    </div>
  </section>;
}
