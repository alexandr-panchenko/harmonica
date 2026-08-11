import { expect, test, type Page } from "@playwright/test";

async function pressAction(page: Page, id: string, holdMs = 100) {
  const cell = page.locator(`[data-action-id="${id}"]`);
  await cell.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "mouse", buttons: 1 });
  await page.waitForTimeout(holdMs);
  await cell.dispatchEvent("pointerup", { pointerId: 1, pointerType: "mouse", buttons: 0 });
}

async function openMode(page: Page, name: string, song = "Twinkle Twinkle") {
  await page.getByRole("button", { name: new RegExp(name) }).click();
  if (name === "Play the score" || name === "Learn a song") {
    await page.getByRole("button", { name: new RegExp(song) }).click();
  }
}

async function chooseAid(page: Page, group: string, value: "Off" | "On") {
  await page.getByRole("group", { name: group }).getByRole("button", { name: value, exact: true }).click();
}

async function musicMetrics(page: Page) {
  return page.locator(".music-viewport").evaluate((viewport) => {
    const svg = viewport.querySelector<SVGSVGElement>(".abc-production-render svg");
    const note = viewport.querySelector<SVGGraphicsElement>(".abcjs-note");
    const stage = viewport.closest<HTMLElement>(".music-stage")!;
    return {
      clientWidth: viewport.clientWidth,
      scrollWidth: viewport.scrollWidth,
      clientHeight: viewport.clientHeight,
      scrollHeight: viewport.scrollHeight,
      svgWidth: svg?.getBoundingClientRect().width ?? 0,
      noteWidth: note?.getBoundingClientRect().width ?? 0,
      stageHeight: stage.getBoundingClientRect().height,
      systems: viewport.querySelectorAll(".abcjs-staff-wrapper").length,
    };
  });
}

test("main menu is focused on the five learning intents", async ({ page }) => {
  await page.goto("./");
  for (const name of ["Find a note", "Play the score", "Play by ear", "Rhythm training", "Learn a song"]) {
    await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Player setup" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Choose what to practise" })).toBeVisible();
  await expect(page.getByText("Learn where notes are on a chromatic harmonica, read music, train rhythm and your ear, and play complete songs with microphone or touch guidance.")).toBeVisible();
  for (const copy of [
    "Read a note on the staff and find the matching pitch on the harmonica.",
    "Practise a melody note by note, then play it in time with feedback on pitch, timing and duration.",
    "Listen to a short phrase, work out its notes or intervals, and then perform it in rhythm.",
    "Practise starts, holds, releases and rests without the added difficulty of learning a melody.",
    "Follow visible notation and harmonica guidance to start playing a complete melody immediately.",
  ]) await expect(page.getByText(copy)).toBeVisible();
  await expect(page.getByText(/Train your ear|Own the score|YOUR INSTRUMENT|PLAY/, { exact: false })).toHaveCount(0);
});

test("theme control persists explicit choices and System follows the browser", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("group", { name: "Theme" }).getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("group", { name: "Theme" }).getByRole("button", { name: "System" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("saved theme is applied by bootstrap before React mounts", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("harmonica-theme", "dark"));
  await page.goto("./");
  expect(await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, preference: document.documentElement.dataset.themePreference }))).toEqual({ theme: "dark", preference: "dark" });
});

test("phone menu is a readable single column and every mode remains reachable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "phone portrait assertion");
  await page.goto("./");
  const cards = page.locator(".mode-choice");
  await expect(cards).toHaveCount(5);
  const boxes = await cards.evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { left: box.left, width: box.width, height: box.height }; }));
  expect(new Set(boxes.map(box => Math.round(box.left))).size).toBe(1);
  expect(Math.max(...boxes.map(box => box.width))).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(Math.min(...boxes.map(box => box.height))).toBeGreaterThanOrEqual(120);
  await cards.first().click();
  await expect(page.getByRole("heading", { name: "Find the note" })).toBeVisible();
});

test("microphone uses compact guidance and touch exposes four direct actions per hole", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await expect(page.getByTestId("compact-harmonica")).toBeVisible();
  await expect(page.locator(".compact-hole")).toHaveCount(12);
  await expect(page.locator("[data-action-id]")).toHaveCount(0);
  await page.getByRole("button", { name: "Touch · alternative" }).click();
  await expect(page.getByTestId("interactive-harmonica")).toBeVisible();
  await expect(page.locator(".interactive-hole")).toHaveCount(12);
  await expect(page.locator("[data-action-id]")).toHaveCount(48);

  const setupFollowsInstrument = await page.evaluate(() => {
    const instrument = document.querySelector('[data-testid="interactive-harmonica"]')!;
    const setup = document.querySelector(".player-setup")!;
    return Boolean(instrument.compareDocumentPosition(setup) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(setupFollowsInstrument).toBe(true);
  const inputFollowsInstrument = await page.evaluate(() => {
    const instrument = document.querySelector('[data-testid="interactive-harmonica"]')!;
    const input = document.querySelector(".harmonica-input")!;
    return Boolean(instrument.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(inputFollowsInstrument).toBe(true);
  await expect(page.locator(".music-controls").getByRole("group", { name: "Input source" })).toHaveCount(0);
});

test("visible instrument selector switches full 10-hole and 12-hole models and persists", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await page.getByRole("button", { name: "Instrument: 10 holes" }).click();
  await expect(page.getByRole("button", { name: "Instrument: 10 holes" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".compact-hole")).toHaveCount(10);
  await expect(page.getByTestId("compact-harmonica")).toHaveAttribute("data-profile", "standard-c-10");
  await page.getByLabel("Find note range").selectOption("full");
  await page.getByLabel("Accidentals").selectOption("chromatic");
  await expect(page.getByText("33 possible pitches · anti-repeat shuffle")).toBeVisible();
  await page.reload();
  await openMode(page, "Find a note");
  await expect(page.getByRole("button", { name: "Instrument: 10 holes" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".compact-hole")).toHaveCount(10);
  await page.getByRole("button", { name: "Instrument: 12 holes" }).click();
  await expect(page.locator(".compact-hole")).toHaveCount(12);
});

test("all four independent label combinations and naming changes work without reload", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await chooseAid(page, "Harmonica note names", "On");
  await expect(page.locator(".compact-note-names")).toHaveCount(12);
  await expect(page.locator('.compact-hole[data-hole="1"] .compact-note-names')).toContainText("C4");
  await chooseAid(page, "Harmonica note names", "Off");
  await page.getByRole("button", { name: "Touch · alternative" }).click();
  await expect(page.locator(".abc-note-name")).toHaveCount(0);
  await expect(page.locator(".interactive-hole strong")).toHaveCount(0);

  await chooseAid(page, "Staff note names", "On");
  await expect(page.locator(".abc-note-name")).toHaveCount(1);
  await expect(page.locator(".interactive-hole strong")).toHaveCount(0);

  await chooseAid(page, "Staff note names", "Off");
  await chooseAid(page, "Harmonica note names", "On");
  await expect(page.locator(".abc-note-name")).toHaveCount(0);
  await expect(page.locator(".interactive-hole strong")).toHaveCount(48);

  await chooseAid(page, "Staff note names", "On");
  await expect(page.locator(".abc-note-name")).toHaveCount(1);
  await expect(page.locator(".interactive-hole strong")).toHaveCount(48);
  await expect(page.locator('[data-action-id="1-blow-out"] strong')).toHaveText("C4");

  await page.getByRole("group", { name: "Note naming" }).getByRole("button", { name: /Solfège/ }).click();
  await expect(page.locator('[data-action-id="1-blow-out"] strong')).toHaveText("Do4");
  await expect(page.locator(".abc-note-name")).toContainText(/Do|Re|Mi|Fa|Sol|La|Si/);
});

test("learning-aid and naming preferences survive reload", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await chooseAid(page, "Staff note names", "On");
  await chooseAid(page, "Harmonica note names", "On");
  await page.getByRole("group", { name: "Note naming" }).getByRole("button", { name: /Solfège/ }).click();
  await page.reload();
  await openMode(page, "Find a note");
  await page.getByRole("button", { name: "Touch · alternative" }).click();
  await expect(page.getByRole("group", { name: "Staff note names" }).getByRole("button", { name: /On/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Harmonica note names" }).getByRole("button", { name: /On/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Note naming" }).getByRole("button", { name: /Solfège/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-action-id="1-blow-out"] strong')).toHaveText("Do4");
});

test("direct pointer and keyboard actions still capture a held note", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Play the score");
  await page.getByRole("button", { name: "Touch · alternative" }).click();
  await page.getByRole("button", { name: "Start Step" }).click();
  const before = await page.locator(".music-active").getAttribute("data-written-event-id");
  await pressAction(page, "1-blow-out", 680);
  await page.waitForTimeout(120);
  const after = await page.locator(".music-active").getAttribute("data-written-event-id");
  expect(after).not.toBe(before);
  const cell = page.getByRole("button", { name: /Hole 1, blow, slide out/ });
  await cell.focus();
  await page.keyboard.down("Space");
  await expect(cell).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.up("Space");
});

test("hold duration remains exercise input", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Rhythm training");
  await page.getByLabel("Rhythm source").selectOption("preset");
  await page.getByRole("button", { name: "New pattern" }).click();
  await page.getByRole("button", { name: "Touch · alternative" }).click();
  await page.getByRole("button", { name: "Start Step" }).click();
  const before=await page.getByLabel("Practice position").inputValue();
  await pressAction(page, "1-blow-out", 850);
  await expect.poll(async()=>Number(await page.getByLabel("Practice position").inputValue())).toBeGreaterThan(Number(before));
});

test("score library and duration notation remain intact", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Play the score/ }).click();
  await expect(page.getByRole("heading", { name: "Choose your song" })).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.locator(".song-card small")).toHaveCount(0);
  await expect(page.locator(".song-grid")).not.toContainText(/BPM|notes/);
  await expect(page.locator(".import-source")).toBeVisible();
  await page.getByRole("button", { name: /Twinkle Twinkle/ }).click();
  expect(await page.locator(".abcjs-note").count()).toBeGreaterThan(3);
  expect(await page.locator(".music-ribbon").count()).toBeGreaterThan(4);
});

test("notation sizing follows the viewport and Score wraps instead of scaling down", async ({ page }, testInfo) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  const find = await musicMetrics(page);
  expect(find.scrollWidth).toBeLessThanOrEqual(find.clientWidth + 1);
  expect(Math.abs(find.svgWidth - find.clientWidth)).toBeLessThanOrEqual(2);
  expect(find.stageHeight).toBeLessThan(220);

  await page.getByRole("button", { name: /Menu/ }).click();
  await openMode(page, "Play the score");
  const timeline = await musicMetrics(page);
  if (testInfo.project.name === "mobile") expect(timeline.scrollWidth).toBeGreaterThan(timeline.clientWidth);
  await page.getByRole("button", { name: "Score", exact: true }).click();
  const score = await musicMetrics(page);
  expect(score.scrollWidth).toBeLessThanOrEqual(score.clientWidth + 1);
  expect(Math.abs(score.svgWidth - score.clientWidth)).toBeLessThanOrEqual(2);
  expect(score.noteWidth).toBeGreaterThanOrEqual(10);
  expect(score.stageHeight).toBeLessThan(360);
  if (testInfo.project.name === "mobile") expect(score.systems).toBeGreaterThanOrEqual(2);
});

test("Score remains readable in every mode where it is available", async ({ page }) => {
  const contexts = ["Learn a song", "Rhythm training", "Play by ear"];
  for (const name of contexts) {
    await page.goto("./");
    await openMode(page, name);
    await page.getByRole("button", { name: "Score", exact: true }).click();
    if (name === "Play by ear") await page.getByRole("button", { name: "Reveal", exact: true }).click();
    const metrics = await musicMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(Math.abs(metrics.svgWidth - metrics.clientWidth)).toBeLessThanOrEqual(2);
    expect(metrics.noteWidth).toBeGreaterThanOrEqual(10);
    expect(metrics.systems).toBeGreaterThanOrEqual(1);
  }
});

test("long Score documents scroll vertically without horizontal overflow", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Play the score/ }).click();
  await page.getByText("Import ABC", { exact: true }).click();
  const body = Array.from({ length: 32 }, () => "C D E F |").join(" ");
  await page.getByLabel("ABC notation").fill(`X:9\nT:Long layout check\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n${body}`);
  await page.getByRole("button", { name: "Open imported score" }).click();
  await page.getByRole("button", { name: "Score", exact: true }).click();
  const metrics = await musicMetrics(page);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(metrics.systems).toBeGreaterThanOrEqual(8);
});

test("timeline ribbons share notehead coordinates and fill measured intervals after resize", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Learn a song");
  const measure = () => page.evaluate(() => {
    const ribbons = [...document.querySelectorAll<HTMLElement>(".music-ribbon")];
    const groups = [...document.querySelectorAll<SVGElement>(".abc-production-render [data-written-event-id]")];
    return ribbons.slice(0, -1).flatMap(ribbon => {
      const groupIndex = groups.findIndex(group => group.dataset.writtenEventId === ribbon.dataset.writtenEventId), group = groups[groupIndex], nextGroup = groups[groupIndex + 1];
      const head = group?.querySelector<SVGGraphicsElement>(".abcjs-notehead,[class*='notehead'],path.abcjs-note");
      if (!head || !nextGroup) return [];
      const band = ribbon.getBoundingClientRect(), notehead = head.getBoundingClientRect(), next = nextGroup.getBoundingClientRect();
      return [{ y: Math.abs((band.top + band.height / 2) - (notehead.top + notehead.height / 2)), start: band.left - notehead.right, gap: next.left + next.width / 2 - band.right }];
    });
  });
  const desktop = await measure();
  expect(desktop.length).toBeGreaterThan(4);
  expect(Math.max(...desktop.map(value => value.y))).toBeLessThanOrEqual(1.5);
  expect(Math.min(...desktop.map(value => value.start))).toBeGreaterThanOrEqual(3);
  expect(Math.max(...desktop.map(value => value.gap))).toBeLessThanOrEqual(8);
  await page.setViewportSize({ width: 760, height: 900 });
  await page.waitForTimeout(200);
  const resized = await measure();
  expect(Math.max(...resized.map(value => value.y))).toBeLessThanOrEqual(1.5);
});

test("staff mode persists and hidden ear events leak no engraved pitch", async ({ page }) => {
  await page.goto("./");
  await openMode(page,"Play the score");
  await page.getByRole("button",{name:"Score",exact:true}).click();
  await expect(page.getByRole("button",{name:"Score",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.reload();
  await openMode(page,"Play by ear");
  await expect(page.getByRole("button",{name:"Score",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".abc-production-render .music-hidden")).toHaveCount(4);
  await expect(page.locator(".abc-production-render .music-hidden").first()).toHaveCSS("visibility","hidden");
  await expect(page.locator(".hidden-pitch-marker")).toHaveCount(4);
  const placeholderTops=await page.locator(".hidden-pitch-marker").evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().top)));
  expect(new Set(placeholderTops).size).toBe(1);
  await expect(page.locator(".abc-note-name")).toHaveCount(0);
  await expect(page.locator(".compact-hole.target")).toHaveCount(0);
});

test("guided song uses the selected profile and keeps notation visible", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Learn a song");
  await page.getByRole("button", { name: "Instrument: 10 holes" }).click();
  await expect(page.locator(".hidden-pitch-marker")).toHaveCount(0);
  await expect(page.getByTestId("compact-harmonica")).toHaveAttribute("data-profile", "standard-c-10");
  await expect(page.locator(".compact-hole.target")).toHaveCount(1);
});

test("important harmonica and control typography meets readable minimums", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await page.getByRole("button", { name: "Touch · alternative" }).click();
  await chooseAid(page, "Harmonica note names", "On");
  const sizes = await page.evaluate(() => ({
    hole: Number.parseFloat(getComputedStyle(document.querySelector(".interactive-hole > span")!).fontSize),
    breath: Number.parseFloat(getComputedStyle(document.querySelector(".interactive-hole button i")!).fontSize),
    sliderWidth: Number.parseFloat(getComputedStyle(document.querySelector(".product-slider")!).width),
    note: Number.parseFloat(getComputedStyle(document.querySelector(".interactive-hole strong")!).fontSize),
    setting: Number.parseFloat(getComputedStyle(document.querySelector(".aid-control > span")!).fontSize),
    control: Number.parseFloat(getComputedStyle(document.querySelector(".choice-row button")!).fontSize),
  }));
  expect(sizes.hole).toBeGreaterThanOrEqual(11);
  expect(sizes.breath).toBeGreaterThanOrEqual(9);
  expect(sizes.sliderWidth).toBeGreaterThanOrEqual(24);
  expect(sizes.note).toBeGreaterThanOrEqual(9);
  expect(sizes.setting).toBeGreaterThanOrEqual(14);
  expect(sizes.control).toBeGreaterThanOrEqual(14);
});

test("mobile keeps the two-row model and scrolls instead of shrinking labels", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "phone portrait assertion");
  await page.goto("./");
  await openMode(page, "Find a note");
  await page.getByRole("button", { name: "Touch · alternative" }).click();
  const dimensions = await page.locator(".interactive-scroll").evaluate((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }));
  expect(dimensions.scroll).toBeGreaterThan(dimensions.client);
  const quadrant = await page.locator(".interactive-hole button").first().boundingBox();
  expect(quadrant!.width).toBeGreaterThanOrEqual(25);
  expect(quadrant!.height).toBeGreaterThanOrEqual(25);
});

test("microphone mode keeps compact instrument without touch quadrants", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await page.getByRole("button", { name: "Microphone · recommended" }).click();
  await expect(page.getByTestId("compact-harmonica")).toBeVisible();
  await expect(page.locator("[data-action-id]")).toHaveCount(0);
});

test("staff canvas contains music without technical labels or find-mode ribbons", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  const stage=page.locator(".music-stage");
  const visibleText=await stage.evaluate(node=>(node as HTMLElement).innerText);
  expect(visibleText).not.toMatch(/Timeline staff|Read the target|Find a note|JUDGMENT|abcjs|balanced density/);
  await expect(stage.locator(".music-stage-status, .stage-heading")).toHaveCount(0);
  await expect(stage.locator(".music-ribbon")).toHaveCount(0);
  await expect(stage.locator(".music-playhead")).toHaveCount(0);
  await expect(stage.locator(".abcjs-note")).toHaveCount(1);
  const widths=await stage.locator(".abcjs-staff").evaluateAll(groups=>groups.map(group=>{const staff=group.getBoundingClientRect(),viewport=group.closest(".music-viewport")!.getBoundingClientRect();return{staff:staff.width,viewport:viewport.width}}));
  expect(Math.min(...widths.map(value=>value.staff/value.viewport))).toBeGreaterThan(.8);
});

test("harmonica chassis, cover, face and slider remain aligned for both profiles", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  for (const holes of [10,12]) {
    await page.getByRole("button", { name: `Instrument: ${holes} holes` }).click();
    const geometry=await page.locator(".product-harmonica").evaluate(root=>{const chassis=root.querySelector<HTMLElement>(".product-chassis")!,cover=root.querySelector<HTMLElement>(".product-cover")!,face=root.querySelector<HTMLElement>(".product-face")!,slider=root.querySelector<HTMLElement>(".product-slider")!,left=root.querySelector<HTMLElement>(".product-cap.left")!,right=root.querySelector<HTMLElement>(".product-cap.right")!,socket=root.querySelector<HTMLElement>(".product-slider-socket")!;const c=chassis.getBoundingClientRect(),v=cover.getBoundingClientRect(),f=face.getBoundingClientRect(),s=slider.getBoundingClientRect(),o=socket.getBoundingClientRect();return{coverLeft:v.left-c.left,coverRight:c.right-v.right,faceLeft:f.left-c.left,faceRight:c.right-f.right,sliderAnchor:s.left-c.right,capMaterialsMatch:getComputedStyle(left).backgroundImage===getComputedStyle(right).backgroundImage,horizontalCapGradient:getComputedStyle(left).backgroundImage.includes("90deg"),socketWidth:o.width,socketIntersectsRod:o.right>=s.left}});
    expect(Math.abs(geometry.coverLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.coverRight)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.faceLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.faceRight)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.sliderAnchor+10)).toBeLessThanOrEqual(1);
    expect(geometry.capMaterialsMatch).toBe(true);
    expect(geometry.horizontalCapGradient).toBe(false);
    expect(geometry.socketWidth).toBeGreaterThanOrEqual(10);
    expect(geometry.socketIntersectsRod).toBe(true);
  }
});

test("ear flow remains reachable", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Play by ear");
  await page.getByRole("button", { name: "Reveal" }).click();
  await expect(page.locator('.abc-production-render [data-written-event-id]')).toHaveCount(4);
  await page.getByRole("button", { name: "In time" }).click();
  await page.getByRole("button", { name: "Count in + start" }).click();
  await expect(page.getByRole("region",{name:"Practice transport"}).getByText("Count in · 4 beats",{exact:true})).toBeVisible();
});

test("transport seeks, pauses on drag, and exposes distinct Step policies",async({page})=>{
  await page.goto("./");await openMode(page,"Play the score");
  await expect(page.getByLabel("Practice position")).toBeVisible();
  await page.getByLabel("Practice position").fill("4");
  await expect(page.getByText(/Start position · beat 4.0/)).toBeVisible();
  await page.getByRole("button",{name:"Start Step"}).click();
  await page.getByLabel("Practice position").fill("2");
  await expect(page.getByRole("button",{name:"Resume"})).toBeVisible();
  for(const policy of ["pause","restart-note","restart-measure"])await page.getByLabel("Mistake policy").selectOption(policy);
});

test("ear and rhythm content changes only through explicit lifecycle controls",async({page})=>{
  await page.goto("./");await openMode(page,"Play by ear");
  const before=await page.locator(".source-summary b").innerText();await page.getByRole("button",{name:"Hint"}).click();expect(await page.locator(".source-summary b").innerText()).toBe(before);
  await page.getByRole("button",{name:"New phrase"}).click();await expect(page.getByText(/New phrase · listen when ready/)).toBeVisible();
  await page.getByRole("button",{name:"Skip"}).click();await expect(page.getByText(/Phrase skipped/)).toBeVisible();
  await page.getByRole("button",{name:"Menu"}).click();await openMode(page,"Rhythm training");
  await expect(page.getByLabel("Rhythm meter")).toBeVisible();await page.getByLabel("Rhythm meter").selectOption("3/4");await page.getByRole("button",{name:"New pattern"}).click();await expect(page.getByText(/New pattern ready/)).toBeVisible();
});

test("both song shortcuts open the same Song Practice with different presets",async({page})=>{
  await page.goto("./");await openMode(page,"Play the score");await expect(page.getByRole("region",{name:"Song Practice guidance preset"})).toContainText("Practice preset");
  await page.getByRole("button",{name:"Menu"}).click();await openMode(page,"Learn a song");await expect(page.getByRole("region",{name:"Song Practice guidance preset"})).toContainText("Learn preset");
  await page.getByRole("button",{name:"Perform"}).click();await expect(page.getByRole("button",{name:"In time"})).toHaveClass(/active/);
});
