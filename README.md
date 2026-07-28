# Harmonica Trainer

A static, local-first trainer for a 12-hole chromatic harmonica. It teaches note location, score reading, rhythmic performance, and absolute or relative ear playing. Input can come from the duration-aware on-screen harmonica or a real instrument through the microphone.

## Run and validate

Requirements: [Bun](https://bun.sh/) 1.2.5 or later and a modern Chromium, Firefox, or Safari browser.

```bash
bun install --frozen-lockfile
bun run dev
bun run typecheck
bun test
bun run benchmark:pitch
bun run build
bun run test:browser
```

Vite serves the repository under `/harmonica/`, matching GitHub Pages. Microphone access needs HTTPS in production (localhost is allowed during development). Audio is analyzed in the browser and is never sent to a server.

## Product map

- **Find a note:** one staff target, reference playback, exact virtual action or microphone note identity, optional strict intonation.
- **Play the score:** eight preserved legacy examples or monodic ABC import; untimed step practice and count-in flow performance with separate pitch, onset, length, stability, and intonation results.
- **Play by ear:** hidden four-note phrase, explicit absolute/relative variants, transposition feedback, hint/reveal ladder, then rhythm performance.
- **Diagnostics:** `?lab=pitch`, `?lab=fixtures`, `?lab=timing`, and `?lab=calibration`.

The pitch lab compares MPM, YIN, and autocorrelation against the same PCM frame path used by uploaded audio. The fixture recorder creates a local ZIP and manifest. Calibration is stored in `localStorage`; it changes intonation centers, never note identity.

Deployment is a static GitHub Pages artifact built by [.github/workflows/pages.yml](.github/workflows/pages.yml). No backend, account, database, telemetry, or cloud audio processing is used.
