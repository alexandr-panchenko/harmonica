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

test("main menu is focused on the five learning intents", async ({ page }) => {
  await page.goto("./");
  for (const name of ["Find a note", "Play the score", "Play by ear", "Rhythm training", "Learn a song"]) {
    await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Player setup" })).toHaveCount(0);
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
  const before = await page.locator(".music-active").getAttribute("data-written-event-id");
  await pressAction(page, "1-blow-out", 180);
  await page.waitForTimeout(380);
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
  await page.getByRole("button", { name: "Touch · alternative" }).click();
  await pressAction(page, "1-blow-out", 700);
  await expect(page.getByText(/Rhythm matched/)).toBeVisible();
});

test("score library and duration notation remain intact", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Play the score/ }).click();
  await expect(page.getByRole("heading", { name: "Choose your song" })).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
  await page.getByRole("button", { name: /Twinkle Twinkle/ }).click();
  expect(await page.locator(".abcjs-note").count()).toBeGreaterThan(3);
  expect(await page.locator(".music-ribbon").count()).toBeGreaterThan(4);
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

test("ear flow and diagnostic lab remain reachable", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Play by ear");
  await page.getByRole("button", { name: "Reveal" }).click();
  await expect(page.locator('.abc-production-render [data-written-event-id]')).toHaveCount(4);
  await page.getByRole("button", { name: "In time" }).click();
  await page.getByRole("button", { name: "Count in + perform" }).click();
  await page.goto("?lab=pitch");
  await page.getByRole("button", { name: "Run synthetic" }).click();
  await expect(page.getByText("C4")).toBeVisible();
});

test("isolated staff lab renders every comparison path and canonical anchors", async ({ page }) => {
  await page.goto("lab/staff-design/");
  await expect(page.getByTestId("staff-design-lab")).toBeVisible();
  await expect(page.locator(".abcjs-note").first()).toBeVisible();
  await expect(page.locator("[data-written-event-id]").first()).toBeVisible();
  await expect(page.locator(".duration-ribbon").first()).toBeVisible();
  for (const mode of ["standard", "timeline", "timeline-game", "standard-game"]) {
    await page.getByLabel("Render mode").selectOption(mode);
    await expect(page.locator('[data-render-mode="' + mode + '"]')).toBeVisible();
  }
  await page.getByLabel("Fixture").selectOption("compound-meter");
  await expect(page.locator(".abcjs-note").first()).toBeVisible();
});

test("isolated harmonica lab exposes 10/12 direct geometry and ambiguity-safe slider", async ({ page }) => {
  await page.goto("lab/harmonica-design/");
  await expect(page.getByTestId("harmonica-design-lab")).toBeVisible();
  await expect(page.locator(".physical-hole")).toHaveCount(12);
  await expect(page.locator(".action-quadrants button")).toHaveCount(48);
  await page.getByLabel("Instrument state").selectOption("mic-ambiguous");
  await expect(page.getByTestId("lab-harmonica")).toHaveAttribute("data-slider", "neutral");
  await page.getByRole("button", { name: "10 holes" }).click();
  await expect(page.locator(".physical-hole")).toHaveCount(10);
  await expect(page.locator(".action-quadrants button")).toHaveCount(40);
  await page.locator('[data-action-id="5-blow-in"]').click();
  await expect(page.getByTestId("lab-harmonica")).toHaveAttribute("data-slider", "in");
});
