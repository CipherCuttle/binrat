/* M1: task-based mobile acceptance plus tablet/desktop regression.
 * Validated demo fixtures only; screenshots captured before owner visual review.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const base = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4174").replace(/\/$/, "");
const output = path.resolve(__dirname, "../browser-artifacts/mobile-m1");
fs.mkdirSync(output, { recursive: true });
const sizes = [
  [320, 720], [360, 780], [390, 844], [430, 932],
  [768, 1024], [1024, 768], [1440, 900],
];
const routes = ["/", "/dumpster", "/radar", "/bag/bag-feral-arc-20418791"];
async function ready(page, route) {
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await page.locator("main h1").first().waitFor();
  await page.waitForFunction(() => (document.querySelector("main")?.innerText || "").length > 60 &&
    !(document.querySelector("main")?.innerText || "").includes("RAT IS CHECKING THE RECEIPTS"));
}
async function noOverflow(page, label, width) {
  const data = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth, body: document.body.scrollWidth,
    offenders: [...document.querySelectorAll("main *")].map(x => ({ x, r: x.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.right > innerWidth + 1)
      .slice(0, 8).map(({ x, r }) => ({ element: x.tagName, css: String(x.className).slice(0, 80),
        text: x.textContent?.slice(0, 45), right: Math.round(r.right) })),
  }));
  assert.ok(data.html <= width + 1 && data.body <= width + 1,
    label + " overflow at " + width + ": " + JSON.stringify(data));
}
async function mobileNav(page, width, height) {
  const nav = page.getByRole("navigation", { name: "Mobile primary navigation" });
  await nav.waitFor();
  const links = nav.getByRole("link");
  assert.equal(await links.count(), 4, "exactly four phone destinations");
  const result = await nav.evaluate(n => {
    const r = n.getBoundingClientRect();
    return { y: r.y, h: r.height, controls: [...n.querySelectorAll("a")].map(x => ({
      height: x.getBoundingClientRect().height, label: x.innerText, font: parseFloat(getComputedStyle(x).fontSize),
    })) };
  });
  assert.ok(result.y >= height - 95 && result.y < height - 55, "nav must be bottom pinned");
  assert.ok(result.controls.every(x => x.height >= 48 && x.font >= 11),
    "nav not finger-sized: " + JSON.stringify(result.controls));
  assert.deepEqual(result.controls.map(x => x.label), ["Discover", "Radar", "Saved", "More"]);
  assert.ok(await page.getByRole("link", { name: "BINRAT Discover" }).isVisible(), "mobile brand home link");
  assert.ok(await page.getByText("DEMO", { exact: true }).first().isVisible(), "visible synthetic DEMO badge");
}
async function testPhone(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    for (const route of [...routes, "/saved", "/more"]) {
      await ready(page, route);
      await mobileNav(page, width, height);
      await noOverflow(page, route, width);
      const label = route.includes("/bag/") ? "bag" : route === "/" ? "discover" : route.slice(1);
      if (width === 390 || (width === 320 && ["discover", "radar", "bag"].includes(label))) {
        await page.screenshot({ path: path.join(output, label + "-" + width + ".png"), fullPage: true, animations: "disabled" });
      }
      process.stdout.write("PASS M1 " + width + "px " + label + "\n");
    }
    await ready(page, "/");
    assert.match(await page.locator("main").innerText(), /Fresh evidence/);
    const search = page.getByRole("searchbox");
    await search.fill("FERAL");
    assert.equal(await page.getByRole("link", { name: "Open FERAL dossier" }).count(), 1);
    await search.fill("not-present-in-demo");
    assert.match(await page.locator("main").innerText(), /NOTHING IN THIS BAG/);
    await search.fill("");
    await page.getByRole("button", { name: "↻ REPEATS" }).click();
    assert.equal(await page.getByRole("link", { name: "Open SLAG dossier" }).count(), 0,
      "repeat filter should exclude no-history bag");
    await page.getByRole("button", { name: "↻ REPEATS" }).click();
    await page.getByRole("link", { name: "Open FERAL dossier" }).click();
    assert.match(new URL(page.url()).pathname, /\/bag\/bag-feral/);
    const tabs = page.getByRole("tab");
    assert.equal(await tabs.count(), 4);
    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "true");
    assert.match(await page.getByRole("tabpanel").innerText(), /DEMO \+5m/);
    await tabs.nth(3).click();
    assert.match(await page.getByRole("tabpanel").innerText(), /NO RECEIPT/);
    await page.getByRole("button", { name: "Save bag FERAL on this device" }).click();
    await page.getByRole("navigation", { name: "Mobile primary navigation" }).getByRole("link", { name: "Saved" }).click();
    assert.match(await page.locator("main").innerText(), /SAVED BAG/);
    assert.match(await page.locator("main").innerText(), /never starts a Telegram Watch subscription/);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /\$FERAL/ }).waitFor();
    await noOverflow(page, "persisted Saved", width);
    await page.getByRole("navigation", { name: "Mobile primary navigation" }).getByRole("link", { name: "Radar" }).click();
    assert.equal(await page.getByRole("button", { name: "Save radar address on this device" }).count(), 1);
    assert.doesNotMatch(await page.locator("main").innerText(), /WATCH ARMED/);
    const candidates = page.locator("main a[href*='/radar/address/']");
    assert.ok((await candidates.count()) >= 5);
    await candidates.nth(1).click();
    assert.match(new URL(page.url()).pathname, /\/radar\/address\//);
    await page.reload({ waitUntil: "domcontentloaded" });
    await noOverflow(page, "radar deep link", width);
    await ready(page, "/radar/address/0x0000000000000000000000000000000000000000");
    assert.match(await page.locator("main").innerText(), /NO MATCHING RADAR FILE/);
    await ready(page, "/bag/bag-slag-arc-20418502");
    assert.doesNotMatch(await page.locator("main").innerText(), /DEMO \+5m/);
    process.stdout.write("PASS M1 " + width + "px task flow, bookmarks, URL/Replay integrity\n");
  } catch (error) {
    await page.screenshot({ path: path.join(output, "FAILED-" + width + ".png"), fullPage: true }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}
async function testWide(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  try {
    for (const route of routes) {
      await ready(page, route);
      assert.equal(await page.getByRole("navigation", { name: "Mobile primary navigation" }).count(), 0);
      assert.equal(await page.getByRole("navigation", { name: "Primary" }).getByRole("link").count(), 5);
      await noOverflow(page, route, width);
      if (width === 768) await page.screenshot({ path: path.join(output, (route === "/" ? "home" : route.includes("/bag/") ? "bag" : route.slice(1)) + "-" + width + ".png"), fullPage: true });
      process.stdout.write("PASS M1 " + width + "px desktop/tablet " + route + "\n");
    }
  } finally { await context.close(); }
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    for (const [width,height] of sizes) {
      if (width <= 720) await testPhone(browser,width,height);
      else await testWide(browser,width,height);
    }
    process.stdout.write("BINRAT M1 MOBILE-FIRST ACCEPTANCE: ALL PASS\n");
  } finally { await browser.close(); }
})().catch(e => { process.stderr.write("M1 BROWSER FAILED: " + (e?.stack || e) + "\n"); process.exitCode = 1; });
