import { useRef, useState } from "react";
import { STANDARD_C12, type Breath, type HarmonicaAction, type Slide } from "../harmonica/profile";
import { noteName } from "../music/pitch";

interface Props { onStart: (action: HarmonicaAction) => void; onEnd: (action: HarmonicaAction, durationMs: number) => void; showLabels?: boolean }
const BREATHS: { breath: Breath; symbol: string; label: string }[] = [
  { breath: "blow", symbol: "↑", label: "BLOW" },
  { breath: "draw", symbol: "↓", label: "DRAW" },
];
const SLIDES: { slide: Slide; symbol: string; label: string }[] = [
  { slide: "out", symbol: "○", label: "OUT" },
  { slide: "in", symbol: "●", label: "IN" },
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
  const actionButton = (hole: number, breath: Breath, slide: Slide) => {
      const action = STANDARD_C12.physicalActions.find((item) => item.hole === hole && item.breath === breath && item.slide === slide)!;
      const keyboardKey = `keyboard-${action.id}`;
      return <button
        key={action.id}
        data-action-id={action.id}
        data-hole={hole}
        data-breath={breath}
        data-slide={slide}
        className={`action-cell ${pressed.has(action.id) ? "sounding" : ""}`}
        aria-label={`Hole ${hole}, ${breath}, slide ${slide}`}
        aria-pressed={pressed.has(action.id)}
        onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); start(action, `pointer-${event.pointerId}`); }}
        onPointerUp={(event) => end(action, `pointer-${event.pointerId}`)}
        onPointerCancel={(event) => end(action, `pointer-${event.pointerId}`)}
        onKeyDown={(event) => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); start(action, keyboardKey); } }}
        onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); end(action, keyboardKey); } }}
      ><span className="slide-symbol" aria-hidden="true">{slide === "in" ? "●" : "○"}</span><span className="slide-name">{slide === "in" ? "IN" : "OUT"}</span>{showLabels && <small>{noteName(action.canonicalMidi)}</small>}</button>;
  };
  const holes = Array.from({length: 12}, (_, index) => index + 1);
  return <div className="virtual-panel" data-testid="virtual-harmonica">
    <div className="instrument-title"><span><b>CHROMATIC 12</b><small>Hold any action to play</small></span><div className="slide-key"><span>○ OUT</span><span>● IN</span></div></div>
    <div className="harmonica-scroll">
      <div className="harmonica-body">
        <div className="harmonica-brand" aria-hidden="true"><b>H</b><span>BREATH</span></div>
        <div className="hole-strip">{holes.map((hole) => <span className="hole-number" key={hole}>{hole}</span>)}</div>
        {BREATHS.map((row) => <div className={`breath-row ${row.breath}`} key={row.breath}>
          <span className="breath-label"><i>{row.symbol}</i><b>{row.label}</b></span>
          {holes.map((hole) => <div className="hole-actions" key={hole}>{SLIDES.map(({slide}) => actionButton(hole, row.breath, slide))}</div>)}
        </div>)}
        <div className="instrument-rail" aria-hidden="true"><span>STANDARD C</span><i/><span>12 HOLE CHROMATIC</span></div>
      </div>
    </div>
  </div>;
}
