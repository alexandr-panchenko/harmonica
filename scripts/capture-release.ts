import { chromium, devices, type BrowserContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.RELEASE_URL ?? "http://127.0.0.1:4173/harmonica/";
const output = resolve(import.meta.dirname, "../docs/screenshots/release-candidate");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function open(theme: "light" | "dark", mobile = false): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(mobile ? { ...devices["Pixel 7"] } : { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript(value => localStorage.setItem("harmonica-theme", value), theme);
  return { context, page };
}

async function shot(name: string, theme: "light" | "dark", setup?: (page: Page) => Promise<void>, mobile = false) {
  const { context, page } = await open(theme, mobile);
  await page.goto(base);
  if (setup) await setup(page);
  await page.waitForTimeout(450);
  await page.screenshot({ path: resolve(output, name), fullPage: true });
  await context.close();
}

const find = async (page: Page) => page.getByRole("button", { name: /Find a note/ }).click();
const library = async (page: Page) => page.getByRole("button", { name: /Play the score/ }).click();
const openSongMode = async (page: Page, mode: "Play the score"|"Learn a song") => { await page.getByRole("button", { name: new RegExp(mode) }).click(); await page.getByRole("button", { name: /Twinkle Twinkle/ }).click(); };

await shot("main-menu-light-desktop.png", "light");
await shot("main-menu-dark-desktop.png", "dark");
await shot("main-menu-light-phone.png", "light", undefined, true);
await shot("main-menu-dark-phone.png", "dark", undefined, true);
await shot("training-find-light-desktop.png", "light", find);
await shot("training-find-dark-desktop.png", "dark", find);
await shot("find-note-light-phone.png", "light", find, true);
await shot("play-score-light-desktop.png", "light", page=>openSongMode(page,"Play the score"));
await shot("learn-song-light-desktop.png", "light", page=>openSongMode(page,"Learn a song"));
await shot("play-by-ear-light-desktop.png", "light", page=>page.getByRole("button",{name:/Play by ear/}).click());
await shot("rhythm-training-light-desktop.png", "light", page=>page.getByRole("button",{name:/Rhythm training/}).click());
await shot("compact-harmonica-12-slider-light-desktop.png", "light", async page=>{await find(page);await page.getByRole("group",{name:"Harmonica note names"}).getByRole("button",{name:"On",exact:true}).click()});
await shot("compact-harmonica-10-light-desktop.png", "light", async page=>{await find(page);await page.getByRole("button",{name:"Instrument: 10 holes"}).click()});
await shot("touch-harmonica-light-desktop.png", "light", async page=>{await find(page);await page.getByRole("button",{name:"Touch · alternative"}).click()});
await shot("song-library-light-desktop.png", "light", library);
await shot("settings-theme-light-desktop.png", "light", async page => page.getByRole("button", { name: "Settings" }).click());

await browser.close();
console.log(`Captured light/dark desktop and phone review screenshots in ${output}`);
