# M10–M12 design decision report

Status: **owner decisions approved; production release candidate implemented**

## Approved decisions

- abcjs 6.5.2 is the production engraver.
- Timeline Staff is the initial guided/beginner default; Engraved Score is the conventional secondary mode.
- Balanced density is the production Timeline preset (`minPadding: 13`, `minWidth: 33`, target staff width about 40 measured-layout px per beat). Spacious and Compact remain laboratory diagnostics only.
- The light product-illustration body is the production instrument direction; no raster asset is required.
- Microphone input uses Compact Guidance, while explicit touch input uses four direct-action zones per hole.
- One action always specifies hole, breath, and slide. The physical slider remains independently animated.

## Ribbon correction

The approved lab no longer computes ribbon width from `durationBeats * 42` or vertical position from the selectable group bottom. Production `RenderAnchor` now distinguishes whole-event bounds, exact notehead bounds, temporal X, and system index. The adapter searches for the notehead inside each selectable note group and owns the only diagnostic fallback.

`buildTimelineGeometry()` connects a notehead to the next measured temporal anchor with a 5 px end gap. A rest supplies the next temporal anchor but produces no ribbon. The last note extrapolates from a neighboring measured pixels-per-beat interval. Every ribbon center uses `notehead.centerY`. Tied written notes retain separate engraved segments while elapsed fill belongs to the merged sounding event.

Layer order is explicit: translucent ribbon underlay, abcjs notation, then hidden/name/performance/trace overlays. Balanced spacing is about 15% tighter than the original Spacious prototype and retains clear accidentals, dots, flags, beams, ties, and rests.

## Production instrument split

Compact Guidance presents one complete 10/12-hole body, hole numbers, target outline, detected halo, airflow, feedback, and out/in/neutral physical slider. It contains no four-quadrant buttons. Multiple microphone matches are combined by hole and only assert a common breath or slide state when one exists.

Interactive Touch uses the same body and typed mappings, exposing 40 or 48 direct action buttons with pointer capture, keyboard hold, sampled playback, and slider animation. Phone layouts scroll horizontally and follow the recommended target unless it is already safe on screen or the user interacted during the previous three seconds.

The phrase-level dynamic-programming planner selects a deterministic primary fingering while preserving valid alternatives. Its costs cover hole travel, slide/breath changes, duplicate-position churn, and continuity; an impossible pitch is explicit.

## Screenshot evidence

Laboratory evidence is under `docs/screenshots/labs/` and includes Timeline mixed duration, tie, phone, ribbon close-up, Score desktop/mobile, 10/12 instrument geometry, ambiguous microphone mapping, and slider states. Full product evidence is under `docs/screenshots/release-candidate/` and includes menu, all five modes, Timeline/Score, hidden Ear, compact 10/12, mobile compact, mobile touch, and ribbon close-up.

## Two-pass self-review

Pass one found authored ABC body line breaks creating multiple Timeline systems, missing lead-in before the first judgment target, mobile compact layout overflow, and late legacy CSS restoring dark panels. Pass two flattened Timeline body line breaks without changing source offsets, added measured lead-in, made compact geometry truly responsive, raised setup controls above scrolling content, and applied final light-panel overrides.

Confirmed after pass two:

- ribbons continue from the notehead and nearly fill each measured event interval;
- notation remains above the ribbon;
- Balanced spacing is readable without the original excess;
- airflow and slider states are visible without turning Compact into a table;
- all 10/12 compact holes fit phone portrait;
- Touch retains readable scrolling controls and automatic target focus;
- main surfaces are light and high-contrast.

Final acceptance still requires the owner’s real-harmonica test; this report does not declare the product accepted.
