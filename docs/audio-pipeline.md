# Audio pipeline

`MicrophoneInput` requests mono audio while preferring disabled echo cancellation, noise suppression, and AGC. Ignored constraints are safe; actual `MediaTrackSettings`, sample rate, base latency, and output latency are shown in Settings diagnostics. Tracks and the `AudioContext` are stopped on input change/unmount.

The current browser path is `MediaStream → AnalyserNode (4096 samples) → MPM estimator → adaptive tracker → stable note event`. The tracker gates RMS/clarity, median-filters MIDI values, adds boundary hysteresis, and requires three agreeing frames. The UI submits a note only after 120 ms stable hold and rearms after silence/note change. Pitch trace retains continuous MIDI float, so bends and vibrato remain visible.

Synthetic and uploaded file paths call the same estimator adapters through `analyzeFrames`. MPM (`pitchy`), YIN, and autocorrelation implement one `PitchEstimator` contract. Note identity uses calibrated midpoint classification; cents are a separate metric. Strict intonation is an opt-in ±20-cent gate.

Known release limitation: capture/estimation currently runs from an `AnalyserNode` on the main thread. Benchmark cost for default MPM is well below a frame budget on this development machine, but an AudioWorklet/Worker capture split should be the first optimization if five-minute mobile profiling shows jank.
