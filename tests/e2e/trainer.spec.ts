import { expect, test } from "@playwright/test";

test("Mode A accepts a held virtual note", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Find the note" })).toBeVisible();
  const hole = page.locator('[data-hole="1"]');
  await hole.dispatchEvent("pointerdown", { pointerId: 1 });
  await page.waitForTimeout(160);
  await hole.dispatchEvent("pointerup", { pointerId: 1 });
  await expect(page.getByText(/Hit · C4/)).toBeVisible();
});

test("score step, relative ear, and diagnostics remain reachable", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Play the score" }).click();
  await expect(page.getByRole("heading", { name: "Twinkle Twinkle" })).toBeVisible();
  await page.locator('[data-hole="1"]').dispatchEvent("pointerdown", { pointerId: 2 });
  await page.locator('[data-hole="1"]').dispatchEvent("pointerup", { pointerId: 2 });
  await expect(page.getByText(/Hit · C4/)).toBeVisible();
  await page.getByRole("button", { name: "Play by ear" }).click();
  await page.locator('[data-hole="1"]').dispatchEvent("pointerdown", { pointerId: 3 });
  await page.locator('[data-hole="1"]').dispatchEvent("pointerup", { pointerId: 3 });
  await expect(page.getByText(/Anchor locked/)).toBeVisible();
  await page.goto("?lab=pitch");
  await page.getByRole("button", { name: "Run synthetic" }).click();
  await expect(page.getByText("C4")).toBeVisible();
  await page.screenshot({ path: `docs/screenshots/pitch-lab-${test.info().project.name}.png`, fullPage: true });
});

test("mobile controls support simultaneous slide and hole pointers", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "touch scenario");
  await page.goto("./");
  const slide = page.getByRole("button", { name: /SLIDE/ }), hole = page.locator('[data-hole="1"]');
  await slide.dispatchEvent("pointerdown", { pointerId: 7, pointerType: "touch" });
  await hole.dispatchEvent("pointerdown", { pointerId: 8, pointerType: "touch" });
  await hole.dispatchEvent("pointerup", { pointerId: 8, pointerType: "touch" });
  await slide.dispatchEvent("pointerup", { pointerId: 7, pointerType: "touch" });
  await expect(page.locator(".harmonica-body")).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/mobile-virtual.png", fullPage: true });
});
