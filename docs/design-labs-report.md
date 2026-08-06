# M10 design laboratories · owner review report

Status: **laboratories complete; production migration requires owner approval**

Starting SHA: `518da7fc60f2f7f2ef140d035e4f21e942b48f2f`

Final SHA: use the commit containing this report (also recorded in the delivery message and deployed workflow).

## Review URLs

- Staff: <https://alexandr-panchenko.github.io/harmonica/lab/staff-design/>
- Harmonica: <https://alexandr-panchenko.github.io/harmonica/lab/harmonica-design/>

Both routes are independent Vite HTML entry points, so direct GitHub Pages navigation works without an SPA fallback. Production `GameStage`, `VirtualHarmonica`, exercises, scoring, and audio flows were not replaced.

## Staff laboratory

The mode switch compares the current handwritten production renderer, plain abcjs engraving, plain `timeBasedLayout`, Timeline Staff with gameplay overlays, and conventional Engraved Score with highlighting. The fixture selector includes:

- a long 4/4 G-major stress fixture with pickup, key signature, explicit sharp/flat/natural, all principal durations and rests, beams, tuplets, internal and cross-bar ties, barlines, and ledger notes from `C,` to `c'`;
- a 6/8 compound-meter fixture with pickup, beamed groups, dotted values, rests, and cross-bar tie;
- an extended built-in Greensleeves example.

### Findings

| Question | Result |
| --- | --- |
| Accidentals/key signature | abcjs is clearly superior and measure-aware; the custom baseline cannot express the complete rules. |
| Durations/rests | Standard glyphs are correct and readable. Time-based spacing adds temporal information without replacing glyph values. |
| Beams/ties/barlines | abcjs renders them correctly; the custom baseline has no equivalent complete engraving model. |
| `timeBasedLayout` | Useful and duration-proportional inside each rendered line. It is not a complete scrolling game timeline by itself. |
| Gameplay overlay | Source-range-bound anchors support ribbons, active fill, fixed judgment line, and pitch trace without leaking SVG queries outside the adapter. |
| Mobile | Full-size notation in a horizontal viewport is preferable to shrinking. Conventional score remains readable with scrolling. |

The tested and pinned dependency is `abcjs@6.5.2`. `AbcAdapter` is the only code that reads parse/visual-object internals. It emits separate written events and sounding events; ties merge multiple written notes into one sound event. DOM association uses source ranges rather than assuming SVG node order.

### Staff recommendation

Proceed later with **Timeline Staff as the default guided-learning mode**, using abcjs for engraving and an application-owned continuously translated viewport for ribbons, judgment line, pitch trace, and result history. Keep **Engraved Score as a conventional reading option** with restrained active highlighting and system transitions.

Do not make raw `timeBasedLayout` the entire production timeline: it solves spacing, not continuous playhead motion, line-transition policy, or tie-spanning ribbon behavior. Those remain application responsibilities behind the adapter.

## Harmonica laboratory

The lab compares brushed light steel, pearl/silver, and a simplified product-illustration hybrid. The same parameterized object renders 10 and 12 holes from existing typed profiles. Every physical hole contains four direct action buttons: blow/out, blow/in, draw/out, and draw/in. One click therefore still specifies the complete action.

State controls cover idle/labels off/labels on, guided target, user press, single microphone match, ambiguous microphone matches, correct, incorrect, slider released, pressed, and neutral. Mobile intentionally retains full-size holes in a horizontal viewport.

### Harmonica recommendation

Use the **parameterized product-illustration SVG/CSS hybrid** as the production direction. It provides deterministic 10/12 scaling, clean provenance, equal-size holes, separate slider motion, high-DPI rendering, and overlay control. A future owner-supplied photo may inform material texture, but should replace only the base material layer—not geometry or musical mapping.

- Base art: parameterized vector/CSS body now; optional restrained raster texture only after a provenance-safe owner reference is approved.
- Hit zones: normalized profile-derived geometry; 40 actions for 10 holes and 48 for 12 holes.
- Slider: separate rod/knob object with released, pressed, and hatched neutral positions.
- Ambiguous mic: highlight every valid zone; animate the slider only when all candidate actions agree.
- Accessibility: every quadrant remains a real button with a complete accessible name and keyboard activation; state is not color-only.

## Screenshot index

| Screenshot | Review purpose |
| --- | --- |
| [`staff-timeline-game-desktop.png`](screenshots/labs/staff-timeline-game-desktop.png) | Timeline Staff, desktop, duration and pitch overlays |
| [`staff-engraved-desktop.png`](screenshots/labs/staff-engraved-desktop.png) | Conventional 6/8 engraved score, beams/ties/rests |
| [`staff-timeline-game-mobile.png`](screenshots/labs/staff-timeline-game-mobile.png) | Timeline Staff, phone portrait and horizontal viewport |
| [`harmonica-12-guided-desktop.png`](screenshots/labs/harmonica-12-guided-desktop.png) | Recommended 12-hole concept and guided target |
| [`harmonica-10-ambiguous-desktop.png`](screenshots/labs/harmonica-10-ambiguous-desktop.png) | 10-hole geometry and ambiguity-safe mic state |
| [`harmonica-12-guided-mobile.png`](screenshots/labs/harmonica-12-guided-mobile.png) | Phone portrait, readable left-side holes |
| [`harmonica-12-slider-mobile.png`](screenshots/labs/harmonica-12-slider-mobile.png) | Phone portrait scrolled to the separately animated slider |

Run `bun run capture:labs` while the local server is running to regenerate this review set. It is screenshot evidence, not a pixel-perfect regression suite.

## Owner decisions still required

1. Approve Timeline Staff as the learning default and Engraved Score as the secondary reading mode.
2. Choose exact Timeline Staff density, judgment-line position, ribbon weight, and line-transition behavior.
3. Approve the product-illustration hybrid over the more photoreal steel/pearl treatments.
4. Decide whether an owner photograph should be used only as material reference before production asset work.
5. Choose how much quadrant guidance is visible by default versus revealed on focus/guidance.

## Known limitations

- The lab slider changes a deterministic playback position; it is not a production timing engine.
- `timeBasedLayout` is line-oriented. Continuous motion and system transitions need a production viewport controller.
- Overlay anchors intentionally depend on abcjs visual details, but that dependency is isolated and tested at one boundary.
- The harmonica body is reviewed vector concept art, not a final photoreal raster asset.
- The lab demonstrates airflow/state treatments but does not play audio or infer breath/slide from microphone pitch.
- Visual screenshots cover Chromium reference viewports; Safari/Firefox visual acceptance remains part of a later production migration.

## Verification

- `bun run typecheck`
- `bun test`
- `bun run build`
- `bun run test:browser`
- reproducible desktop/mobile screenshot capture via `bun run capture:labs`

No production rewrite is included in this milestone.
