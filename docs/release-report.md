# Release report

Status: polish release candidate; deployment metadata is recorded after the verified main push.

Starting `main`: `7e42d4ff24e0fadfa0a5e68fe7ab1d4c260fca9d` (already matched `origin/main` after fetch). Production URL: <https://alexandr-panchenko.github.io/harmonica/>.

Polish sprint implementation: application-owned SVG treble clef/rest/accidental glyphs; diatonic written-pitch engraving and ledger lines; ABC spelling retention; answer-hidden assessment; rolling Find history; beat/time-based score and performed-audio timelines; direct 48-cell action grid; startup/adaptive microphone gate; true note segmentation and measured duration; discovered-ear flow target consistency; ten-zone sampled harmonica playback; output-contamination suppression; browser coverage for desktop, phone portrait, and phone landscape.

The workflow installs with a frozen Bun lockfile, typechecks, runs deterministic tests, builds the repository-subpath bundle, waits for the repository's legacy branch publisher to drain, and then deploys the official artifact. Real harmonica and device checks remain exactly those in `manual-test-checklist.md`.

Local release verification on 2026-07-30: frozen install passed; TypeScript passed; 29/29 Bun tests passed; synthetic pitch benchmark completed; Vite production build passed; Playwright browser matrix passed 25 tests with two intentional viewport skips; production-preview matrix passed 8 tests with one intentional viewport skip. The final expanded matrix adds keyboard and ear-flow regression cases, producing 25 passing cases across the three viewport projects.

Gate benchmark change: colored noise and breath noise each fell from 50 legacy-visible frames to zero stable frames/segments; a click fell from one visible frame to zero; the near-threshold harmonic produced 26 stable frames and one segment; vibrato/bend produced 41 stable frames and one segment. Default MPM identity accuracy remained 100% on all four synthetic tone fixtures. The ten WAV zones total 6.4 MB; the built JS is 342.51 kB (109.28 kB gzip) and CSS is 12.69 kB (3.98 kB gzip).

Acceptance screenshots use the `polish-*` prefix in `docs/screenshots/`, covering initial Find, five-answer history, score step, flow before/after, desktop, Pixel 7 portrait, and Pixel 7 landscape.

Known limitations: main-thread AnalyserNode capture; the notation parser is a monodic ABC subset without tuplets/key-signature carry/ties; high pitches between sparse source zones are pitch-shifted samples; no continuous virtual bend gesture; fixture recorder exports browser-native WebM; flow review is aggregate; real-room and physical harmonica behavior still needs the short owner check.
