import abcjs from "abcjs";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { adaptAbc, bindAbcRender, extendStaffLines, type RenderAnchor } from "../notation/abc/AbcAdapter";
import { formatWrittenPitch, moveWrittenPitchDiatonically } from "./EditableArrangement";
import { CANONICAL_PPQ, type EditableArrangement, type EditableEvent } from "./editorTypes";
import { serializeArrangementToAbcWithMap } from "./serialization";
import { measureTicksForMeter } from "./validation";

export interface EditorNotationStageProps {
  arrangement: EditableArrangement;
  selectedEventIds: string[];
  changedEventIds: string[];
  outOfRangeEventIds: string[];
  playheadBeat?: number;
  onSelectEvent: (eventId: string, shiftKey: boolean) => void;
  onDragPitchDiatonically: (eventId: string, deltaSteps: number) => void;
}

const ENGRAVING_SCALE = 1.08;
const STEP_PIXELS = 4.5;

export function EditorNotationStage({
  arrangement,
  selectedEventIds,
  changedEventIds,
  outOfRangeEventIds,
  playheadBeat,
  onSelectEvent,
  onDragPitchDiatonically,
}: EditorNotationStageProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [anchors, setAnchors] = useState<(RenderAnchor & { canonicalEventId: string })[]>([]);
  const [dragPreview, setDragPreview] = useState<{
    eventId: string;
    startY: number;
    deltaSteps: number;
    moved: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setViewportWidth(Math.round(el.clientWidth));
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const serialized = serializeArrangementToAbcWithMap(arrangement);
  const document = adaptAbc(serialized.abc);
  const measureTicks = measureTicksForMeter(arrangement.meter);

  useEffect(() => {
    const root = renderRef.current;
    const coord = canvasRef.current;
    if (!root || !coord || !viewportWidth) return;

    const cleanAbc = serialized.abc.replace(/^[TC]:.*$/gm, (line) => " ".repeat(line.length));
    const staffWidth = Math.max(280, Math.max(320, viewportWidth) / ENGRAVING_SCALE - 24);
    const visual = abcjs.renderAbc(root, cleanAbc, {
      add_classes: true,
      staffwidth: staffWidth,
      scale: ENGRAVING_SCALE,
      wrap: {
        minSpacing: 1.8,
        maxSpacing: 2.8,
        preferredMeasuresPerLine: viewportWidth < 640 ? 2 : 4,
      },
      paddingleft: 12,
      paddingright: 12,
      paddingtop: 22,
      paddingbottom: 28,
    });

    let frame = 0;
    const measureAndBind = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        extendStaffLines(root);
        const bound = bindAbcRender(root, coord, document.writtenEvents, visual[0]);
        const mapped = bound.map((anchor) => {
          const wIdx = document.writtenEvents.findIndex((w) => w.id === anchor.eventId);
          const canonicalEventId =
            serialized.writtenTokenEventIds[wIdx] ??
            arrangement.events[Math.min(wIdx, arrangement.events.length - 1)]?.id ??
            anchor.eventId;
          return { ...anchor, canonicalEventId };
        });

        for (const svgEl of root.querySelectorAll<SVGElement>("[data-written-event-id]")) {
          const wId = svgEl.dataset.writtenEventId!;
          const wIdx = document.writtenEvents.findIndex((w) => w.id === wId);
          const canonicalId =
            serialized.writtenTokenEventIds[wIdx] ??
            arrangement.events[Math.min(wIdx, arrangement.events.length - 1)]?.id;
          if (canonicalId) {
            svgEl.dataset.canonicalEventId = canonicalId;
          }
        }
        setAnchors(mapped);
      });
    };

    measureAndBind();
    void globalThis.document.fonts?.ready.then(measureAndBind);
    const obs = new ResizeObserver(measureAndBind);
    obs.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      obs.disconnect();
    };
  }, [serialized.abc, viewportWidth]);

  // Apply selection/diff/range classes on SVG groups
  useEffect(() => {
    const root = renderRef.current;
    if (!root) return;
    const selectedSet = new Set(selectedEventIds);
    const changedSet = new Set(changedEventIds);
    const outSet = new Set(outOfRangeEventIds);
    for (const el of root.querySelectorAll<SVGElement>("[data-canonical-event-id]")) {
      const id = el.dataset.canonicalEventId!;
      el.classList.toggle("editor-selected", selectedSet.has(id));
      el.classList.toggle("editor-changed", changedSet.has(id));
      el.classList.toggle("editor-out-of-range", outSet.has(id));
    }
  }, [anchors, selectedEventIds, changedEventIds, outOfRangeEventIds]);

  // Deduplicate anchors by canonicalEventId (prefer first segment of barline-split notes for primary selection/drag hit target)
  const primaryAnchors = anchors.filter(
    (anchor, idx, arr) => arr.findIndex((a) => a.canonicalEventId === anchor.canonicalEventId) === idx,
  );

  const eventById = new Map<string, EditableEvent>(arrangement.events.map((e) => [e.id, e]));

  const playheadAnchor = (() => {
    if (playheadBeat === undefined || anchors.length === 0) return null;
    const tick = playheadBeat * CANONICAL_PPQ;
    const activeEvent =
      arrangement.events.find((e) => tick >= e.startTick && tick <= e.startTick + e.durationTick) ??
      arrangement.events.at(-1);
    if (!activeEvent) return null;
    const anchor = primaryAnchors.find((a) => a.canonicalEventId === activeEvent.id);
    if (!anchor) return null;
    const ratio = Math.max(
      0,
      Math.min(1, (tick - activeEvent.startTick) / Math.max(1, activeEvent.durationTick)),
    );
    return {
      x: anchor.eventBounds.left + anchor.eventBounds.width * ratio,
      y: anchor.eventBounds.top,
      height: Math.max(64, anchor.eventBounds.height + 28),
    };
  })();

  return (
    <section className="editor-notation-stage" aria-label="Editable score notation">
      <div className="editor-notation-viewport" ref={viewportRef}>
        <div className="editor-notation-canvas" ref={canvasRef}>
          {playheadAnchor && (
            <div
              className="editor-notation-playhead"
              data-testid="editor-notation-playhead"
              style={{
                left: playheadAnchor.x,
                top: Math.max(6, playheadAnchor.y - 12),
                height: playheadAnchor.height,
              }}
            />
          )}
          <div className="abc-production-render editor-abc-render" ref={renderRef} />

          <div className="editor-hit-overlay" role="group" aria-label="Score events">
            {primaryAnchors.map((anchor) => {
              const ev = eventById.get(anchor.canonicalEventId);
              if (!ev) return null;
              const isSelected = selectedEventIds.includes(ev.id);
              const isChanged = changedEventIds.includes(ev.id);
              const isOutOfRange = outOfRangeEventIds.includes(ev.id);
              const measureNum = Math.floor(ev.startTick / measureTicks) + 1;
              const pitchLabel =
                ev.kind === "note" ? formatWrittenPitch(ev.writtenPitch, ev.midi) : "Rest";
              const isDraggingThis = dragPreview?.eventId === ev.id;
              const previewPitchLabel =
                isDraggingThis && ev.kind === "note" && ev.writtenPitch && dragPreview.deltaSteps !== 0
                  ? formatWrittenPitch(
                      moveWrittenPitchDiatonically(ev.writtenPitch, dragPreview.deltaSteps).writtenPitch,
                    )
                  : null;

              const box = anchor.notehead
                ? {
                    left: anchor.notehead.left - 8,
                    top: anchor.notehead.top - 14,
                    width: Math.max(26, anchor.notehead.right - anchor.notehead.left + 16),
                    height: Math.max(34, anchor.notehead.bottom - anchor.notehead.top + 28),
                  }
                : {
                    left: anchor.eventBounds.left - 4,
                    top: anchor.eventBounds.top - 6,
                    width: Math.max(26, anchor.eventBounds.width + 8),
                    height: Math.max(34, anchor.eventBounds.height + 12),
                  };

              return (
                <button
                  key={ev.id}
                  type="button"
                  data-testid={`score-event-${ev.id}`}
                  data-event-id={ev.id}
                  data-event-kind={ev.kind}
                  data-pitch={pitchLabel}
                  aria-label={`${ev.kind === "note" ? `Note ${pitchLabel}` : "Rest"}, measure ${measureNum}, ${ev.durationTick} ticks`}
                  aria-pressed={isSelected}
                  className={`editor-event-hitbox ${ev.kind}${isSelected ? " selected" : ""}${isChanged ? " changed" : ""}${isOutOfRange ? " out-of-range" : ""}`}
                  style={{
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    transform:
                      isDraggingThis && dragPreview.deltaSteps !== 0
                        ? `translateY(${-dragPreview.deltaSteps * STEP_PIXELS}px)`
                        : undefined,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelectEvent(ev.id, e.shiftKey);
                    if (ev.kind === "note") {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDragPreview({
                        eventId: ev.id,
                        startY: e.clientY,
                        deltaSteps: 0,
                        moved: false,
                      });
                    }
                  }}
                  onPointerMove={(e) => {
                    if (!dragPreview || dragPreview.eventId !== ev.id) return;
                    const dy = dragPreview.startY - e.clientY;
                    const deltaSteps = Math.round(dy / STEP_PIXELS);
                    if (deltaSteps !== dragPreview.deltaSteps || Math.abs(dy) > 3) {
                      setDragPreview({
                        ...dragPreview,
                        deltaSteps,
                        moved: dragPreview.moved || deltaSteps !== 0,
                      });
                    }
                  }}
                  onPointerUp={(e) => {
                    if (dragPreview && dragPreview.eventId === ev.id) {
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                      const finalDelta = dragPreview.deltaSteps;
                      setDragPreview(null);
                      if (finalDelta !== 0) {
                        onDragPitchDiatonically(ev.id, finalDelta);
                      }
                    }
                  }}
                  onPointerCancel={() => setDragPreview(null)}
                >
                  <span className="hitbox-badge">{pitchLabel}</span>
                  {previewPitchLabel && (
                    <span className="drag-pitch-tooltip" data-testid="drag-pitch-tooltip">
                      → {previewPitchLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
