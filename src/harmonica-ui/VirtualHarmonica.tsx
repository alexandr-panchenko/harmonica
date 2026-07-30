import { useRef, useState } from "react";
import { STANDARD_C12, type Breath, type HarmonicaAction, type Slide } from "../harmonica/profile";
import { noteName } from "../music/pitch";

interface Props { onStart: (action: HarmonicaAction) => void; onEnd: (action: HarmonicaAction, durationMs: number) => void; showLabels?: boolean }
const ROWS: { breath: Breath; slide: Slide; label: string; short: string }[] = [
  { breath: "blow", slide: "out", label: "Blow, slide out", short: "↑ OUT" },
  { breath: "blow", slide: "in", label: "Blow, slide in", short: "↑ IN" },
  { breath: "draw", slide: "out", label: "Draw, slide out", short: "↓ OUT" },
  { breath: "draw", slide: "in", label: "Draw, slide in", short: "↓ IN" },
];

export function VirtualHarmonica({ onStart, onEnd, showLabels = false }: Props) {
  const started = useRef(new Map<string, number>());
  const [pressed, setPressed] = useState(() => new Set<string>());
  const setSounding = (id: string, sounding: boolean) => setPressed((value) => { const next = new Set(value); sounding ? next.add(id) : next.delete(id); return next; });
  const start = (action: HarmonicaAction, key: string) => {
    if (started.current.has(key)) return;
    started.current.set(key, performance.now()); setSounding(action.id, true); onStart(action);
  };
  const end = (action: HarmonicaAction, key: string) => {
    const at = started.current.get(key); if (at === undefined) return;
    started.current.delete(key); setSounding(action.id, false); onEnd(action, performance.now() - at);
  };
  const bank = (holes: number[]) => <div className="action-bank">
    <span className="grid-corner" aria-hidden="true">ACTION</span>{holes.map((hole) => <span className="hole-number" key={hole}>#{hole}</span>)}
    {ROWS.flatMap((row) => [<span className="action-row-label" key={`${row.label}-label`} title={row.label}>{row.short}</span>, ...holes.map((hole) => {
      const action = STANDARD_C12.physicalActions.find((item) => item.hole === hole && item.breath === row.breath && item.slide === row.slide)!;
      const keyboardKey = `keyboard-${action.id}`;
      return <button
        key={action.id}
        data-action-id={action.id}
        data-hole={hole}
        data-breath={row.breath}
        data-slide={row.slide}
        className={`action-cell ${pressed.has(action.id) ? "sounding" : ""}`}
        aria-label={`Hole ${hole}, ${row.breath}, slide ${row.slide}`}
        aria-pressed={pressed.has(action.id)}
        onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); start(action, `pointer-${event.pointerId}`); }}
        onPointerUp={(event) => end(action, `pointer-${event.pointerId}`)}
        onPointerCancel={(event) => end(action, `pointer-${event.pointerId}`)}
        onKeyDown={(event) => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); start(action, keyboardKey); } }}
        onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); end(action, keyboardKey); } }}
      ><span aria-hidden="true">{row.breath === "blow" ? "↑" : "↓"}<i>{row.slide === "in" ? "●" : "○"}</i></span>{showLabels && <small>{noteName(action.canonicalMidi)}</small>}</button>;
    })])}
  </div>;
  return <div className="virtual-panel" data-testid="virtual-harmonica">
    <div className="action-grid-heading"><div><span className="eyebrow">ONE-ACTION LAYOUT</span><b>Breath × slide × hole</b></div><span>○ slide out · ● slide in</span></div>
    <div className="action-banks">{bank([1,2,3,4,5,6])}{bank([7,8,9,10,11,12])}</div>
    <p className="instrument-hint">Press and hold one cell to sound and time the complete physical action.</p>
  </div>;
}
