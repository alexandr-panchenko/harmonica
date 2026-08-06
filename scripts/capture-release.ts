import {chromium,devices,type BrowserContext,type Page} from "@playwright/test";
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";
const base=process.env.RELEASE_URL??"http://127.0.0.1:4173/harmonica/",output=resolve(import.meta.dirname,"../docs/screenshots/release-candidate");await mkdir(output,{recursive:true});const browser=await chromium.launch({headless:true});
async function open(mobile=false){const context=await browser.newContext(mobile?{...devices["Pixel 7"]}:{viewport:{width:1440,height:1000},deviceScaleFactor:1});const page=await context.newPage();return{context,page}}
async function shot(name:string,setup?:(page:Page)=>Promise<void>,mobile=false,locator?:string){const{context,page}=await open(mobile);await page.goto(base);if(setup)await setup(page);await page.waitForTimeout(400);if(locator)await page.locator(locator).screenshot({path:resolve(output,name)});else await page.screenshot({path:resolve(output,name),fullPage:true});await context.close()}
const mode=(label:string,song?:string)=>async(page:Page)=>{await page.getByRole("button",{name:new RegExp(label)}).click();if(song)await page.getByRole("button",{name:new RegExp(song)}).click()};
await shot("main-menu-desktop.png");
await shot("find-timeline-desktop.png",mode("Find a note"));
await shot("score-timeline-desktop.png",mode("Play the score","Twinkle Twinkle"));
await shot("score-engraved-desktop.png",async page=>{await mode("Play the score","Twinkle Twinkle")(page);await page.getByRole("button",{name:"Score",exact:true}).click()});
await shot("ear-hidden-desktop.png",mode("Play by ear"));
await shot("rhythm-timeline-desktop.png",mode("Rhythm training"));
await shot("learn-compact-12-desktop.png",mode("Learn a song","Twinkle Twinkle"));
await shot("learn-compact-10-desktop.png",async page=>{await mode("Learn a song","Twinkle Twinkle")(page);await page.getByRole("button",{name:"Instrument: 10 holes"}).click()});
await shot("ribbon-close-up.png",mode("Learn a song","Twinkle Twinkle"),false,".music-stage");
await shot("learn-compact-mobile.png",mode("Learn a song","Twinkle Twinkle"),true);
await shot("touch-mobile.png",async page=>{await mode("Learn a song","Twinkle Twinkle")(page);await page.getByRole("button",{name:"Touch · alternative"}).click()},true);
await browser.close();console.log(`Captured release candidate screenshots in ${output}`);
