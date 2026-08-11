# Visual-system iteration release report

Status: implementation and local visual correction pass complete; final live source identity is verified after the release commit is published.

## Product result

The production application now has one neutral semantic surface system across the menu, game shell, notation container, harmonica container, tuner, player setup, settings, song library and review cards. Light is the primary reference; Dark is a neutral charcoal counterpart, and System follows the browser unless the saved `harmonica-theme` preference selects an explicit theme. The inline document bootstrap applies the resolved theme before React mounts.

The main menu uses the factual heading and five specified mode descriptions. Each card exposes its explanation without hover, a restrained mode mark and a direct `Start` action. Desktop uses a balanced two-column grid with the guided-song card spanning the row; phone portrait uses one readable column.

The palette is generated in `src/design/palette.ts` from LCh(ab) hues 272°, 205°, 318°, 78° and 142°. The resulting reversible pairs are `#1b5293/#dce9ff`, `#005d66/#c1f1f5`, `#6c3e79/#f9e0fe`, `#654b18/#f9e5c6` and `#255b2c/#d2f0d2`; measured pair contrast ranges from 6.23:1 to 6.63:1. `bun run verify:colors` also checks neutral copy, focus contrast and that checked-in CSS tokens match the generated values.

## Preserved production foundations

The staff still uses the promoted abcjs adapter, measured notehead anchors, rest-aware ribbons and shared tie progress. The harmonica still uses the typed 10/12-hole profile, deterministic four-action geometry and out/in/neutral slider semantics recovered from the approved historical design labs. No public staff or harmonica lab route was restored, and this iteration changes neither renderer geometry nor exercise/audio behaviour.

## Deployment and evidence

GitHub Pages now uses the official Actions publisher instead of the stale legacy `gh-pages` branch. The workflow verifies, builds once with the exact GitHub source SHA, uploads `dist/` and deploys that artifact. Baseline run `31483801140` proved the repaired path by publishing source `709dffd8870a88cbb1b4081f96c57ae97ba4e3e8`; live metadata matched and the production suite passed before visual work began.

The release capture command writes the required eight review images to `docs/screenshots/release-candidate/`: light/dark desktop and phone menus, light/dark training screens, the light song library and settings/theme control. These reproducible images are intentionally ignored rather than committed. The correction pass tightened game-header sizing, anchored the main footer, improved dark-instrument boundaries and protected long build metadata in settings.
