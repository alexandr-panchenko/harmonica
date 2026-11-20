import { useRef, useState } from "react";
import { formatWrittenPitch } from "./EditableArrangement";
import { CANONICAL_PPQ, DURATION_PRESETS, type EditableArrangement } from "./editorTypes";
import { measureTicksForMeter } from "./validation";

export interface TimingLaneProps {
  arrangement: EditableArrangement;
  selectedEventIds: string[];
  insertionTick?: number;
  playheadBeat?: number;
  onSelectEvent: (eventId: string, shiftKey: boolean) => void;
  onResizeDuration: (eventId: string, durationTick: number) => void;
  onSetInsertionTick: (tick: number) => void;
}

const PIXELS_PER_QUARTER = 76;

function snapTicksToPresetOrGrid(rawTicks: number): number {
  const clamped = Math.max(120, Math.min(3840 * 2, rawTicks));
  let best = DURATION_PRESETS[0]!.ticks;
  let bestDist = Math.abs(clamped - best);
  for (const preset of DURATION_PRESETS) {
    const dist = Math.abs(clamped - preset.ticks);
    if (dist < bestDist) {
      bestDist = dist;
      best = preset.ticks;
    }
  }
  if (bestDist <= 60) return best;
  return Math.max(120, Math.round(clamped / 120) * 120);
}

export function TimingLane({
  arrangement,
  selectedEventIds,
  insertionTick,
  playheadBeat,
  onSelectEvent,
  onResizeDuration,
  onSetInsertionTick,
}: TimingLaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState<{
    eventId: string;
    startX: number;
    initialTicks: number;
    previewTicks: number;
  } | null>(null);

  const measureTicks = measureTicksForMeter(arrangement.meter);
  const totalTicks = arrangement.events.reduce((max, e) => Math.max(max, e.startTick + e.durationTick), measureTicks);
  const tickToPx = (ticks: number) => (ticks / CANONICAL_PPQ) * PIXELS_PER_QUARTER;
  const totalWidth = Math.max(360, Math.ceil(tickToPx(totalTicks) + 64));

  const measureCount = Math.ceil(totalTicks / measureTicks);
  const measureMarkers = Array.from({ length: measureCount + 1 }, (_, idx) => ({
    measure: idx + 1,
    tick: idx * measureTicks,
    x: tickToPx(idx * measureTicks),
  }));

  return (
    <section className="timing-lane" aria-label="Timing lane">
      <div className="timing-lane-header">
        <span className="timing-lane-title">TIMING LANE · 960 PPQ</span>
        <span className="timing-lane-hint">
          Click block to select · Drag right handle to resize duration · Click ruler to set insertion point
        </span>
      </div>
      <div className="timing-lane-scroll" ref={scrollRef}>
        <div
          className="timing-lane-track"
          style={{ width: `${totalWidth}px` }}
          onClick={(e) => {
            if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains("timing-ruler")) {
              return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const rawTick = (clickX / PIXELS_PER_QUARTER) * CANONICAL_PPQ;
            const snapped = Math.max(0, Math.round(rawTick / 240) * 240);
            onSetInsertionTick(snapped);
          }}
        >
          <div className="timing-ruler">
            {measureMarkers.map((m) => (
              <span
                key={m.tick}
                className="timing-barline"
                style={{ left: `${m.x}px` }}
              >
                <small>M{m.measure}</small>
              </span>
            ))}
          </div>

          {insertionTick !== undefined && (
            <div
              className="timing-insertion-marker"
              data-testid="timing-insertion-marker"
              title={`Insertion point: ${insertionTick} ticks`}
              style={{ left: `${tickToPx(insertionTick)}px` }}
            />
          )}

          {playheadBeat !== undefined && (
            <div
              className="timing-playhead"
              data-testid="timing-playhead"
              style={{ left: `${playheadBeat * PIXELS_PER_QUARTER}px` }}
            />
          )}

          <div className="timing-blocks">
            {arrangement.events.map((ev) => {
              const isSelected = selectedEventIds.includes(ev.id);
              const isResizingThis = resizing?.eventId === ev.id;
              const effectiveTicks = isResizingThis ? resizing.previewTicks : ev.durationTick;
              const left = tickToPx(ev.startTick);
              const width = Math.max(22, tickToPx(effectiveTicks) - 2);
              const label =
                ev.kind === "note" ? formatWrittenPitch(ev.writtenPitch, ev.midi) : "Rest";

              return (
                <div
                  key={ev.id}
                  data-testid={`timing-block-${ev.id}`}
                  data-event-id={ev.id}
                  data-duration-ticks={effectiveTicks}
                  className={`timing-block ${ev.kind}${isSelected ? " selected" : ""}${ev.tieOut ? " tied-out" : ""}`}
                  style={{ left: `${left}px`, width: `${width}px` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvent(ev.id, e.shiftKey);
                  }}
                >
                  <span className="timing-block-label">
                    <b>{label}</b>
                    <small>{effectiveTicks}t</small>
                  </span>
                  <button
                    type="button"
                    aria-label={`Resize duration for ${label}`}
                    data-testid={`timing-resize-${ev.id}`}
                    className="timing-resize-handle"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectEvent(ev.id, false);
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setResizing({
                        eventId: ev.id,
                        startX: e.clientX,
                        initialTicks: ev.durationTick,
                        previewTicks: ev.durationTick,
                      });
                    }}
                    onPointerMove={(e) => {
                      if (!resizing || resizing.eventId !== ev.id) return;
                      const dx = e.clientX - resizing.startX;
                      const deltaTicks = (dx / PIXELS_PER_QUARTER) * CANONICAL_PPQ;
                      const previewTicks = snapTicksToPresetOrGrid(resizing.initialTicks + deltaTicks);
                      if (previewTicks !== resizing.previewTicks) {
                        setResizing({ ...resizing, previewTicks });
                      }
                    }}
                    onPointerUp={(e) => {
                      if (!resizing || resizing.eventId !== ev.id) return;
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                      const finalTicks = resizing.previewTicks;
                      setResizing(null);
                      if (finalTicks !== ev.durationTick) {
                        onResizeDuration(ev.id, finalTicks);
                      }
                    }}
                    onPointerCancel={() => setResizing(null)}
                  >
                    ⋮
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
