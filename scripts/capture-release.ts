import { chromium, type Page } from "@playwright/test";

const baseURL = "http://127.0.0.1:4174/harmonica/";
const pass = process.argv[2] ?? "pass1";

async function openMode(page: Page, name: string) {
  await page.getByRole("button", { name: new RegExp(name) }).click();
}

async function enableAid(page: Page, name: string) {
  await page.getByRole("group", { name }).getByRole("button", { name: "On" }).click();
}

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
await desktop.goto(baseURL);
await desktop.screenshot({ path: `docs/screenshots/${pass}-menu-desktop.png`, fullPage: true });
await openMode(desktop, "Find a note");
await desktop.screenshot({ path: `docs/screenshots/${pass}-12-labels-off-desktop.png`, fullPage: true });
await enableAid(desktop, "Staff note names");
await enableAid(desktop, "Harmonica note names");
await desktop.screenshot({ path: `docs/screenshots/${pass}-12-labels-on-desktop.png`, fullPage: true });
await desktop.screenshot({ path: `docs/screenshots/${pass}-learning-aids-desktop.png`, fullPage: true });

await desktop.getByRole("button", { name: "Instrument: 10 holes" }).click();
await desktop.screenshot({ path: `docs/screenshots/${pass}-10-labels-on-desktop.png`, fullPage: true });
await desktop.getByRole("button", { name: "Instrument: 12 holes" }).click();
await desktop.locator('[data-midi="72"]').evaluateAll((nodes) => {
  for (const node of nodes) {
    node.classList.add("detected");
    const marker = document.createElement("span");
    marker.className = "action-state";
    marker.textContent = "◉";
    node.append(marker);
  }
});
await desktop.screenshot({ path: `docs/screenshots/${pass}-microphone-matching-desktop.png`, fullPage: true });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await mobile.goto(baseURL);
await openMode(mobile, "Find a note");
await enableAid(mobile, "Harmonica note names");
await mobile.screenshot({ path: `docs/screenshots/${pass}-find-mobile.png`, fullPage: true });
await browser.close();
