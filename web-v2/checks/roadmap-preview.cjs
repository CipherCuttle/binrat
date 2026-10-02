const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4174").replace(/\/$/, "");
const output = path.resolve(__dirname, "../browser-artifacts/roadmap-v2");
fs.mkdirSync(output, { recursive: true });
const sizes = [[390, 844], [390, 568], [1024, 768], [1440, 900]];
const stages = ["sniff", "remember", "investigate", "watch", "connect", "autonomous_rat"];

async function noOverflow(page, width, label) {
  const size = await page.evaluate(() => ({ html: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(size.html <= width + 1 && size.body <= width + 1, `${label} overflow: ${JSON.stringify(size)}`);
}
async function center(page, id) {
  await page.locator(`[data-stage="${id}"]`).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2, behavior: "auto" });
  });
  await page.locator(`[data-stage="${id}"][data-active="true"]`).waitFor();
  await page.waitForTimeout(700);
}
async function testViewport(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(String(error)));
  try {
    await page.goto(base + "/roadmap", { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "FOLLOW THE RECEIPTS." }).waitFor();
    assert.equal(await page.locator("[data-stage]").count(), 6);
    for (const id of stages) {
      await center(page, id);
      assert.equal(await page.locator('[data-stage][data-active="true"]').count(), 1, `one active stage at ${id}`);
      assert.equal(await page.locator(`[data-stage="${id}"] [data-scene-art="canonical-raster"] img`).count(), 1);
      await noOverflow(page, width, id);
    }
    const perf = await page.evaluate(() => ({
      permanentAnimations: document.getAnimations().filter((item) => item.playState === "running").length,
      activeLayerCount: document.querySelector('[data-stage][data-active="true"] [data-scene-art]')?.childElementCount,
      ratRequests: performance.getEntriesByType("resource").filter((entry) => entry.name.includes("rat-zero")).length,
    }));
    assert.equal(perf.permanentAnimations, 0, "no permanent animation loop");
    assert.ok(perf.activeLayerCount <= 6, `active scene layer budget exceeded: ${perf.activeLayerCount}`);
    assert.ok(perf.ratRequests <= 1, `Rat Zero must be cached/shared: ${perf.ratRequests}`);
    assert.deepEqual(errors, [], `console errors: ${errors.join(" | ")}`);
    await page.screenshot({ path: path.join(output, `roadmap-${width}x${height}.png`), fullPage: false, animations: "disabled" });
    process.stdout.write(`PASS ROADMAP V2 ${width}x${height}\n`);
  } finally { await context.close(); }
}
async function reduced(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(base + "/roadmap", { waitUntil: "networkidle" });
    await center(page, "autonomous_rat");
    const state = await page.evaluate(() => ({
      focus: getComputedStyle(document.querySelector(".roadmap-spine__focus")).display,
      activeEvidence: getComputedStyle(document.querySelector('[data-stage="autonomous_rat"] .roadmap-scene__evidence')).opacity,
      activeScene: getComputedStyle(document.querySelector('[data-stage="autonomous_rat"] .roadmap-scene')).opacity,
      animations: document.getAnimations().filter((item) => item.playState === "running").length,
    }));
    assert.equal(state.focus, "none");
    assert.equal(state.activeEvidence, "1");
    assert.equal(state.activeScene, "1");
    assert.equal(state.animations, 0);
    await noOverflow(page, 390, "reduced motion");
    await page.screenshot({ path: path.join(output, "roadmap-reduced-390x844.png"), fullPage: false, animations: "disabled" });
    process.stdout.write("PASS ROADMAP V2 REDUCED MOTION\n");
  } finally { await context.close(); }
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try { for (const [width, height] of sizes) await testViewport(browser, width, height); await reduced(browser); }
  finally { await browser.close(); }
})().catch((error) => { process.stderr.write(`ROADMAP V2 PREVIEW FAILED: ${error?.stack || error}\n`); process.exitCode = 1; });
