/** Pinned native Playwright. Actual local Worker/SQLite + captured production identities.
 * Source timestamps, owner credentials and Telegram transport are explicit offline mocks. */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const runner = require("node:module").createRequire(path.join(process.env.BINRAT_FRONTDOOR_TOOLS || "/tmp/binrat-a2-2-browser-runner/node_modules", "runner.cjs"));
assert.equal(runner("playwright/package.json").version, "1.56.1");
const { chromium } = runner("playwright");
const base = "http://127.0.0.1:4194", out = path.resolve(process.env.BINRAT_TRIPWIRE_UI_OUTPUT || "docs/proofs/pons-tripwire/ui");
fs.mkdirSync(out, { recursive: true });
const report = { provenance: "LOCAL_WORKER_SQLITE_CAPTURED_PRODUCTION_IDENTITIES_SIMULATED_CLOCK_MOCK_TELEGRAM", productionWrites: 0, realTelegramMessages: 0, productionTimestampProof: false, checks: [], requests: [], errors: [], verdict: "BLOCKED" };
const manifest = JSON.parse(fs.readFileSync(".artifacts/v3-frontdoor/manifest.json", "utf8"));
report.build = { sourceSha: manifest.sourceSha, sourceDirty: manifest.sourceDirty,
  bundles: manifest.files.filter(item => /assets\/.*\.(js|css)$/.test(item.path)) };
const tab = (page, name) => page.getByRole("tab", { name: new RegExp("\\b" + name + "\\b") });
const panel = page => page.getByRole("region", { name: "Watch this Pons deployer" });
async function check(name, run) { await run(); report.checks.push(name); console.log("PASS " + name); }
async function control(action) {
  const response = await fetch(base + "/__offline/" + action, { method: action === "meta" ? "GET" : "POST" });
  assert.equal(response.status, 200); return response.json();
}
async function visit(context, id, now) {
  const page = await context.newPage();
  await page.clock.install({ time: new Date(now) });
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url()); assert.equal(url.origin, base, "offline browser must not call an external service");
    const item = { method: request.method(), path: url.pathname };
    if (url.pathname.startsWith("/api/pons-tripwire/")) {
      const body = request.postDataJSON(); item.bodyKeys = Object.keys(body).sort();
      assert.deepEqual(item.bodyKeys, ["caseId", "initData"]); item.caseId = body.caseId;
    }
    report.requests.push(item);
  });
  await page.goto(base + "/bag/" + id, { waitUntil: "networkidle" });
  await page.locator("#vl-case").waitFor(); assert.equal(await page.locator("#vl-case").getAttribute("data-case"), id);
  return page;
}
async function watchPanel(page) { await page.getByRole("button", { name: "WATCH THIS DEPLOYER →", exact: true }).click(); await panel(page).waitFor(); }
async function screenshot(page, name, width) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= width + 1, "horizontal overflow at " + width);
  await panel(page).scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true });
}
(async () => {
  const meta = await control("meta"), browser = await chromium.launch({ headless: true });
  report.browser = browser.version(); report.openedCase = meta.caseId; report.laterCase = meta.laterCaseId; report.exactDeployer = meta.deployer;
  try {
    const outside = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const external = await visit(outside, meta.caseId, meta.now);
    await external.screenshot({ path: path.join(out, "phone-find.png"), fullPage: true });
    await watchPanel(external);
    await check("ordinary website requires exact Case Telegram authentication; no implicit Watch", async () => {
      const link = panel(external).getByRole("link", { name: "OPEN THIS CASE IN TELEGRAM ↗" }); await link.waitFor();
      const payload = new URL(await link.getAttribute("href")).searchParams.get("start");
      assert.equal(payload.length, 48); assert.equal(Buffer.from(payload.slice(5), "base64url").toString("hex"), meta.caseId);
      assert.equal(await panel(external).getByRole("checkbox").count(), 0);
      assert.equal(report.requests.filter(item => item.path === "/api/pons-tripwire/watch").length, 0);
    });
    await screenshot(external, "phone-authentication", 390); await outside.close();

    const rejected = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await rejected.addInitScript(() => { window.Telegram = { WebApp: { initData: "EXPLICIT_OFFLINE_FORGED_AUTH", ready() {} } }; });
    const rejectedPage = await visit(rejected, meta.caseId, meta.now); await watchPanel(rejectedPage);
    await check("actual Worker rejects forged authentication before showing opt-in", async () => {
      await panel(rejectedPage).getByRole("alert").waitFor();
      assert.match(await panel(rejectedPage).innerText(), /authenticated owner pilot/);
      assert.equal(await panel(rejectedPage).getByRole("checkbox").count(), 0);
    });
    await screenshot(rejectedPage, "phone-auth-rejected", 390); await rejected.close();

    const authenticated = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await authenticated.addInitScript(credential => { window.Telegram = { WebApp: { initData: credential, ready() {} } }; }, meta.initData);
    const stale = await visit(authenticated, meta.caseId, meta.now + 181000); await watchPanel(stale);
    await check("stale Case cannot arm a new Watch", async () => {
      await panel(stale).getByRole("checkbox").waitFor();
      assert.equal(await panel(stale).getByRole("checkbox").isEnabled(), false);
      assert.equal(await panel(stale).getByRole("button", { name: "WATCH THIS DEPLOYER", exact: true }).isEnabled(), false);
      assert.match(await panel(stale).innerText(), /Updates paused/);
    });
    await stale.setViewportSize({ width: 320, height: 740 });
    await screenshot(stale, "watch-stale-320", 320); await stale.close();
    for (const [name, status, responseBody] of [
      ["unavailable", 503, { error: "PONS_TRIPWIRE_UNAVAILABLE" }],
      ["malformed", 200, { ok: true, watch: { state: "ACTIVE", deployer: meta.deployer } }],
    ]) {
      const adverse = await authenticated.newPage();
      await adverse.route("**/api/pons-tripwire/status", route => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(responseBody) }));
      await adverse.clock.install({ time: new Date(meta.now) });
      await adverse.goto(base + "/bag/" + meta.caseId, { waitUntil: "networkidle" }); await watchPanel(adverse);
      await check(name + " saved status fails closed without invented Watch success", async () => {
        await panel(adverse).getByRole("alert").waitFor();
        assert.equal(await panel(adverse).getByRole("checkbox").count(), 0);
        assert.doesNotMatch(await panel(adverse).innerText(), /Watch saved/);
        await panel(adverse).getByRole("button", { name: "RECHECK SAVED WATCH" }).waitFor();
      });
      await adverse.close();
    }
    const page = await visit(authenticated, meta.caseId, meta.now); await watchPanel(page);
    await check("exact address and explicit future-only opt-in", async () => {
      await panel(page).getByRole("checkbox").waitFor(); assert.match(await panel(page).innerText(), new RegExp(meta.deployer));
      assert.match(await panel(page).innerText(), /Future Pons V2 launches only\. No historical alerts/);
      assert.equal(await panel(page).getByRole("button", { name: "WATCH THIS DEPLOYER", exact: true }).isEnabled(), false);
    });
    await check("lost mutation response leaves success unconfirmed and requires status recheck", async () => {
      await page.route("**/api/pons-tripwire/watch", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "EXPLICIT_OFFLINE_ADVERSE_RESPONSE" }) }));
      await panel(page).getByRole("checkbox").check(); await panel(page).getByRole("button", { name: "WATCH THIS DEPLOYER", exact: true }).click();
      await panel(page).getByRole("button", { name: "RECHECK SAVED WATCH" }).waitFor(); assert.doesNotMatch(await panel(page).innerText(), /Watch saved/);
      await page.unroute("**/api/pons-tripwire/watch"); await panel(page).getByRole("button", { name: "RECHECK SAVED WATCH" }).click();
      await panel(page).getByRole("checkbox").waitFor();
    });
    await screenshot(page, "desktop-opt-in", 1440);
    await panel(page).getByRole("checkbox").check(); await panel(page).getByRole("button", { name: "WATCH THIS DEPLOYER", exact: true }).click();
    await check("actual Worker creates persistent authenticated Watch", async () => { await panel(page).getByRole("button", { name: "CANCEL WATCH" }).waitFor(); assert.match(await panel(page).innerText(), /Watch saved\. Only launches after block/); });
    await control("restart"); await page.reload({ waitUntil: "networkidle" }); await watchPanel(page);
    await check("SQLite Watch survives server restart and frontend reload", async () => { await panel(page).getByRole("button", { name: "CANCEL WATCH" }).waitFor(); assert.match(await panel(page).innerText(), /Watch saved/); });
    for (const [width, height] of [[1440, 900], [390, 844], [320, 740], [430, 932], [1024, 768]]) {
      await page.setViewportSize({ width, height }); await screenshot(page, "watch-saved-" + width, width);
      report.checks.push("saved Watch responsive controls without overflow at " + width + "px");
    }
    await check("historical opened launch never yields a Telegram alert after opt-in", async () => {
      const historical = await control("cycle"); assert.deepEqual(historical.acks, ["ACK"]); assert.equal(historical.deliveries.length, 0);
    });
    await control("advance"); const delivered = await control("cycle"), repeated = await control("cycle");
    await check("real later matching launch produces one mock Telegram notification with exact new Case URL", async () => {
      assert.deepEqual(delivered.acks, ["ACK"]); assert.equal(delivered.deliveries.length, 1);
      const expected = "https://binrat.tech/bag/" + meta.laterCaseId;
      assert.match(delivered.deliveries[0].text, new RegExp(expected)); assert.match(delivered.deliveries[0].text, new RegExp(meta.deployer));
      assert.ok(JSON.stringify(delivered.deliveries[0].reply_markup).includes(expected)); report.mockNotification = delivered.deliveries[0];
    });
    await check("duplicate queue delivery creates no duplicate notification", async () => { assert.deepEqual(repeated.acks, ["ACK"]); assert.equal(repeated.deliveries.length, 1); });
    const returned = await visit(authenticated, meta.laterCaseId, meta.now + 2000);
    await check("notification Case return resolves exact new evidence", async () => {
      await returned.setViewportSize({ width: 390, height: 844 });
      assert.equal(await returned.locator("#vl-case").getAttribute("data-case"), meta.laterCaseId); await tab(returned, "RECEIPTS").click();
      await returned.locator(".vl-receipt summary").click();
      assert.match(await returned.locator("pre").innerText(), new RegExp(meta.laterCaseId)); assert.match(await returned.locator("pre").innerText(), new RegExp(meta.deployer));
      await returned.screenshot({ path: path.join(out, "phone-case-return.png"), fullPage: true });
      await returned.setViewportSize({ width: 1440, height: 900 });
      await returned.screenshot({ path: path.join(out, "desktop-case-return.png"), fullPage: true });
    });
    await tab(returned, "NEXT").click(); await panel(returned).getByRole("button", { name: "CANCEL WATCH" }).waitFor();
    await panel(returned).getByRole("button", { name: "CANCEL WATCH" }).click();
    await check("authenticated cancellation confirms durable state and prevents further alerts", async () => {
      await returned.getByText("Watch cancelled. No new alerts will be prepared. An alert already sending may still arrive.", { exact: true }).waitFor();
      assert.equal((await control("cycle")).deliveries.length, 1);
      await control("restart"); await returned.reload({ waitUntil: "networkidle" }); await watchPanel(returned);
      await returned.getByText("Watch cancelled. No new alerts will be prepared. An alert already sending may still arrive.", { exact: true }).waitFor();
    });
    await screenshot(returned, "watch-cancelled", 1440); await authenticated.close();
    assert.deepEqual(report.errors, []); report.verdict = "PASS";
  } finally { fs.writeFileSync(path.join(out, "browser-proof.json"), JSON.stringify(report, null, 2) + "\n"); await browser.close(); }
})().catch(error => { report.failure = error.stack; fs.writeFileSync(path.join(out, "browser-proof.json"), JSON.stringify(report, null, 2) + "\n"); console.error(error); process.exitCode = 1; });
