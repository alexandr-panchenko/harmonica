# Active Codex task — rebuild the production staff and virtual harmonica

This is the current repository task. Execute it autonomously from the latest `main`.

Read completely before editing:

1. `docs/production-redesign-spec.md` — binding product/design/acceptance specification;
2. `docs/design-labs-report.md` — owner review history, including the rejected first production migration;
3. `docs/architecture.md`;
4. `README.md`;
5. the current production notation, harmonica, application, styles, tests, and deployment files.

## Mission

Update the **main Harmonica Trainer application itself** with:

- a correct abcjs Timeline Staff whose ribbons are aligned to noteheads and fill the real measured temporal intervals;
- a visibly improved vector/CSS virtual harmonica in the production game screen;
- compact microphone-first guidance and secondary interactive touch input;
- one deterministic, verifiable GitHub Pages release.

Do not deliver separate design-lab pages. The main production URL is the acceptance surface.

## Current known context

The repository previously committed a migration under `5a05c3b38d12ac63b0c3b84432393c87a135aba9`, followed by a branch-based Pages fallback. The owner did not accept that result:

- the deployed harmonica appeared unchanged or the deployment could not be distinguished from an older build;
- Timeline ribbons remained visually wrong;
- deployment status was ambiguous;
- documentation claimed visual success without owner confirmation.

Do not defend the existing implementation because classes or files already exist. Observe the current main app and repair the visible product.

## Required approach

### 1. Establish the real baseline

- fetch latest `main` and `gh-pages`;
- record both SHAs;
- inspect GitHub Pages configuration;
- run the production build and current tests;
- capture current main-app screenshots;
- identify whether the live site matches the source using existing assets and then add build identity as required by the spec.

### 2. Correct production notation

- keep abcjs as the engraver;
- use one shared coordinate root for abcjs notation and every overlay;
- locate actual notehead bounds, not whole event-group bounds;
- position each ribbon at `notehead.centerY`;
- begin the ribbon at/behind the notehead;
- end it just before the next measured temporal event anchor;
- let rests interrupt ribbons;
- let ties merge sounding duration without erasing written notation;
- put ribbons below notation;
- slightly reduce excess Timeline spacing without crowding;
- verify accidentals, rests, beams, ties, bars, dots, ledger notes, hidden pitch, note labels, Timeline, and Score in the main application.

Do not solve alignment with another magic `duration * constant` or a final CSS offset.

### 3. Correct the production harmonica

- make the approved light parameterized vector instrument visibly present in the main game screen;
- use a coherent body, cover, mouthpiece, physical holes, end caps, slide rod, and slide knob;
- microphone mode is the recommended default and uses Compact Guidance;
- compact mode must not show four large touch buttons per hole;
- show target/detected holes, airflow when known, slider state when known, correct/incorrect state, and optional note names;
- preserve ambiguity: highlight all matching mappings and leave breath/slide neutral when mixed;
- Touch mode uses the same body with four direct actions integrated into each hole;
- animate the physical slider;
- support 10-hole and 12-hole profiles;
- preserve phrase-level deterministic fingering and alternatives;
- make phone behavior readable and automatically focus the relevant hole in Touch mode.

### 4. Remove the laboratory product surface

After promoting useful code/fixtures:

- remove `lab/staff-design/` and `lab/harmonica-design/` public entry points;
- remove lab navigation;
- remove duplicated `src/labs/staff/` and `src/labs/harmonica/` production-equivalent code;
- retain valuable fixtures under tests or a neutral fixture directory;
- remove `capture:labs` and lab-only screenshot capture;
- do not keep a second visual implementation competing with production.

### 5. Refactor styles rather than stacking overrides

- remove obsolete custom-staff CSS;
- remove obsolete table-harmonica CSS;
- remove lab-only CSS;
- resolve old dark/neon rules that override the light production components;
- do not append one more emergency override block;
- preserve high contrast and readable mobile text.

### 6. Make deployment provable

For this pass, use one authoritative branch-based Pages publication path unless repository configuration is explicitly and successfully changed.

- build from the final pushed `main` SHA;
- publish only `dist` to `gh-pages:/`;
- add generated `build-meta.json` containing the exact source SHA and build time;
- expose the source SHA in a small visible About/footer location;
- make the `gh-pages` commit message reference the source SHA;
- wait for Pages to finish building;
- fetch live `build-meta.json` with cache busting and assert it matches final `main`;
- run production smoke tests against the live URL.

A local preview or a pushed `main` commit is not a completed deployment.

## Verification

Run at minimum:

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run benchmark:pitch
bun run build
bun run test:browser
bun run test:production
bun run capture:release
```

Add focused browser geometry tests for:

- notehead/ribbon vertical alignment;
- ribbon reaching the next temporal anchor;
- rest and tie behavior;
- resize recalculation;
- hidden pitch;
- compact harmonica visibility in the main app;
- slider out/in/neutral;
- microphone ambiguity;
- Touch action counts and hold duration;
- 10/12 profiles;
- mobile auto-focus.

Capture and visually inspect at least two iterations of main-app screenshots. Do not use lab screenshots as acceptance evidence.

## Preserve

Do not regress:

- Find a note;
- Play the score Step/In time;
- Play by ear Relative/Absolute;
- Rhythm Step/In time;
- Learn a song Step/In time;
- microphone pitch detection and gating;
- sampled playback;
- note labels and solfège;
- 10-hole/12-hole mappings;
- song library;
- GitHub Pages subpath asset loading.

## Excluded

Do not implement:

- Cloudflare migration;
- accounts;
- achievements;
- user/community melody publishing;
- improvisation mode;
- graphical notation editing;
- unrelated feature expansion.

## Autonomy and completion

Do not ask for routine design choices. Use the approved specification and iterate through observed failures:

```text
Observed failure → smallest structural fix → rerun the same check → compare → next fix
```

Stop only for a genuine external blocker. Do not stop after a partial implementation or another experimental page.

After successful verification:

1. update canonical docs honestly;
2. create a detailed commit on `main`;
3. push `main`;
4. publish `dist` to `gh-pages`;
5. verify live build identity and production tests;
6. leave a clean worktree;
7. report source SHA, publication SHA, production URL, tests, screenshots, removed legacy files, and remaining limitations.

The task is complete only when the live main application visibly contains the corrected staff and harmonica and its build metadata identifies the final source commit.