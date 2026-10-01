const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4174").replace(/\/$/, "");
const output = path.resolve(__dirname, "../browser-artifacts/roadmap-motion-lab");
fs.mkdirSync(output, { recursive: true });

async function scrollToProgress(page, progress, settleMs = 900) {
  await page.locator("[data-motion-lab] .motion-lab__runway").evaluate((node, value) => {
    const top = window.scrollY + node.getBoundingClientRect().top;
    const range = node.scrollHeight - window.innerHeight;
    window.scrollTo({ top: top + range * value, behavior: "auto" });
  }, progress);
  await page.waitForTimeout(settleMs);
}

async function capture(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto(base + "/roadmap-motion-lab", { waitUntil: "domcontentloaded" });
    await page.locator("[data-motion-lab]").waitFor();
    assert.equal(await page.locator("[data-motion-milestone]").count(), 6, "motion lab exposes six milestones");
    assert.deepEqual(
      await page.locator("[data-motion-milestone] .motion-lab__label strong").allTextContents(),
      ["SNIFF", "REMEMBER", "WATCH", "HUNT", "ORGANIZE", "AUTONOMOUS RAT"],
      "motion lab chapter order matches canonical roadmap",
    );
    assert.equal(await page.locator("[data-motion-lab] img, [data-motion-lab] svg, [data-motion-lab] canvas").count(), 0,
      "motion lab must contain no scene/image/vector/canvas art");

    await scrollToProgress(page, 0);
    assert.equal(await page.locator("[data-motion-lab]").getAttribute("data-active-index"), "0");
    assert.equal(
      await page.locator('[data-motion-milestone="0"] [data-roadmap-feature="pons_live_intelligence"] [data-roadmap-status]').textContent(),
      "BUILDING",
      "current Pons intelligence status projects from canonical manifest",
    );
    assert.equal(
      await page.locator('[data-motion-milestone="0"] [data-roadmap-feature="rat_radar"] [data-roadmap-status]').textContent(),
      "BUILDING",
      "Rat Radar current-rail replacement stays BUILDING",
    );
    assert.equal(
      await page.locator('[data-motion-milestone="1"] [data-roadmap-feature="replay_lab"] [data-roadmap-status]').textContent(),
      "LIVE",
      "Replay Lab public beta projects as LIVE",
    );
    await page.screenshot({ path: path.join(output, "motion-start-" + width + ".png"), animations: "disabled" });

    await scrollToProgress(page, 0.4);
    assert.equal(await page.locator("[data-motion-lab]").getAttribute("data-active-index"), "2");
    assert.equal(await page.locator("[data-motion-lab]").getAttribute("data-docked"), "false");
    assert.equal(
      await page.locator('[data-motion-milestone="2"] [data-roadmap-feature="rat_watch"] [data-roadmap-status]').textContent(),
      "BUILDING",
      "Rat Watch current-rail revalidation prevents a stale LIVE badge",
    );
    await page.screenshot({ path: path.join(output, "motion-middle-" + width + ".png"), animations: "disabled" });

    await scrollToProgress(page, 0.6);
    assert.equal(await page.locator("[data-motion-lab]").getAttribute("data-active-index"), "3");
    assert.equal(await page.locator('[data-motion-milestone="3"] [data-roadmap-feature]').count(), 7,
      "HUNT exposes all seven canonical future capabilities");
    assert.equal(
      await page.locator('[data-motion-milestone="3"] [data-roadmap-feature="dumpster_raids"] [data-roadmap-status]').textContent(),
      "EXPERIMENT",
      "Dumpster Raids projects manifest EXPERIMENTAL as EXPERIMENT",
    );
    assert.equal(
      (await page.locator('[data-motion-milestone="3"] .motion-lab__rat-line').textContent()).trim(),
      "DEGEN DECIDES ATTENTION. RECEIPTS DECIDE TRUTH.",
      "HUNT retains the canonical attention/truth contract",
    );
    assert.equal(
      await page.locator('[data-motion-milestone="4"] [data-roadmap-feature="rat_den"] [data-roadmap-status]').textContent(),
      "PLANNED",
      "Rat Den projects manifest PLANNED state",
    );

    await scrollToProgress(page, 1);
    const root = page.locator("[data-motion-lab]");
    assert.equal(await root.getAttribute("data-active-index"), "5");
    await page.waitForFunction(() => {
      const lab = document.querySelector("[data-motion-lab]");
      const pulse = document.querySelector(".motion-lab__pulse");
      if (!lab || !pulse) return false;
      return lab.getAttribute("data-docked") === "true" && Number(getComputedStyle(pulse).opacity) < 0.08;
    }, undefined, { timeout: 4000 });
    assert.equal(await root.getAttribute("data-docked"), "true", "signal head docks at the final milestone");
    const pulseOpacity = await page.locator(".motion-lab__pulse").evaluate((node) => Number(getComputedStyle(node).opacity));
    assert.ok(pulseOpacity < 0.08, "docked signal head disappears, opacity=" + pulseOpacity);
    await page.screenshot({ path: path.join(output, "motion-end-" + width + ".png"), animations: "disabled" });

    const overflow = await page.evaluate(() => ({
      html: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    assert.ok(overflow.html <= width + 1 && overflow.body <= width + 1,
      "motion lab overflow at " + width + ": " + JSON.stringify(overflow));

    process.stdout.write("PASS ROADMAP MOTION LAB " + width + "px\n");
  } finally {
    await context.close();
  }
}

async function reduced(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(base + "/roadmap-motion-lab", { waitUntil: "domcontentloaded" });
    const root = page.locator("[data-motion-lab]");
    await root.waitFor();
    assert.equal(await root.getAttribute("data-reduced-motion"), "true");
    assert.equal(await page.locator(".motion-lab__reduced-row").count(), 6);
    assert.equal(await page.locator(".motion-lab__reduced-row [data-roadmap-feature]").count(), 30,
      "reduced motion exposes all roadmap capabilities without animation");
    assert.equal(await page.locator(".motion-lab__rail").count(), 0, "reduced motion removes moving rail");
    process.stdout.write("PASS ROADMAP MOTION LAB REDUCED " + width + "px\n");
  } finally {
    await context.close();
  }
}

async function record(browser, width, height) {
  const videoDir = path.join(output, ".video-" + width);
  fs.mkdirSync(videoDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDir, size: { width, height } },
  });
  const page = await context.newPage();
  const target = path.join(output, "motion-lab-live-" + width + ".webm");
  try {
    await page.goto(base + "/roadmap-motion-lab", { waitUntil: "domcontentloaded" });
    await page.locator("[data-motion-lab]").waitFor();
    for (let step = 0; step <= 50; step += 1) {
      await scrollToProgress(page, step / 50, 70);
    }
    const video = page.video();
    await page.close();
    if (video) await video.saveAs(target);
    assert.ok(fs.existsSync(target), "motion lab video exists at " + width);
    process.stdout.write("PASS ROADMAP MOTION LAB VIDEO " + width + "px\n");
  } finally {
    if (!page.isClosed()) await page.close();
    await context.close();
    fs.rmSync(videoDir, { recursive: true, force: true });
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    await capture(browser, 1440, 900);
    await capture(browser, 390, 844);
    await reduced(browser, 1440, 900);
    await reduced(browser, 390, 844);
    await record(browser, 1440, 900);
    await record(browser, 390, 844);
    process.stdout.write("BINRAT ROADMAP MOTION LAB: ALL PASS\n");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write("ROADMAP MOTION LAB FAILED: " + (error?.stack || error) + "\n");
  process.exitCode = 1;
});
