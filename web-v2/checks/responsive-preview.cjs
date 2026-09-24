/* Isolated BINRAT GitHack preview layout gates; synthetic DEMO only. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4174").replace(/\/$/, "");
const out = path.resolve(__dirname, "../browser-artifacts/responsive");
fs.mkdirSync(out, { recursive: true });
const viewports = [
  { width: 320, height: 720, tier: "phone" },
  { width: 360, height: 780, tier: "phone" },
  { width: 390, height: 844, tier: "phone" },
  { width: 430, height: 932, tier: "phone" },
  { width: 768, height: 1024, tier: "tablet" },
  { width: 1024, height: 768, tier: "tablet" },
  { width: 1440, height: 900, tier: "desktop" },
];

async function visit(page, route) {
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await page.locator("main").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const text = document.querySelector("main")?.innerText || "";
    return text.length > 30 && !text.includes("RAT IS CHECKING THE RECEIPTS");
  });
}

async function layout(page, viewport, route) {
  const data = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const font = (selector) => {
      const element = document.querySelector(selector);
      return element ? Number.parseFloat(getComputedStyle(element).fontSize) : null;
    };
    return {
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      nav: rect(".shell-nav"),
      navLabels: [...document.querySelectorAll(".shell-nav nav a")].map(x => ({
        label: x.textContent.trim(), width: x.getBoundingClientRect().width,
        height: x.getBoundingClientRect().height, font: Number.parseFloat(getComputedStyle(x).fontSize)
      })),
      copy: rect(".hero-copy"), image: rect(".rat-presence"),
      heroFont: font(".hero-lede"), action: rect(".hero-copy .action"),
      brand: rect(".mobile-brand"),
      status: rect(".status-rail"),
      heading: rect("main h1"),
      offenders: [...document.querySelectorAll("main *")]
        .map(e => ({ e, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.right > innerWidth + 1)
        .slice(0, 15).map(({ e, r }) => ({ tag: e.tagName, name: String(e.className).slice(0, 70),
          text: (e.textContent || "").slice(0, 60), right: Math.round(r.right), width: Math.round(r.width),
          scroll: e.scrollWidth, client: e.clientWidth })),
    };
  });
  assert.ok(data.scroll <= viewport.width + 1 && data.body <= viewport.width + 1,
    route + " " + viewport.width + " horizontal overflow: " + JSON.stringify(data));
  assert.ok(data.heading && data.heading.width > 0, route + ": missing heading");
  assert.equal(data.navLabels.length, 5, route + ": five visible product destinations");
  if (viewport.tier === "phone") {
    assert.ok(data.brand?.width > 35 && data.status?.height >= 48, "phone header not readable");
    assert.ok(data.nav && data.nav.top > viewport.height - 90 && data.nav.top < viewport.height - 45,
      "thumb navigation not pinned to bottom: " + JSON.stringify(data.nav));
    assert.ok(data.navLabels.every(x => x.height >= 44 && x.font >= 11),
      "tiny or untappable navigation: " + JSON.stringify(data.navLabels));
    if (route === "/") {
      assert.ok(data.heroFont >= 13, "mobile hero copy too small: " + data.heroFont);
      assert.ok(data.action?.height >= 44, "mobile primary action too short");
      assert.ok(data.copy && data.image && data.image.top >= data.copy.bottom - 2,
        "mascot overlaps primary reading flow: " + JSON.stringify(data));
      assert.ok(data.image.height >= 220 && data.image.height <= 345, "mascot artwork excessive or cropped");
    }
  } else if (viewport.tier === "tablet") {
    assert.ok(data.nav?.height >= 60 && data.nav?.height <= 70 && data.nav.top >= -1,
      "tablet must use horizontal top navigation");
  } else {
    assert.ok(data.nav?.width >= 180 && data.nav?.height >= viewport.height - 1,
      "desktop must use full-height side navigation");
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      try {
        for (const route of ["/", "/dumpster", "/radar", "/bag/bag-feral-arc-20418791", "/ledger"]) {
          await visit(page, route);
          assert.ok(await page.getByText("DETERMINISTIC DEMO DATA").isVisible(), "Preview must remain explicit DEMO");
          await layout(page, viewport, route);
          const label = route === "/" ? "home" : route.includes("/bag/") ? "bag" : route.slice(1);
          if (route === "/" || viewport.width === 320 || viewport.width === 390 || viewport.width === 768) {
            await page.screenshot({ path: path.join(out, label + "-" + viewport.width + ".png"), fullPage: true });
          }
          process.stdout.write("PASS " + viewport.width + "px " + label + " (" + viewport.tier + ")\n");
        }
        if (viewport.tier === "phone") {
          await visit(page, "/");
          await page.locator(".shell-nav nav").getByText("RADAR").click();
          assert.match(new URL(page.url()).pathname, /\/radar$/);
          await layout(page, viewport, "/radar");
          process.stdout.write("PASS " + viewport.width + "px thumb-navigation interaction\n");
        }
      } catch (error) {
        await page.screenshot({ path: path.join(out, "FAILED-" + viewport.width + ".png"), fullPage: true }).catch(() => {});
        throw error;
      } finally {
        await context.close();
      }
    }
    process.stdout.write("BINRAT responsive preview: ALL PASS\n");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write("BINRAT responsive preview FAILED: " + (error?.stack || error) + "\n");
  process.exitCode = 1;
});
