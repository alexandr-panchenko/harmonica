import { expect, test, type Page } from "@playwright/test";

async function pressAction(page: Page, id: string, holdMs = 100) {
  const cell = page.locator(`[data-action-id="${id}"]`);
  await cell.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "mouse", buttons: 1 });
  await page.waitForTimeout(holdMs);
  await cell.dispatchEvent("pointerup", { pointerId: 1, pointerType: "mouse", buttons: 0 });
}

async function openMode(page: Page, name: string, song = "Twinkle Twinkle") {
  await page.getByRole("button", { name: new RegExp(name) }).click();
  if (name === "Practice a song") {
    await page.getByRole("button", { name: new RegExp(song) }).click();
  }
}

async function chooseAid(page: Page, group: string, value: "Off" | "On") {
  await page.getByRole("group", { name: group }).getByRole("button", { name: value, exact: true }).click({force:true});
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
      systems: Math.max(viewport.querySelectorAll(".abcjs-staff-wrapper").length,viewport.querySelectorAll("g.abcjs-staff").length),
    };
  });
}

test("main menu is focused on four learning intents with one Song Practice entry", async ({ page }) => {
  await page.goto("./");
  for (const name of ["Find a note", "Practice a song", "Play by ear", "Rhythm training"]) {
    await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Player setup" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Choose what to practise" })).toBeVisible();
  await expect(page.getByText("Learn where notes are on a chromatic harmonica, read music, train rhythm and your ear, and play complete songs with microphone or touch guidance.")).toBeVisible();
  for (const copy of [
    "Read a note on the staff and find the matching pitch on the harmonica.",
    "Choose a song, guidance and mistake response, then practise note by note or in tempo.",
    "Listen to a short phrase, work out its notes or intervals, and then perform it in rhythm.",
    "Practise starts, holds, releases and rests without the added difficulty of learning a melody.",
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
  await expect(cards).toHaveCount(4);
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

  await page.getByRole("group", { name: "Note naming" }).getByRole("button", { name: /Solfège/ }).click({force:true});
  await expect(page.locator('[data-action-id="1-blow-out"] strong')).toHaveText("Do4");
  await expect(page.locator(".abc-note-name")).toContainText(/Do|Re|Mi|Fa|Sol|La|Si/);
});

test("learning-aid and naming preferences survive reload", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await chooseAid(page, "Staff note names", "On");
  await chooseAid(page, "Harmonica note names", "On");
  await page.getByRole("group", { name: "Note naming" }).getByRole("button", { name: /Solfège/ }).click({force:true});
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
  await openMode(page, "Practice a song");
  await page.getByRole("button", { name: "Touch · alternative" }).click();
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
  const before=await page.getByLabel("Practice position").inputValue();
  await pressAction(page, "1-blow-out", 850);
  await expect.poll(async()=>Number(await page.getByLabel("Practice position").inputValue())).toBeGreaterThan(Number(before));
});

test("score library and duration notation remain intact", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Practice a song/ }).click();
  await expect(page.getByRole("heading", { name: "Choose your song" })).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.locator(".song-card small")).toHaveCount(0);
  await expect(page.locator(".song-grid")).not.toContainText(/BPM|notes/);
  await expect(page.locator(".import-source")).toBeVisible();
  await page.getByRole("button", { name: /Twinkle Twinkle/ }).click();
  expect(await page.locator(".abcjs-note").count()).toBeGreaterThan(3);
  expect(await page.locator(".music-ribbon").count()).toBeGreaterThan(4);
});

test("notation sizing follows the viewport with one visible Timeline layout", async ({ page }, testInfo) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  const find = await musicMetrics(page);
  expect(find.scrollWidth).toBeLessThanOrEqual(find.clientWidth + 1);
  expect(Math.abs(find.svgWidth - find.clientWidth)).toBeLessThanOrEqual(2);
  expect(find.stageHeight).toBeLessThan(220);

  await page.getByRole("button", { name: /Menu/ }).click();
  await openMode(page, "Practice a song");
  const timeline = await musicMetrics(page);
  if (testInfo.project.name === "mobile") expect(timeline.scrollWidth).toBeGreaterThan(timeline.clientWidth);
  expect(timeline.scrollWidth).toBeGreaterThanOrEqual(timeline.clientWidth - 1);
  expect(timeline.noteWidth).toBeGreaterThanOrEqual(10);
  expect(timeline.stageHeight).toBeLessThan(360);
  await expect(page.getByRole("group", { name: "Staff display" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Score", exact: true })).toHaveCount(0);
});

test("Timeline remains readable in every notation practice mode", async ({ page }) => {
  const contexts = ["Practice a song", "Rhythm training", "Play by ear"];
  for (const name of contexts) {
    await page.goto("./");
    await openMode(page, name);
    if (name === "Play by ear") await page.getByRole("button", { name: "Reveal", exact: true }).click();
    const metrics = await musicMetrics(page);
    expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth - 1);
    expect(metrics.noteWidth).toBeGreaterThanOrEqual(10);
    expect(metrics.systems).toBeGreaterThanOrEqual(1);
    await expect(page.getByRole("button", { name: "Score", exact: true })).toHaveCount(0);
  }
});

test("long Timeline documents retain one horizontal duration axis", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Practice a song/ }).click();
  await page.getByText("Import ABC", { exact: true }).click();
  const body = Array.from({ length: 32 }, () => "C D E F |").join(" ");
  await page.getByLabel("ABC notation").fill(`X:9\nT:Long layout check\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n${body}`);
  await page.getByRole("button", { name: "Open imported score" }).click();
  const metrics = await musicMetrics(page);
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.systems).toBe(1);
});

test("timeline ribbons share notehead coordinates and fill measured intervals after resize", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Practice a song");
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

test("hidden ear events leak no engraved pitch and expose no fake Score mode", async ({ page }) => {
  await page.goto("./");
  await openMode(page,"Play by ear");
  await expect(page.getByRole("button",{name:"Score",exact:true})).toHaveCount(0);
  await expect(page.getByRole("group",{name:"Staff display"})).toHaveCount(0);
  await expect(page.locator(".abc-production-render .music-hidden")).toHaveCount(4);
  await expect(page.locator(".abc-production-render .music-hidden").first()).toHaveCSS("visibility","hidden");
  await expect(page.locator(".hidden-pitch-marker")).toHaveCount(4);
  const placeholderTops=await page.locator(".hidden-pitch-marker").evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().top)));
  expect(new Set(placeholderTops).size).toBe(1);
  await expect(page.locator(".abc-note-name")).toHaveCount(0);
  await expect(page.locator(".compact-hole.target")).toHaveCount(0);
});

test("song guidance uses the selected profile and keeps notation visible", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Practice a song");
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

test("Touch harmonica is centered whenever the full instrument fits", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await page.getByRole("button", { name: "Touch · alternative" }).click();
  for (const holes of [10,12]) {
    await page.getByRole("button", { name: `Instrument: ${holes} holes` }).click();
    const geometry=await page.locator(".interactive-scroll").evaluate(root=>{const instrument=root.querySelector<HTMLElement>(".product-harmonica")!,viewport=root.getBoundingClientRect(),body=instrument.getBoundingClientRect();return{fits:root.scrollWidth<=root.clientWidth+1,centerDelta:Math.abs((body.left+body.width/2)-(viewport.left+viewport.width/2))}});
    if(geometry.fits)expect(geometry.centerDelta).toBeLessThanOrEqual(1);
  }
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

test("notation transport seeks by keyboard fallback and exposes distinct Wait for me policies",async({page})=>{
  await page.goto("./");await openMode(page,"Practice a song");
  await page.getByRole("button",{name:"Touch · alternative"}).click();
  await expect(page.getByLabel("Practice position")).toBeAttached();
  await page.getByLabel("Practice position").evaluate((input:HTMLInputElement)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!;setter.call(input,"4");input.dispatchEvent(new Event("input",{bubbles:true}))});
  await expect(page.locator(".practice-feedback")).toContainText("Start position · beat 4.0");
  await page.getByLabel("Practice position").evaluate((input:HTMLInputElement)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!;setter.call(input,"2");input.dispatchEvent(new Event("input",{bubbles:true}))});
  await expect(page.getByRole("button",{name:"Resume"})).toBeVisible();
  for(const policy of ["pause","restart-note","restart-measure"])await page.getByLabel("Mistake policy").selectOption(policy);
  await expect(page.locator(".notation-playhead")).toBeVisible();
  await expect.poll(()=>page.locator(".notation-playhead").evaluate(node=>getComputedStyle(node,"::before").content)).toBe("none");
});

test("ear and rhythm content changes only through explicit lifecycle controls",async({page})=>{
  await page.goto("./");await openMode(page,"Play by ear");
  const before=await page.locator(".source-summary b").innerText();await page.getByRole("button",{name:"Hint"}).click();expect(await page.locator(".source-summary b").innerText()).toBe(before);
  await page.getByRole("button",{name:"New phrase"}).click();await expect(page.locator(".practice-feedback")).toContainText("New phrase · listen when ready");
  await page.getByRole("button",{name:"Skip"}).click();await expect(page.locator(".practice-feedback")).toContainText("Phrase skipped");
  await page.getByRole("button",{name:"Menu"}).click();await openMode(page,"Rhythm training");
  await expect(page.getByLabel("Rhythm meter")).toBeVisible();await page.getByLabel("Rhythm meter").selectOption("3/4");await page.getByRole("button",{name:"New pattern"}).click();await expect(page.locator(".practice-feedback")).toContainText("New pattern ready");
});

test("one Song Practice implementation exposes direct settings without presets or a visible Position block",async({page})=>{
  await page.goto("./");await expect(page.getByRole("button",{name:/Practice a song/})).toHaveCount(1);await openMode(page,"Practice a song");
  await expect(page.getByRole("region",{name:"Song practice controls"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Wait for me"})).toHaveClass(/active/);
  await expect(page.getByText(/Learn preset|Practice preset|Perform preset/)).toHaveCount(0);
  await expect(page.locator(".practice-transport,.seek-control")).toHaveCount(0);
  await expect(page.getByLabel("Practice position")).toBeAttached();
  await page.getByRole("button",{name:"▶ Listen"}).click();
  await page.getByRole("button",{name:"Settings"}).click();
  await expect.poll(async()=>page.locator(".settings-drawer pre").textContent()).toContain('"status": "sampled"');
  await expect(page.locator(".settings-drawer pre")).toContainText('"instrument": "VCSL Hohner Super 64 samples"');
});

test("notation click and drag seek the playhead",async({page})=>{
  await page.goto("./");await openMode(page,"Practice a song");
  const viewport=page.locator(".music-viewport");await viewport.scrollIntoViewIfNeeded();const box=await viewport.boundingBox();expect(box).toBeTruthy();
  await page.mouse.click(box!.x+box!.width*.62,box!.y+box!.height*.5);
  await expect.poll(async()=>Number(await page.getByLabel("Practice position").inputValue())).toBeGreaterThan(1);
  await page.mouse.move(box!.x+box!.width*.4,box!.y+box!.height*.5);await page.mouse.down();await page.mouse.move(box!.x+box!.width*.75,box!.y+box!.height*.5,{steps:4});await page.mouse.up();
  await expect(page.locator(".notation-playhead")).toBeVisible();
});

test("wrong played pitch is marked at its own height with an explicit explanation",async({page})=>{
  await page.goto("./");await openMode(page,"Practice a song");await page.getByRole("button",{name:"Touch · alternative"}).click();const wrong=page.locator("[data-action-id]:not(.guided)").first();await wrong.focus();await page.keyboard.down("Space");await expect(page.locator(".wrong-pitch-marker")).toHaveText("×");await expect(page.locator(".practice-feedback")).toContainText(/Played .* · expected .* · Progress kept/);await page.keyboard.up("Space");
});

test("In time exposes count-in and leaves passed events visibly missed",async({page})=>{
  await page.goto("./");await openMode(page,"Practice a song");await page.getByRole("button",{name:"In time"}).click();await page.getByRole("button",{name:"Count in + start"}).click();await expect(page.getByRole("region",{name:"Practice transport"})).toContainText("Count in · 4 beats");await page.getByRole("button",{name:"Pause"}).click();await page.getByLabel("Practice position").evaluate((input:HTMLInputElement)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"4");input.dispatchEvent(new Event("input",{bubbles:true}))});expect(await page.locator(".music-ribbon.missed").count()).toBeGreaterThan(0);
});

test("the three mistake responses create different score geometry from a half-held note",async({page})=>{
  const release=async(policy:"pause"|"restart-note")=>{await page.goto("./");await openMode(page,"Practice a song");await page.getByLabel("Mistake policy").selectOption(policy);await page.getByRole("button",{name:"Microphone · recommended"}).click();await page.getByRole("button",{name:"Touch · alternative"}).click();const target=page.locator("[data-action-id].guided").first();await target.focus();await page.keyboard.down("Space");await page.waitForTimeout(240);await page.keyboard.up("Space");await page.waitForTimeout(100);return Number.parseFloat(await page.locator(".music-ribbon.active i,.music-ribbon.partial i,.music-ribbon.wrong i").first().evaluate(element=>(element as HTMLElement).style.width))};
  const kept=await release("pause"),restarted=await release("restart-note");expect(kept).toBeGreaterThan(30);expect(restarted).toBe(0);
  await page.goto("./");await openMode(page,"Practice a song");await page.getByLabel("Mistake policy").selectOption("restart-measure");await page.getByRole("button",{name:"Microphone · recommended"}).click();await page.getByRole("button",{name:"Touch · alternative"}).click();const target=page.locator("[data-action-id].guided").first();await target.focus();await page.keyboard.down("Space");await page.waitForTimeout(240);await page.keyboard.up("Space");await expect(page.locator(".practice-feedback")).toContainText(/Measure 1 restarted/);expect(Number(await page.getByLabel("Practice position").inputValue())).toBe(0);
});
