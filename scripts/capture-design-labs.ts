import { chromium, devices, type BrowserContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = process.env.LAB_URL ?? "http://127.0.0.1:4173/harmonica/";
const output = resolve(import.meta.dirname, "../docs/screenshots/labs");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function contextPage(mobile = false): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(mobile ? { ...devices["Pixel 7"] } : { viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  return { context, page: await context.newPage() };
}

async function shot(name: string, route: string, setup?: (page: Page) => Promise<void>, mobile = false, locator?: string) {
  const { context, page } = await contextPage(mobile);
  await page.goto(new URL(route, baseUrl).toString());
  await page.getByTestId(route.includes("staff") ? "staff-design-lab" : "harmonica-design-lab").waitFor();
  if (setup) await setup(page);
  await page.waitForTimeout(250);
  if (locator) await page.locator(locator).screenshot({ path: resolve(output, name) });
  else await page.screenshot({ path: resolve(output, name), fullPage: true });
  await context.close();
}

await shot("staff-timeline-game-desktop.png", "lab/staff-design/");
await shot("staff-timeline-tie-desktop.png", "lab/staff-design/", async page=>{await page.getByLabel("Playback position").fill("0.29")});
await shot("staff-ribbon-close-up.png", "lab/staff-design/", undefined, false, ".staff-comparison-stage");
await shot("staff-engraved-desktop.png", "lab/staff-design/", async (page) => {
  await page.getByLabel("Render mode").selectOption("standard-game");
  await page.getByLabel("Fixture").selectOption("compound-meter");
});
await shot("staff-timeline-game-mobile.png", "lab/staff-design/", undefined, true);
await shot("staff-engraved-mobile.png", "lab/staff-design/", async page=>{await page.getByLabel("Render mode").selectOption("standard-game");await page.getByLabel("Fixture").selectOption("compound-meter")}, true);

await shot("harmonica-12-guided-desktop.png", "lab/harmonica-design/");
await shot("harmonica-10-ambiguous-desktop.png", "lab/harmonica-design/", async (page) => {
  await page.getByRole("button", { name: "10 holes" }).click();
  await page.getByLabel("Instrument state").selectOption("mic-ambiguous");
});
await shot("harmonica-12-guided-mobile.png", "lab/harmonica-design/", undefined, true);
await shot("harmonica-12-slider-mobile.png", "lab/harmonica-design/", async (page) => {
  await page.getByLabel("Instrument state").selectOption("pressed");
  await page.locator(".instrument-scroll").evaluate((element) => { element.scrollLeft = element.scrollWidth; });
}, true);

await browser.close();
console.log(`Captured design lab screenshots in ${output}`);
