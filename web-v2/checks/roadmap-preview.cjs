const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4174").replace(/\/$/, "");
const output = path.resolve(__dirname, "../browser-artifacts/roadmap-v1");
fs.mkdirSync(output, { recursive: true });

const sizes = [
  [320, 720],
  [390, 844],
  [430, 932],
  [1024, 768],
  [1440, 900],
];

async function noOverflow(page, width, label) {
  const data = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert.ok(data.html <= width + 1 && data.body <= width + 1,
    label + " overflow at " + width + ": " + JSON.stringify(data));
}

async function centerStage(page, id) {
  await page.locator('[data-stage="' + id + '"]').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const top = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo({ top, behavior: "auto" });
    root.style.scrollBehavior = previous;
  });
  await page.locator('[data-stage="' + id + '"][data-active="true"]').waitFor();
}

async function capture(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto(base + "/roadmap", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "DOWN THE RAT HOLE." }).waitFor();
    await noOverflow(page, width, "roadmap intro");

    await centerStage(page, "sniff");
    assert.equal(await page.locator('[data-active="true"][data-stage]').count(), 1, "one active stage at SNIFF");
    await page.screenshot({
      path: path.join(output, "sniff-" + width + ".png"),
      fullPage: false,
      animations: "disabled",
    });

    await centerStage(page, "remember");
    assert.equal(await page.locator('[data-active="true"][data-stage]').count(), 1, "one active stage at REMEMBER");
    await noOverflow(page, width, "roadmap remember");
    await page.screenshot({
      path: path.join(output, "remember-" + width + ".png"),
      fullPage: false,
      animations: "disabled",
    });

    process.stdout.write("PASS ROADMAP " + width + "px SNIFF -> REMEMBER\n");
  } finally {
    await context.close();
  }
}

async function reducedMotion(browser, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    await page.goto(base + "/roadmap", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "DOWN THE RAT HOLE." }).waitFor();
    await centerStage(page, "sniff");
    const motion = await page.evaluate(() => {
      const signal = document.querySelector(".roadmap-spine__signal");
      const node = document.querySelector('[data-stage="sniff"] .roadmap-stage__node span');
      return {
        signalDisplay: signal ? getComputedStyle(signal).display : "missing",
        nodeAnimation: node ? getComputedStyle(node).animationName : "missing",
      };
    });
    assert.equal(motion.signalDisplay, "none", "reduced motion hides travelling signal");
    assert.equal(motion.nodeAnimation, "none", "reduced motion stops node animation");
    await noOverflow(page, width, "roadmap reduced motion");
    process.stdout.write("PASS ROADMAP REDUCED MOTION " + width + "px\n");
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    for (const [width, height] of sizes) await capture(browser, width, height);
    await reducedMotion(browser, 390, 844);
    await reducedMotion(browser, 1440, 900);
    process.stdout.write("BINRAT ROADMAP V1 PREVIEW: ALL PASS\n");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write("ROADMAP PREVIEW FAILED: " + (error?.stack || error) + "\n");
  process.exitCode = 1;
});
