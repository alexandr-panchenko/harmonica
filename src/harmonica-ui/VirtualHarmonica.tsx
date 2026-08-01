import { useRef, useState } from "react";
import { actionFor, type HarmonicaProfile, type Breath, type HarmonicaAction, type Slide } from "../harmonica/profile";
import { teachingNoteName, type NamingSystem } from "../music/naming";

interface Props {
  profile: HarmonicaProfile;
  onStart: (action: HarmonicaAction) => void;
  onEnd: (action: HarmonicaAction, durationMs: number) => void;
  showLabels?: boolean;
  namingSystem?: NamingSystem;
  detectedMidis?: number[];
  guideMidis?: number[];
  feedback?: { actionId: string; outcome: "correct" | "incorrect" };
}

const BREATHS: { breath: Breath; symbol: string; label: string; help: string }[] = [
  { breath: "blow", symbol: "↑", label: "BLOW", help: "Exhale" },
  { breath: "draw", symbol: "↓", label: "DRAW", help: "Inhale" },
];

const SLIDES: Slide[] = ["out", "in"];

export function VirtualHarmonica({
  profile,
  onStart,
  onEnd,
  showLabels = false,
  namingSystem = "letters",
  detectedMidis = [],
  guideMidis = [],
  feedback,
}: Props) {
  const started = useRef(new Map<string, number>());
  const [pressed, setPressed] = useState(() => new Set<string>());
  const holes = Array.from({ length: profile.holeCount }, (_, index) => index + 1);

  const setSounding = (id: string, sounding: boolean) => setPressed((value) => {
    const next = new Set(value);
    sounding ? next.add(id) : next.delete(id);
    return next;
  });

  const start = (action: HarmonicaAction, key: string) => {
    if (started.current.has(key)) return;
    started.current.set(key, performance.now());
    setSounding(action.id, true);
    onStart(action);
  };

  const end = (action: HarmonicaAction, key: string) => {
    const at = started.current.get(key);
    if (at === undefined) return;
    started.current.delete(key);
    setSounding(action.id, false);
    onEnd(action, performance.now() - at);
  };

  const actionButton = (hole: number, breath: Breath, slide: Slide) => {
    const action = actionFor(profile, hole, breath, slide);
    const keyboardKey = `keyboard-${action.id}`;
    const detected = detectedMidis.includes(action.canonicalMidi);
    const guided = guideMidis.includes(action.canonicalMidi);
    const outcome = feedback?.actionId === action.id ? feedback.outcome : undefined;
    const note = teachingNoteName(action.canonicalMidi, namingSystem);

    return <button
      key={action.id}
      data-action-id={action.id}
      data-hole={hole}
      data-breath={breath}
      data-slide={slide}
      data-midi={action.canonicalMidi}
      data-detected={detected || undefined}
      data-guided={guided || undefined}
      data-outcome={outcome}
      className={`action-cell slide-${slide} ${pressed.has(action.id) ? "sounding" : ""} ${detected ? "detected" : ""} ${guided ? "guided" : ""} ${outcome ?? ""}`}
      aria-label={`Hole ${hole}, ${breath}, slide ${slide}${showLabels ? `, ${note}` : ""}`}
      aria-pressed={pressed.has(action.id)}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        start(action, `pointer-${event.pointerId}`);
      }}
      onPointerUp={(event) => end(action, `pointer-${event.pointerId}`)}
      onPointerCancel={(event) => end(action, `pointer-${event.pointerId}`)}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault();
          start(action, keyboardKey);
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          end(action, keyboardKey);
        }
      }}
    >
      <span className="slide-action" aria-hidden="true"><span className="slide-icon"><span className="slide-icon-knob" /></span></span>
      {showLabels && <strong>{note}</strong>}
      {(detected || guided || outcome) && <span className="action-state" aria-hidden="true">{outcome === "correct" ? "✓" : outcome === "incorrect" ? "×" : detected ? "◉" : "◆"}</span>}
    </button>;
  };

  return <section className="virtual-panel" data-testid="virtual-harmonica" data-profile={profile.id}>
    <div className="instrument-title">
      <span><b>{profile.holeCount}-HOLE CHROMATIC · C</b><small>Hold either slider position to play and set duration</small></span>
    </div>
    <div className="harmonica-scroll">
      <div className="harmonica-body" style={{ "--hole-count": profile.holeCount } as React.CSSProperties}>
        <div className="cover-plate">
          <span className="cover-brand" aria-hidden="true">HARMONICA</span>
          <div className="cover-holes">{holes.map((hole) => <span className="hole-number" key={hole}>{hole}</span>)}</div>
          <span className="slide-button" aria-hidden="true" />
        </div>
        <div className="mouthpiece">
          {BREATHS.map((row) => <div className={`breath-row ${row.breath}`} data-breath-row={row.breath} key={row.breath}>
            <span className="breath-label"><i aria-hidden="true">{row.symbol}</i><span><b>{row.label}</b><small>{row.help}</small></span></span>
            <div className="breath-holes">
              {holes.map((hole) => <div className="hole-actions" data-hole-group={hole} key={hole}>{SLIDES.map((slide) => actionButton(hole, row.breath, slide))}</div>)}
            </div>
          </div>)}
        </div>
        <div className="instrument-rail" aria-hidden="true"><span>SOLO TUNING</span><i/><span>{profile.holeCount} HOLES · {profile.physicalActions.length} DIRECT ACTIONS</span></div>
      </div>
    </div>
  </section>;
}
