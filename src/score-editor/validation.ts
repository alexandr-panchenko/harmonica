import { HARMONICA_PROFILES, STANDARD_C12, type HarmonicaProfile } from "../harmonica/profile";
import { planFingerings } from "../harmonica-ui/fingeringPlanner";
import type { SoundEvent } from "../notation/abc/AbcAdapter";
import { midiFromWrittenPitch } from "./EditableArrangement";
import {
  CANONICAL_PPQ,
  type EditableArrangement,
  type EditorValidationIssue,
  type EditorValidationReport,
  type HarmonicaRangeDiagnostics,
} from "./editorTypes";

export function measureTicksForMeter(meter: { numerator: number; denominator: number }): number {
  return Math.max(240, Math.round((CANONICAL_PPQ * 4 * meter.numerator) / meter.denominator));
}

export function analyzeHarmonicaRange(
  arrangement: EditableArrangement,
  profileId = STANDARD_C12.id,
): HarmonicaRangeDiagnostics {
  const profile: HarmonicaProfile =
    HARMONICA_PROFILES.find((p) => p.id === profileId) ?? STANDARD_C12;
  const playableMidis = profile.physicalActions.map((a) => a.canonicalMidi);
  const minMidi = Math.min(...playableMidis);
  const maxMidi = Math.max(...playableMidis);

  const outOfRangeEventIds: string[] = [];
  const multiPositionEventIds: string[] = [];
  const soundEvents: SoundEvent[] = [];

  for (const e of arrangement.events) {
    if (e.kind !== "note" || e.midi === undefined) continue;
    const matches = profile.physicalActions.filter((a) => a.canonicalMidi === e.midi);
    if (matches.length === 0 || e.midi < minMidi || e.midi > maxMidi) {
      outOfRangeEventIds.push(e.id);
    } else if (matches.length > 1) {
      multiPositionEventIds.push(e.id);
    }
    if (e.tieIn && soundEvents.length > 0 && soundEvents.at(-1)!.midi === e.midi) {
      const last = soundEvents.at(-1)!;
      last.durationBeats += e.durationTick / CANONICAL_PPQ;
      last.writtenEventIds.push(e.id);
    } else {
      soundEvents.push({
        id: `snd-${e.id}`,
        midi: e.midi,
        startBeat: e.startTick / CANONICAL_PPQ,
        durationBeats: e.durationTick / CANONICAL_PPQ,
        writtenEventIds: [e.id],
      });
    }
  }

  const plans = planFingerings(soundEvents, profile);
  let estimatedSlideChanges = 0;
  let estimatedBreathChanges = 0;
  let maxHoleJump = 0;
  let prevAction = plans[0]?.recommended;

  for (const plan of plans.slice(1)) {
    const curr = plan.recommended;
    if (prevAction && curr) {
      if (curr.slide !== prevAction.slide) estimatedSlideChanges++;
      if (curr.breath !== prevAction.breath) estimatedBreathChanges++;
      maxHoleJump = Math.max(maxHoleJump, Math.abs(curr.hole - prevAction.hole));
    }
    if (curr) prevAction = curr;
  }

  const fingeringByEventId: HarmonicaRangeDiagnostics["fingeringByEventId"] = {};
  for (let i = 0; i < soundEvents.length; i++) {
    const snd = soundEvents[i]!;
    const plan = plans[i];
    const rec = plan?.recommended;
    const label = rec
      ? `Hole ${rec.hole} · ${rec.breath}${rec.slide === "in" ? " + slide" : ""}`
      : "Out of range";
    for (const writtenId of snd.writtenEventIds) {
      fingeringByEventId[writtenId] = {
        recommendedId: rec?.id,
        recommendedLabel: label,
        alternativeCount: plan?.alternatives.length ?? 0,
        unplayable: plan?.unplayable,
      };
    }
  }

  const noteEvents = arrangement.events.filter((e) => e.kind === "note" && e.midi !== undefined);
  const insideCount = noteEvents.length - outOfRangeEventIds.length;
  const insideRangePercent =
    noteEvents.length > 0 ? Math.round((insideCount / noteEvents.length) * 1000) / 10 : 100;

  // Suggest deterministic transposition that maximizes playable notes with minimum semitone shift
  let suggestedTransposeSemitones = 0;
  if (outOfRangeEventIds.length > 0 && noteEvents.length > 0) {
    let bestInside = insideCount;
    let bestCost = Infinity;
    for (let shift = -24; shift <= 24; shift++) {
      if (shift === 0) continue;
      const inRange = noteEvents.filter((e) => {
        const shifted = (e.midi ?? 60) + shift;
        return shifted >= minMidi && shifted <= maxMidi;
      }).length;
      const isOctave = shift % 12 === 0;
      const cost = Math.abs(shift) + (isOctave ? 0 : 8);
      if (inRange > bestInside || (inRange === bestInside && cost < bestCost)) {
        bestInside = inRange;
        bestCost = cost;
        suggestedTransposeSemitones = shift;
      }
    }
  }

  return {
    profileId: profile.id,
    holeCount: (profile.holeCount === 10 ? 10 : 12) as 10 | 12,
    minMidi,
    maxMidi,
    outOfRangeEventIds,
    multiPositionEventIds,
    insideRangePercent,
    estimatedSlideChanges,
    estimatedBreathChanges,
    maxHoleJump,
    suggestedTransposeSemitones,
    fingeringByEventId,
  };
}

export function validateArrangement(
  arrangement: EditableArrangement,
  profileId = STANDARD_C12.id,
): EditorValidationReport {
  const issues: EditorValidationIssue[] = [];
  const measureTicks = measureTicksForMeter(arrangement.meter);

  if (arrangement.events.length === 0) {
    issues.push({
      code: "EMPTY_ARRANGEMENT",
      severity: "error",
      message: "Arrangement contains no events.",
    });
  } else if (!arrangement.events.some((e) => e.kind === "note")) {
    issues.push({
      code: "NO_NOTES",
      severity: "error",
      message: "Arrangement contains only rests; add at least one note before exporting.",
    });
  }

  let cursor = 0;
  let denseCount = 0;

  for (let i = 0; i < arrangement.events.length; i++) {
    const e = arrangement.events[i]!;
    const measure = Math.floor(e.startTick / measureTicks) + 1;

    if (!Number.isInteger(e.durationTick) || e.durationTick <= 0) {
      issues.push({
        code: "NON_POSITIVE_DURATION",
        severity: "error",
        message: `Event ${e.id} has non-positive or non-integer duration (${e.durationTick} ticks).`,
        eventIds: [e.id],
        measure,
      });
    }

    if (e.startTick < cursor) {
      issues.push({
        code: "MONOPHONIC_OVERLAP",
        severity: "error",
        message: `Event ${e.id} overlaps previous event at tick ${e.startTick} (expected >= ${cursor}).`,
        eventIds: [e.id],
        measure,
      });
    } else if (e.startTick > cursor) {
      issues.push({
        code: "UNREPRESENTED_GAP",
        severity: "error",
        message: `Unrepresented silent gap of ${e.startTick - cursor} ticks before ${e.id}.`,
        eventIds: [e.id],
        measure,
      });
    }
    cursor = e.startTick + e.durationTick;

    if (e.durationTick < 120) {
      denseCount++;
    }

    if (e.kind === "note") {
      if (e.midi === undefined || e.midi < 0 || e.midi > 127) {
        issues.push({
          code: "INVALID_MIDI",
          severity: "error",
          message: `Note ${e.id} has an invalid MIDI pitch (${String(e.midi)}).`,
          eventIds: [e.id],
          measure,
        });
      }
      if (!e.writtenPitch) {
        issues.push({
          code: "MISSING_WRITTEN_PITCH",
          severity: "error",
          message: `Note ${e.id} is missing its written pitch spelling.`,
          eventIds: [e.id],
          measure,
        });
      } else if (e.midi !== undefined && midiFromWrittenPitch(e.writtenPitch) !== e.midi) {
        issues.push({
          code: "PITCH_SPELLING_MISMATCH",
          severity: "error",
          message: `Note ${e.id} written pitch (${e.writtenPitch.step}${e.writtenPitch.octave}) does not match MIDI ${e.midi}.`,
          eventIds: [e.id],
          measure,
        });
      }

      if (e.tieOut) {
        const next = arrangement.events[i + 1];
        if (!next || next.kind !== "note" || next.midi !== e.midi) {
          issues.push({
            code: "INVALID_TIE",
            severity: "error",
            message: `Note ${e.id} has an outgoing tie, but the next event is not an equal-pitch note.`,
            eventIds: next ? [e.id, next.id] : [e.id],
            measure,
          });
        }
      }
    }
  }

  if (denseCount > 0) {
    issues.push({
      code: "EXCESSIVELY_DENSE_EVENTS",
      severity: "warning",
      message: `${denseCount} event${denseCount === 1 ? " is" : "s are"} shorter than a 32nd note (< 120 ticks).`,
    });
  }

  if (cursor > 0 && cursor % measureTicks !== 0) {
    const remainderBeats = ((cursor % measureTicks) / CANONICAL_PPQ).toFixed(2);
    issues.push({
      code: "INCOMPLETE_FINAL_MEASURE",
      severity: "info",
      message: `Arrangement ends with a partial measure (${remainderBeats} quarter beats). Barlines will still serialize deterministically.`,
    });
  }

  const range = analyzeHarmonicaRange(arrangement, profileId);
  if (range.outOfRangeEventIds.length > 0) {
    issues.push({
      code: "OUT_OF_HARMONICA_RANGE",
      severity: "warning",
      message: `${range.outOfRangeEventIds.length} note${range.outOfRangeEventIds.length === 1 ? " lies" : "s lie"} outside the ${range.holeCount}-hole C chromatic range (MIDI ${range.minMidi}–${range.maxMidi}).`,
      eventIds: range.outOfRangeEventIds,
    });
  }

  const blockingErrors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity !== "error");

  return {
    valid: blockingErrors.length === 0,
    blockingErrors,
    warnings,
    allIssues: issues,
  };
}
