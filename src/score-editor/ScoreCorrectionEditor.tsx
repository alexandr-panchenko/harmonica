import { useEffect, useMemo, useRef, useState } from "react";
import { PlaybackEngine } from "../audio/PlaybackEngine";
import { STANDARD_C12 } from "../harmonica/profile";
import { MusicStage } from "../notation/abc/AbcRenderer";
import { adaptAbc } from "../notation/abc/AbcAdapter";
import { toAbc, type Candidate } from "../score-import/core";
import {
  compareOriginalAndEdited,
  type EditorCommandHistory,
} from "./EditableArrangement";
import { EditorNotationStage } from "./EditorNotationStage";
import { EditorToolbar } from "./EditorToolbar";
import { EventInspector } from "./EventInspector";
import { TimingLane } from "./TimingLane";
import {
  selectAdjacentEvent,
  selectContiguousRange,
  selectSingleEvent,
  type EditorSelectionState,
} from "./editorSelection";
import {
  CANONICAL_PPQ,
  type EditCommand,
  type EditableArrangementProject,
} from "./editorTypes";
import { editableArrangementToMelody } from "./serialization";
import { analyzeHarmonicaRange, validateArrangement } from "./validation";

export interface ScoreCorrectionEditorProps {
  history: EditorCommandHistory;
  project: EditableArrangementProject;
  baseCandidate?: Candidate;
  player: PlaybackEngine;
  profileId: string;
  onSelectProfile: (profileId: string) => void;
  onExecuteCommand: (command: EditCommand) => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetToCandidate: () => void;
  onOpenExportStage: () => void;
  onOpenInSongPractice: () => void;
}

export function ScoreCorrectionEditor({
  history,
  project,
  baseCandidate,
  player,
  profileId,
  onSelectProfile,
  onExecuteCommand,
  onUndo,
  onRedo,
  onResetToCandidate,
  onOpenExportStage,
  onOpenInSongPractice,
}: ScoreCorrectionEditorProps) {
  const arrangement = project.arrangement;
  const [selection, setSelection] = useState<EditorSelectionState>(() => ({
    anchorId: history.selection[0] ?? arrangement.events[0]?.id,
    selectedIds:
      history.selection.length > 0
        ? history.selection
        : arrangement.events[0]
          ? [arrangement.events[0].id]
          : [],
  }));
  const [deletePolicy, setDeletePolicy] = useState<"close-gap" | "leave-rest">("close-gap");
  const [arrowPitchMode, setArrowPitchMode] = useState<"diatonic" | "semitone">("diatonic");
  const [viewMode, setViewMode] = useState<"edited" | "original">("edited");
  const [confirmReset, setConfirmReset] = useState(false);
  const [loopSelection, setLoopSelection] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadBeat, setPlayheadBeat] = useState<number | undefined>(undefined);
  const playStartOffsetBeat = useRef(0);
  const playingLoopMode = useRef<"all" | "selection">("all");
  const playbackPendingRef = useRef(false);
  const mobileInspectorOpen = useState(false);

  // Sync selection when history updates (e.g. insert, split, merge, delete, undo, redo)
  useEffect(() => {
    const validIds = new Set(arrangement.events.map((e) => e.id));
    const historyIds = history.selection.filter((id) => validIds.has(id));
    if (historyIds.length > 0) {
      setSelection((prev) => ({
        ...prev,
        anchorId: historyIds[0],
        selectedIds: historyIds,
      }));
    } else if (arrangement.events[0]) {
      setSelection({
        anchorId: arrangement.events[0].id,
        selectedIds: [arrangement.events[0].id],
      });
    } else {
      setSelection({ selectedIds: [] });
    }
  }, [project, history]);

  const primarySelectedId = selection.selectedIds[0];
  const selectedEvent =
    arrangement.events.find((e) => e.id === primarySelectedId) ?? arrangement.events[0];

  const rangeDiagnostics = useMemo(
    () => analyzeHarmonicaRange(arrangement, profileId || STANDARD_C12.id),
    [arrangement, profileId],
  );
  const validation = useMemo(
    () => validateArrangement(arrangement, profileId || STANDARD_C12.id),
    [arrangement, profileId],
  );
  const diffSummary = useMemo(
    () =>
      compareOriginalAndEdited(
        history.base,
        project,
        rangeDiagnostics.minMidi,
        rangeDiagnostics.maxMidi,
      ),
    [history.base, project, rangeDiagnostics.minMidi, rangeDiagnostics.maxMidi],
  );

  const canMerge = useMemo(() => {
    if (selection.selectedIds.length === 1 && selectedEvent) {
      const idx = arrangement.events.findIndex((e) => e.id === selectedEvent.id);
      const next = arrangement.events[idx + 1];
      if (!next || next.kind !== selectedEvent.kind) return false;
      return selectedEvent.kind === "rest" || selectedEvent.midi === next.midi;
    }
    if (selection.selectedIds.length >= 2) {
      const indices = selection.selectedIds
        .map((id) => arrangement.events.findIndex((e) => e.id === id))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b);
      if (indices.length < 2) return false;
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] !== indices[i - 1]! + 1) return false;
      }
      const first = arrangement.events[indices[0]!]!;
      return indices.every((i) => {
        const ev = arrangement.events[i]!;
        return ev.kind === first.kind && (first.kind === "rest" || ev.midi === first.midi);
      });
    }
    return false;
  }, [arrangement.events, selectedEvent, selection.selectedIds]);

  const canTie = useMemo(() => {
    if (!selectedEvent || selectedEvent.kind !== "note") return false;
    const idx = arrangement.events.findIndex((e) => e.id === selectedEvent.id);
    const next = arrangement.events[idx + 1];
    return Boolean(next && next.kind === "note" && next.midi === selectedEvent.midi);
  }, [arrangement.events, selectedEvent]);

  const stopPlayback = () => {
    playbackPendingRef.current = false;
    player.stopReferencePlayback();
    setIsPlaying(false);
    setPlayheadBeat(undefined);
  };

  const startPlayback = (mode: "all" | "selection") => {
    player.stopReferencePlayback();
    playingLoopMode.current = mode;
    const fromEvent =
      mode === "selection" && selectedEvent ? selectedEvent : arrangement.events[0];
    const startOffsetBeat = fromEvent ? fromEvent.startTick / CANONICAL_PPQ : 0;
    playStartOffsetBeat.current = startOffsetBeat;

    const melody =
      mode === "selection"
        ? editableArrangementToMelody(
            arrangement,
            selectedEvent?.id,
            selection.selectedIds.length > 1 ? selection.selectedIds : undefined,
          )
        : editableArrangementToMelody(arrangement);

    playbackPendingRef.current = true;
    setIsPlaying(true);
    setPlayheadBeat(startOffsetBeat);
    void player.startReferencePlayback(melody, 0).then((session) => {
      playbackPendingRef.current = false;
      if (!session) {
        setIsPlaying(false);
        setPlayheadBeat(undefined);
      }
    });
  };

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      const snap = player.referenceSnapshot();
      if (snap.status === "playing") {
        setPlayheadBeat(playStartOffsetBeat.current + snap.positionBeat);
        raf = requestAnimationFrame(tick);
      } else if (playbackPendingRef.current) {
        raf = requestAnimationFrame(tick);
      } else if (snap.status === "complete") {
        if (loopSelection) {
          startPlayback(playingLoopMode.current);
        } else {
          setIsPlaying(false);
          setPlayheadBeat(undefined);
        }
      } else {
        setIsPlaying(false);
        setPlayheadBeat(undefined);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, loopSelection, arrangement]);

  useEffect(() => () => player.stopReferencePlayback(), [player]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        onRedo();
        return;
      }

      if (e.key === " ") {
        e.preventDefault();
        if (isPlaying) stopPlayback();
        else startPlayback("selection");
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const nextSel = selectAdjacentEvent(
          arrangement.events,
          selection,
          e.key === "ArrowRight" ? 1 : -1,
          e.shiftKey,
        );
        setSelection(nextSel);
        history.setSelection(nextSel.selectedIds);
        return;
      }

      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && selectedEvent?.kind === "note") {
        e.preventDefault();
        const dir = e.key === "ArrowUp" ? 1 : -1;
        if (e.altKey) {
          onExecuteCommand({
            type: "shift-octave",
            eventIds: selection.selectedIds,
            octaves: dir,
          });
        } else if (arrowPitchMode === "semitone") {
          onExecuteCommand({
            type: "transpose-selection",
            eventIds: selection.selectedIds,
            semitones: dir,
          });
        } else {
          onExecuteCommand({
            type: "move-pitch-diatonically",
            eventId: selectedEvent.id,
            deltaSteps: dir,
          });
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedEvent) {
        e.preventDefault();
        onExecuteCommand({
          type: "delete-event",
          eventId: selectedEvent.id,
          policy: deletePolicy,
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    arrangement.events,
    selection,
    selectedEvent,
    arrowPitchMode,
    deletePolicy,
    isPlaying,
    onUndo,
    onRedo,
    onExecuteCommand,
  ]);

  const handleSelectEvent = (eventId: string, shiftKey: boolean) => {
    const next = shiftKey
      ? selectContiguousRange(arrangement.events, selection, eventId)
      : selectSingleEvent(eventId);
    setSelection(next);
    history.setSelection(next.selectedIds);
  };

  return (
    <div className="score-correction-editor">
      <div className="editor-context-bar">
        <div className="editor-status-summary">
          <span className="status-pill" data-testid="editor-last-action">
            {history.lastDescription}
          </span>
          <span className="diff-pill" data-testid="editor-diff-summary">
            Diff: <b>{diffSummary.pitchesChanged}</b> pitch · <b>{diffSummary.spellingsChanged}</b>{" "}
            spelling · <b>{diffSummary.durationsChanged}</b> dur ·{" "}
            <b>+{diffSummary.notesInserted + diffSummary.restsInserted}</b> /{" "}
            <b>−{diffSummary.notesDeleted + diffSummary.restsDeleted}</b> events ·{" "}
            <b>{diffSummary.tiesChanged}</b> ties
          </span>
        </div>

        <div className="editor-view-actions">
          <div className="segmented" role="group" aria-label="Comparison view">
            <button
              type="button"
              className={viewMode === "edited" ? "active" : ""}
              aria-pressed={viewMode === "edited"}
              onClick={() => setViewMode("edited")}
            >
              Edited arrangement ({arrangement.events.length})
            </button>
            <button
              type="button"
              className={viewMode === "original" ? "active" : ""}
              aria-pressed={viewMode === "original"}
              onClick={() => setViewMode("original")}
            >
              Imported candidate ({baseCandidate?.canonicalEvents.length ?? 0})
            </button>
          </div>

          {!confirmReset ? (
            <button
              type="button"
              disabled={project.editLog.length === 0}
              onClick={() => setConfirmReset(true)}
            >
              Reset to imported candidate
            </button>
          ) : (
            <span className="reset-confirm-group">
              <button
                type="button"
                className="danger-btn"
                onClick={() => {
                  setConfirmReset(false);
                  onResetToCandidate();
                }}
              >
                Confirm reset
              </button>
              <button type="button" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </span>
          )}
        </div>
      </div>

      <EditorToolbar
        selectedEvent={selectedEvent}
        selectedCount={selection.selectedIds.length}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        canMerge={canMerge}
        canTie={canTie}
        deletePolicy={deletePolicy}
        arrowPitchMode={arrowPitchMode}
        isPlaying={isPlaying}
        loopSelection={loopSelection}
        onUndo={onUndo}
        onRedo={onRedo}
        onSetDuration={(ticks) =>
          selectedEvent &&
          onExecuteCommand({
            type: "set-duration",
            eventId: selectedEvent.id,
            durationTick: ticks,
          })
        }
        onConvertNoteRest={() =>
          selectedEvent &&
          onExecuteCommand({
            type: "convert-note-rest",
            eventId: selectedEvent.id,
            targetKind: selectedEvent.kind === "note" ? "rest" : "note",
            defaultMidi: 60,
          })
        }
        onInsertBefore={(kind) =>
          onExecuteCommand({
            type: "insert-event",
            targetEventId: selectedEvent?.id,
            placement: selection.insertionTick !== undefined ? "at-tick" : "before",
            atTick: selection.insertionTick,
            kind,
            durationTick: selectedEvent?.durationTick ?? 480,
            midi: kind === "note" ? (selectedEvent?.midi ?? 60) : undefined,
          })
        }
        onInsertAfter={(kind) =>
          onExecuteCommand({
            type: "insert-event",
            targetEventId: selectedEvent?.id,
            placement: "after",
            kind,
            durationTick: selectedEvent?.durationTick ?? 480,
            midi: kind === "note" ? (selectedEvent?.midi ?? 60) : undefined,
          })
        }
        onDelete={(policy) =>
          selectedEvent &&
          onExecuteCommand({
            type: "delete-event",
            eventId: selectedEvent.id,
            policy,
          })
        }
        onSetDeletePolicy={setDeletePolicy}
        onSetArrowPitchMode={setArrowPitchMode}
        onSplit={() =>
          selectedEvent &&
          onExecuteCommand({
            type: "split-event",
            eventId: selectedEvent.id,
          })
        }
        onMerge={() => {
          if (selection.selectedIds.length >= 2) {
            onExecuteCommand({
              type: "merge-events",
              eventIds: selection.selectedIds,
            });
          } else if (selectedEvent) {
            const idx = arrangement.events.findIndex((e) => e.id === selectedEvent.id);
            const next = arrangement.events[idx + 1];
            if (next) {
              onExecuteCommand({
                type: "merge-events",
                eventIds: [selectedEvent.id, next.id],
              });
            }
          }
        }}
        onToggleTie={() =>
          selectedEvent &&
          onExecuteCommand({
            type: "toggle-tie",
            eventId: selectedEvent.id,
          })
        }
        onTranspose={(semitones, all) =>
          onExecuteCommand({
            type: "transpose-selection",
            eventIds: all ? [] : selection.selectedIds,
            semitones,
          })
        }
        onShiftOctave={(octaves, all) =>
          onExecuteCommand({
            type: "shift-octave",
            eventIds: all ? [] : selection.selectedIds,
            octaves,
          })
        }
        onCropToSelection={() =>
          onExecuteCommand({
            type: "crop-to-selection",
            eventIds: selection.selectedIds,
          })
        }
        onPlayFromStart={() => startPlayback("all")}
        onPlayFromSelection={() => startPlayback("selection")}
        onStopPlayback={stopPlayback}
        onToggleLoop={() => setLoopSelection((v) => !v)}
      />

      <div className="editor-workspace-grid">
        <div className="editor-main-column">
          {viewMode === "edited" ? (
            <EditorNotationStage
              arrangement={arrangement}
              selectedEventIds={selection.selectedIds}
              changedEventIds={diffSummary.changedEventIds}
              outOfRangeEventIds={rangeDiagnostics.outOfRangeEventIds}
              playheadBeat={playheadBeat}
              onSelectEvent={handleSelectEvent}
              onDragPitchDiatonically={(eventId, deltaSteps) =>
                onExecuteCommand({
                  type: "move-pitch-diatonically",
                  eventId,
                  deltaSteps,
                })
              }
            />
          ) : (
            <section className="original-candidate-view" aria-label="Imported candidate notation">
              <div className="original-banner">
                <b>Read-only imported candidate:</b> {baseCandidate?.label} · Switch back to Edited
                arrangement to continue making corrections.
              </div>
              {baseCandidate && (
                <MusicStage
                  document={adaptAbc(toAbc(baseCandidate))}
                  mode="score"
                  activeBeat={0}
                  accessibleLabel="Original imported candidate preview"
                  ribbons="none"
                />
              )}
            </section>
          )}

          <TimingLane
            arrangement={arrangement}
            selectedEventIds={selection.selectedIds}
            insertionTick={selection.insertionTick}
            playheadBeat={playheadBeat}
            onSelectEvent={handleSelectEvent}
            onResizeDuration={(eventId, durationTick) =>
              onExecuteCommand({
                type: "set-duration",
                eventId,
                durationTick,
              })
            }
            onSetInsertionTick={(tick) =>
              setSelection((prev) => ({
                ...prev,
                insertionTick: prev.insertionTick === tick ? undefined : tick,
              }))
            }
          />

          <div className="editor-bottom-bar">
            <div className="bottom-bar-status">
              <span>
                Events: <b>{arrangement.events.length}</b> · Edit log:{" "}
                <b>{project.editLog.length}</b> command(s)
              </span>
              {!validation.valid && (
                <span className="blocking-error-badge">
                  {validation.blockingErrors.length} blocking error(s)
                </span>
              )}
            </div>
            <div className="bottom-bar-actions">
              <button
                type="button"
                className="mobile-inspector-toggle"
                onClick={() => mobileInspectorOpen[1]((v) => !v)}
              >
                {mobileInspectorOpen[0] ? "Hide inspector" : "Inspect event"}
              </button>
              <button type="button" onClick={onOpenExportStage}>
                Review & Export →
              </button>
              <button
                type="button"
                className="primary"
                disabled={!validation.valid}
                onClick={onOpenInSongPractice}
              >
                Open in Song Practice
              </button>
            </div>
          </div>
        </div>

        <div className={`editor-inspector-column ${mobileInspectorOpen[0] ? "mobile-open" : ""}`}>
          <EventInspector
            arrangement={arrangement}
            selectedEvent={selectedEvent}
            selectedEventIds={selection.selectedIds}
            rangeDiagnostics={rangeDiagnostics}
            validation={validation}
            onSetPitch={(midi, writtenPitch) =>
              selectedEvent &&
              onExecuteCommand({
                type: "set-pitch",
                eventId: selectedEvent.id,
                midi,
                writtenPitch,
              })
            }
            onRespellPitch={(writtenPitch) =>
              selectedEvent &&
              onExecuteCommand({
                type: "respell-pitch",
                eventId: selectedEvent.id,
                writtenPitch,
              })
            }
            onMoveDiatonic={(deltaSteps) =>
              selectedEvent &&
              onExecuteCommand({
                type: "move-pitch-diatonically",
                eventId: selectedEvent.id,
                deltaSteps,
              })
            }
            onSetDuration={(durationTick) =>
              selectedEvent &&
              onExecuteCommand({
                type: "set-duration",
                eventId: selectedEvent.id,
                durationTick,
              })
            }
            onSelectProfile={onSelectProfile}
            onApplySuggestedTranspose={(semitones) =>
              onExecuteCommand({
                type: "transpose-selection",
                eventIds: [],
                semitones,
              })
            }
            onUpdateMetadata={(meta) =>
              onExecuteCommand({
                type: "set-metadata",
                ...meta,
              })
            }
            onCloseMobileDrawer={() => mobileInspectorOpen[1](false)}
          />
        </div>
      </div>
    </div>
  );
}
