import type { WrittenPitch } from "../music/melody";
import {
  formatWrittenPitch,
  midiFromWrittenPitch,
  respellMidiPitch,
} from "./EditableArrangement";
import {
  CANONICAL_PPQ,
  DURATION_PRESETS,
  type EditableArrangement,
  type EditableEvent,
  type EditorValidationReport,
  type HarmonicaRangeDiagnostics,
} from "./editorTypes";
import { measureTicksForMeter } from "./validation";

export interface EventInspectorProps {
  arrangement: EditableArrangement;
  selectedEvent?: EditableEvent;
  selectedEventIds: string[];
  rangeDiagnostics: HarmonicaRangeDiagnostics;
  validation: EditorValidationReport;
  onSetPitch: (midi: number, writtenPitch?: WrittenPitch) => void;
  onRespellPitch: (writtenPitch: WrittenPitch) => void;
  onMoveDiatonic: (deltaSteps: number) => void;
  onSetDuration: (durationTick: number) => void;
  onSelectProfile: (profileId: string) => void;
  onApplySuggestedTranspose: (semitones: number) => void;
  onUpdateMetadata: (meta: {
    title?: string;
    composer?: string;
    tempoQpm?: number;
    meter?: { numerator: number; denominator: number };
    key?: { tonic?: string; mode?: string; prefer?: "sharps" | "flats" };
  }) => void;
  onCloseMobileDrawer?: () => void;
}

const STEPS: WrittenPitch["step"][] = ["C", "D", "E", "F", "G", "A", "B"];

export function EventInspector({
  arrangement,
  selectedEvent,
  selectedEventIds,
  rangeDiagnostics,
  validation,
  onSetPitch,
  onRespellPitch,
  onMoveDiatonic,
  onSetDuration,
  onSelectProfile,
  onApplySuggestedTranspose,
  onUpdateMetadata,
  onCloseMobileDrawer,
}: EventInspectorProps) {
  const measureTicks = measureTicksForMeter(arrangement.meter);
  const measureNum = selectedEvent ? Math.floor(selectedEvent.startTick / measureTicks) + 1 : 1;
  const beatInMeasure = selectedEvent
    ? ((selectedEvent.startTick % measureTicks) / CANONICAL_PPQ + 1).toFixed(2)
    : "1.00";
  const fingering = selectedEvent
    ? rangeDiagnostics.fingeringByEventId[selectedEvent.id]
    : undefined;

  return (
    <aside className="event-inspector" aria-label="Selection inspector">
      <div className="inspector-section">
        <div className="inspector-header">
          <span className="eyebrow">SELECTION INSPECTOR</span>
          <b>
            {selectedEvent
              ? `${selectedEvent.kind === "note" ? `Note ${formatWrittenPitch(selectedEvent.writtenPitch, selectedEvent.midi)}` : "Rest"}`
              : `${selectedEventIds.length} selected`}
          </b>
          {selectedEventIds.length > 1 && (
            <small className="range-badge">{selectedEventIds.length} events in range</small>
          )}
          {onCloseMobileDrawer && (
            <button
              type="button"
              className="mobile-inspector-close"
              aria-label="Close inspector"
              onClick={onCloseMobileDrawer}
            >
              Done
            </button>
          )}
        </div>

        {selectedEvent ? (
          <>
            <div className="inspector-kv-grid">
              <span>
                Measure / Beat{" "}
                <b>
                  M{measureNum} · B{beatInMeasure}
                </b>
              </span>
              <span>
                Start / Dur{" "}
                <b>
                  {selectedEvent.startTick}t / {selectedEvent.durationTick}t
                </b>
              </span>
              <span>
                Origin <b>{selectedEvent.origin}</b>
              </span>
              <span>
                Source ID{" "}
                <code>{selectedEvent.sourceEventIds[0] ?? selectedEvent.id.slice(0, 12)}</code>
              </span>
            </div>

            {selectedEvent.kind === "note" && selectedEvent.writtenPitch && (
              <div className="inspector-pitch-box">
                <div className="inspector-row">
                  <label>
                    Step
                    <select
                      aria-label="Written pitch step"
                      value={selectedEvent.writtenPitch.step}
                      onChange={(e) => {
                        const nextPitch: WrittenPitch = {
                          ...selectedEvent.writtenPitch!,
                          step: e.target.value as WrittenPitch["step"],
                        };
                        onSetPitch(midiFromWrittenPitch(nextPitch), nextPitch);
                      }}
                    >
                      {STEPS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Accidental
                    <select
                      aria-label="Written accidental"
                      value={selectedEvent.writtenPitch.accidental ?? "none"}
                      onChange={(e) => {
                        const val = e.target.value;
                        const acc =
                          val === "sharp" || val === "flat" || val === "natural" ? val : undefined;
                        const nextPitch: WrittenPitch = {
                          ...selectedEvent.writtenPitch!,
                          accidental: acc,
                        };
                        onSetPitch(midiFromWrittenPitch(nextPitch), nextPitch);
                      }}
                    >
                      <option value="none">None</option>
                      <option value="sharp">♯ Sharp</option>
                      <option value="flat">♭ Flat</option>
                      <option value="natural">♮ Natural</option>
                    </select>
                  </label>

                  <label>
                    Octave
                    <select
                      aria-label="Written pitch octave"
                      value={selectedEvent.writtenPitch.octave}
                      onChange={(e) => {
                        const nextPitch: WrittenPitch = {
                          ...selectedEvent.writtenPitch!,
                          octave: Number(e.target.value),
                        };
                        onSetPitch(midiFromWrittenPitch(nextPitch), nextPitch);
                      }}
                    >
                      {[2, 3, 4, 5, 6, 7].map((oct) => (
                        <option key={oct} value={oct}>
                          {oct}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="inspector-btn-strip">
                  <button
                    type="button"
                    aria-label="Step pitch up"
                    onClick={() => onMoveDiatonic(1)}
                  >
                    ↑ Step +1
                  </button>
                  <button
                    type="button"
                    aria-label="Step pitch down"
                    onClick={() => onMoveDiatonic(-1)}
                  >
                    ↓ Step −1
                  </button>
                  <button
                    type="button"
                    aria-label="Respell enharmonically"
                    onClick={() => {
                      const next = respellMidiPitch(
                        selectedEvent.midi ?? 60,
                        "toggle",
                        selectedEvent.writtenPitch,
                      );
                      onRespellPitch(next);
                    }}
                  >
                    ♯/♭ Respell
                  </button>
                </div>

                {fingering && (
                  <div className={`inspector-fingering ${fingering.unplayable ? "unplayable" : ""}`}>
                    <span>Harmonica placement:</span>
                    <b>{fingering.recommendedLabel}</b>
                    {fingering.alternativeCount > 0 && (
                      <small>+{fingering.alternativeCount} alternate position(s)</small>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="inspector-duration-box">
              <label>
                Exact duration (ticks)
                <select
                  aria-label="Inspector duration preset"
                  value={
                    DURATION_PRESETS.some((p) => p.ticks === selectedEvent.durationTick)
                      ? String(selectedEvent.durationTick)
                      : "custom"
                  }
                  onChange={(e) =>
                    e.target.value !== "custom" && onSetDuration(Number(e.target.value))
                  }
                >
                  {DURATION_PRESETS.map((p) => (
                    <option key={p.id} value={p.ticks}>
                      {p.label} ({p.ticks} ticks)
                    </option>
                  ))}
                  {!DURATION_PRESETS.some((p) => p.ticks === selectedEvent.durationTick) && (
                    <option value="custom">Custom ({selectedEvent.durationTick} ticks)</option>
                  )}
                </select>
              </label>
            </div>
          </>
        ) : (
          <p className="inspector-empty">Click any note or rest on the staff or timing lane.</p>
        )}
      </div>

      <div className="inspector-section" aria-label="Harmonica range diagnostics">
        <div className="inspector-header">
          <span className="eyebrow">HARMONICA RANGE & FINGERING</span>
          <div className="segmented" role="group" aria-label="Editor harmonica profile">
            <button
              type="button"
              aria-pressed={rangeDiagnostics.holeCount === 12}
              className={rangeDiagnostics.holeCount === 12 ? "active" : ""}
              onClick={() => onSelectProfile("standard-c-12")}
            >
              12-hole C
            </button>
            <button
              type="button"
              aria-pressed={rangeDiagnostics.holeCount === 10}
              className={rangeDiagnostics.holeCount === 10 ? "active" : ""}
              onClick={() => onSelectProfile("standard-c-10")}
            >
              10-hole C
            </button>
          </div>
        </div>

        <div className="inspector-kv-grid">
          <span>
            Playable range <b>{rangeDiagnostics.insideRangePercent}%</b>
          </span>
          <span>
            Out of range <b>{rangeDiagnostics.outOfRangeEventIds.length}</b>
          </span>
          <span>
            Slide / Breath{" "}
            <b>
              {rangeDiagnostics.estimatedSlideChanges} / {rangeDiagnostics.estimatedBreathChanges}
            </b>
          </span>
          <span>
            Max hole jump <b>{rangeDiagnostics.maxHoleJump}</b>
          </span>
        </div>

        {rangeDiagnostics.outOfRangeEventIds.length > 0 &&
          rangeDiagnostics.suggestedTransposeSemitones !== 0 && (
            <div className="range-fit-suggestion">
              <span>
                {rangeDiagnostics.outOfRangeEventIds.length} note(s) outside {rangeDiagnostics.holeCount}-hole
                range (MIDI {rangeDiagnostics.minMidi}–{rangeDiagnostics.maxMidi}).
              </span>
              <button
                type="button"
                onClick={() =>
                  onApplySuggestedTranspose(rangeDiagnostics.suggestedTransposeSemitones)
                }
              >
                Transpose {rangeDiagnostics.suggestedTransposeSemitones > 0 ? "+" : ""}
                {rangeDiagnostics.suggestedTransposeSemitones} semitones to fit
              </button>
            </div>
          )}
      </div>

      <details className="inspector-section metadata-details" open>
        <summary>
          <span className="eyebrow">METADATA & NOTATION SETTINGS</span>
        </summary>
        <div className="metadata-form">
          <label>
            Title
            <input
              aria-label="Arrangement title"
              type="text"
              value={arrangement.title}
              onChange={(e) => onUpdateMetadata({ title: e.target.value })}
            />
          </label>
          <label>
            Composer / Source
            <input
              aria-label="Arrangement composer"
              type="text"
              value={arrangement.composer ?? ""}
              onChange={(e) => onUpdateMetadata({ composer: e.target.value })}
            />
          </label>
          <div className="inspector-row">
            <label>
              Tempo (BPM)
              <input
                aria-label="Arrangement tempo"
                type="number"
                min={30}
                max={260}
                value={arrangement.tempoQpm}
                onChange={(e) => onUpdateMetadata({ tempoQpm: Number(e.target.value) })}
              />
            </label>
            <label>
              Meter
              <select
                aria-label="Arrangement meter"
                value={`${arrangement.meter.numerator}/${arrangement.meter.denominator}`}
                onChange={(e) => {
                  const [n = "4", d = "4"] = e.target.value.split("/");
                  onUpdateMetadata({ meter: { numerator: Number(n), denominator: Number(d) } });
                }}
              >
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
                <option value="2/4">2/4</option>
                <option value="6/8">6/8</option>
              </select>
            </label>
          </div>
          <div className="inspector-row">
            <label>
              Key tonic
              <select
                aria-label="Arrangement key tonic"
                value={arrangement.key.tonic}
                onChange={(e) => onUpdateMetadata({ key: { tonic: e.target.value } })}
              >
                {["C", "G", "D", "A", "E", "F", "Bb", "Eb"].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Spelling
              <select
                aria-label="Arrangement spelling preference"
                value={arrangement.key.prefer}
                onChange={(e) =>
                  onUpdateMetadata({ key: { prefer: e.target.value as "sharps" | "flats" } })
                }
              >
                <option value="sharps">Prefer sharps (♯)</option>
                <option value="flats">Prefer flats (♭)</option>
              </select>
            </label>
          </div>
        </div>
      </details>

      {validation.allIssues.length > 0 && (
        <div className="inspector-section" aria-label="Validation diagnostics">
          <span className="eyebrow">VALIDATION ({validation.allIssues.length})</span>
          <div className="validation-list">
            {validation.allIssues.map((issue, idx) => (
              <p
                key={`${issue.code}-${idx}`}
                className={`validation-item ${issue.severity}`}
                data-testid={`validation-${issue.code}`}
              >
                <b>{issue.code}</b> {issue.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
