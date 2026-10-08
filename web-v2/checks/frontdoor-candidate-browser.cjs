/* Playwright 1.56.1; compiled static site; recorded transport is REPLAY, never live proof. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const runnerRequire = process.env.BINRAT_FRONTDOOR_TOOLS
  ? require("node:module").createRequire(path.join(process.env.BINRAT_FRONTDOOR_TOOLS, "runner.cjs")) : require;
const { pathToFileURL } = require("node:url");
const base = "http://127.0.0.1:4189";
const root = path.resolve(__dirname, "../..");
const response = p => JSON.parse(fs.readFileSync(path.join(root, "docs/receipts/pons-runtime-v1", p), "utf8")).body;
const feed = response("1440x900-api-launches-latest.json"), status = response("1440x900-api-status.json");
const out = path.resolve(root, process.env.BINRAT_FRONTDOOR_OUTPUT || ".artifacts/v3-frontdoor/browser");
fs.mkdirSync(out, { recursive: true });
fs.rmSync(path.join(out, "results.json"), { force: true });
require("node:child_process").execFileSync(process.execPath, [path.join(__dirname, "check-frontdoor-package.mjs")], { stdio: "inherit" });
const manifest = JSON.parse(fs.readFileSync(path.join(root, ".artifacts/v3-frontdoor/manifest.json"), "utf8"));
const { chromium } = runnerRequire("playwright");
assert.equal(runnerRequire("playwright/package.json").version, "1.56.1");
const report = { sourceSha: manifest.sourceSha, sourceDirty: manifest.sourceDirty, checks: [], errors: [], requests: [], measurements: [],
  provenance: "RECORDED_REAL_PUBLIC_TRANSPORT_REPLAY", controls: "SIMULATED_ADVERSE_STATES", productionAuthorization: false, verdict: "FAIL" };
const allowed = ["/api/status", "/api/launches/latest"];
async function contextFor(browser, viewport, state = { feed, status }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  context.on("page", page => {
    page.on("pageerror", err => report.errors.push(err.message));
    page.on("requestfailed", r => report.errors.push(r.url() + ": " + r.failure()?.errorText));
    page.on("request", r => report.requests.push({ url: r.url(), method: r.method() }));
    page.on("response", r => {
      if (!new URL(r.url()).pathname.startsWith("/api/") && r.status() >= 400) report.errors.push("Asset HTTP " + r.status() + " " + r.url());
    });
  });
  await context.route("**/api/**", route => {
    const p = new URL(route.request().url()).pathname;
    assert.equal(route.request().method(), "GET"); assert.ok(allowed.includes(p), p);
    return route.fulfill({ status: state.unavailable ? 503 : 200, contentType: "application/json",
      body: JSON.stringify(state.unavailable ? { error: "SIMULATED_UPSTREAM_UNAVAILABLE" } : p === "/api/status" ? state.status : state.feed) });
  });
  return context;
}
async function visit(context, pathname) {
  const page = await context.newPage();
  const html = await page.goto(base + pathname, { waitUntil: "networkidle" });
  assert.equal(html.status(), 200); assert.match(html.headers()["content-type"], /text\/html/);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
  return page;
}
async function check(label, fn) { await fn(); report.checks.push(label); console.log("PASS " + label); }
const tab = (page, name) => page.getByRole("tab", { name: new RegExp("\\b" + name + "\\b") });
async function capture(page, name) { await page.screenshot({ path: path.join(out, name + ".png") }); }
async function noOverflow(page, width) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= width + 1, "horizontal overflow at " + width);
}
async function recheck(page) {
  await page.getByRole("button", { name: "RECHECK", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".vl-utility")?.disabled);
}
(async () => {
  const { canonicalSnapshotDigest } = await import(pathToFileURL(path.join(root, "web/snapshot-contract.js")));
  const browser = await chromium.launch({ headless: true }); report.browser = browser.version();
  try {
    for (const [w, h] of [[1440, 900], [390, 844], [768, 1024], [320, 800], [430, 932], [360, 800], [1024, 768]]) {
      const context = await contextFor(browser, { width: w, height: h });
      const page = await visit(context, "/");
      await check(w + "x" + h + " recorded Pons Case, stale truth, fonts and assets", async () => {
        assert.equal(await page.locator("#vl-case").getAttribute("data-case"), feed.launches[0].launchId);
        assert.match(await page.locator(".vl-lab-stamp").innerText(), /STALE_VERIFIED/);
        assert.equal(await page.locator(".vl-find").count(), feed.launches.length);
        assert.doesNotMatch(await page.locator("body").innerText(), /SYNTHETIC INVESTIGATION/);
        assert.ok(await page.evaluate(() => document.fonts.check('12px "Geist Sans"') && document.fonts.check('12px "Geist Mono"')));
        await noOverflow(page, w);
      });
      await capture(page, `root-${w}x${h}`);
      report.measurements.push({ width: w, height: h, primaryCta: await page.locator(".vl-primary").boundingBox() });
      await check(w + "x" + h + " WHAT → TRAIL → RECEIPTS → NEXT and keyboard", async () => {
        for (const stage of ["WHAT", "TRAIL", "RECEIPTS", "NEXT"]) {
          assert.equal(await tab(page, stage).getAttribute("aria-selected"), "true");
          if (stage === "RECEIPTS") {
            await page.locator("summary").click();
            const receipt = JSON.parse(await page.locator("pre").innerText());
            assert.equal(receipt.launchId, feed.launches[0].launchId);
            assert.equal(receipt.token, feed.launches[0].token);
            assert.equal(receipt.feedDigest, status.feedDigest);
            assert.equal(await page.getByRole("link", { name: "Same-origin Pons public feed" }).getAttribute("href"), "/api/launches/latest");
          }
          if (stage === "NEXT") {
            assert.match(await page.getByRole("tabpanel").innerText(), /UNAVAILABLE IN PREVIEW/);
            assert.equal(await page.getByRole("button", { name: /watch|employ|wallet|buy|trade/i }).count(), 0);
          }
          await noOverflow(page, w);
          if ([1440, 390, 768].includes(w)) await capture(page, `${stage.toLowerCase()}-${w}x${h}`);
          if (stage !== "NEXT") await page.locator(".vl-primary").click();
        }
        await tab(page, "NEXT").press("Home");
        assert.equal(await tab(page, "WHAT").getAttribute("aria-selected"), "true");
        await tab(page, "WHAT").press("ArrowRight");
        assert.equal(await tab(page, "TRAIL").getAttribute("aria-selected"), "true");
      });
      await context.close();
    }
    const context = await contextFor(browser, { width: 390, height: 844 });
    const page = await visit(context, "/");
    await check("Selected share link and reload preserve the exact Case", async () => {
      await page.getByRole("button", { name: "Open Case " + feed.launches[1].launchId }).click();
      assert.equal(await page.locator("#vl-case").getAttribute("data-case"), feed.launches[1].launchId);
      assert.equal(new URL(page.url()).searchParams.get("case"), feed.launches[1].launchId);
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await page.locator("#vl-case").getAttribute("data-case"), feed.launches[1].launchId);
    });
    await check("Direct /bag and query deep links resolve exact IDs; absent ID fails closed", async () => {
      for (const url of ["/bag/" + feed.launches[2].launchId, "/?case=" + feed.launches[2].launchId]) {
        await page.goto(base + url, { waitUntil: "networkidle" });
        assert.equal(await page.locator("#vl-case").getAttribute("data-case"), feed.launches[2].launchId);
      }
      await page.goto(base + "/bag/" + "f".repeat(64), { waitUntil: "networkidle" });
      assert.equal(await page.locator("#vl-case").count(), 0);
      assert.match(await page.getByRole("alert").innerText(), /No replacement Case/);
    });
    await check("Historical routes expose no ARC UI or transport", async () => {
      for (const route of ["/radar", "/watch", "/replay", "/unknown-route"]) {
        await page.goto(base + route, { waitUntil: "networkidle" });
        assert.match(await page.locator("body").innerText(), /NOT IN THIS BUILD/);
        assert.equal(await page.locator("#vl-case").count(), 0);
      }
    });
    await check("Synthetic Lab remains explicit and makes no API requests", async () => {
      const before = report.requests.filter(r => new URL(r.url).pathname.startsWith("/api/")).length;
      await page.goto(base + "/visual-lab", { waitUntil: "networkidle" });
      assert.match(await page.locator(".vl-lab-stamp").innerText(), /SYNTHETIC/);
      assert.equal(await page.locator("#vl-case").getAttribute("data-case"), "$MOLDY");
      assert.equal(report.requests.filter(r => new URL(r.url).pathname.startsWith("/api/")).length, before);
      await capture(page, "synthetic-lab");
    });
    await context.close();
    for (const name of ["http-503", "verified-empty", "wrong-chain", "tampered-digest", "retained-after-503"]) {
      const state = { feed: structuredClone(feed), status: structuredClone(status) };
      if (name === "http-503") state.unavailable = true;
      if (name === "verified-empty") {
        state.feed.launches = []; state.feed.feedDigest = await canonicalSnapshotDigest(state.feed);
        state.status.feedDigest = state.feed.feedDigest;
      }
      if (name === "wrong-chain") state.feed.chainId = 5042;
      if (name === "tampered-digest") state.feed.launches[0].symbol = "TAMPERED";
      const context = await contextFor(browser, { width: 390, height: 844 }, state);
      const page = await visit(context, "/");
      await check("Simulated " + name + " fails closed without synthetic replacement", async () => {
        if (name === "retained-after-503") {
          state.unavailable = true; await recheck(page);
          assert.equal(await page.locator("#vl-case").getAttribute("data-case"), feed.launches[0].launchId);
          assert.match(await page.getByRole("alert").innerText(), /Last verified snapshot retained/);
          assert.match(await page.locator(".vl-lab-stamp").innerText(), /STALE_VERIFIED/);
        } else {
          assert.equal(await page.locator("#vl-case").count(), 0);
          assert.match(await page.locator("body").innerText(), name === "verified-empty" ? /Verified empty feed/ : /Nothing was substituted/);
        }
        await capture(page, "simulated-" + name);
      });
      await context.close();
    }
    await check("All browser requests are same-origin GET; no legacy API, broken assets or JS errors", async () => {
      assert.ok(report.requests.some(r => new URL(r.url).pathname.startsWith("/api/")));
      for (const r of report.requests) {
        const u = new URL(r.url); assert.equal(r.method, "GET"); assert.equal(u.origin, base);
        if (u.pathname.startsWith("/api/")) assert.ok(allowed.includes(u.pathname), u.pathname);
      }
      assert.deepEqual(report.errors, []);
    });
    report.verdict = "PASS";
    console.log("CUTOVER_STATIC_BROWSER_PASS " + report.checks.length);
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(report, null, 2) + "\n");
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
