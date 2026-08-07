# Staff and harmonica design decision report

Status: **laboratory direction approved; first production migration rejected; direct production rebuild is active**

The design laboratories established the correct direction, but they are no longer the product deliverable. The owner approved the underlying ideas and then reviewed the first production migration. That migration was not accepted.

The binding implementation specification is now:

- [`docs/production-redesign-spec.md`](production-redesign-spec.md)
- active execution task: [`CODEX_TASK.md`](../CODEX_TASK.md)

## What the laboratories proved

### Notation

- `abcjs@6.5.2` can engrave notes, rests, accidentals, key signatures, beams, ties, dots, ledger lines, and barlines correctly.
- `timeBasedLayout` can make horizontal notation spacing proportional to musical duration.
- The duration-ribbon idea should be preserved because it gives beginners a direct visual representation of how long to hold a note.
- Conventional engraved Score view remains useful as a secondary reading mode.

### Harmonica

- A parameterized light vector/CSS harmonica can represent both 10-hole and 12-hole instruments.
- A separately animated physical slide is useful and understandable.
- The microphone-first compact instrument and the four-action Touch instrument should share one body and profile data.
- Pitch-only microphone detection must remain honest about multiple possible physical actions.

## Owner review of the laboratory prototypes

The staff laboratory was visually successful except for the ribbon overlay:

- ribbons were shorter than the actual horizontal temporal intervals between adjacent events;
- ribbons were vertically positioned from the whole note group/stem/flag area rather than continuing directly from the notehead;
- ribbons should be translucent horizontal bands, not circular or disconnected elements;
- Timeline spacing could be slightly denser while remaining readable.

The harmonica laboratory established the correct grid, profile mapping, and slide animation. The vector body was still schematic, but it was already good enough to refine without requiring a raster image.

The owner then clarified the product hierarchy:

- real harmonica + microphone is the primary practice path;
- the compact virtual harmonica is primarily animated tablature/guidance;
- Touch input is useful but secondary;
- compact guidance should fit phones without a large four-action grid;
- expanded Touch controls may scroll and should automatically focus the relevant hole.

## Rejected first production migration

The migration committed under `5a05c3b38d12ac63b0c3b84432393c87a135aba9` introduced production notation and harmonica modules, but the owner did not see an accepted result in the deployed application:

- the harmonica appeared unchanged or insufficiently different from the previous production interface;
- Timeline ribbon placement remained wrong;
- repository documentation claimed visual success that the owner had not confirmed;
- deployment moved to a manually published `gh-pages` branch, making it unclear which source build was live.

Therefore none of the following statements should be treated as owner-verified facts until the active rebuild is completed:

- that ribbons are correctly notehead-aligned;
- that ribbons fill measured event intervals;
- that the new compact harmonica is visibly deployed;
- that production matches the final source commit;
- that M11/M12 are accepted.

## Approved final direction

### Production staff

- abcjs is the only production engraver;
- Timeline Staff is the primary guided display;
- ribbon Y equals the actual notehead center;
- ribbon X extends through the measured interval to the next temporal event;
- one shared coordinate root is used by notation and overlays;
- ribbons are behind notation;
- rests break duration bands;
- ties merge sounding duration while preserving engraved written notes;
- conventional Score may remain as a secondary option.

### Production harmonica

- one coherent light vector instrument body;
- Compact Guidance is the default microphone view;
- Interactive Touch is secondary and uses the same body;
- visible physical slide states: released, pressed, and neutral/ambiguous;
- target and detected states are visually distinct;
- 10-hole and 12-hole mappings remain typed and explicit;
- no false physical-action inference from pitch-only microphone input.

### Product surface

Separate public lab pages are no longer required. After reusable code and fixtures are promoted:

- remove the standalone lab routes;
- remove duplicated lab components;
- keep only production code, neutral test fixtures, and production screenshots.

## Deployment decision

GitHub Pages currently uses `gh-pages:/` with a test-only workflow on `main`. The active rebuild must keep one authoritative release path and add generated build identity:

- exact final source SHA;
- build timestamp;
- machine-readable `build-meta.json`;
- visible source SHA in the UI;
- live verification that deployed metadata matches final `main`.

A local preview, a pushed `main`, or a claimed screenshot set is not deployment proof.

## Acceptance surface

Only the deployed main application is accepted:

`https://alexandr-panchenko.github.io/harmonica/`

Final owner acceptance still includes a manual real-harmonica check after automated and visual production verification.