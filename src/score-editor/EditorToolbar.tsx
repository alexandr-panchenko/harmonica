import { DURATION_PRESETS, type EditableEvent } from "./editorTypes";

export interface EditorToolbarProps {
  selectedEvent?: EditableEvent;
  selectedCount: number;
  canUndo: boolean;
  canRedo: boolean;
  canMerge: boolean;
  canTie: boolean;
  deletePolicy: "close-gap" | "leave-rest";
  arrowPitchMode: "diatonic" | "semitone";
  isPlaying: boolean;
  loopSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSetDuration: (ticks: number) => void;
  onConvertNoteRest: () => void;
  onInsertBefore: (kind: "note" | "rest") => void;
  onInsertAfter: (kind: "note" | "rest") => void;
  onDelete: (policy: "close-gap" | "leave-rest") => void;
  onSetDeletePolicy: (policy: "close-gap" | "leave-rest") => void;
  onSetArrowPitchMode: (mode: "diatonic" | "semitone") => void;
  onSplit: () => void;
  onMerge: () => void;
  onToggleTie: () => void;
  onTranspose: (semitones: number, all: boolean) => void;
  onShiftOctave: (octaves: number, all: boolean) => void;
  onCropToSelection: () => void;
  onPlayFromStart: () => void;
  onPlayFromSelection: () => void;
  onStopPlayback: () => void;
  onToggleLoop: () => void;
}

export function EditorToolbar({
  selectedEvent,
  selectedCount,
  canUndo,
  canRedo,
  canMerge,
  canTie,
  deletePolicy,
  arrowPitchMode,
  isPlaying,
  loopSelection,
  onUndo,
  onRedo,
  onSetDuration,
  onConvertNoteRest,
  onInsertBefore,
  onInsertAfter,
  onDelete,
  onSetDeletePolicy,
  onSetArrowPitchMode,
  onSplit,
  onMerge,
  onToggleTie,
  onTranspose,
  onShiftOctave,
  onCropToSelection,
  onPlayFromStart,
  onPlayFromSelection,
  onStopPlayback,
  onToggleLoop,
}: EditorToolbarProps) {
  const hasSelection = Boolean(selectedEvent) || selectedCount > 0;

  return (
    <section className="editor-toolbar" aria-label="Score correction toolbar">
      <div className="editor-toolbar-group" role="group" aria-label="History">
        <span className="toolbar-group-label">HISTORY</span>
        <div className="toolbar-btn-row">
          <button type="button" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
            ↶ Undo
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo} aria-label="Redo">
            ↷ Redo
          </button>
        </div>
      </div>

      <div className="editor-toolbar-group" role="group" aria-label="Audition">
        <span className="toolbar-group-label">AUDITION</span>
        <div className="toolbar-btn-row">
          {!isPlaying ? (
            <>
              <button type="button" className="listen" onClick={onPlayFromStart}>
                ▶ Play start
              </button>
              <button
                type="button"
                className="listen"
                disabled={!hasSelection}
                onClick={onPlayFromSelection}
              >
                ▶ From selection
              </button>
            </>
          ) : (
            <button type="button" className="listen active" onClick={onStopPlayback}>
              ■ Stop
            </button>
          )}
          <button
            type="button"
            aria-pressed={loopSelection}
            className={loopSelection ? "active" : ""}
            onClick={onToggleLoop}
          >
            ↻ Loop
          </button>
        </div>
      </div>

      <div className="editor-toolbar-group" role="group" aria-label="Duration">
        <span className="toolbar-group-label">DURATION</span>
        <div className="toolbar-btn-row duration-presets">
          {DURATION_PRESETS.slice(0, 7).map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={!selectedEvent}
              aria-label={`Duration ${preset.label}`}
              aria-pressed={selectedEvent?.durationTick === preset.ticks}
              className={selectedEvent?.durationTick === preset.ticks ? "active" : ""}
              onClick={() => onSetDuration(preset.ticks)}
            >
              {preset.shortLabel}
            </button>
          ))}
          <select
            aria-label="All durations"
            disabled={!selectedEvent}
            value={
              DURATION_PRESETS.some((p) => p.ticks === selectedEvent?.durationTick)
                ? String(selectedEvent?.durationTick)
                : ""
            }
            onChange={(e) => e.target.value && onSetDuration(Number(e.target.value))}
          >
            <option value="" disabled>
              More…
            </option>
            {DURATION_PRESETS.map((p) => (
              <option key={p.id} value={p.ticks}>
                {p.label} ({p.ticks}t)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="editor-toolbar-group" role="group" aria-label="Event edits">
        <span className="toolbar-group-label">EVENT</span>
        <div className="toolbar-btn-row">
          <button
            type="button"
            disabled={!selectedEvent}
            onClick={onConvertNoteRest}
            aria-label={selectedEvent?.kind === "rest" ? "Convert rest to note" : "Convert note to rest"}
          >
            {selectedEvent?.kind === "rest" ? "♩ Rest → Note" : "— Note → Rest"}
          </button>
          <button type="button" onClick={() => onInsertBefore("note")}>
            + Note before
          </button>
          <button type="button" onClick={() => onInsertAfter("note")}>
            + Note after
          </button>
          <button type="button" onClick={() => onInsertAfter("rest")}>
            + Rest after
          </button>
          <button
            type="button"
            disabled={!selectedEvent || selectedEvent.durationTick < 120}
            onClick={onSplit}
          >
            ✂ Split
          </button>
          <button type="button" disabled={!canMerge} onClick={onMerge}>
            ⊕ Merge
          </button>
          <button
            type="button"
            disabled={!selectedEvent || selectedEvent.kind !== "note" || (!canTie && !selectedEvent.tieOut)}
            aria-pressed={Boolean(selectedEvent?.tieOut)}
            className={selectedEvent?.tieOut ? "active" : ""}
            onClick={onToggleTie}
          >
            ⌒ Tie
          </button>
        </div>
      </div>

      <div className="editor-toolbar-group" role="group" aria-label="Delete and range">
        <span className="toolbar-group-label">DELETE & RANGE</span>
        <div className="toolbar-btn-row">
          <button
            type="button"
            disabled={!selectedEvent}
            onClick={() => onDelete("close-gap")}
          >
            ⌫ Delete & close gap
          </button>
          <button
            type="button"
            disabled={!selectedEvent}
            onClick={() => onDelete("leave-rest")}
          >
            — Delete & leave rest
          </button>
          <select
            aria-label="Delete key policy"
            value={deletePolicy}
            onChange={(e) => onSetDeletePolicy(e.target.value as "close-gap" | "leave-rest")}
          >
            <option value="close-gap">Del key: Close gap</option>
            <option value="leave-rest">Del key: Leave rest</option>
          </select>
          <select
            aria-label="Arrow key pitch step"
            value={arrowPitchMode}
            onChange={(e) => onSetArrowPitchMode(e.target.value as "diatonic" | "semitone")}
          >
            <option value="diatonic">Arrows: Diatonic step</option>
            <option value="semitone">Arrows: Semitone</option>
          </select>
          <button
            type="button"
            disabled={!hasSelection}
            onClick={() => onShiftOctave(1, false)}
            title="Shift selection +1 octave"
          >
            Oct +1
          </button>
          <button
            type="button"
            disabled={!hasSelection}
            onClick={() => onShiftOctave(-1, false)}
            title="Shift selection -1 octave"
          >
            Oct −1
          </button>
          <button
            type="button"
            disabled={!hasSelection}
            onClick={() => onTranspose(1, false)}
            title="Transpose selection +1 semitone"
          >
            Semi +1
          </button>
          <button
            type="button"
            disabled={!hasSelection}
            onClick={() => onTranspose(-1, false)}
            title="Transpose selection -1 semitone"
          >
            Semi −1
          </button>
          <button
            type="button"
            disabled={!hasSelection}
            onClick={onCropToSelection}
          >
            Crop to selection
          </button>
        </div>
      </div>
    </section>
  );
}
