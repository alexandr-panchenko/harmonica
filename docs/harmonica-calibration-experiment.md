# Harmonica calibration experiment

No real instrument fixtures were available during the autonomous build, so no claim about a reliable RMS-to-cents slope is made. The release stores robust per-note medians and observed comfortable bands at multiple dynamics. Loudness is displayed but never rejects a correct note.

After Stage A fixtures arrive, plot normalized RMS against cents per note, compare takes with AGC on/off, and enable a device-local slope only if repeatability materially reduces residual error. Until then the conservative band model is active.
