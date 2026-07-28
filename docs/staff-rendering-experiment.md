# Staff rendering experiment

The legacy ABCJS SVG was unsuitable as the source of game coordinates: event mapping relied on library DOM details and wrapped lines broke a single horizontal timeline. The release therefore uses the canonical `Melody` and an application-owned SVG staff for the game stage.

The spike covers normal notes, rests, accidentals through labels, varied duration ribbons, horizontal overflow, a fixed playhead, moving flow transform, pitch trace, desktop resize, mobile portrait/landscape, hit/miss state, and reduced motion. This makes event-to-X and MIDI-to-Y deterministic. ABC source is retained in `Melody.source` and can later be rendered as a detailed reference without owning scoring state.

Trade-off: the game notation is intentionally a readable monodic subset, not an engraving engine. Ties and dotted values are represented in timing but not yet engraved with full professional glyph detail.
