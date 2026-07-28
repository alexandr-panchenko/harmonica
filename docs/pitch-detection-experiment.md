# Pitch detection experiment

The executable benchmark is `bun run benchmark:pitch`; raw results are in `docs/benchmarks/pitch-synthetic.json`. Fixtures are seeded and cover low C, strong second harmonic, vibrato, noise, attack/release, and high C. Each adapter uses a 4,096-sample window with 256-sample hop at 48 kHz.

MPM/pitchy is the default. It retained note identity on the deliberately strong-second-harmonic fixture where simple autocorrelation produced octave errors, and it was materially faster than the reference YIN implementation. The lab keeps all three selectable because real harmonica recordings may expose different failure modes.

Decision: MPM, frame 4096, hop 256, UI capped by animation frames, clarity gate 0.72, RMS gate derived from noise floor, 120 ms stable acceptance, 100 ms release/dropout grace. These remain diagnosable values rather than claims of final physical-instrument tuning.
