import { expect, test, type Page } from "@playwright/test";

async function pressAction(page: Page, id: string, holdMs = 100) {
  const cell = page.locator(`[data-action-id="${id}"]`);
  await cell.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "mouse", buttons: 1 });
  await page.waitForTimeout(holdMs);
  await cell.dispatchEvent("pointerup", { pointerId: 1, pointerType: "mouse", buttons: 0 });
}

async function openMode(page: Page, name: string, song = "Twinkle Twinkle") {
  await page.getByRole("button", { name: new RegExp(name) }).click();
  if (name === "Play the score" || name === "Learn a song") await page.getByRole("button", { name: new RegExp(song) }).click();
}

test("main menu exposes five learning intents", async ({ page }, testInfo) => {
  await page.goto("./");
  for (const name of ["Find a note","Play the score","Play by ear","Rhythm training","Learn a song"]) await expect(page.getByRole("button",{name:new RegExp(name)})).toBeVisible();
  if(testInfo.project.name==="desktop") await page.screenshot({path:"docs/screenshots/expansion-main-menu-desktop.png",fullPage:true});
  if(testInfo.project.name==="mobile") await page.screenshot({path:"docs/screenshots/expansion-mobile-portrait.png",fullPage:true});
});

test("find trainer has explicit randomized constraints and a persistent 12-hole instrument", async ({ page }, testInfo) => {
  await page.goto("./"); await openMode(page,"Find a note");
  await expect(page.getByRole("heading",{name:"Find the note"})).toBeVisible();
  await expect(page.getByLabel("Find note range")).toHaveValue("beginner");
  await page.getByLabel("Find note range").selectOption("full"); await page.getByLabel("Accidentals").selectOption("chromatic");
  await expect(page.getByText(/possible pitches · anti-repeat shuffle/)).toBeVisible();
  await expect(page.locator(".action-cell")).toHaveCount(48);
  await expect(page.locator('[data-testid="virtual-harmonica"][data-profile="standard-c-12"]')).toBeVisible();
  if(testInfo.project.name==="desktop") await page.screenshot({path:"docs/screenshots/expansion-find-note-desktop.png",fullPage:true});
});

test("settings independently control staff and harmonica labels and solfege", async ({ page }) => {
  await page.goto("./"); await openMode(page,"Find a note");
  await page.getByRole("button",{name:"Settings"}).click();
  await page.getByLabel("Show labels on staff").check();
  await page.getByLabel("Show labels on harmonica").uncheck();
  await page.getByLabel("Note naming").selectOption("solfege");
  await page.getByRole("button",{name:"Close settings"}).click();
  await expect(page.locator(".note-label")).toHaveCount(1);
  await expect(page.locator(".note-label")).toContainText(/Do|Re|Mi|Fa|Sol|La|Si/);
  await expect(page.locator(".action-cell strong")).toHaveCount(0);
});

test("10-hole profile changes the action model and full exercise range", async ({ page }, testInfo) => {
  await page.goto("./"); await page.getByRole("button",{name:"Settings"}).click();
  await page.getByLabel("Instrument").selectOption("standard-c-10"); await page.getByRole("button",{name:"Close settings"}).click();
  await openMode(page,"Find a note"); await page.getByLabel("Find note range").selectOption("full");
  await expect(page.locator(".action-cell")).toHaveCount(40);
  await expect(page.locator('[data-testid="virtual-harmonica"][data-profile="standard-c-10"]')).toBeVisible();
  await expect(page.getByText("10 HOLES · 40 PLAYABLE POSITIONS")).toHaveCount(1);
  if(testInfo.project.name==="desktop") await page.screenshot({path:"docs/screenshots/expansion-harmonica-10-hole.png",fullPage:true});
});

test("score library replaces the dropdown and duration notation matches ABC values", async ({ page }) => {
  await page.goto("./"); await page.getByRole("button",{name:/Play the score/}).click();
  await expect(page.getByRole("heading",{name:"Choose your song"})).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
  await page.getByRole("button",{name:/Twinkle Twinkle/}).click();
  expect(await page.locator('[data-duration-notation="quarter"]').count()).toBeGreaterThan(3);
  expect(await page.locator('[data-duration-notation="half"]').count()).toBeGreaterThan(0);
  expect(await page.locator(".target-ribbon").count()).toBeGreaterThan(4);
  await page.getByRole("button",{name:/Twinkle Twinkle.*Change song/}).click();
  await page.getByRole("button",{name:/Happy Birthday/}).click();
  await expect(page.locator('[data-duration-notation="eighth"]')).toHaveCount(1);
  expect(await page.locator(".note-dot").count()).toBeGreaterThan(0);
});

test("score step interaction and keyboard hold still work", async ({ page }) => {
  await page.goto("./"); await openMode(page,"Play the score");
  const before=Number(await page.locator('[data-event-id="e0"] ellipse').getAttribute("cx"));
  await pressAction(page,"1-blow-out",180); await page.waitForTimeout(380);
  const after=Number(await page.locator('[data-event-id="e0"] ellipse').getAttribute("cx")); expect(after).toBeLessThan(before);
  const cell=page.getByRole("button",{name:/Hole 1, blow, slide out/}); await cell.focus(); await page.keyboard.down("Space"); await expect(cell).toHaveAttribute("aria-pressed","true"); await page.keyboard.up("Space");
});

test("rhythm mode renders rests and scores duration separately", async ({ page }, testInfo) => {
  await page.goto("./"); await openMode(page,"Rhythm training");
  await expect(page.getByRole("heading",{name:"Rhythm training"})).toBeVisible();
  await expect(page.locator('[data-duration-notation="eighth"]')).toHaveCount(3);
  await expect(page.locator('[data-duration-notation="quarter-rest"]')).toHaveCount(2);
  await pressAction(page,"1-blow-out",700); await expect(page.getByText(/Rhythm matched/)).toBeVisible();
  if(testInfo.project.name==="desktop") await page.screenshot({path:"docs/screenshots/expansion-rhythm-mode.png",fullPage:true});
});

test("guided song keeps notation visible and lights all matching positions", async ({ page }, testInfo) => {
  await page.goto("./"); await openMode(page,"Learn a song");
  await expect(page.getByRole("heading",{name:"Learn a song"})).toBeVisible();
  await expect(page.locator(".hidden-slot")).toHaveCount(0);
  await expect(page.locator(".action-cell.guided")).toHaveCount(1);
  await pressAction(page,"1-blow-out",180); await page.waitForTimeout(380);
  await expect(page.locator(".action-cell.guided")).toHaveCount(1);
  if(testInfo.project.name==="desktop") await page.screenshot({path:"docs/screenshots/expansion-guided-song.png",fullPage:true});
});

test("12-hole harmonica is readable and mobile remains horizontally navigable", async ({ page }, testInfo) => {
  await page.goto("./"); await openMode(page,"Find a note");
  const number=await page.locator(".cover-holes span").first().evaluate((node)=>getComputedStyle(node).fontSize); expect(Number.parseFloat(number)).toBeGreaterThanOrEqual(20);
  const cell=await page.locator(".action-cell").first().boundingBox(); expect(cell!.height).toBeGreaterThanOrEqual(48);
  if(testInfo.project.name==="desktop") await page.screenshot({path:"docs/screenshots/expansion-harmonica-12-hole.png",fullPage:true});
  if(testInfo.project.name==="mobile") { const dimensions=await page.locator(".harmonica-scroll").evaluate((node)=>({client:node.clientWidth,scroll:node.scrollWidth})); expect(dimensions.scroll).toBeGreaterThan(dimensions.client); await page.screenshot({path:"docs/screenshots/expansion-find-mobile-portrait.png",fullPage:true}); }
});

test("microphone selection never removes the clickable virtual harmonica", async ({ page }) => {
  await page.goto("./"); await openMode(page,"Find a note");
  await page.getByRole("button",{name:"Microphone + touch"}).click();
  await expect(page.getByTestId("virtual-harmonica")).toBeVisible();
  await expect(page.locator(".action-cell")).toHaveCount(48);
});

test("ear flow and diagnostic lab remain reachable", async ({ page }) => {
  await page.goto("./"); await openMode(page,"Play by ear"); await page.getByRole("button",{name:"Reveal"}).click();
  await expect(page.locator('[data-event-id^="ear-"]')).toHaveCount(4); await page.getByRole("button",{name:"In time"}).click(); await page.getByRole("button",{name:"Count in + perform"}).click();
  await page.goto("?lab=pitch"); await page.getByRole("button",{name:"Run synthetic"}).click(); await expect(page.getByText("C4")).toBeVisible();
});
