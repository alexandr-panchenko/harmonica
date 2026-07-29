# Release report

Status: release candidate published through the GitHub Pages artifact workflow.

Implemented: strict TypeScript/Vite/React foundation; preserved mapping and tune library; central live staff, ribbons, playhead, trace, and accessible hit/miss feedback; virtual and microphone input; Mode A, score step/flow, absolute/relative ear training; pitch/timing/fixture/calibration labs; seeded benchmark; unit/integration/browser coverage; official Pages artifact workflow.

The workflow installs with a frozen Bun lockfile, typechecks, runs deterministic tests, builds the repository-subpath bundle, waits for the repository's legacy branch publisher to drain, and then deploys the official artifact. Real harmonica and device checks remain exactly those in `manual-test-checklist.md`.

Known limitations: main-thread AnalyserNode capture; game notation is a monodic subset; no tuplets or polyphony; virtual bends are modeled but not continuously simulated; fixture recorder exports browser-native WebM instead of encoding WAV; aggregate rather than expandable per-note flow review; real-audio calibration awaits owner fixtures.
