# Performance evaluation experiment

Synthetic segments cover correct, early/late, short/long, wrong, extra, missing, strict intonation, and transposed interval patterns. `alignPerformance` uses monotonic dynamic programming with pitch, onset, insertion, and deletion costs; one extra event does not shift every later score.

Tempo windows follow `onset = clamp(beat × .18, 60, 160 ms)` and `release = clamp(beat × .22, 80, 220 ms)`. Step practice does not score timing. Flow reports Notes, Timing, Length, Stability, and Intonation separately. Virtual note duration is pointer hold time. The timing lab stores a device-local manual/median offset.

Known limitation: live online flow labels are compact; the detailed per-event review currently aggregates the five dimensions instead of showing an expandable row for every note.
