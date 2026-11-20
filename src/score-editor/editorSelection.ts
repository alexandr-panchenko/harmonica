import type { EditableEvent } from "./editorTypes";

export interface EditorSelectionState {
  anchorId?: string;
  selectedIds: string[];
  insertionTick?: number;
}

export function selectSingleEvent(eventId: string): EditorSelectionState {
  return {
    anchorId: eventId,
    selectedIds: [eventId],
  };
}

export function selectContiguousRange(
  events: readonly EditableEvent[],
  current: EditorSelectionState,
  targetId: string,
): EditorSelectionState {
  const anchorId = current.anchorId ?? current.selectedIds[0] ?? targetId;
  const anchorIdx = events.findIndex((e) => e.id === anchorId);
  const targetIdx = events.findIndex((e) => e.id === targetId);
  if (anchorIdx < 0 || targetIdx < 0) {
    return selectSingleEvent(targetId);
  }
  const start = Math.min(anchorIdx, targetIdx);
  const end = Math.max(anchorIdx, targetIdx);
  return {
    anchorId,
    selectedIds: events.slice(start, end + 1).map((e) => e.id),
  };
}

export function selectAdjacentEvent(
  events: readonly EditableEvent[],
  current: EditorSelectionState,
  direction: -1 | 1,
  extendRange = false,
): EditorSelectionState {
  if (events.length === 0) return { selectedIds: [] };
  const activeId =
    direction > 0
      ? (current.selectedIds.at(-1) ?? events[0]!.id)
      : (current.selectedIds[0] ?? events[0]!.id);
  const idx = events.findIndex((e) => e.id === activeId);
  const nextIdx = Math.max(0, Math.min(events.length - 1, (idx < 0 ? 0 : idx) + direction));
  const nextId = events[nextIdx]!.id;
  if (extendRange) {
    return selectContiguousRange(events, current, nextId);
  }
  return selectSingleEvent(nextId);
}
