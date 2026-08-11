# Audio pipeline

`MicrophoneInput` requests mono audio while preferring disabled echo cancellation, noise suppression, and AGC. Ignored constraints are safe; actual `MediaTrackSettings`, sample rate, base latency, and output latency are shown in Settings diagnostics. Tracks and the `AudioContext` are stopped on input change/unmount.

The browser path is `MediaStream → AnalyserNode (4096 samples) → ProductionAudioPipeline → MPM estimator → dB gate/hysteresis → LivePitchState → NoteSegmenter`. Synthetic PCM and decoded recordings enter at the same `ProductionAudioPipeline.processFrame` boundary. Startup gathers 900 ms of room energy and derives a robust 80th-percentile floor. Tonal or high-variance calibration is rejected and retried instead of silently becoming the room floor.

The tracker uses elapsed milliseconds rather than animation-frame counts. High/Normal/Low sensitivity persist locally and derive open/close thresholds as explicit margins above ambient dB. A credible attack opens in roughly 145–210 ms including acceptance stabilization, accepted state tolerates a short dropout, display remains latched for 210 ms, and a genuine release closes after 320 ms. The diagnostics panel exposes RMS/dB, noise floor, both thresholds, clarity, gate state and sensitivity.

Raw estimate, candidate, display, accepted state and completed segment are intentionally different. Tuner/staff/harmonica use display. Find and Ear discovery accept a live accepted onset once, then require release/rearticulation. Duration practice consumes accepted time continuously. `NoteSegmenter` finalizes on pitch change or genuine release with measured duration and median pitch/frequency/cents/clarity/RMS. Equal notes separated by articulation become distinct segments.

MPM (`pitchy`), YIN and autocorrelation still implement one `PitchEstimator` contract. Release fixtures use MPM through the production pipeline; standalone estimator comparison remains a benchmark only. Note identity uses calibrated midpoint classification; cents are a separate metric. Strict intonation is an opt-in ±20-cent gate.

Playback uses ten local VCSL Hohner Super 64 sample zones (CC0 1.0), pitch-shifted to the requested MIDI pitch and looped inside the sustain with a Web Audio attack/release envelope. A triangle oscillator exists only as an explicit load/decode failure fallback. The output-contamination guard blocks scoring for all reference/virtual output and a 180 ms tail; microphone tracker and segment state are flushed while blocked.

Known release limitation: capture/estimation still runs from an `AnalyserNode` on the main thread. Benchmark cost for default MPM is below a frame budget on this development machine, but an AudioWorklet/Worker split remains the first optimization for sustained mobile profiling.
