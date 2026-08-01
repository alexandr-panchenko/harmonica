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

test("harmonica always has two breath rows and two direct halves per hole", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await expect(page.locator(".breath-row")).toHaveCount(2);
  await expect(page.locator('[data-breath-row="blow"]')).toHaveCount(1);
  await expect(page.locator('[data-breath-row="draw"]')).toHaveCount(1);
  await expect(page.locator(".action-lane")).toHaveCount(0);
  await expect(page.locator(".hole-number")).toHaveCount(12);
  await expect(page.locator(".hole-actions")).toHaveCount(24);
  for (const group of await page.locator(".hole-actions").all()) await expect(group.locator(".action-cell")).toHaveCount(2);
  await expect(page.locator(".action-cell")).toHaveCount(48);
  await expect(page.locator(".slide-icon")).toHaveCount(48);
  await expect(page.getByTestId("virtual-harmonica").getByText("OUT", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("virtual-harmonica").getByText("IN", { exact: true })).toHaveCount(0);

  const sliderPositions = await page.evaluate(() => ({
    out: Number.parseFloat(getComputedStyle(document.querySelector(".slide-out .slide-icon-knob")!).left),
    in: Number.parseFloat(getComputedStyle(document.querySelector(".slide-in .slide-icon-knob")!).left),
  }));
  expect(sliderPositions.in).toBeGreaterThan(sliderPositions.out);

  const setupFollowsInstrument = await page.evaluate(() => {
    const instrument = document.querySelector('[data-testid="virtual-harmonica"]')!;
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
  await expect(page.locator(".hole-number")).toHaveCount(10);
  await expect(page.locator(".action-cell")).toHaveCount(40);
  await expect(page.getByTestId("virtual-harmonica")).toHaveAttribute("data-profile", "standard-c-10");
  await page.getByLabel("Find note range").selectOption("full");
  await page.getByLabel("Accidentals").selectOption("chromatic");
  await expect(page.getByText("33 possible pitches · anti-repeat shuffle")).toBeVisible();
  await page.reload();
  await openMode(page, "Find a note");
  await expect(page.getByRole("button", { name: "Instrument: 10 holes" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".action-cell")).toHaveCount(40);
  await page.getByRole("button", { name: "Instrument: 12 holes" }).click();
  await expect(page.locator(".hole-number")).toHaveCount(12);
  await expect(page.locator(".action-cell")).toHaveCount(48);
});

test("all four independent label combinations and naming changes work without reload", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await expect(page.locator(".note-label")).toHaveCount(0);
  await expect(page.locator(".action-cell strong")).toHaveCount(0);

  await chooseAid(page, "Staff note names", "On");
  await expect(page.locator(".note-label")).toHaveCount(1);
  await expect(page.locator(".action-cell strong")).toHaveCount(0);

  await chooseAid(page, "Staff note names", "Off");
  await chooseAid(page, "Harmonica note names", "On");
  await expect(page.locator(".note-label")).toHaveCount(0);
  await expect(page.locator(".action-cell strong")).toHaveCount(48);

  await chooseAid(page, "Staff note names", "On");
  await expect(page.locator(".note-label")).toHaveCount(1);
  await expect(page.locator(".action-cell strong")).toHaveCount(48);
  await expect(page.locator('[data-action-id="1-blow-out"] strong')).toHaveText("C4");

  await page.getByRole("group", { name: "Note naming" }).getByRole("button", { name: /Solfège/ }).click();
  await expect(page.locator('[data-action-id="1-blow-out"] strong')).toHaveText("Do4");
  await expect(page.locator(".note-label")).toContainText(/Do|Re|Mi|Fa|Sol|La|Si/);
});

test("learning-aid and naming preferences survive reload", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await chooseAid(page, "Staff note names", "On");
  await chooseAid(page, "Harmonica note names", "On");
  await page.getByRole("group", { name: "Note naming" }).getByRole("button", { name: /Solfège/ }).click();
  await page.reload();
  await openMode(page, "Find a note");
  await expect(page.getByRole("group", { name: "Staff note names" }).getByRole("button", { name: /On/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Harmonica note names" }).getByRole("button", { name: /On/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Note naming" }).getByRole("button", { name: /Solfège/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-action-id="1-blow-out"] strong')).toHaveText("Do4");
});

test("direct pointer and keyboard actions still capture a held note", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Play the score");
  const before = Number(await page.locator('[data-event-id="e0"] ellipse').getAttribute("cx"));
  await pressAction(page, "1-blow-out", 180);
  await page.waitForTimeout(380);
  const after = Number(await page.locator('[data-event-id="e0"] ellipse').getAttribute("cx"));
  expect(after).toBeLessThan(before);
  const cell = page.getByRole("button", { name: /Hole 1, blow, slide out/ });
  await cell.focus();
  await page.keyboard.down("Space");
  await expect(cell).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.up("Space");
});

test("hold duration remains exercise input", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Rhythm training");
  await pressAction(page, "1-blow-out", 700);
  await expect(page.getByText(/Rhythm matched/)).toBeVisible();
});

test("score library and duration notation remain intact", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Play the score/ }).click();
  await expect(page.getByRole("heading", { name: "Choose your song" })).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
  await page.getByRole("button", { name: /Twinkle Twinkle/ }).click();
  expect(await page.locator('[data-duration-notation="quarter"]').count()).toBeGreaterThan(3);
  expect(await page.locator('[data-duration-notation="half"]').count()).toBeGreaterThan(0);
  expect(await page.locator(".target-ribbon").count()).toBeGreaterThan(4);
});

test("guided song uses the selected profile and keeps notation visible", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Learn a song");
  await page.getByRole("button", { name: "Instrument: 10 holes" }).click();
  await expect(page.locator(".hidden-slot")).toHaveCount(0);
  await expect(page.getByTestId("virtual-harmonica")).toHaveAttribute("data-profile", "standard-c-10");
  await expect(page.locator(".action-cell")).toHaveCount(40);
  await expect(page.locator(".action-cell.guided")).toHaveCount(1);
});

test("important harmonica and control typography meets readable minimums", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await chooseAid(page, "Harmonica note names", "On");
  const sizes = await page.evaluate(() => ({
    hole: Number.parseFloat(getComputedStyle(document.querySelector(".hole-number")!).fontSize),
    breath: Number.parseFloat(getComputedStyle(document.querySelector(".breath-label b")!).fontSize),
    sliderWidth: Number.parseFloat(getComputedStyle(document.querySelector(".slide-icon")!).width),
    note: Number.parseFloat(getComputedStyle(document.querySelector(".action-cell strong")!).fontSize),
    setting: Number.parseFloat(getComputedStyle(document.querySelector(".aid-control > span")!).fontSize),
    control: Number.parseFloat(getComputedStyle(document.querySelector(".choice-row button")!).fontSize),
  }));
  expect(sizes.hole).toBeGreaterThanOrEqual(18);
  expect(sizes.breath).toBeGreaterThanOrEqual(13);
  expect(sizes.sliderWidth).toBeGreaterThanOrEqual(24);
  expect(sizes.note).toBeGreaterThanOrEqual(12);
  expect(sizes.setting).toBeGreaterThanOrEqual(14);
  expect(sizes.control).toBeGreaterThanOrEqual(14);
});

test("mobile keeps the two-row model and scrolls instead of shrinking labels", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "phone portrait assertion");
  await page.goto("./");
  await openMode(page, "Find a note");
  const dimensions = await page.locator(".harmonica-scroll").evaluate((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }));
  expect(dimensions.scroll).toBeGreaterThan(dimensions.client);
  await expect(page.locator(".breath-row")).toHaveCount(2);
  const half = await page.locator(".action-cell").first().boundingBox();
  expect(half!.width).toBeGreaterThanOrEqual(40);
  expect(half!.height).toBeGreaterThanOrEqual(44);
});

test("microphone mode never removes the clickable virtual harmonica", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Find a note");
  await page.getByRole("button", { name: "Microphone + touch" }).click();
  await expect(page.getByTestId("virtual-harmonica")).toBeVisible();
  await expect(page.locator(".action-cell")).toHaveCount(48);
});

test("ear flow and diagnostic lab remain reachable", async ({ page }) => {
  await page.goto("./");
  await openMode(page, "Play by ear");
  await page.getByRole("button", { name: "Reveal" }).click();
  await expect(page.locator('[data-event-id^="ear-"]')).toHaveCount(4);
  await page.getByRole("button", { name: "In time" }).click();
  await page.getByRole("button", { name: "Count in + perform" }).click();
  await page.goto("?lab=pitch");
  await page.getByRole("button", { name: "Run synthetic" }).click();
  await expect(page.getByText("C4")).toBeVisible();
});
