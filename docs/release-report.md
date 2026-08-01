# Release report — two-row instrument and visible learning aids

Status: local release gate passed; pending the final `main` push, Pages deployment, and deployed smoke test.

- Starting `main`: `13eca3aad297817033903ed63424ee47252fb98b` (matched fetched `origin/main` on 2026-08-01).
- Production URL: <https://alexandr-panchenko.github.io/harmonica/>.
- Scope: finish the existing instrument profiles, learning aids, discoverability, typography, and contrast without adding modes.

## Baseline reproduction

The fetched production build was rendered at browser zoom 100% in Chromium at 1440 px desktop and 390 px phone portrait. It showed four independent action lanes (`BLOW OUT`, `DRAW OUT`, `BLOW IN`, `DRAW IN`). Instrument selection, staff labels, harmonica labels, and note naming were reachable only through an unlabeled visual gear. Useful labels existed at 7–10 px with low-contrast blue/green grays. The 10-hole profile was a truncated 12-hole pattern: hole 9 blow-out was C6 and hole 10 blow-out was E6 instead of E6 and G6.

Baseline captures:

- `baseline-menu-desktop.png`
- `baseline-find-desktop.png`
- `baseline-score-desktop.png`
- `baseline-ear-desktop.png`
- `baseline-harmonica-12-desktop.png`
- `baseline-harmonica-10-desktop.png`
- `baseline-menu-mobile.png`
- `baseline-find-mobile.png`

## Implementation

`VirtualHarmonica` now renders exactly two `.breath-row` elements. Each numbered hole is one `.hole-actions` group containing two direct buttons: `○ OUT` and `● IN`. Hole numbers appear once per column on stable high-contrast plates. The shared cover, mouthpiece, rail, and right-hand slide knob read as one continuous instrument. Twelve holes remain full-size on phones and use horizontal scrolling; each half is at least 40 × 68 CSS px in portrait.

Player setup is visible without opening Settings on both the main menu and game screen. It exposes:

- `INSTRUMENT`: `10 holes` / `12 holes`;
- `Staff note names`: Off / On;
- `Harmonica note names`: Off / On;
- `Note naming`: Letters C D E / Solfège Do Re Mi.

All four staff/harmonica label combinations work independently, naming updates immediately, and all four choices persist in `localStorage`. The advanced gear now contains only intonation and diagnostic links.

The profile formula was removed as the shared source of truth. `STANDARD_C10_ACTIONS` and `STANDARD_C12_ACTIONS` are separate typed `HarmonicaHoleLayout[]` tables expanded into physical actions. The critical 10-hole slide-out mappings are hole 9 `blow: 88, draw: 86` and hole 10 `blow: 91, draw: 89`; hole 10 slide-in blow is 92. Its full action range is MIDI 60–92, while the 12-hole range remains MIDI 60–97. Find pools, guided targets, direct input, and microphone matches all consume the currently selected profile.

Pressed, microphone-detected, guided, correct, and incorrect actions use different combinations of solid/dashed/double outlines, glow, icons, and error hatching rather than color alone.

## Typography and contrast audit

The conflicting historical two-row and four-lane CSS blocks were removed and replaced by one formatted instrument section. No user-significant text in `src/styles.css` remains at 7–9 px. Computed browser checks enforce: hole numbers 20 px, breath names 14 px, OUT/IN 12 px, harmonica note names 13 px, setup labels and buttons 14 px. Mobile keeps those sizes.

Representative WCAG contrast calculations:

- hole number: 17.24:1;
- OUT label against the lighter action gradient stop: 10.62:1;
- IN label: 8.99:1;
- BLOW/DRAW: 17.24:1;
- learning-aid labels: 15.49:1;
- inactive control text: 12.96:1;
- instrument help text: 10.06:1.

Two full screenshot iterations were reviewed at original size. Pass 1 identified an overly wide mobile slide legend and a stale simulated-microphone capture. Pass 2 removes that phone legend while retaining OUT/IN inside every action and shows all MIDI-72 matching positions with outline, glow, and `◉` markers.

Final acceptance captures use the `pass2-*` prefix:

- `pass2-menu-desktop.png`
- `pass2-12-labels-off-desktop.png`
- `pass2-12-labels-on-desktop.png`
- `pass2-10-labels-on-desktop.png`
- `pass2-microphone-matching-desktop.png`
- `pass2-learning-aids-desktop.png`
- `pass2-find-mobile.png`

The matching screenshot uses the same rendered action states with a scripted stable MIDI 72 so all duplicate physical positions can be inspected deterministically without depending on room audio.

## Verification

Local release gate on 2026-08-01:

- `bun install --frozen-lockfile`: 92 installs checked, no lockfile changes;
- `bun run typecheck`: passed;
- `bun test`: 33 passed, 245 assertions;
- `bun run benchmark:pitch`: MPM identity remained 100% for all four synthetic tone fixtures; colored noise, breath noise, and clicks produced zero stable frames/segments;
- `bun run build`: passed, 359.67 kB JS (114.88 kB gzip) and 27.26 kB CSS (7.47 kB gzip);
- `bun run test:browser`: 37 passed across desktop, Pixel 7 portrait, and Pixel 7 landscape; two viewport-specific skips;
- `bun run test:production`: 12 passed against the production preview; one phone-only skip in the desktop production project.

The final commit SHA and deployed-production result are recorded in the delivery report after Pages completes.

Known limitations remain unchanged: main-thread `AnalyserNode` capture; a monodic ABC subset without tuplets/key-signature carry/ties; pitch-shifted samples between sparse high source zones; no continuous virtual bend gesture; browser-native WebM fixture export; aggregate flow review; and the need for the existing short owner/device check for real-room microphone behavior.
