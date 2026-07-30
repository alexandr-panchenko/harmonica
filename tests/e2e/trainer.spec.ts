import { expect, test, type Page } from "@playwright/test";

async function pressAction(page: Page, id: string, pointerId: number, holdMs = 80) {
  const cell = page.locator(`[data-action-id="${id}"]`);
  pointerId = 1;
  await cell.dispatchEvent("pointerdown", { pointerId, pointerType: "mouse", buttons: 1 });
  await page.waitForTimeout(holdMs);
  await cell.dispatchEvent("pointerup", { pointerId, pointerType: "mouse", buttons: 0 });
}

test("find mode hides its answer and exposes all direct physical actions", async ({ page }, testInfo) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Find the note" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("C4");
  await expect(page.locator(".action-cell")).toHaveCount(48);
  await expect(page.locator(".instrument-controls,.slide-control")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hole 1, blow, slide out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hole 1, draw, slide in" })).toBeVisible();
  const bankCount = await page.locator(".action-bank").count(); expect(bankCount).toBe(2);
  await page.screenshot({ path: `docs/screenshots/polish-find-${testInfo.project.name}.png`, fullPage: true });
});

test("one pointer action identifies blow/out and held duration", async ({ page }) => {
  await page.goto("./");
  await pressAction(page,"1-blow-out",1,340);
  await expect(page.getByText(/Hit · C4/)).toBeVisible();
  const duration=Number(await page.locator('[data-performance-midi="60"]').last().getAttribute("data-duration-ms"));
  expect(duration).toBeGreaterThanOrEqual(300);
});

test("one pointer action identifies draw/slide-in without a state toggle", async ({ page }) => {
  await page.goto("./");
  await pressAction(page,"1-draw-in",2);
  await expect(page.getByText(/E♭4 · play lower/)).toBeVisible();
  await expect(page.locator('[data-performance-midi="63"].incorrect')).toBeVisible();
});

test("direct cells support keyboard note-on and note-off", async ({ page }) => {
  await page.goto("./"); const cell=page.getByRole("button",{name:"Hole 1, blow, slide out"}); await cell.focus(); await page.keyboard.down("Space"); await page.waitForTimeout(140); await expect(cell).toHaveAttribute("aria-pressed","true"); await page.keyboard.up("Space"); await expect(page.getByText(/Hit · C4/)).toBeVisible();
});

test("find timeline retains five accepted targets", async ({ page }) => {
  await page.goto("./");
  for (const [index,id] of ["1-blow-out","1-draw-out","2-blow-out","2-draw-out","3-blow-out"].entries()) { await pressAction(page,id,10+index); await page.waitForTimeout(380); await expect(page.locator(`[data-event-id="find-${index}"]`)).toBeVisible(); }
  await expect(page.locator('[data-event-id^="find-"]')).toHaveCount(5);
  await expect(page.locator(".completed-event .history-mark")).toHaveCount(4);
  await page.screenshot({ path: "docs/screenshots/polish-find-history-desktop.png", fullPage: true });
});

test("score step advances with beat-aware motion and modes/labs remain reachable", async ({ page }, testInfo) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Play the score" }).click();
  await expect(page.getByRole("heading", { name: "Twinkle Twinkle" })).toBeVisible();
  const before=Number(await page.locator('[data-event-id="e0"] ellipse').getAttribute("cx"));
  await pressAction(page,"1-blow-out",21); await page.waitForTimeout(380);
  const after=Number(await page.locator('[data-event-id="e0"] ellipse').getAttribute("cx"));
  expect(before).toBe(300); expect(after).toBeLessThan(before);
  await page.screenshot({ path: `docs/screenshots/polish-score-step-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Play by ear" }).click();
  await pressAction(page,"1-blow-out",22);
  await expect(page.getByText(/Anchor locked/)).toBeVisible();
  await page.goto("?lab=pitch"); await page.getByRole("button", { name: "Run synthetic" }).click(); await expect(page.getByText("C4")).toBeVisible();
});

test("flow keeps a fixed playhead while target positions move by beat", async ({ page }, testInfo) => {
  await page.goto("./"); await page.getByRole("button", { name: "Play the score" }).click(); await page.getByRole("button", { name: "Flow" }).click(); await page.getByRole("button", { name: "Count in + perform" }).click();
  const playhead=await page.locator(".playhead").getAttribute("x1"); expect(playhead).toBe("300");
  const before=Number(await page.locator('[data-event-id="e0"] ellipse').getAttribute("cx")); await page.screenshot({path:`docs/screenshots/polish-flow-before-${testInfo.project.name}.png`,fullPage:true}); await page.waitForTimeout(2900); const after=Number(await page.locator('[data-event-id="e0"] ellipse').getAttribute("cx")); expect(after).toBeLessThan(before); await page.screenshot({path:`docs/screenshots/polish-flow-after-${testInfo.project.name}.png`,fullPage:true});
});

test("ear rhythm stage keeps the discovered phrase as its exercise source", async ({ page }) => {
  await page.goto("./"); await page.getByRole("button",{name:"Play the score"}).click(); await page.locator(".score-source select").selectOption("ode"); await page.getByRole("button",{name:"Play by ear"}).click(); await page.getByRole("button",{name:"Reveal"}).click(); await expect(page.locator('[data-event-id^="ear-"]')).toHaveCount(4); await page.getByRole("button",{name:"Flow"}).click(); await page.getByRole("button",{name:"Count in + perform"}).click(); await expect(page.locator('[data-event-id^="ear-"]')).toHaveCount(4);
});

test("mobile uses two stacked six-hole banks with accessible touch targets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "phone layout"); await page.goto("./");
  const boxes=await page.locator(".action-bank").evaluateAll((nodes)=>nodes.map((node)=>node.getBoundingClientRect())); expect(boxes[1]!.top).toBeGreaterThan(boxes[0]!.bottom);
  const cell=await page.locator(".action-cell").first().boundingBox(); expect(cell!.height).toBeGreaterThanOrEqual(44);
});
