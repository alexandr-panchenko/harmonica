import { useEffect, useState } from "react";
import { STANDARD_C12, type Breath, type HarmonicaAction, type Slide } from "../harmonica/profile";
import { noteName } from "../music/pitch";

interface Props { onStart: (action: HarmonicaAction) => void; onEnd: (action: HarmonicaAction, durationMs: number) => void; showLabels?: boolean }
export function VirtualHarmonica({ onStart, onEnd, showLabels = true }: Props) {
  const [breath, setBreath] = useState<Breath>("blow"), [slide, setSlide] = useState<Slide>("out"), [started] = useState(new Map<number, number>());
  const action = (hole: number) => STANDARD_C12.physicalActions.find((item) => item.hole === hole && item.breath === breath && item.slide === slide)!;
  const down = (hole: number, pointerId: number) => { const selected = action(hole); started.set(pointerId, performance.now()); onStart(selected); };
  const up = (hole: number, pointerId: number) => { const selected = action(hole), at = started.get(pointerId) ?? performance.now(); started.delete(pointerId); onEnd(selected, performance.now() - at); };
  useEffect(() => { const keydown = (event: KeyboardEvent) => { if (event.key === " ") setBreath((value) => value === "blow" ? "draw" : "blow"); if (event.key === "Shift") setSlide("in"); }; const keyup = (event: KeyboardEvent) => { if (event.key === "Shift") setSlide("out"); }; addEventListener("keydown", keydown); addEventListener("keyup", keyup); return () => { removeEventListener("keydown", keydown); removeEventListener("keyup", keyup); }; }, []);
  return <div className="virtual-panel" data-testid="virtual-harmonica">
    <div className="instrument-controls">
      <div className="segmented" aria-label="Breath direction"><button className={breath === "blow" ? "active" : ""} onClick={() => setBreath("blow")}>↑ Blow</button><button className={breath === "draw" ? "active" : ""} onClick={() => setBreath("draw")}>↓ Draw</button></div>
      <button className={`slide-control ${slide === "in" ? "active" : ""}`} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setSlide("in"); }} onPointerUp={() => setSlide("out")} onPointerCancel={() => setSlide("out")}><span>SLIDE</span><small>{slide === "in" ? "IN" : "hold"}</small></button>
    </div>
    <div className="harmonica-body">{Array.from({ length: 12 }, (_, index) => index + 1).map((hole) => { const selected = action(hole); return <button key={hole} data-hole={hole} className="hole" onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); down(hole, e.pointerId); }} onPointerUp={(e) => up(hole, e.pointerId)} onPointerCancel={(e) => up(hole, e.pointerId)}><b>{hole}</b>{showLabels && <small>{noteName(selected.canonicalMidi)}</small>}</button>; })}</div>
    <p className="instrument-hint">Hold a hole for duration · Space changes breath · Hold Shift for slide</p>
  </div>;
}
