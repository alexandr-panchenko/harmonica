# Harmonica Trainer visual system specification

Status: **binding specification for the next deployed design iteration**  
Scope: **shared colour system, light/dark themes, and main mode-selection screen**

This is an iterative visual-design pass. It does not reopen the notation, microphone, harmonica mapping, exercise, or persistence architecture. The current product behaviour must remain intact.

The immediate goal is to remove the existing black/neon presentation and replace it with a simple, modern, readable visual system. The first owner-review surface is the deployed main mode-selection screen. Training screens should receive the shared tokens and lose the old neon treatment, but their information architecture is not redesigned in this iteration.

---

## 1. Design principles

1. **Clear before decorative.** The interface explains what the trainer does and what each mode teaches.
2. **Light-first, not light-only.** The light theme is the primary design reference; a complete dark counterpart is required.
3. **Colour communicates structure.** Five perceptually chosen hue families identify the five training modes.
4. **No neon as a global style.** Bright colour remains useful for duration ribbons, focus, playback and feedback, but not as an excuse for black backgrounds, low-contrast copy or excessive glow.
5. **One system, two themes.** Components use semantic design tokens, never theme-specific literal colours.
6. **Accessible by construction.** Contrast is measured, not judged only by eye.
7. **Deploy and review in small steps.** This iteration ends after the new visual system and main screen are live and owner-reviewable.

---

## 2. CIELAB/LCh palette model

Use the CIE L\*a\*b\* colour space expressed as LCh(ab) for palette construction. Hues should be chosen perceptually rather than by selecting unrelated hex values.

The five accent families correspond to the five current modes:

| Mode | Hue family | Initial LCh(ab) hue band |
| --- | --- | ---: |
| Find a note | blue / cobalt | 250°–285° |
| Play the score | cyan / teal | 190°–220° |
| Play by ear | violet / purple | 300°–330° |
| Rhythm training | amber / ochre | 65°–90° |
| Learn a song | green | 125°–155° |

These bands are a starting constraint, not permission to use arbitrary saturated colours. Choose one stable hue per family after rendering comparisons. Preserve that hue between its light and dark versions; adjust lightness and, where required by gamut, chroma.

### 2.1 Required pair per hue

Each family must produce at least:

```css
--mode-find-dark
--mode-find-light
--mode-score-dark
--mode-score-light
--mode-ear-dark
--mode-ear-light
--mode-rhythm-dark
--mode-rhythm-light
--mode-guided-dark
--mode-guided-light
```

The pair is reversible:

- dark token can be text/icon/border on the light token;
- light token can be text/icon/border on the dark token.

### 2.2 Contrast requirements

CIELAB lightness is not itself the WCAG contrast calculation. After conversion and gamut mapping to sRGB, calculate relative luminance and contrast according to WCAG.

Required:

- `contrast(dark, light) >= 4.5:1` for every mode pair;
- normal body text against its theme background `>= 4.5:1`;
- target `>= 7:1` for primary body copy where practical;
- interactive boundaries and non-text indicators `>= 3:1` against adjacent surfaces;
- visible keyboard focus `>= 3:1` against both the component and surrounding surface.

Also verify intended combinations against actual theme surfaces. Pair contrast alone does not guarantee that an accent works on every neutral background.

### 2.3 Reproducible generation

Do not hard-code ten unexplained hex values in CSS.

Create a small checked-in palette definition and verification script, for example:

```text
src/design/palette.ts
scripts/verify-colors.ts
```

The palette source records:

- LCh hue;
- chosen lightness/chroma for the light token;
- chosen lightness/chroma for the dark token;
- gamut-mapped sRGB output;
- measured pair contrast;
- measured contrast against relevant neutral surfaces.

A small colour library such as `culori` is acceptable, or implement the conversions and WCAG calculation locally with tests. Generated CSS variables or TypeScript tokens must be deterministic.

The verification command must fail when required contrast is not met.

### 2.4 Neutral system

The five accents do not replace a neutral scale. Define semantic neutrals for both themes:

```css
--canvas
--surface-1
--surface-2
--surface-raised
--text-primary
--text-secondary
--text-muted
--border-subtle
--border-strong
--shadow
--focus-ring
```

Light theme direction:

- warm or neutral near-white canvas;
- white or subtly tinted surfaces;
- dark charcoal text rather than pure black;
- restrained borders and shadows.

Dark theme direction:

- dark neutral canvas, not blue-black neon;
- clearly separated charcoal surfaces;
- near-white primary text;
- no low-contrast gray-green microcopy.

### 2.5 Semantic state colours

Success, warning and error are functional colours. They may reuse an appropriate mode family only when meaning remains clear; otherwise define separate semantic tokens. They must satisfy the same contrast rules and must never be communicated by colour alone.

---

## 3. Theme architecture

Support:

- Light;
- Dark;
- System.

Requirements:

- initial default follows `prefers-color-scheme` unless a saved user choice exists;
- user can choose theme through a clear control, not an obscure diagnostic setting;
- persist choice in `localStorage`;
- apply theme before first paint or as early as practical to prevent flashing;
- use `color-scheme` so native controls match;
- all components use semantic tokens;
- no duplicated light-theme and dark-theme component CSS blocks;
- automated tests cover preference persistence and system fallback.

The light theme is the primary screenshot and owner-review reference.

---

## 4. Remove the old neon language

Remove or replace the current global design motifs:

- black/blue-black page background as the default;
- radial aurora backgrounds;
- large cyan/violet ambient glows;
- glowing card borders;
- text shadows used to manufacture contrast;
- permanent neon states on inactive controls;
- decorative monospaced microtext;
- excessive all-caps letter spacing;
- large gradients on ordinary buttons and panels.

Allowed, when useful and restrained:

- coloured duration ribbons;
- active playback progress;
- microphone pitch trace;
- focus ring;
- short success/error feedback;
- small accent areas tied to a mode.

Ordinary surfaces should be flat or only subtly elevated. Shadows should establish hierarchy rather than create atmosphere.

---

## 5. Typography

Use a modern, highly legible system or locally bundled sans-serif family. Avoid a remote font dependency for core readability.

Suggested hierarchy:

- main page title: 36–56 px responsive;
- main explanatory subtitle: 17–21 px;
- mode title: 20–26 px;
- mode explanation: 14–17 px with comfortable line height;
- ordinary control text: at least 14 px;
- useful secondary text: at least 12 px;
- build metadata may be smaller but must remain readable and visually secondary.

Avoid decorative microcopy. Do not use 7–10 px labels for user-relevant information.

---

## 6. Main mode-selection screen

The main screen has one task: explain the trainer and let the user choose a learning activity.

### 6.1 Remove generated marketing copy

Remove:

- `YOUR INSTRUMENT · YOUR GAME`;
- `Train your ear. Own the score.`;
- `Choose a challenge and turn the chromatic harmonica into muscle memory.`;
- any similar slogan or aspirational filler.

Do not replace it with another slogan.

### 6.2 Approved information structure

Use a direct heading and explanatory subtitle.

Recommended English copy:

**Heading**

> Choose what to practise

**Subtitle**

> Learn where notes are on a chromatic harmonica, read music, train rhythm and your ear, and play complete songs with microphone or touch guidance.

The exact wording may receive small editorial improvements, but it must remain factual, specific and free of marketing claims.

### 6.3 Mode descriptions

Use these meanings and approximately this level of detail:

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

- clear title;
- one explanatory sentence;
- restrained icon or musical mark;
- direct action such as `Start`;
- its assigned mode accent family.

Remove unnecessary mode numbering unless it demonstrably improves navigation. Replace `PLAY` with a neutral, direct action label such as `Start`.

### 6.4 Layout

Desktop:

- concise intro region;
- five mode cards in a balanced grid or list;
- no giant decorative hero competing with the modes;
- cards remain readable without hover.

Phone:

- one-column mode list;
- no horizontal scrolling;
- title and description visible without opening the card;
- minimum comfortable touch target;
- no typography compressed into microtext.

The mode cards should feel related but not identical. Use the five hue families mainly for a stripe, icon field, border, light fill or active state—not as five large saturated blocks.

### 6.5 Header and footer

Header:

- product name;
- clear theme control;
- settings only if settings have a useful role on the menu.

Footer:

- keep privacy/local-audio information if useful;
- keep build identity available but unobtrusive;
- do not let technical metadata compete with mode selection.

---

## 7. Baseline migration of other screens

This iteration does not redesign training-screen layout, staff geometry or harmonica geometry.

However, every production screen must stop looking like a different neon application. Apply the shared semantic tokens to:

- page canvas;
- header;
- cards/panels;
- toolbars;
- buttons;
- form controls;
- text;
- borders;
- dialogs/settings;
- song library;
- review cards;
- tuner container;
- staff container around the notation;
- harmonica container around the instrument.

Preserve functional accent rendering inside the staff and instrument where it communicates current state.

Do not mix a new light menu with unchanged black/neon game screens.

Do not redesign the notation or harmonica in this iteration. Their remaining visual/geometry corrections are reviewed separately after the shared visual system is accepted.

---

## 8. Iterative owner-review workflow

This task is intentionally one reviewable iteration.

1. Establish the real deployed baseline and repair deployment first.
2. Implement the token system and both themes.
3. Migrate all global surfaces away from neon.
4. Redesign the main mode-selection screen and copy.
5. Capture and inspect screenshots.
6. Deploy the exact final commit.
7. Stop and request owner review before another layout redesign.

Required screenshots:

- main menu, light, desktop;
- main menu, dark, desktop;
- main menu, light, phone portrait;
- main menu, dark, phone portrait;
- one representative training screen, light;
- the same training screen, dark;
- song library, light;
- settings/theme control.

The agent should perform one internal correction pass after viewing screenshots, then deploy. Further aesthetic iteration is owner-directed on the live application.

---

## 9. Acceptance criteria

### Deployment

- the live site identifies the exact final source commit;
- a push to `main` has one authoritative deployment path;
- the live URL, not a local preview, is the owner-review surface.

### Palette

- five documented LCh(ab) hue families;
- dark/light pair for each;
- every pair measures at least 4.5:1 after conversion to sRGB;
- verification script is deterministic and fails on contrast regression;
- light and dark themes use semantic tokens.

### Visual system

- no global black-neon appearance;
- no radial aurora on the main menu;
- no permanent decorative glow;
- readable type and contrast on desktop and phone;
- consistent surfaces across menu, game, song library and settings.

### Main screen

- no generated slogan;
- factual heading and explanatory subtitle;
- every mode explains what the player does and learns;
- cards use five accents with restraint;
- direct `Start` action;
- accessible keyboard/focus behaviour;
- phone layout is a readable single column.

### Theme

- Light, Dark and System choices;
- persisted preference;
- no first-paint theme flash where reasonably preventable;
- all required screenshots look intentional in both themes.

### Regression safety

- all modes remain reachable;
- no exercise logic changes;
- microphone, touch, staff, harmonica, playback and song library continue to work;
- existing automated tests pass.
