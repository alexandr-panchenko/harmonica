# Audio pipeline

`MicrophoneInput` requests mono audio while preferring disabled echo cancellation, noise suppression, and AGC. Ignored constraints are safe; actual `MediaTrackSettings`, sample rate, base latency, and output latency are shown in Settings diagnostics. Tracks and the `AudioContext` are stopped on input change/unmount.

The browser path is `MediaStream → AnalyserNode (4096 samples) → pre-pitch energy gate → MPM estimator → clarity/range hysteresis → NoteSegmenter`. Startup gathers 750 ms of room energy and derives a robust 80th-percentile floor. While closed, the floor adapts slowly; it does not rise during a credible tone. Three credible frames open the gate, the lower close threshold plus five-frame release prevents chatter, and the accepted range is MIDI 58–99 (the physical profile with bend/estimator margin). A recalibration control is available beside the tuner.

Only stable tonal frames drive the note label, needle, scoring, or trace. RMS remains available separately, so silence can show input energy without inventing a pitch. `NoteSegmenter` begins at stable onset, retains every accepted pitch point, and finalizes on note change or release with measured duration, median pitch/frequency/cents/clarity/RMS, and variability. Equal notes separated by release become distinct segments.

Synthetic and uploaded file paths call the same estimator adapters through `analyzeFrames`. MPM (`pitchy`), YIN, and autocorrelation implement one `PitchEstimator` contract. Note identity uses calibrated midpoint classification; cents are a separate metric. Strict intonation is an opt-in ±20-cent gate.

Playback uses ten local VCSL Hohner Super 64 sample zones (CC0 1.0), pitch-shifted to the requested MIDI pitch and looped inside the sustain with a Web Audio attack/release envelope. A triangle oscillator exists only as an explicit load/decode failure fallback. The output-contamination guard blocks scoring for all reference/virtual output and a 180 ms tail; microphone tracker and segment state are flushed while blocked.

Known release limitation: capture/estimation still runs from an `AnalyserNode` on the main thread. Benchmark cost for default MPM is below a frame budget on this development machine, but an AudioWorklet/Worker split remains the first optimization for sustained mobile profiling.
