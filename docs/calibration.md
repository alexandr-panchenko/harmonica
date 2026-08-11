# Calibration and fixtures

The production tuner performs a short 900 ms ambient calibration after microphone start. Stay quiet; tonal or high-variance samples are treated as contamination and trigger an explained retry. Recalibrate is available beside the tuner. High/Normal/Low sensitivity and the selected device persist locally; advanced Settings diagnostics show RMS/dB, floor, open/close thresholds, clarity and gate state.

Open `?lab=calibration` for optional intonation-centre collection, then hold each target naturally at several dynamics and save stable samples. Data remains in `localStorage`; reset and JSON export are available. The median becomes the expected intonation center and never changes semitone identity into a narrow zero-cent test.

Open `?lab=fixtures` for guided local recording. Follow 1 s quiet, clean attack, 2–3 s hold, release, and 1 s quiet. Each take can be reviewed or removed. Export creates a ZIP containing browser-native audio clips and generated `manifest.json`; device IDs are not exported.

Real fixtures are intentionally not committed. Stage A should contain room tone, 6–9 notes at medium/loud dynamics, 3–5 bend targets, and one four-note phrase free/60/120 BPM. Browser WebM is accepted; WAV remains preferred when externally captured.
