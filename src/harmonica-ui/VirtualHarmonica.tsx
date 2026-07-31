import { useRef, useState } from "react";
import type { HarmonicaProfile, Breath, HarmonicaAction, Slide } from "../harmonica/profile";
import { teachingNoteName, type NamingSystem } from "../music/naming";

interface Props {
  profile: HarmonicaProfile;
  onStart: (action: HarmonicaAction) => void;
  onEnd: (action: HarmonicaAction, durationMs: number) => void;
  showLabels?: boolean;
  namingSystem?: NamingSystem;
  detectedMidis?: number[];
  guideMidis?: number[];
}

const LANES: { breath: Breath; slide: Slide; breathSymbol: string; label: string; slideLabel: string }[] = [
  { breath: "blow", slide: "out", breathSymbol: "↑", label: "BLOW", slideLabel: "SLIDE OUT" },
  { breath: "draw", slide: "out", breathSymbol: "↓", label: "DRAW", slideLabel: "SLIDE OUT" },
  { breath: "blow", slide: "in", breathSymbol: "↑", label: "BLOW", slideLabel: "SLIDE IN" },
  { breath: "draw", slide: "in", breathSymbol: "↓", label: "DRAW", slideLabel: "SLIDE IN" },
];

export function VirtualHarmonica({ profile, onStart, onEnd, showLabels = false, namingSystem = "letters", detectedMidis = [], guideMidis = [] }: Props) {
  const started = useRef(new Map<string, number>());
  const [pressed, setPressed] = useState(() => new Set<string>());
  const setSounding = (id: string, sounding: boolean) => setPressed((value) => { const next = new Set(value); sounding ? next.add(id) : next.delete(id); return next; });
  const start = (action: HarmonicaAction, key: string) => { if (started.current.has(key)) return; started.current.set(key, performance.now()); setSounding(action.id, true); onStart(action); };
  const end = (action: HarmonicaAction, key: string) => { const at = started.current.get(key); if (at === undefined) return; started.current.delete(key); setSounding(action.id, false); onEnd(action, performance.now() - at); };
  const holes = Array.from({ length: profile.holeCount }, (_, index) => index + 1);
  const actionButton = (hole: number, breath: Breath, slide: Slide) => {
    const action = profile.physicalActions.find((item) => item.hole === hole && item.breath === breath && item.slide === slide)!;
    const keyboardKey = `keyboard-${action.id}`;
    const detected = detectedMidis.includes(action.canonicalMidi), guided = guideMidis.includes(action.canonicalMidi);
    return <button key={action.id} data-action-id={action.id} data-hole={hole} data-breath={breath} data-slide={slide}
      className={`action-cell ${pressed.has(action.id) ? "sounding" : ""} ${detected ? "detected" : ""} ${guided ? "guided" : ""}`}
      aria-label={`Hole ${hole}, ${breath}, slide ${slide}${showLabels ? `, ${teachingNoteName(action.canonicalMidi,namingSystem)}` : ""}`}
      aria-pressed={pressed.has(action.id)}
      onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); start(action, `pointer-${event.pointerId}`); }}
      onPointerUp={(event) => end(action, `pointer-${event.pointerId}`)} onPointerCancel={(event) => end(action, `pointer-${event.pointerId}`)}
      onKeyDown={(event) => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); start(action, keyboardKey); } }}
      onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); end(action, keyboardKey); } }}>
      <span className="cell-hole">{hole}</span>
      {showLabels && <strong>{teachingNoteName(action.canonicalMidi,namingSystem,false)}</strong>}
    </button>;
  };
  return <section className="virtual-panel" data-testid="virtual-harmonica" data-profile={profile.id}>
    <div className="instrument-title"><span><b>{profile.holeCount}-HOLE CHROMATIC · C</b><small>Hold a position to play · glowing positions match the detected pitch</small></span><div className="instrument-status"><span className="status-out">OUT</span><span className="status-in">IN</span></div></div>
    <div className="harmonica-scroll">
      <div className="harmonica-body" style={{ "--hole-count": profile.holeCount } as React.CSSProperties}>
        <div className="cover-plate"><span className="cover-brand">HARMONICA</span><div className="cover-holes">{holes.map((hole) => <span key={hole}>{hole}</span>)}</div><span className="slide-button" aria-hidden="true" /></div>
        <div className="mouthpiece">
          {LANES.map((lane) => <div className={`action-lane ${lane.breath} ${lane.slide}`} key={`${lane.breath}-${lane.slide}`}>
            <span className="lane-label"><i>{lane.breathSymbol}</i><b>{lane.label}</b><small>{lane.slideLabel}</small></span>
            <div className="lane-actions">{holes.map((hole) => actionButton(hole,lane.breath,lane.slide))}</div>
          </div>)}
        </div>
        <div className="instrument-rail"><span>SOLO TUNING</span><i/><span>{profile.holeCount} HOLES · {profile.physicalActions.length} PLAYABLE POSITIONS</span></div>
      </div>
    </div>
  </section>;
}
