import { useEffect, useMemo, useRef, useState } from "react";
import { RecordingContext, Renderer, Scene } from "../vendor/canvas-ir/index";
import {
  getPortableInstrumentProfile,
  getPrimaryInstrumentPlacement,
  PORTABLE_INSTRUMENTS,
  type PortableInstrumentId,
} from "../instruments/instrumentProfiles";
import { drawPortableInstrumentToCanvasIr } from "../instruments/instrumentCanvasRenderer";
import { noteName as midiToPitchName } from "../music/pitch";
import {
  buildCallPromptMidis,
  buildScaleMidisInRange,
  CALL_AND_RESPONSE_PROMPTS,
  getRecommendedInstrumentScale,
  getScaleFormula,
  IMPROVISATION_CONSTRAINT_CARDS,
  ROOT_PITCH_CLASSES,
  SCALE_FORMULAS,
  type ScaleFormulaId,
} from "./scaleCatalog";

export interface ImprovisationWorkspaceProps {
  readonly defaultInstrumentId?: PortableInstrumentId;
  readonly onPlayMidiNote?: (midi: number, durationMs?: number) => void;
  readonly onExportPhraseToWorkbench?: (title: string, midis: readonly number[]) => void;
}

export function ImprovisationWorkspace({
  defaultInstrumentId = "harmonica-c12",
  onPlayMidiNote,
  onExportPhraseToWorkbench,
}: ImprovisationWorkspaceProps) {
  const [instrumentId, setInstrumentId] = useState<PortableInstrumentId>(defaultInstrumentId);
  const [rootSemitone, setRootSemitone] = useState<number>(0);
  const [scaleId, setScaleId] = useState<ScaleFormulaId>("major-pentatonic");
  const [activeConstraintId, setActiveConstraintId] = useState<string>(IMPROVISATION_CONSTRAINT_CARDS[0]!.id);
  const [activeCallPromptId, setActiveCallPromptId] = useState<string>(CALL_AND_RESPONSE_PROMPTS[0]!.id);
  const [playedPhraseMidis, setPlayedPhraseMidis] = useState<number[]>([]);
  const [activeMidi, setActiveMidi] = useState<number | null>(60);
  const [continuousCentsOffset, setContinuousCentsOffset] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const instrument = useMemo(() => getPortableInstrumentProfile(instrumentId), [instrumentId]);
  const scaleFormula = useMemo(() => getScaleFormula(scaleId), [scaleId]);
  const rootInfo = useMemo(
    () => ROOT_PITCH_CLASSES.find((item) => item.semitone === rootSemitone) ?? ROOT_PITCH_CLASSES[0]!,
    [rootSemitone],
  );
  const scaleMidis = useMemo(
    () =>
      buildScaleMidisInRange(
        rootSemitone,
        scaleFormula,
        instrument.minMidi,
        instrument.maxMidi,
      ),
    [rootSemitone, scaleFormula, instrument],
  );
  const scalePitchClasses = useMemo(
    () => new Set(scaleFormula.intervals.map((iv) => (rootSemitone + iv) % 12)),
    [rootSemitone, scaleFormula],
  );

  const activeConstraint = useMemo(
    () => IMPROVISATION_CONSTRAINT_CARDS.find((c) => c.id === activeConstraintId) ?? IMPROVISATION_CONSTRAINT_CARDS[0]!,
    [activeConstraintId],
  );
  const constraintEvaluation = useMemo(
    () => activeConstraint.checkPass(playedPhraseMidis, rootInfo.defaultMidi, scaleFormula.intervals),
    [activeConstraint, playedPhraseMidis, rootInfo.defaultMidi, scaleFormula.intervals],
  );

  const activeCallPrompt = useMemo(
    () => CALL_AND_RESPONSE_PROMPTS.find((p) => p.id === activeCallPromptId) ?? CALL_AND_RESPONSE_PROMPTS[0]!,
    [activeCallPromptId],
  );
  const callPromptMidis = useMemo(() => buildCallPromptMidis(activeCallPrompt), [activeCallPrompt]);

  function playSynthTone(midi: number, durationMs = 340) {
    if (onPlayMidiNote) {
      onPlayMidiNote(midi, durationMs);
      return;
    }
    try {
      const AudioCtor =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      osc.type = instrument.family === "kalimba" ? "sine" : instrument.family === "pontic-lyra" ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // Ignore WebAudio restrictions in headless tests
    }
  }

  function triggerNote(midi: number) {
    setActiveMidi(midi);
    setPlayedPhraseMidis((prev) => [...prev.slice(-15), midi]);
    playSynthTone(midi, 320);
  }

  function playCallSequence() {
    callPromptMidis.forEach((midi, idx) => {
      window.setTimeout(() => {
        setActiveMidi(midi);
        playSynthTone(midi, 360);
      }, idx * 420);
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = 760;
    const height = 240;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rc = new RecordingContext();
    drawPortableInstrumentToCanvasIr(rc, {
      profile: instrument,
      x: 10,
      y: 8,
      width: width - 20,
      height: height - 16,
      targetMidi: activeMidi ?? undefined,
      detectedMidis: activeMidi !== null ? [activeMidi] : [],
      scalePitchClasses,
      tonicPitchClass: rootSemitone,
      centsDeviation: continuousCentsOffset,
    });

    const scene = new Scene(rc.getDocument());
    const renderer = new Renderer(scene, ctx);
    renderer.setView({ a: dpr, b: 0, c: 0, d: dpr, e: 0, f: 0 }, canvas.width, canvas.height);
    renderer.render();
  }, [instrument, activeMidi, scalePitchClasses, rootSemitone, continuousCentsOffset]);

  const activePlacement = useMemo(
    () => (activeMidi !== null ? getPrimaryInstrumentPlacement(instrument, activeMidi) : null),
    [instrument, activeMidi],
  );

  return (
    <section
      className="improvisation-workspace-panel"
      data-testid="improvisation-workspace"
      aria-label="Scale Explorer and Improvisation Studio"
    >
      <header className="improvisation-header">
        <div>
          <span className="eyebrow">Ear-on-the-Fly &amp; Multi-Instrument Improvisation</span>
          <h3>Scale Explorer, Physical Projections &amp; Constraint Missions</h3>
          <p className="small-note">
            See safe scale tones directly on your instrument&apos;s physical geometry (CanvasIR), practice call-and-response by ear, and complete phrasing missions.
          </p>
        </div>
        <div className="improvisation-controls-row">
          <label className="compact-field">
            <span>Instrument</span>
            <select
              data-testid="improv-instrument-select"
              value={instrument.id}
              onChange={(e) => {
                const nextId = e.target.value as PortableInstrumentId;
                setInstrumentId(nextId);
              }}
            >
              {PORTABLE_INSTRUMENTS.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </label>

          <label className="compact-field">
            <span>Root Key</span>
            <select
              data-testid="improv-root-select"
              value={rootSemitone}
              onChange={(e) => setRootSemitone(Number(e.target.value))}
            >
              {ROOT_PITCH_CLASSES.map((root) => (
                <option key={root.semitone} value={root.semitone}>
                  {root.label}
                </option>
              ))}
            </select>
          </label>

          <label className="compact-field">
            <span>Scale / Mode</span>
            <select
              data-testid="improv-scale-select"
              value={scaleId}
              onChange={(e) => setScaleId(e.target.value as ScaleFormulaId)}
            >
              {SCALE_FORMULAS.map((formula) => (
                <option key={formula.id} value={formula.id}>
                  {formula.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="secondary-btn"
            data-testid="improv-recommended-preset-btn"
            onClick={() => {
              const rec = getRecommendedInstrumentScale(instrument.id);
              setRootSemitone(rec.rootSemitone);
              setScaleId(rec.scaleId);
            }}
          >
            Recommended for {instrument.shortName}
          </button>
        </div>
      </header>

      <div className="improvisation-grid">
        <div className="improvisation-stage-column">
          <div className="improv-canvas-card">
            <div className="improv-canvas-card-header">
              <strong>
                {rootInfo.label} {scaleFormula.label} on {instrument.name}
              </strong>
              <span className="improv-badge">
                {scaleMidis.length} playable scale tones ({midiToPitchName(instrument.minMidi)}–
                {midiToPitchName(instrument.maxMidi)})
              </span>
            </div>

            <canvas
              ref={canvasRef}
              className="improv-instrument-canvas"
              data-testid="improv-instrument-canvas"
              style={{ width: "100%", maxWidth: 760, height: 240 }}
            />

            {instrument.pitchControl === "continuous" && (
              <div className="improv-continuous-pitch-bar" data-testid="improv-continuous-pitch-bar">
                <label>
                  <span>
                    Fretless Intonation / Micro-detune ({continuousCentsOffset > 0 ? `+${continuousCentsOffset}` : continuousCentsOffset}¢)
                  </span>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    value={continuousCentsOffset}
                    onChange={(e) => setContinuousCentsOffset(Number(e.target.value))}
                  />
                </label>
                <span className="small-note">{instrument.description}</span>
              </div>
            )}

            <div className="improv-scale-note-strip" data-testid="improv-scale-note-strip">
              {scaleMidis.slice(0, 14).map((midi) => {
                const isRoot = ((midi - rootSemitone) % 12 + 12) % 12 === 0;
                const placement = getPrimaryInstrumentPlacement(instrument, midi);
                return (
                  <button
                    key={midi}
                    type="button"
                    data-testid={`improv-note-btn-${midi}`}
                    className={`improv-scale-note-btn ${activeMidi === midi ? "active" : ""} ${isRoot ? "root-tone" : ""}`}
                    onClick={() => triggerNote(midi)}
                  >
                    <strong>{midiToPitchName(midi)}</strong>
                    <small>{placement?.label ?? "Play"}</small>
                  </button>
                );
              })}
            </div>

            {activePlacement && activeMidi !== null && (
              <div className="improv-active-placement-readout" data-testid="improv-active-placement-readout">
                <span>
                  Active Note: <strong>{midiToPitchName(activeMidi)}</strong>
                </span>
                <span>
                  Physical Action: <strong>{activePlacement.label}</strong>
                </span>
                <span>
                  Articulation: <strong>{instrument.articulation}</strong> ({instrument.pitchControl})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="improvisation-missions-column">
          <div className="improv-mission-card" data-testid="improv-constraint-card">
            <div className="improv-card-header">
              <span>Improvisation Constraint Card</span>
              <select
                data-testid="improv-constraint-select"
                value={activeConstraintId}
                onChange={(e) => setActiveConstraintId(e.target.value)}
              >
                {IMPROVISATION_CONSTRAINT_CARDS.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.title} ({card.category})
                  </option>
                ))}
              </select>
            </div>
            <p className="improv-prompt-copy">{activeConstraint.prompt}</p>
            <p className="small-note">{activeConstraint.evaluationHint}</p>

            <div
              className={`improv-evaluation-banner ${constraintEvaluation.passed ? "passed" : "pending"}`}
              data-testid="improv-constraint-status"
            >
              <strong>{constraintEvaluation.passed ? "Mission Complete" : "In Progress"}:</strong>{" "}
              {constraintEvaluation.feedback}
            </div>

            <div className="improv-captured-phrase-row">
              <span>
                Phrase ({playedPhraseMidis.length} notes):{" "}
                <strong>
                  {playedPhraseMidis.length > 0
                    ? playedPhraseMidis.map((m) => midiToPitchName(m)).join(" → ")
                    : "Tap scale notes to improvise a phrase"}
                </strong>
              </span>
              <div className="improv-phrase-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="improv-clear-phrase-btn"
                  onClick={() => setPlayedPhraseMidis([])}
                >
                  Clear Phrase
                </button>
                {onExportPhraseToWorkbench && playedPhraseMidis.length > 0 && (
                  <button
                    type="button"
                    className="primary-btn"
                    data-testid="improv-send-phrase-to-editor-btn"
                    onClick={() =>
                      onExportPhraseToWorkbench(
                        `${rootInfo.label} ${scaleFormula.label} Improvisation`,
                        playedPhraseMidis,
                      )
                    }
                  >
                    Open Phrase in Score Editor
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="improv-mission-card" data-testid="improv-call-response-card">
            <div className="improv-card-header">
              <span>Call &amp; Response Ear Trainer</span>
              <select
                data-testid="improv-call-prompt-select"
                value={activeCallPromptId}
                onChange={(e) => {
                  const next = CALL_AND_RESPONSE_PROMPTS.find((p) => p.id === e.target.value);
                  setActiveCallPromptId(e.target.value);
                  if (next) {
                    setScaleId(next.scaleId);
                  }
                }}
              >
                {CALL_AND_RESPONSE_PROMPTS.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.title} [{prompt.difficulty}]
                  </option>
                ))}
              </select>
            </div>
            <p className="improv-prompt-copy">{activeCallPrompt.instruction}</p>
            <div className="improv-call-buttons">
              <button
                type="button"
                className="secondary-btn"
                data-testid="improv-play-call-btn"
                onClick={playCallSequence}
              >
                Play Call ({callPromptMidis.map((m) => midiToPitchName(m)).join(" - ")})
              </button>
              <button
                type="button"
                className="secondary-btn"
                data-testid="improv-echo-call-btn"
                onClick={() => {
                  setPlayedPhraseMidis(callPromptMidis);
                  if (callPromptMidis.length > 0) {
                    setActiveMidi(callPromptMidis[callPromptMidis.length - 1]!);
                  }
                }}
              >
                Load Call into Phrase Buffer
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
