import { expect, test } from "@playwright/test";
import midiPkg from "@tonejs/midi";
import { readFileSync } from "node:fs";

const { Midi } = midiPkg;

function buildSyntheticMidiBytes(pitches = [60, 61, 64, 67, 95], durationTicks = 480): Buffer {
  const midi = new Midi();
  midi.header.fromJSON({ ...midi.header.toJSON(), ppq: 480 });
  midi.header.setTempo(104);
  const lead = midi.addTrack();
  lead.name = "Harmonica Lead";
  pitches.forEach((m, idx) => {
    lead.addNote({
      midi: m,
      ticks: idx * durationTicks,
      durationTicks,
      velocity: 0.85,
    });
  });
  const bass = midi.addTrack();
  bass.name = "Accompaniment Bass";
  [48, 55].forEach((m, idx) => {
    bass.addNote({
      midi: m,
      ticks: idx * 960,
      durationTicks: 960,
      velocity: 0.7,
    });
  });
  return Buffer.from(midi.toArray());
}

test("direct nested route /tools/score-import/ returns 200, survives refresh, and navigates back to Trainer", async ({
  page,
}) => {
  const response = await page.goto("tools/score-import/");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Score Import & Correction Workbench" }),
  ).toBeVisible();

  // Direct refresh on nested static route must still return 200 and render workbench
  const reloadResponse = await page.reload();
  expect(reloadResponse?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Score Import & Correction Workbench" }),
  ).toBeVisible();

  // Back to Trainer uses base-safe URL and reaches the trainer main menu
  await page.getByRole("link", { name: /Back to Trainer/ }).click();
  await expect(page.getByRole("heading", { name: "Choose what to practise" })).toBeVisible();

  // Navigate from Song Library to Workbench via canonical trailing-slash URL
  await page.getByRole("button", { name: /Practice a song/ }).click();
  const workbenchLink = page.getByRole("link", { name: "Open Score Import Workbench" });
  await expect(workbenchLink).toHaveAttribute("href", /\/harmonica\/tools\/score-import\/$/);
  await workbenchLink.click();
  await expect(
    page.getByRole("heading", { name: "Score Import & Correction Workbench" }),
  ).toBeVisible();
});

test("visual correction editor workflow: import, candidate selection, drag pitch, duration/timing lane, commands, undo/redo, deterministic export, and Song Practice handoff", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop comprehensive correction workflow");
  await page.goto("tools/score-import/");

  // 1. Import synthetic MIDI
  const fileInput = page.getByLabel("Import score or project file");
  await fileInput.setInputFiles({
    name: "synthetic-lead.mid",
    mimeType: "audio/midi",
    buffer: buildSyntheticMidiBytes([60, 61, 64, 67, 95], 480),
  });

  // 2. Extract stage: inspect tracks & choose candidate
  await expect(page.getByRole("region", { name: "Extract stage" })).toBeVisible();
  await expect(page.getByText("Harmonica Lead").first()).toBeVisible();
  await expect(page.getByLabel("Candidate", { exact: true })).toBeVisible();

  // 3. Create editable arrangement
  await page.getByRole("button", { name: /Edit this candidate/ }).click();
  await expect(page.getByRole("region", { name: "Editable score notation" })).toBeVisible();

  // 4. Select first note (C4) and drag pitch vertically up by 2 diatonic steps -> E4
  const hitboxes = page.locator(".editor-event-hitbox");
  await expect(hitboxes).toHaveCount(5);
  const firstHitbox = hitboxes.first();
  await expect(firstHitbox).toHaveAttribute("data-pitch", "C4");
  const firstEventId = await firstHitbox.getAttribute("data-event-id");
  expect(firstEventId).toBeTruthy();

  const box = await firstHitbox.boundingBox();
  expect(box).toBeTruthy();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;
  // Drag upward by 2 * 4.5px = 9px
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX, centerY - 10, { steps: 4 });
  await page.mouse.up();

  await expect(page.locator(`[data-testid="score-event-${firstEventId}"]`)).toHaveAttribute(
    "data-pitch",
    "E4",
  );
  await expect(page.getByTestId("editor-diff-summary")).toContainText("1 pitch");

  // 5. Change duration via toolbar and via TimingLane resize handle
  await page.getByRole("button", { name: "Duration Half" }).click();
  await expect(page.locator(`[data-testid="timing-block-${firstEventId}"]`)).toHaveAttribute(
    "data-duration-ticks",
    "1920",
  );

  const resizeHandle = page.getByTestId(`timing-resize-${firstEventId}`);
  const rBox = await resizeHandle.boundingBox();
  expect(rBox).toBeTruthy();
  await page.mouse.move(rBox!.x + rBox!.width / 2, rBox!.y + rBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(rBox!.x - 38, rBox!.y + rBox!.height / 2, { steps: 4 });
  await page.mouse.up();

  // 6. Respell accidental on second note (C#4 -> Db4)
  const secondHitbox = hitboxes.nth(1);
  await secondHitbox.click();
  await expect(secondHitbox).toHaveAttribute("data-pitch", "C♯4");
  await page.getByRole("button", { name: "Respell enharmonically" }).click();
  await expect(hitboxes.nth(1)).toHaveAttribute("data-pitch", "D♭4");

  // 7. Insert note, insert rest, delete & leave rest, delete & close gap
  await page.getByRole("button", { name: "+ Note after" }).click();
  await expect(hitboxes).toHaveCount(6);
  await page.getByRole("button", { name: "+ Rest after" }).click();
  await expect(hitboxes).toHaveCount(7);

  await page.getByRole("button", { name: /Delete & leave rest/ }).click();
  await expect(hitboxes).toHaveCount(7);
  await page.getByRole("button", { name: /Delete & close gap/ }).click();
  await expect(hitboxes).toHaveCount(6);

  // 8. Split, tie, untie, merge
  await hitboxes.first().click();
  await page.getByRole("button", { name: /Split/ }).click();
  await expect(hitboxes).toHaveCount(7);
  await hitboxes.first().click();
  await page.getByRole("button", { name: /Tie/ }).click();
  await expect(page.getByRole("button", { name: /Tie/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Tie/ }).click();
  await expect(page.getByRole("button", { name: /Tie/ })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: /Merge/ }).click();
  await expect(hitboxes).toHaveCount(6);

  // 9. Undo / Redo round-trip
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(hitboxes).toHaveCount(7);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(hitboxes).toHaveCount(6);

  // 10. Validate 10-hole / 12-hole range warnings (MIDI 88 is out of 10-hole C range)
  await page.getByRole("group", { name: "Editor harmonica profile" }).getByRole("button", { name: "10-hole C" }).click();
  await expect(page.getByTestId("validation-OUT_OF_HARMONICA_RANGE")).toBeVisible();

  // 11. Keyboard navigation and pitch editing
  await hitboxes.first().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");

  // 12. Sampled harmonica audition from selection and Stop
  await page.getByRole("button", { name: /From selection/ }).click();
  await expect(page.getByRole("button", { name: "■ Stop" })).toBeVisible();
  await page.getByRole("button", { name: "■ Stop" }).click();
  await expect(page.getByRole("button", { name: /Play start/ })).toBeVisible();

  // 13. Export stage: deterministic byte-equality and editor project round-trip
  await page.getByLabel("Arrangement title").fill("Edited Synthetic Lead");
  await page.getByRole("button", { name: /Review & Export/ }).click();
  await expect(page.getByRole("region", { name: "Export stage" })).toBeVisible();

  const downloadBytes = async (buttonLabel: string) => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: buttonLabel }).click(),
    ]);
    const path = await download.path();
    expect(path).toBeTruthy();
    return readFileSync(path!);
  };

  const abc1 = await downloadBytes("Download ABC");
  const abc2 = await downloadBytes("Download ABC");
  expect(abc1.equals(abc2)).toBe(true);
  expect(abc1.toString("utf8")).toContain("T:Edited Synthetic Lead");

  const midi1 = await downloadBytes("Download MIDI");
  const midi2 = await downloadBytes("Download MIDI");
  expect(midi1.equals(midi2)).toBe(true);

  const xml1 = await downloadBytes("Download MusicXML 4.0");
  const xml2 = await downloadBytes("Download MusicXML 4.0");
  expect(xml1.equals(xml2)).toBe(true);

  const projectJsonBuf = await downloadBytes("Save Editor Project (.harmonica-project.json)");

  // Reimport the saved editor project JSON and confirm state is preserved
  await page.getByRole("button", { name: "1. Import" }).click();
  await page.getByLabel("Import score or project file").setInputFiles({
    name: "edited-synthetic-lead.harmonica-project.json",
    mimeType: "application/json",
    buffer: projectJsonBuf,
  });
  await expect(page.getByRole("region", { name: "Editable score notation" })).toBeVisible();
  await expect(page.getByLabel("Arrangement title")).toHaveValue("Edited Synthetic Lead");

  // 14. Open edited result in Song Practice and verify base-safe handoff
  await page.getByRole("button", { name: "Open in Song Practice" }).click();
  await expect(page.getByRole("region", { name: "Song practice controls" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Edited Synthetic Lead/ })).toBeVisible();
});

test("phone editor flow keeps notation readable, opens inspector drawer, and prevents horizontal page overflow", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "phone portrait editor assertion");
  await page.goto("tools/score-import/");

  await page.getByLabel("Import score or project file").setInputFiles({
    name: "phone-test.mid",
    mimeType: "audio/midi",
    buffer: buildSyntheticMidiBytes([60, 62, 64, 65], 480),
  });

  await page.getByRole("button", { name: /Edit this candidate/ }).click();
  await expect(page.getByRole("region", { name: "Editable score notation" })).toBeVisible();

  // No page-wide horizontal overflow
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // Select note and open mobile inspector drawer
  await page.locator(".editor-event-hitbox").first().click();
  const inspectBtn = page.getByRole("button", { name: "Inspect event" });
  await expect(inspectBtn).toBeVisible();
  await inspectBtn.click();
  await expect(page.getByRole("complementary", { name: "Selection inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Step pitch up" }).click();
  await expect(page.locator(".editor-event-hitbox").first()).toHaveAttribute("data-pitch", "D4");
});

test("CanvasIR 2D Workspace, ml-collab-codec <project> artifact diff, Multi-Instrument projections, Song Creation bridge, and Scale Improvisation Studio", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop 2D canvas and multi-instrument studio");
  await page.goto("tools/score-import/");

  // 1. Song Creation: Lyrics + ACE-Step audio -> Honest transcription bridge into score candidate
  await page.getByRole("button", { name: /Create Song \(Lyrics \+ Audio\)/ }).click();
  await expect(page.getByTestId("create-song-panel")).toBeVisible();
  await page.getByRole("button", { name: "2. Generate Audio Takes (ACE-Step)" }).click();
  await expect(page.getByTestId("generated-audio-ready")).toContainText(
    "Audio ready · No editable score yet",
  );
  await page.getByRole("button", { name: /3\. Transcribe Selected Audio/ }).click();
  await expect(page.getByRole("region", { name: "Extract stage" })).toBeVisible();

  // 2. Open Stage 4: Canvas 2D & AI (CanvasIR + ml-collab-codec)
  await page.getByTestId("workbench-stage-canvas-btn").click();
  await expect(page.getByRole("region", { name: "CanvasIR 2D Workspace" })).toBeVisible();
  await expect(page.getByTestId("canvas-ir-board")).toBeVisible();

  // Switch active portable instrument to 17-Tine Kalimba and Pontic Lyra
  const instSelect = page.getByLabel("Canvas active instrument");
  await instSelect.selectOption("kalimba-17c");
  await expect(page.getByText(/Active instrument:/)).toContainText("Kalimba (17-Tine)");
  await instSelect.selectOption("pontic-lyra");
  await expect(page.getByText(/Active instrument:/)).toContainText("Pontic Lyra (3-String)");

  // 3. Inspect <project> tagged artifact drawer and verify schema tags
  await page.getByRole("button", { name: /Inspect <project> Artifact/ }).click();
  const artifactTextarea = page.getByLabel("Tagged project artifact source");
  await expect(artifactTextarea).toBeVisible();
  const sourceText = await artifactTextarea.inputValue();
  expect(sourceText).toContain("<project ");
  expect(sourceText).toContain('active-instrument="pontic-lyra"');
  expect(sourceText).toContain("<arrangement ");
  expect(sourceText).toContain("<board ");
  await page.getByRole("button", { name: "Close" }).click();

  // 4. Propose an Agent skill edit via ml-collab-codec proposeEdit() and apply via rebaseProposal()
  await page.getByRole("button", { name: /Transpose \+2 semitones/ }).click();
  const proposalBanner = page.getByTestId("agent-proposal-banner");
  await expect(proposalBanner).toBeVisible();
  await expect(proposalBanner).toContainText("Transpose +2 semitones");
  await page.getByRole("button", { name: /Apply Proposal \(rebaseProposal\)/ }).click();
  await expect(proposalBanner).toBeHidden();

  // 5. Open Stage 5: Scale & Improvise (Scale Explorer, Constraint Cards, Call & Response)
  await page.getByTestId("workbench-stage-improvise-btn").click();
  await expect(page.getByTestId("improvisation-workspace")).toBeVisible();
  await page.getByTestId("improv-instrument-select").selectOption("pontic-lyra");
  await expect(page.getByTestId("improv-continuous-pitch-bar")).toBeVisible();
  await page.getByTestId("improv-recommended-preset-btn").click();

  // Load Call sequence into phrase buffer and open phrase in Score Editor
  await page.getByTestId("improv-echo-call-btn").click();
  await page.getByTestId("improv-send-phrase-to-editor-btn").click();
  await expect(page.getByRole("region", { name: "Editable score notation" })).toBeVisible();
});

