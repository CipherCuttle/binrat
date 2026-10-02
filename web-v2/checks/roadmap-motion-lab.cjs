const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4174").replace(/\/$/, "");

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(base + "/roadmap-motion-lab", { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "FOLLOW THE RECEIPTS." }).waitFor();
    assert.equal(await page.locator("[data-motion-lab]").count(), 0, "legacy continuous Motion Lab must not remain public");
    assert.equal(await page.locator("[data-stage]").count(), 6);
    assert.equal(await page.locator("[data-scene-art=canonical-raster]").count(), 6);
    process.stdout.write("BINRAT ROADMAP V2 ROUTE TRANSITION: PASS\n");
  } finally { await context.close(); await browser.close(); }
})().catch((error) => { process.stderr.write(`ROADMAP V2 ROUTE FAILED: ${error?.stack || error}\n`); process.exitCode = 1; });
