import { useEffect, useMemo, useRef, useState } from "react";
import abcjs from "abcjs";
import { adaptAbc, bindAbcRender, ABCJS_TESTED_VERSION, type RenderAnchor } from "../../notation/abc/AbcAdapter";
import { buildTimelineGeometry } from "../../notation/abc/timelineGeometry";
import { STAFF_FIXTURES, staffFixture } from "./fixtures";

type RenderMode = "standard" | "timeline" | "timeline-game" | "standard-game";

const MODES: { id: RenderMode; label: string; note: string }[] = [
  { id: "standard", label: "abcjs standard engraving", note: "Conventional paper spacing. Inspect key signatures, rests, stems, beams, accidentals, ties, bars, and system wrapping." },
  { id: "timeline", label: "abcjs time-based layout", note: "Public timeBasedLayout only: horizontal distance reflects musical time, with no gameplay layer." },
  { id: "timeline-game", label: "Timeline Staff + overlays", note: "Time-based engraving plus an application-owned duration ribbon, fixed judgment line, held-note progress, and optional pitch trace." },
  { id: "standard-game", label: "Engraved Score + highlighting", note: "Calm conventional score with active-note highlighting and time progression; suitable as a reading mode." },
];

export function StaffDesignLab() {
  const [mode, setMode] = useState<RenderMode>("timeline-game");
  const [fixtureId, setFixtureId] = useState(STAFF_FIXTURES[0]!.id);
  const [progress, setProgress] = useState(0.1);
  const [trace, setTrace] = useState(true);
  const [density, setDensity] = useState<"spacious"|"balanced"|"compact">("balanced");
  const fixture = staffFixture(fixtureId);
  const document = useMemo(() => adaptAbc(fixture.abc), [fixture]);
  const activeBeat = document.totalBeats * progress;
  const activeIndex = Math.max(0, document.writtenEvents.findIndex((event) => activeBeat >= event.startBeat && activeBeat < event.startBeat + event.durationBeats));
  const active = document.writtenEvents[activeIndex] ?? document.writtenEvents.at(-1)!;

  return <main className="design-lab staff-design-lab" data-testid="staff-design-lab">
    <LabHeader title="Staff design laboratory" index="LAB 01 · NOTATION" subtitle="Five render paths, one deliberately difficult fixture. This route is evidence for owner review—not a production renderer migration." />
    <section className="design-controls" aria-label="Staff laboratory controls">
      <label>Render mode<select aria-label="Render mode" value={mode} onChange={(event) => setMode(event.target.value as RenderMode)}>{MODES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Fixture<select aria-label="Fixture" value={fixtureId} onChange={(event) => setFixtureId(event.target.value)}>{STAFF_FIXTURES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="progress-control">Position <input aria-label="Playback position" type="range" min="0" max="0.999" step="0.001" value={progress} onChange={(event) => setProgress(Number(event.target.value))}/><span>{activeBeat.toFixed(1)} / {document.totalBeats.toFixed(1)} beats</span></label>
      <label className="check-control"><input type="checkbox" checked={trace} onChange={(event) => setTrace(event.target.checked)}/> performed pitch trace</label>
      <label>Density<select aria-label="Timeline density" value={density} onChange={(event)=>setDensity(event.target.value as typeof density)}><option value="spacious">Spacious</option><option value="balanced">Balanced</option><option value="compact">Compact</option></select></label>
    </section>
    <section className="lab-annotation">
      <div><span className="lab-kicker">WHAT TO INSPECT</span><h2>{MODES.find((item) => item.id === mode)!.label}</h2><p>{MODES.find((item) => item.id === mode)!.note}</p></div>
      <ul>{fixture.checks.map((check) => <li key={check}>{check}</li>)}</ul>
    </section>
    <section className="staff-comparison-stage" data-render-mode={mode}>
      <AbcPrototype source={fixture.abc} document={document} mode={mode} active={active} activeBeat={activeBeat} trace={trace} density={density}/>
    </section>
    <section className="lab-facts">
      <Fact label="abcjs" value={ABCJS_TESTED_VERSION + " pinned"}/><Fact label="Written events" value={`${document.writtenEvents.length}`}/><Fact label="Sounding events" value={`${document.soundingEvents.length}`}/><Fact label="Tie model" value={`${document.writtenEvents.length - document.soundingEvents.length} merged/rest delta`}/><Fact label="Meter" value={`${document.meter.numerator}/${document.meter.denominator}`}/><Fact label="Pickup" value={`${document.pickupBeats} beats`}/>
    </section>
    <details className="lab-source"><summary>Fixture ABC and adapter diagnostics</summary><p>{fixture.summary}</p><pre>{fixture.abc}</pre><p>{document.diagnostics.length ? document.diagnostics.join("\n") : "abcjs parse: no warnings"}</p></details>
  </main>;
}

function AbcPrototype({ source, document, mode, active, activeBeat, trace, density }: { source: string; document: ReturnType<typeof adaptAbc>; mode: RenderMode; active: ReturnType<typeof adaptAbc>["writtenEvents"][number]; activeBeat: number; trace: boolean; density:"spacious"|"balanced"|"compact" }) {
  const root = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [anchors, setAnchors] = useState<RenderAnchor[]>([]);
  const timeBased = mode === "timeline" || mode === "timeline-game";
  const gameplay = mode === "timeline-game" || mode === "standard-game";
  const densityOptions={spacious:{padding:16,width:38,beat:47},balanced:{padding:13,width:33,beat:40},compact:{padding:10,width:29,beat:35}}[density];
  useEffect(() => {
    if (!root.current) return;
    const renderSource=timeBased?timelineSource(source):source;
    const visual = abcjs.renderAbc(root.current, renderSource, {
      add_classes: true,
      responsive: timeBased ? undefined : "resize",
      staffwidth: timeBased ? Math.max(1160, document.totalBeats * densityOptions.beat) : 1060,
      scale: 1.08,
      wrap: timeBased ? undefined : { minSpacing: 1.8, maxSpacing: 2.8, preferredMeasuresPerLine: 4 },
      timeBasedLayout: timeBased ? { minPadding: densityOptions.padding, minWidth: densityOptions.width, align: "left" } : undefined,
      paddingtop: 20,
      paddingbottom: gameplay ? 46 : 22,
    });
    const update = () => root.current && setAnchors(bindAbcRender(root.current, document.writtenEvents, visual[0]));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [source, document, timeBased, gameplay, densityOptions.padding, densityOptions.width, densityOptions.beat]);
  useEffect(() => {
    if (!root.current) return;
    for (const element of root.current.querySelectorAll("[data-written-event-id]")) element.classList.toggle("lab-active", (element as HTMLElement).dataset.writtenEventId === active.id);
    if (timeBased && scroll.current) {
      const anchor = anchors.find((item) => item.eventId === active.id);
      if (anchor) scroll.current.scrollLeft = Math.max(0, anchor.temporalX - scroll.current.clientWidth * 0.38);
    }
  }, [active.id, anchors, timeBased]);
  const activeAnchor = anchors.find((anchor) => anchor.eventId === active.id);
  const geometry=useMemo(()=>buildTimelineGeometry(document.writtenEvents,document.soundingEvents,anchors),[document,anchors]);
  const heldProgress = Math.max(0, Math.min(1, (activeBeat - active.startBeat) / active.durationBeats));
  return <div className={`abc-prototype ${timeBased ? "is-timeline" : "is-standard"} ${gameplay ? "has-gameplay" : ""}`}>
    {timeBased && <div className="timeline-playhead" aria-label="Fixed judgment line"><span>JUDGMENT</span></div>}
    <div className="abc-scroll" ref={scroll}><div className="abc-render" ref={root}/>{gameplay && <div className="abc-overlay" aria-hidden="true">
      {geometry.segments.map((segment) => {
        const event = document.writtenEvents.find((item) => item.id === segment.writtenEventId);
        if (!event || event.kind === "rest") return null;
        const isActive = event.id === active.id;
        return <span key={event.id} className={`duration-ribbon ${isActive ? "active" : ""}`} style={{ left: segment.startX, top: segment.centerY-5, width: Math.max(8,segment.endX-segment.startX) }}><i style={{ width: `${isActive ? heldProgress * 100 : event.startBeat < activeBeat ? 100 : 0}%` }}/></span>;
      })}
      {trace && activeAnchor && <svg className="performed-trace" style={{ left: Math.max(0, activeAnchor.temporalX - 150), top: Math.max(0, (activeAnchor.notehead?.centerY??activeAnchor.eventBounds.top) - 22) }} viewBox="0 0 250 70"><polyline points="0,48 38,47 74,45 110,46 142,30 180,31 220,29 250,31"/><circle cx="250" cy="31" r="4"/></svg>}
    </div>}
    </div>
    {gameplay && <div className="staff-game-legend"><span><i className="legend-ribbon"/> written duration</span><span><i className="legend-fill"/> elapsed hold</span><span><i className="legend-trace"/> performed pitch</span><strong>{Math.round(heldProgress * 100)}% of active event</strong></div>}
  </div>;
}

function timelineSource(source:string):string{const key=source.search(/^K:.*$/m);if(key<0)return source.replace(/\n/g," ");const body=source.indexOf("\n",key);return body<0?source:source.slice(0,body+1)+source.slice(body+1).replace(/\n/g," ")}

export function LabHeader({ title, subtitle, index }: { title: string; subtitle: string; index: string }) {
  return <header className="design-lab-header"><a href="../../">← Trainer</a><span>{index}</span><h1>{title}</h1><p>{subtitle}</p><nav><a href="../staff-design/">Staff lab</a><a href="../harmonica-design/">Harmonica lab</a></nav></header>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
