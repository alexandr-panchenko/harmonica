import { useMemo, useState } from "react";
import { STANDARD_C10, STANDARD_C12, type HarmonicaAction, type HarmonicaProfile } from "../../harmonica/profile";
import { teachingNoteName } from "../../music/naming";
import { LabHeader } from "../staff/StaffDesignLab";
import { demoActions, harmonicaHitZones, slideStateForActions, type HarmonicaConcept, type HarmonicaDemoState, type VisualSlideState } from "./geometry";

const CONCEPTS: { id: HarmonicaConcept; label: string; note: string }[] = [
  { id: "steel", label: "Brushed light steel", note: "Most realistic material; precise highlights and a restrained industrial character." },
  { id: "pearl", label: "Pearl / silver", note: "Softer satin body with a warm learning-product feel and low overlay competition." },
  { id: "illustration", label: "Product illustration hybrid", note: "Slightly simplified vector surfaces; strongest scaling, provenance, and deterministic state control." },
];

const STATES: { id: HarmonicaDemoState; label: string }[] = [
  { id: "idle", label: "Idle" }, { id: "guided", label: "Guided target" }, { id: "pressed", label: "User pressed" },
  { id: "mic-single", label: "Mic · one mapping" }, { id: "mic-ambiguous", label: "Mic · mixed mappings" },
  { id: "correct", label: "Correct" }, { id: "incorrect", label: "Incorrect" },
];

export function HarmonicaDesignLab() {
  const [concept, setConcept] = useState<HarmonicaConcept>("illustration");
  const [profile, setProfile] = useState<HarmonicaProfile>(STANDARD_C12);
  const [state, setState] = useState<HarmonicaDemoState>("guided");
  const [labels, setLabels] = useState(true);
  const [manualAction, setManualAction] = useState<HarmonicaAction>();
  const actions = manualAction ? [manualAction] : demoActions(profile, state);
  const slider = slideStateForActions(actions);
  const currentConcept = CONCEPTS.find((item) => item.id === concept)!;

  return <main className="design-lab harmonica-design-lab" data-testid="harmonica-design-lab">
    <LabHeader title="Harmonica design laboratory" index="LAB 02 · INSTRUMENT" subtitle="The harmonica is the subject: three light material directions, one deterministic four-zone geometry, and honest microphone ambiguity." />
    <section className="concept-comparison" aria-label="Visual concept comparison">
      {CONCEPTS.map((item) => <button key={item.id} className={concept === item.id ? "selected" : ""} onClick={() => setConcept(item.id)} aria-pressed={concept === item.id}>
        <span className={`concept-swatch concept-${item.id}`}><i/><i/><i/><i/><i/></span><b>{item.label}</b><small>{item.note}</small>{item.id === "illustration" && <em>RECOMMENDED</em>}
      </button>)}
    </section>
    <section className="design-controls" aria-label="Harmonica laboratory controls">
      <div className="control-group"><span>Instrument</span><button className={profile.holeCount === 10 ? "active" : ""} onClick={() => { setProfile(STANDARD_C10); setManualAction(undefined); }}>10 holes</button><button className={profile.holeCount === 12 ? "active" : ""} onClick={() => { setProfile(STANDARD_C12); setManualAction(undefined); }}>12 holes</button></div>
      <label>State<select aria-label="Instrument state" value={state} onChange={(event) => { setState(event.target.value as HarmonicaDemoState); setManualAction(undefined); }}>{STATES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <div className="control-group"><span>Note labels</span><button className={!labels ? "active" : ""} onClick={() => setLabels(false)}>Off</button><button className={labels ? "active" : ""} onClick={() => setLabels(true)}>On</button></div>
    </section>
    <section className="lab-annotation harmonica-note"><div><span className="lab-kicker">ACTIVE DIRECTION</span><h2>{currentConcept.label}</h2><p>{currentConcept.note} Tap any quadrant: that one action sets hole, breath, and slide together.</p></div><ul><li>near-orthographic front/top 3/4</li><li>equal-size physical holes</li><li>separate animated slider</li><li>40 / 48 direct actions</li></ul></section>
    <HarmonicaConceptView concept={concept} profile={profile} state={state} labels={labels} actions={actions} slider={slider} onAction={(action) => { setManualAction(action); setState("pressed"); }}/>
    <section className="state-explainer" aria-live="polite">
      <div><span>VISIBLE SLIDER</span><strong>{slider === "neutral" ? "Neutral · mapping is ambiguous" : slider === "in" ? "Pressed" : "Released"}</strong></div>
      <div><span>ACTIVE MAPPINGS</span><strong>{actions.length ? actions.map((action) => `${action.hole} ${action.breath}/${action.slide}`).join(" · ") : "None"}</strong></div>
      <div><span>GEOMETRY</span><strong>{harmonicaHitZones(profile.holeCount).length} normalized zones</strong></div>
    </section>
    <details className="lab-source"><summary>Engineering notes inside the prototype</summary><p>The visual body is a parameterized SVG/CSS product-illustration base, while the mouthpiece uses deterministic HTML buttons generated from the typed profile. A reviewed owner photograph can later replace only the material layer. Mic matches with mixed slide mappings highlight every valid quadrant and leave the physical slider neutral.</p></details>
  </main>;
}

function HarmonicaConceptView({ concept, profile, state, labels, actions, slider, onAction }: { concept: HarmonicaConcept; profile: HarmonicaProfile; state: HarmonicaDemoState; labels: boolean; actions: HarmonicaAction[]; slider: VisualSlideState; onAction: (action: HarmonicaAction) => void }) {
  const activeIds = new Set(actions.map((action) => action.id));
  const holes = useMemo(() => Array.from({ length: profile.holeCount }, (_, index) => index + 1), [profile.holeCount]);
  return <section className={`lab-instrument concept-${concept} state-${state}`} data-testid="lab-harmonica" data-profile={profile.id} data-slider={slider}>
    <div className="instrument-scroll">
      <div className="instrument-object" style={{ "--lab-holes": profile.holeCount } as React.CSSProperties}>
        <div className="instrument-top" aria-hidden="true"><span className="top-vent v1"/><span className="top-vent v2"/><span className="top-vent v3"/><i className="cover-ridge"/></div>
        <div className="instrument-face">
          <div className="end-cap left" aria-hidden="true"/>
          <div className="physical-holes">
            {holes.map((hole) => <div className="physical-hole" data-hole={hole} key={hole}>
              <span className="physical-number" aria-hidden="true">{hole}</span>
              <div className="action-quadrants">
                {(["blow-out", "blow-in", "draw-out", "draw-in"] as const).map((pair) => {
                  const [breath, slide] = pair.split("-") as ["blow" | "draw", "out" | "in"];
                  const action = profile.physicalActions.find((item) => item.hole === hole && item.breath === breath && item.slide === slide)!;
                  const active = activeIds.has(action.id);
                  return <button key={action.id} className={`${breath} ${slide} ${active ? "active" : ""}`} data-action-id={action.id} data-breath={breath} data-slide={slide} aria-label={`Hole ${hole}, ${breath}, slide ${slide}${labels ? `, ${teachingNoteName(action.canonicalMidi, "letters")}` : ""}`} aria-pressed={state === "pressed" && active} onClick={() => onAction(action)}>
                    <span className="direction-mark" aria-hidden="true">{breath === "blow" ? "↑" : "↓"}</span>{labels && <strong>{teachingNoteName(action.canonicalMidi, "letters")}</strong>}<span className="slide-mark" aria-hidden="true">{slide === "in" ? "●│" : "● ─"}</span>
                  </button>;
                })}
              </div>
            </div>)}
          </div>
          <div className="end-cap right" aria-hidden="true"/>
        </div>
        <div className={`physical-slider slider-${slider}`} aria-label={`Slider ${slider}`}><span className="slider-rod"/><span className="slider-knob"/></div>
        <div className="instrument-shadow" aria-hidden="true"/>
      </div>
    </div>
    <div className="instrument-legend"><span><b>↑</b> blow</span><span><b>↓</b> draw</span><span><b>● ─</b> slide out</span><span><b>●│</b> slide in</span><span>Click = complete physical action</span></div>
  </section>;
}
