import { chromium, devices, type BrowserContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.RELEASE_URL ?? "http://127.0.0.1:4317/harmonica/";
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
const library = async (page: Page) => page.getByRole("button", { name: /Practice a song/ }).click();
const openSongMode = async (page: Page) => { await library(page); await page.getByRole("button", { name: /Twinkle Twinkle/ }).click(); };
const seekSong=async(page:Page,beat:number)=>page.getByLabel("Practice position").evaluate((input:HTMLInputElement,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!;setter.call(input,String(value));input.dispatchEvent(new Event("input",{bubbles:true}))},beat);
const policyState=async(page:Page,policy:"pause"|"restart-note"|"restart-measure")=>{await openSongMode(page);await page.getByLabel("Mistake policy").selectOption(policy);await page.getByRole("button",{name:"Touch · alternative"}).click();const target=page.locator("[data-action-id].guided").first();await target.focus();await page.keyboard.down("Space");await page.waitForTimeout(240);await page.keyboard.up("Space");await page.waitForTimeout(100)};
const correctState=async(page:Page)=>{await openSongMode(page);await page.getByRole("button",{name:"Touch · alternative"}).click();const target=page.locator("[data-action-id].guided").first();await target.focus();await page.keyboard.down("Space");await page.waitForTimeout(650);await page.keyboard.up("Space");await page.waitForTimeout(120)};
const wrongState=async(page:Page)=>{await openSongMode(page);await page.getByRole("button",{name:"Touch · alternative"}).click();const wrong=page.locator("[data-action-id]:not(.guided)").first();await wrong.focus();await page.keyboard.down("Space");await page.waitForTimeout(140)};

await shot("main-menu-light-desktop.png", "light");
await shot("main-menu-dark-desktop.png", "dark");
await shot("main-menu-light-phone.png", "light", undefined, true);
await shot("main-menu-dark-phone.png", "dark", undefined, true);
await shot("training-find-light-desktop.png", "light", find);
await shot("training-find-dark-desktop.png", "dark", find);
await shot("find-note-light-phone.png", "light", find, true);
await shot("song-wait-light-desktop.png", "light", openSongMode);
await shot("song-wait-dark-desktop.png", "dark", openSongMode);
await shot("song-wait-light-phone.png", "light", openSongMode, true);
await shot("song-wait-dark-phone.png", "dark", openSongMode, true);
await shot("song-in-time-light-desktop.png", "light",async page=>{await openSongMode(page);await page.getByRole("button",{name:"In time"}).click()});
await shot("song-score-light-desktop.png", "light",async page=>{await openSongMode(page);await page.getByRole("button",{name:"Score",exact:true}).click()});
await shot("song-playhead-middle-light-desktop.png","light",async page=>{await openSongMode(page);await seekSong(page,4)});
await shot("song-policy-keep-light-desktop.png","light",page=>policyState(page,"pause"));
await shot("song-policy-restart-note-light-desktop.png","light",page=>policyState(page,"restart-note"));
await shot("song-policy-restart-measure-light-desktop.png","light",page=>policyState(page,"restart-measure"));
await shot("song-correct-light-desktop.png","light",correctState);
await shot("song-wrong-light-desktop.png","light",wrongState);
await shot("play-by-ear-light-desktop.png", "light", page=>page.getByRole("button",{name:/Play by ear/}).click());
await shot("play-by-ear-dark-phone.png", "dark", page=>page.getByRole("button",{name:/Play by ear/}).click(), true);
await shot("rhythm-training-light-desktop.png", "light", page=>page.getByRole("button",{name:/Rhythm training/}).click());
await shot("rhythm-training-dark-phone.png", "dark", page=>page.getByRole("button",{name:/Rhythm training/}).click(), true);
await shot("compact-harmonica-12-slider-light-desktop.png", "light", async page=>{await find(page);await page.getByRole("group",{name:"Harmonica note names"}).getByRole("button",{name:"On",exact:true}).click()});
await shot("compact-harmonica-10-light-desktop.png", "light", async page=>{await find(page);await page.getByRole("button",{name:"Instrument: 10 holes"}).click()});
await shot("touch-harmonica-light-desktop.png", "light", async page=>{await find(page);await page.getByRole("button",{name:"Touch · alternative"}).click()});
await shot("song-library-light-desktop.png", "light", library);
await shot("settings-theme-light-desktop.png", "light", async page => page.getByRole("button", { name: "Settings" }).click());

await browser.close();
console.log(`Captured light/dark desktop and phone review screenshots in ${output}`);
