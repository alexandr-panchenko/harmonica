# Active Codex task — repair deployment, remove neon styling, and redesign the main menu

Execute this task autonomously from the latest `main` in the local VS Code/Codex environment.

Read completely before editing:

1. [`docs/visual-system-spec.md`](docs/visual-system-spec.md) — binding design and acceptance specification for this iteration;
2. [`README.md`](README.md);
3. [`docs/architecture.md`](docs/architecture.md);
4. current `src/app/App.tsx`, `src/styles.css`, theme/bootstrap code, tests, build metadata and deployment files.

The previous production-redesign task is closed as a development attempt. Do not repeat it. This iteration is focused on the shared visual system and the main mode-selection screen.

---

## 1. Why the owner saw no change

Treat the current repository and deployment as untrusted until verified.

At task preparation time:

- `main` contained merge commit `493383f35d188f3c4310056664ad3eb30bf84f40` plus later planning documentation;
- the merged redesign diff mostly removed laboratory files and added build metadata, with only very small production-component changes;
- `.github/workflows/pages.yml` was named `Test` and only installed, typechecked, tested and built—it did not publish;
- GitHub Pages was still configured as a legacy `gh-pages:/` site;
- `gh-pages` still pointed to `f12b04504810c3be25ae867e267c48798de7bc6f`, published from older source `e890779`.

Therefore a successful test workflow did not prove that the live application changed.

Do not begin visual work until one authoritative deployment path is repaired and the live site identifies the exact current source commit.

---

## 2. Phase 0 — make deployment authoritative and provable

### 2.1 Establish the baseline

- fetch `main` and `gh-pages`;
- record both SHAs;
- inspect the actual GitHub Pages configuration;
- inspect `.github/workflows/pages.yml` and any local deploy scripts;
- build the latest `main` with exact source metadata;
- verify `dist/build-meta.json` contains the current source SHA.

### 2.2 Choose one deployment path

Use exactly one of these paths and remove/disable conflicting paths:

#### Preferred: official GitHub Pages workflow

If credentials and repository settings permit:

- change Pages build type to GitHub Actions/workflow;
- use official `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages`;
- give the workflow the required `pages: write` and `id-token: write` permissions;
- build only after install, typecheck and tests pass;
- expose deployed URL from the deployment job.

#### Acceptable fallback: authoritative `gh-pages` publication

If the repository must remain legacy `gh-pages:/`:

- make the workflow publish only the verified `dist/` directory to `gh-pages` after tests pass;
- use `GITHUB_TOKEN`/repository write permission or a deterministic local deploy command;
- make the publication commit reference the exact source SHA;
- do not hand-copy source files to `gh-pages`;
- do not leave a test-only workflow that never deploys.

### 2.3 Deployment gate before design

Deploy the unmodified current baseline first, then verify:

- live `build-meta.json?cache-bust=<timestamp>` equals current `main` SHA;
- the visible build identity matches;
- a live smoke test passes.

Only then start the visual redesign. This prevents another iteration from being confused with a stale deployment.

---

## 3. Phase 1 — implement the CIELAB/LCh design system

Follow `docs/visual-system-spec.md` exactly.

### Required outcomes

- five perceptually selected LCh(ab) hue families, one for each mode;
- dark/light pair for each family;
- every pair has WCAG contrast ratio `>= 4.5:1` after conversion/gamut mapping to sRGB;
- semantic neutral tokens for light and dark themes;
- deterministic palette source and verification script;
- verification command fails on contrast regression;
- Light, Dark and System theme choices;
- persisted preference and system fallback;
- theme applied before first paint where practical;
- all production components use semantic tokens rather than scattered literal theme colours.

Do not derive contrast from Lab L* alone. Use WCAG relative luminance on final sRGB values.

A small dependency such as `culori` is acceptable if justified and pinned. A local tested implementation is also acceptable.

Add a script such as:

```bash
bun run verify:colors
```

and include it in CI/test verification.

---

## 4. Phase 2 — remove the global neon visual language

Refactor existing CSS rather than adding a final override block.

Remove or replace:

- blue-black/black global canvas as the default;
- radial aurora backgrounds;
- large cyan/violet ambient glows;
- glowing inactive cards and buttons;
- text shadows used for legibility;
- decorative monospaced microtext;
- excessive uppercase tracking;
- strong gradients on ordinary surfaces.

Keep colour where it conveys function:

- duration ribbons;
- current playback progress;
- pitch trace;
- keyboard focus;
- success/error feedback;
- restrained mode accents.

Apply the new semantic surfaces and typography across:

- main menu;
- game header and shell;
- toolbars and controls;
- song library;
- settings;
- tuner container;
- staff container;
- harmonica container;
- review cards and feedback.

Do not redesign staff geometry, ribbon geometry, harmonica geometry, microphone logic or exercise behaviour in this task.

Do not leave a light main menu opening into unchanged black-neon training screens.

---

## 5. Phase 3 — redesign the main mode-selection screen

The main screen must explain the product and each learning mode. It must not use generated marketing slogans.

### Remove completely

- `YOUR INSTRUMENT · YOUR GAME`;
- `Train your ear. Own the score.`;
- `Choose a challenge and turn the chromatic harmonica into muscle memory.`;
- any replacement slogan of the same kind;
- unnecessary `01`–`05` numbering unless visual review proves it genuinely useful;
- the action word `PLAY` as a decorative label.

### Use factual copy

#### Main heading

> Choose what to practise

#### Main subtitle

> Learn where notes are on a chromatic harmonica, read music, train rhythm and your ear, and play complete songs with microphone or touch guidance.

Minor editorial improvement is allowed only if it remains factual and specific.

### Mode copy

#### Find a note

> Read a note on the staff and find the matching pitch on the harmonica.

#### Play the score

> Practise a melody note by note, then play it in time with feedback on pitch, timing and duration.

#### Play by ear

> Listen to a short phrase, work out its notes or intervals, and then perform it in rhythm.

#### Rhythm training

> Practise starts, holds, releases and rests without the added difficulty of learning a melody.

#### Learn a song

> Follow visible notation and harmonica guidance to start playing a complete melody immediately.

Each mode card contains:

- title;
- one explanatory sentence;
- restrained icon/musical mark;
- direct `Start` action;
- its mode accent used sparingly.

### Layout

Desktop:

- concise explanatory intro;
- five readable mode cards in a balanced grid or list;
- no enormous decorative hero area;
- no dependence on hover to read content.

Phone:

- one-column list;
- title and explanation visible immediately;
- comfortable touch targets;
- no horizontal scroll;
- no microtext.

Header:

- product name;
- clear theme control;
- settings only if useful on the menu.

Footer:

- privacy/local-audio note if useful;
- build identity remains available but visually secondary.

---

## 6. Visual review loop

Before deployment, capture at minimum:

- main menu, light, desktop;
- main menu, dark, desktop;
- main menu, light, phone portrait;
- main menu, dark, phone portrait;
- representative training screen, light;
- the same screen, dark;
- song library, light;
- settings/theme control.

Open and inspect the screenshots at original size.

Self-review:

- Is every heading and description readable without zooming?
- Is the light theme calm and modern rather than empty or clinical?
- Is the dark theme neutral rather than neon blue-black?
- Are the five accents distinguishable but restrained?
- Is any text below useful readable size?
- Is any card dependent on glow or gradient for hierarchy?
- Does the main screen explain every mode without marketing filler?
- Do training screens visibly belong to the same product?
- Does every accent/text/surface combination pass measured contrast?

Perform at least one correction pass after screenshot review.

---

## 7. Automated verification

Run at minimum:

```bash
bun install --frozen-lockfile
bun run verify:colors
bun run typecheck
bun test
bun run benchmark:pitch
bun run build
bun run test:browser
bun run test:production
bun run capture:release
```

Add or update tests for:

- palette generation determinism;
- all five accent-pair contrast ratios;
- neutral text/surface contrast;
- theme System/Light/Dark behaviour;
- persistence across reload;
- no first-paint mismatch where testable;
- main copy and mode descriptions;
- theme control accessibility;
- phone mode list;
- mode navigation;
- no regression of existing exercise entry points.

Do not add brittle full-page pixel-perfect assertions. Keep screenshots for visual review and use focused DOM/computed-style tests for invariants.

---

## 8. Deploy and stop for owner review

This is one owner-review iteration. Do not continue into another layout redesign after it is live.

After local verification:

1. update canonical documentation honestly;
2. create a detailed commit;
3. push `main`;
4. let the authoritative deployment path publish the exact build;
5. wait for completion;
6. verify live `build-meta.json` equals final `main` SHA;
7. run production tests against the live URL;
8. capture the live main menu in light and dark themes;
9. leave a clean worktree;
10. report and stop for owner feedback.

Final report must include:

- starting SHA;
- final source SHA;
- deployment/publication SHA or workflow run;
- live URL;
- live build-meta result;
- chosen LCh hues and generated light/dark values;
- measured contrast table;
- theme architecture;
- copy changes;
- files/CSS removed or refactored;
- test results;
- screenshot paths;
- known limitations;
- specific questions for the next visual iteration.

The task is complete only when the owner can open the live URL and unmistakably see the new light-first main screen from the reported source commit.

---

## Out of scope

Do not implement in this iteration:

- another staff/ribbon redesign;
- another virtual harmonica geometry redesign;
- Cloudflare migration;
- authentication;
- achievements;
- user/community melody publishing;
- improvisation mode;
- notation editing;
- unrelated feature expansion.
