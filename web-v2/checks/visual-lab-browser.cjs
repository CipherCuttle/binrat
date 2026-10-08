/* Local Visual Lab only. Uses the same pinned Playwright 1.56.1 runner as CI.
 * NODE_PATH=/tmp/binrat-visual-lab-runner/node_modules \
 * BINRAT_PREVIEW_URL=http://127.0.0.1:4186 node web-v2/checks/visual-lab-browser.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const base = process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4186";
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, "isolated local preview only");
const output = path.resolve(process.env.BINRAT_VISUAL_OUTPUT || path.join(__dirname, "../browser-artifacts/visual-lab/final"));
fs.mkdirSync(output, { recursive: true });
const results = { checks: [], measurements: [], browser: "", errors: [] };
const tabs = (page, name) => page.getByRole("tab", { name: new RegExp(`\\b${name}\\b`) });
const panel = (page) => page.getByRole("tabpanel");
async function check(name, fn) {
  await fn(); results.checks.push(name); console.log("PASS " + name);
}
async function ready(page, suffix = "/visual-lab") {
  await page.goto(base + suffix, { waitUntil: "networkidle" });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((img) => img.decode().catch(() => {}))); });
}
async function noOverflow(page) {
  const sizes = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, width: innerWidth }));
  assert.ok(sizes.doc <= sizes.width && sizes.body <= sizes.width, JSON.stringify(sizes));
  const bad = await page.evaluate(() => [...document.querySelectorAll(".vl-workspace *")].filter((node) => {
    if (node.closest(".vl-find-rail")) return false; // Intentional contained discovery scroller.
    const r = node.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
  }).map((node) => node.className));
  assert.deepEqual(bad, [], "unexpected content overflow");
}
async function screenshot(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(output, name + ".png"), fullPage });
}
async function run() {
  const browser = await chromium.launch({ headless: true });
  results.browser = browser.version();
  try {
    for (const [width, height] of [[1440, 900], [390, 844], [768, 1024]]) {
      const tag = `${width}x${height}`;
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      await context.addInitScript(() => {
        window.__labVitals = { cls: 0, lcp: 0 };
        new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__labVitals.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__labVitals.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      });
      const page = await context.newPage();
      const failures = [], api = [];
      page.on("pageerror", (e) => failures.push(e.message));
      page.on("console", (e) => { if (e.type() === "error") failures.push(e.text()); });
      page.on("response", (r) => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
      page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api")) api.push(r.url()); });
      await ready(page);
      await check(`${tag}: initial Case, visible primary action, images and overflow`, async () => {
        assert.equal(await page.locator("#vl-case").getAttribute("data-case"), "$MOLDY");
        assert.match(await page.locator("h1").innerText(), /SMELLS FAMILIAR/);
        const action = await page.getByRole("button", { name: "FOLLOW THE TRAIL", exact: true }).boundingBox();
        assert.ok(action && action.y >= 0 && action.y + action.height <= height, "primary action must be in first viewport");
        if (width === 390) {
          assert.match(await page.locator(".vl-case-intro p").innerText(), /also appears on three earlier launches.*That recurrence is why Rat Zero brought it to you\./s, "mobile opening must explain why the discovery matters");
          for (const selector of [".vl-brand strong", ".vl-live", ".vl-lab-stamp b", ".vl-discovery", ".vl-case-art", "h1", ".vl-case-intro p"]) {
            const box = await page.locator(selector).boundingBox();
            assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, `${selector} must fit in the mobile first viewport`);
          }
          const find = await page.getByRole("button", { name: "Open $MOLDY Case", exact: true }).boundingBox();
          assert.ok(find && find.height >= 44, "compact discovery must retain a 44px touch target");
        }
        assert.equal(await page.locator(".vl-material-switcher").count(), 0);
        const unloaded = await page.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src));
        assert.deepEqual(unloaded, []);
        await noOverflow(page);
      });
      await screenshot(page, tag + "-what");
      await screenshot(page, tag + "-what-full", true);
      results.measurements.push(await page.evaluate(() => ({ viewport: `${innerWidth}x${innerHeight}`, ...window.__labVitals, imageBytes: performance.getEntriesByType("resource").filter((r) => /\.(webp|png)/.test(r.name)).reduce((n, r) => n + r.encodedBodySize, 0), images: [...document.images].map((i) => ({ file: i.currentSrc.split("/").pop(), naturalWidth: i.naturalWidth })), blurLayers: [...document.querySelectorAll(".visual-lab *")].filter((e) => getComputedStyle(e).backdropFilter !== "none").length })));
      await check(`${tag}: WHAT → TRAIL → RECEIPTS → NEXT → return`, async () => {
        const before = await panel(page).innerText();
        await page.getByRole("button", { name: "FOLLOW THE TRAIL", exact: true }).click();
        assert.equal(await tabs(page, "TRAIL").getAttribute("aria-selected"), "true");
        assert.notEqual(await panel(page).innerText(), before);
        assert.equal(await page.locator(".vl-timeline li").count(), 4);
        assert.match(await panel(page).innerText(), /\$PEEL/);
        await noOverflow(page);
        await screenshot(page, tag + "-trail");
        await screenshot(page, tag + "-trail-full", true);
        await page.getByRole("button", { name: "CHECK RECEIPTS", exact: true }).click();
        assert.equal(await page.locator(".vl-receipt").count(), 4);
        assert.match(await panel(page).innerText(), /Synthetic examples, not chain receipts/);
        await screenshot(page, tag + "-receipts");
        await page.locator(".vl-receipt summary").first().click();
        const json = JSON.parse(await page.locator(".vl-receipt pre").first().innerText());
        assert.equal(json.synthetic, true); assert.equal(json.case, "$MOLDY");
        assert.equal(json.source, "LOCAL_SYNTHETIC_FIXTURE"); assert.equal(json.reportedDeployer, "lab-address-A");
        assert.match(await page.locator(".vl-receipt-body").first().innerText(), /visual-lab-fixtures.ts/);
        await noOverflow(page);
        await screenshot(page, tag + "-receipt-expanded", true);
        await page.getByRole("button", { name: "REVIEW NEXT ACTIONS", exact: true }).click();
        assert.match(await panel(page).innerText(), /WATCH IS NOT TRIPWIRE/);
        await page.getByRole("button", { name: "CHECK WATCH ACCESS", exact: true }).click();
        assert.match(await page.getByRole("status").innerText(), /No Watch has been created/);
        const link = page.getByRole("link", { name: "OPEN TELEGRAM" });
        assert.equal(await link.getAttribute("href"), "https://t.me/BinratBot");
        // Prove outgoing navigation without contacting Telegram or creating a Watch.
        await context.route("https://t.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "Local navigation test: Telegram target reached." }));
        const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
        await popup.waitForLoadState(); assert.equal(popup.url(), "https://t.me/BinratBot"); await popup.close();
        await screenshot(page, tag + "-next");
        await page.getByRole("link", { name: "RETURN TO FINDS" }).click();
        await page.waitForFunction(() => location.hash === "#vl-finds");
        assert.match(page.url(), /#vl-finds$/);
      });
      await check(`${tag}: all five Finds reset Case and keep facts, chronology and access consistent`, async () => {
        const expectations = [
          ["$MOLDY", "SMELLS FAMILIAR.", 3, 4, true],
          ["$SLOP", "FRESH SCRAP.", 0, 1, true],
          ["$CRUST", "SEEN THIS BEFORE.", 2, 3, true],
          ["$OOZE", "NEW COAT. SAME CAN.", 0, 2, false],
          ["$TIN", "ONLY HALF THE STORY.", 0, 1, false],
        ];
        for (const [symbol, headline, prior, count, watch] of expectations) {
          await page.getByRole("button", { name: `Open ${symbol} Case`, exact: true }).click();
          assert.equal(await page.locator("#vl-case").getAttribute("data-case"), symbol);
          assert.equal(await page.locator("h1").innerText(), headline);
          assert.equal(await tabs(page, "WHAT").getAttribute("aria-selected"), "true");
          assert.match(await panel(page).innerText(), new RegExp(symbol.replace("$", "\\$")));
          await tabs(page, "TRAIL").click();
          assert.equal(await page.locator(".vl-timeline li").count(), prior + 1);
          if (!prior) {
            assert.match(await panel(page).innerText(), /unknown/i);
            assert.doesNotMatch(await panel(page).innerText(), /Same reported address|\$MOLDY|\$CRUST|\$PEEL|\$RIND/);
          }
          await tabs(page, "RECEIPTS").click();
          assert.equal(await page.locator(".vl-receipt").count(), count);
          await page.locator(".vl-receipt summary").first().click();
          const json = JSON.parse(await page.locator(".vl-receipt pre").first().innerText());
          assert.equal(json.symbol, symbol); assert.equal(json.synthetic, true);
          await tabs(page, "NEXT").click();
          assert.equal(await page.getByRole("button", { name: "CHECK WATCH ACCESS" }).count(), watch ? 1 : 0);
          assert.equal(await page.locator("#vl-watch-gate").count(), 0, "gate must reset between Cases");
          if (!watch) assert.match(await panel(page).innerText(), /reported deployer is missing/);
          await noOverflow(page);
        }
      });
      await check(`${tag}: keyboard journey, receipt links, Crew truth and navigation`, async () => {
        await page.getByRole("button", { name: "Open $MOLDY Case", exact: true }).click();
        await tabs(page, "WHAT").focus(); await page.keyboard.press("ArrowRight");
        assert.equal(await tabs(page, "TRAIL").getAttribute("aria-selected"), "true");
        assert.equal(await tabs(page, "TRAIL").evaluate((e) => e === document.activeElement), true);
        await page.keyboard.press("End"); assert.equal(await tabs(page, "NEXT").getAttribute("aria-selected"), "true");
        await page.keyboard.press("Home"); assert.equal(await tabs(page, "WHAT").getAttribute("aria-selected"), "true");
        await page.keyboard.press("ArrowLeft"); assert.equal(await tabs(page, "NEXT").getAttribute("aria-selected"), "true");
        await tabs(page, "WHAT").click();
        await page.getByRole("button", { name: "Inspect lab-crust-01", exact: true }).click();
        const details = page.locator('[data-receipt="lab-crust-01"] details');
        assert.equal(await details.getAttribute("open"), "");
        await details.locator("summary").focus(); await page.keyboard.press("Enter"); assert.equal(await details.getAttribute("open"), null);
        await page.getByRole("button", { name: "CREW", exact: false }).click();
        for (const [name, role, status] of [["RAT ZERO", "SCOUT", "LIVE"], ["TRIPWIRE", "WATCHER", "BUILDING"], ["SNIFFER", "TRAIL HUNTER", "PROVING"]]) {
          const text = await page.locator(".vl-crew-member").filter({ hasText: name }).innerText(); assert.ok(text.includes(role) && text.includes(status));
        }
        assert.match(await page.locator("#vl-crew").innerText(), /Working Rat are not live/);
        await screenshot(page, tag + "-crew");
        await page.keyboard.press("Escape"); assert.equal(await page.locator("#vl-crew").count(), 0);
        const body = await page.locator("body").innerText();
        assert.doesNotMatch(body, /BUY NOW|AUTONOMOUS TRADING|GUARANTEED|LIVE SCANS/i);
        assert.deepEqual(api, [], "Visual Lab must not access evidence APIs");
        await page.getByRole("link", { name: "BINRAT visual lab home" }).click();
        await page.waitForURL(base + "/visual-lab");
        if (width > 700) { await page.getByRole("link", { name: "FRESH FINDS", exact: true }).click(); assert.match(page.url(), /#vl-finds$/); await page.getByRole("link", { name: "CASES", exact: true }).click(); assert.match(page.url(), /#vl-case$/); }
      });
      assert.deepEqual(failures, [], "browser or network failures");
      await context.close();
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await ready(page, "/visual-lab?visualDebug=1");
    await check("reduced motion and explicit material debug mode", async () => {
      for (const name of ["GLASS", "REFRACT", "PEARL"]) {
        await page.getByRole("button", { name, exact: true }).click();
        assert.equal(await page.locator(".visual-lab").getAttribute("data-material"), name.toLowerCase());
      }
      const motion = await page.evaluate(() => ({ reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, scroll: getComputedStyle(document.documentElement).scrollBehavior, active: [...document.querySelectorAll(".visual-lab *")].filter((e) => { const c = getComputedStyle(e); return c.animationName !== "none" || c.transitionDuration.split(",").some((s) => parseFloat(s) > 0); }).length }));
      assert.deepEqual(motion, { reduced: true, scroll: "auto", active: 0 });
      await page.getByRole("button", { name: "FOLLOW THE TRAIL", exact: true }).click();
      assert.match(await panel(page).innerText(), /An address leaves a trail/);
      await noOverflow(page);
      await screenshot(page, "390x844-reduced-motion");
    });
    for (const [width, height] of [[320, 800], [360, 800], [430, 932], [1024, 768]]) {
      await page.setViewportSize({ width, height }); await ready(page);
      await check(`${width}px supplementary responsive gate`, async () => { await noOverflow(page); await screenshot(page, `${width}x${height}-what`); });
    }
    await ready(page, "/?visual=lab");
    assert.equal(await page.locator("#vl-case").count(), 1);
    await page.close();
  } finally { await browser.close(); }
}
run().then(() => { results.verdict = "PASS"; fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(results, null, 2)); console.log(`Browser checks PASS; artifacts: ${output}`); }).catch((error) => { results.verdict = "FAIL"; results.errors.push(error.stack); fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(results, null, 2)); console.error(error); process.exit(1); });
