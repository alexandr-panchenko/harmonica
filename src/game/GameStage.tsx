import type { MelodyEvent } from "../music/melody";
import type { PitchTracePoint } from "../exercises/evaluation";
import { writtenPitchFromMidi, layoutWrittenPitch } from "../notation/layout";
import { AccidentalGlyph, NoteGlyph, RestGlyph, TrebleClef } from "../notation/MusicGlyphs";
import { teachingNoteName, type NamingSystem } from "../music/naming";
import { activeBeat, eventWidth, eventX, PLAYHEAD_X, traceX } from "./timeline";

export interface TimelinePerformance {
  id: string;
  midi: number;
  startedAt: number;
  durationMs: number;
  outcome: "correct" | "incorrect" | "performed";
}

interface Props {
  events: MelodyEvent[];
  activeIndex: number;
  hidden?: boolean;
  currentBeat?: number;
  trace?: PitchTracePoint[];
  performance?: TimelinePerformance[];
  nowMs?: number;
  status?: "idle" | "hit" | "miss";
  title: string;
  showNoteNames?: boolean;
  pixelsPerBeat?: number;
  namingSystem?: NamingSystem;
}

const WIDTH = 900;
const staffYForMidi = (midi: number) => layoutWrittenPitch(writtenPitchFromMidi(Math.round(midi))).y;

export function GameStage({ events, activeIndex, hidden, currentBeat, trace = [], performance = [], nowMs, status = "idle", title, showNoteNames = false, pixelsPerBeat, namingSystem = "letters" }: Props) {
  const beat = currentBeat ?? activeBeat(events, activeIndex);
  const clock = nowMs ?? trace.at(-1)?.time ?? performance.at(-1)?.startedAt ?? 0;
  return <section className={`game-stage ${status}`} aria-label={`${title} music staff`}>
    <div className="stage-heading"><div><span className="eyebrow">LIVE STAFF</span><h2>{title}</h2></div><div className="stage-legend"><span>◆ target</span><span>━ duration</span><span>✓ / × result</span><span>⌁ played pitch</span></div></div>
    <div className="staff-viewport">
      <svg className="staff" viewBox={`0 0 ${WIDTH} 260`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Interactive treble staff">
        <defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="ribbon" x1="0" x2="1"><stop stopColor="#54e7d4"/><stop offset="1" stopColor="#805dff"/></linearGradient></defs>
        <rect width={WIDTH} height="260" rx="28" className="staff-field" />
        {[94,110,126,142,158].map((y) => <line key={y} x1="42" x2={WIDTH - 24} y1={y} y2={y} className="staff-line" />)}
        <TrebleClef x={58} y={147} className="clef-path" />
        {events.map((event, index) => {
          const x = eventX(event, beat, pixelsPerBeat), active = index === activeIndex;
          if (x < 90 || x > WIDTH + 80) return null;
          if (event.kind === "rest") return <g key={event.id} data-duration-notation={event.durationBeats >= 4 ? "whole-rest" : event.durationBeats >= 2 ? "half-rest" : event.durationBeats <= .75 ? "eighth-rest" : "quarter-rest"} className={active ? "active-event" : ""}><RestGlyph x={x} y={126} durationBeats={event.durationBeats} className="rest-path" /></g>;
          const pitch = event.writtenPitch ?? writtenPitchFromMidi(event.midi ?? 60), layout = layoutWrittenPitch(pitch), concealed = hidden && index >= activeIndex;
          return <g key={event.id} data-event-id={event.id} data-pitch-y={layout.y} className={`${active ? "active-event" : ""} ${index < activeIndex ? "completed-event" : ""}`}>
            <rect x={x - 8} y={layout.y - 7} width={eventWidth(event,pixelsPerBeat)} height="14" rx="7" className="target-ribbon" />
            {concealed ? <g><circle cx={x} cy="126" r="14" className="hidden-slot"/><text x={x} y="131" textAnchor="middle" className="slot-text">?</text></g> : <g>
              {layout.ledgerLines.map((y) => <line key={y} x1={x - 17} x2={x + 17} y1={y} y2={y} className="ledger-line" />)}
              <AccidentalGlyph x={x - 21} y={layout.y} accidental={pitch.accidental} />
              <NoteGlyph x={x} y={layout.y} durationBeats={event.durationBeats} />
              {showNoteNames && event.midi !== undefined && <text x={x} y="218" textAnchor="middle" className="note-label">{teachingNoteName(event.midi,namingSystem)}</text>}
              {index < activeIndex && <text x={x} y="205" textAnchor="middle" className="history-mark" aria-label="correct answer">✓</text>}
            </g>}
          </g>;
        })}
        {performance.map((item) => { const x = traceX(item.startedAt, clock), y = staffYForMidi(item.midi); return x < 90 || x > WIDTH ? null : <g key={item.id} data-performance-midi={item.midi} data-duration-ms={Math.round(item.durationMs)} className={`performance-note ${item.outcome}`}><ellipse cx={x} cy={y} rx="8" ry="6"/><line x1={x-7} x2={x + Math.max(12, item.durationMs * .096)} y1={y} y2={y}/><text x={x} y={y-13} textAnchor="middle">{item.outcome === "incorrect" ? "×" : "✓"}</text></g>; })}
        <line x1={PLAYHEAD_X} x2={PLAYHEAD_X} y1="50" y2="190" className="playhead" filter="url(#glow)"/><path d={`M ${PLAYHEAD_X - 7} 48 L ${PLAYHEAD_X + 7} 48 L ${PLAYHEAD_X} 60 Z`} className="playhead-tip"/>
        {trace.length > 1 && <polyline className="pitch-trace" points={trace.filter((point) => clock - point.time <= 8_000).map((point) => `${traceX(point.time, clock)},${staffYForMidi(point.midiFloat)}`).join(" ")} />}
      </svg>
    </div>
  </section>;
}
