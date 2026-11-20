import type { WrittenPitch } from "../music/melody";
import type { ImportWarning, Project } from "../score-import/core";
import { CANONICAL_PPQ } from "../score-import/core";

export { CANONICAL_PPQ };

export type EditableEventOrigin = "imported" | "inserted" | "split" | "derived";

export interface EditableEvent {
  id: string;
  kind: "note" | "rest";
  startTick: number;
  durationTick: number;
  midi?: number;
  writtenPitch?: WrittenPitch;
  tieIn?: boolean;
  tieOut?: boolean;
  sourceEventIds: string[];
  warnings: ImportWarning[];
  origin: EditableEventOrigin;
}

export interface EditableArrangementKey {
  tonic: string;
  mode: string;
  prefer: "sharps" | "flats";
}

export interface EditableArrangement {
  id: string;
  title: string;
  composer?: string;
  tempoQpm: number;
  meter: { numerator: number; denominator: number };
  key: EditableArrangementKey;
  canonicalPpq: 960;
  pickupTicks?: number;
  events: EditableEvent[];
}

export interface SetPitchCommand {
  type: "set-pitch";
  eventId: string;
  midi: number;
  writtenPitch?: WrittenPitch;
}

export interface MovePitchDiatonicallyCommand {
  type: "move-pitch-diatonically";
  eventId: string;
  deltaSteps: number;
}

export interface RespellPitchCommand {
  type: "respell-pitch";
  eventId: string;
  writtenPitch: WrittenPitch;
}

export interface SetDurationCommand {
  type: "set-duration";
  eventId: string;
  durationTick: number;
}

export interface InsertEventCommand {
  type: "insert-event";
  targetEventId?: string;
  placement: "before" | "after" | "at-tick";
  atTick?: number;
  kind: "note" | "rest";
  durationTick: number;
  midi?: number;
  writtenPitch?: WrittenPitch;
}

export interface DeleteEventCommand {
  type: "delete-event";
  eventId: string;
  policy: "close-gap" | "leave-rest";
}

export interface ConvertNoteRestCommand {
  type: "convert-note-rest";
  eventId: string;
  targetKind: "note" | "rest";
  defaultMidi?: number;
}

export interface SplitEventCommand {
  type: "split-event";
  eventId: string;
  offsetTick?: number;
}

export interface MergeEventsCommand {
  type: "merge-events";
  eventIds: string[];
}

export interface ToggleTieCommand {
  type: "toggle-tie";
  eventId: string;
  tieOut?: boolean;
}

export interface TransposeSelectionCommand {
  type: "transpose-selection";
  eventIds: string[];
  semitones: number;
}

export interface ShiftOctaveCommand {
  type: "shift-octave";
  eventIds: string[];
  octaves: number;
}

export interface CropToSelectionCommand {
  type: "crop-to-selection";
  eventIds: string[];
}

export interface SetMetadataCommand {
  type: "set-metadata";
  title?: string;
  composer?: string;
  tempoQpm?: number;
  meter?: { numerator: number; denominator: number };
  key?: Partial<EditableArrangementKey>;
}

export type EditCommand =
  | SetPitchCommand
  | MovePitchDiatonicallyCommand
  | RespellPitchCommand
  | SetDurationCommand
  | InsertEventCommand
  | DeleteEventCommand
  | ConvertNoteRestCommand
  | SplitEventCommand
  | MergeEventsCommand
  | ToggleTieCommand
  | TransposeSelectionCommand
  | ShiftOctaveCommand
  | CropToSelectionCommand
  | SetMetadataCommand;

export interface EditableArrangementProject {
  schemaVersion: 1;
  sourceProject: Project;
  sourceCandidateId: string;
  arrangement: EditableArrangement;
  editLog: EditCommand[];
  settingsHash: string;
}

export interface EditorValidationIssue {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  eventIds?: string[];
  measure?: number;
}

export interface EditorValidationReport {
  valid: boolean;
  blockingErrors: EditorValidationIssue[];
  warnings: EditorValidationIssue[];
  allIssues: EditorValidationIssue[];
}

export interface HarmonicaRangeDiagnostics {
  profileId: string;
  holeCount: 10 | 12;
  minMidi: number;
  maxMidi: number;
  outOfRangeEventIds: string[];
  multiPositionEventIds: string[];
  insideRangePercent: number;
  estimatedSlideChanges: number;
  estimatedBreathChanges: number;
  maxHoleJump: number;
  suggestedTransposeSemitones: number;
  fingeringByEventId: Record<
    string,
    {
      recommendedId?: string;
      recommendedLabel?: string;
      alternativeCount: number;
      unplayable?: boolean;
    }
  >;
}

export interface ArrangementDiffSummary {
  pitchesChanged: number;
  spellingsChanged: number;
  durationsChanged: number;
  notesInserted: number;
  notesDeleted: number;
  restsInserted: number;
  restsDeleted: number;
  tiesChanged: number;
  rangeWarningsDelta: number;
  changedEventIds: string[];
}

export interface DurationPreset {
  id: string;
  label: string;
  shortLabel: string;
  ticks: number;
  dotted?: boolean;
  triplet?: boolean;
}

export const DURATION_PRESETS: readonly DurationPreset[] = [
  { id: "1/1", label: "Whole", shortLabel: "1/1", ticks: 3840 },
  { id: "1/2.", label: "Dotted half", shortLabel: "1/2.", ticks: 2880, dotted: true },
  { id: "1/2", label: "Half", shortLabel: "1/2", ticks: 1920 },
  { id: "1/4.", label: "Dotted quarter", shortLabel: "♩. 1/4.", ticks: 1440, dotted: true },
  { id: "1/4", label: "Quarter", shortLabel: "♩ 1/4", ticks: 960 },
  { id: "1/8.", label: "Dotted eighth", shortLabel: "♪. 1/8.", ticks: 720, dotted: true },
  { id: "1/8", label: "Eighth", shortLabel: "♪ 1/8", ticks: 480 },
  { id: "1/8T", label: "Eighth triplet", shortLabel: "♪3 1/8T", ticks: 320, triplet: true },
  { id: "1/16.", label: "Dotted sixteenth", shortLabel: "♬. 1/16.", ticks: 360, dotted: true },
  { id: "1/16", label: "Sixteenth", shortLabel: "♬ 1/16", ticks: 240 },
  { id: "1/16T", label: "Sixteenth triplet", shortLabel: "♬3 1/16T", ticks: 160, triplet: true },
  { id: "1/32", label: "Thirty-second", shortLabel: "1/32", ticks: 120 },
] as const;
