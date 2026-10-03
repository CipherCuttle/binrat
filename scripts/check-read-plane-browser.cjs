const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = process.env.BINRAT_FRONTDOOR_URL ?? "http://127.0.0.1:4173";
const launchId = "a".repeat(64);
const token = `0x${"1".repeat(40)}`;
const deployer = `0x${"2".repeat(40)}`;
const hash = `0x${"3".repeat(64)}`;
const status = (block, digest, state = "FRESH_VERIFIED") => ({
  schemaVersion: "binrat.public-status/0.1", chainId: 4663, state,
  checkpointBlock: String(block), checkpointBlockHash: hash, feedDigest: digest,
  verifiedAtMs: 1, runtimeUpdatedAtMs: 2, lastSyncError: null,
});
const feed = (block, symbol) => ({
  schemaVersion: "binrat.latest-launches/0.1", chainId: 4663,
  historyCoverage: "PARTIAL", sourceCheckpoint: String(block),
  launches: [{
    launchId, token, txHash: hash, deployer, blockNumber: String(block),
    symbol, name: `${symbol} receipt`, priorLaunchCount: 1, factId: `fact-${symbol}`,
    metadata: { imageUri: "", website: "", twitter: "", telegram: "" },
  }],
});
const waitForApiRequest = (page, pathname) => page.waitForRequest((request) => new URL(request.url()).pathname === pathname);

async function newLivePage(browser, { failInitial = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.clock.install();
  const counts = { feed: 0, status: 0, creator: 0 };
  const feedQueue = [feed(100, "A")];
  const statusQueue = [status(100, "digest-1")];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/launches/latest") {
      counts.feed += 1;
      const failThisRequest = failInitial && counts.feed === 1;
      const body = failThisRequest ? { schemaVersion: "invalid" } : feedQueue.shift() ?? { schemaVersion: "invalid" };
      await route.fulfill({ status: failThisRequest ? 503 : 200, contentType: "application/json", body: JSON.stringify(body) });
    } else if (url.pathname === "/api/status") {
      counts.status += 1;
      const next = statusQueue.shift() ?? status(100, "digest-1");
      if (next === "timeout") return route.abort("timedout");
      await route.fulfill({ status: next.http ?? 200, contentType: "application/json", body: JSON.stringify(next.value ?? next) });
    } else if (url.pathname.startsWith("/api/creator/")) {
      counts.creator += 1;
      await route.fulfill({ status: 503, body: "temporarily unavailable" });
    } else {
      await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    }
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  if (!failInitial) await page.locator(`[data-bag-id="${launchId}"]`).waitFor();
  return { context, page, counts, statusQueue, feedQueue };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
  });
  try {
    const h = await newLivePage(browser);
    const { page, counts, statusQueue, feedQueue } = h;
    await page.waitForFunction(() => document.body.dataset.readState === "FRESH_VERIFIED");
    await page.waitForFunction(() => document.querySelector("#token-public-state")?.innerText === "TOKEN STATE REQUIRES VERIFIED PUBLICATION");
    assert.equal(await page.locator("body").getAttribute("data-read-state"), "FRESH_VERIFIED");
    assert.equal(await page.locator("#token-public-state").innerText(), "TOKEN STATE REQUIRES VERIFIED PUBLICATION");
    for (let i = 0; i < 3; i += 1) {
      const request = waitForApiRequest(page, "/api/status");
      const response = page.waitForResponse((value) => new URL(value.url()).pathname === "/api/status");
      await page.clock.fastForward(15_000);
      await Promise.all([request, response]);
      await page.clock.runFor(1);
    }
    assert.equal(counts.feed, 1, "unchanged status digests must not refetch the feed");
    assert.equal(counts.creator, 1, "unchanged status digests must not refetch creator proof");
    await page.locator("#bag-search").fill(token);
    assert.equal(await page.locator("#bag-search").inputValue(), token, "filter is set before refresh");
    await page.locator(`[data-bag-id="${launchId}"]`).click();
    assert.equal(await page.locator("#drawer").getAttribute("class").then((value) => value.includes("open")), true);

    statusQueue.push({ http: 503, value: {} });
    const firstRefresh = waitForApiRequest(page, "/api/status");
    await page.clock.fastForward(15_000);
    await firstRefresh;
    await page.getByText(/REFRESH DEGRADED · SHOWING LAST VERIFIED DATA/).waitFor();
    assert.equal(await page.locator("body").getAttribute("data-read-state"), "STALE_VERIFIED");
    assert.equal(await page.locator("#drawer").getAttribute("class").then((value) => value.includes("open")), true);
    assert.equal(await page.locator("#bag-search").inputValue(), token);
    assert.equal(await page.locator("#token-public-state").innerText(), "TOKEN STATE REQUIRES VERIFIED PUBLICATION");
    assert.equal(counts.feed, 1, "status 503 must not refetch feed");

    statusQueue.push("timeout");
    const timeoutRefresh = page.waitForEvent("requestfailed", (request) => new URL(request.url()).pathname === "/api/status");
    await page.clock.fastForward(15_000);
    await timeoutRefresh;
    await page.waitForFunction(() => document.body.dataset.readState === "STALE_VERIFIED");
    feedQueue.push({ schemaVersion: "malformed", launches: [] });
    statusQueue.push(status(101, "digest-2"));
    const invalidRefresh = waitForApiRequest(page, "/api/launches/latest");
    await page.clock.fastForward(30_000);
    await invalidRefresh;
    await page.waitForFunction(() => document.body.dataset.readState === "STALE_VERIFIED");
    assert.equal(counts.feed, 2, "changed digest gets one feed refresh; stale copy remains after invalid refresh");
    assert.equal(await page.locator(".token-symbol").innerText(), "A");

    // Force a valid recovery for the same changed digest after the malformed payload.
    feedQueue.push(feed(101, "B"));
    statusQueue.push(status(101, "digest-2"));
    const recovery = waitForApiRequest(page, "/api/launches/latest");
    await page.clock.fastForward(60_000);
    await recovery;
    await page.waitForFunction(() => document.body.dataset.readState === "FRESH_VERIFIED");
    assert.equal(await page.locator(".token-symbol").innerText(), "B");
    await page.waitForFunction(() => document.querySelector("#frontdoor-proof")?.innerText.includes("PRIOR PROJECT NAMES TEMPORARILY UNAVAILABLE"));
    assert.equal(counts.creator, 3, "initial proof, drawer file, and changed-snapshot proof only");

    const beforeHidden = counts.status;
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.fastForward(240_000);
    assert.equal(counts.status, beforeHidden, "hidden tab must pause polling");
    await h.context.close();

    const empty = await newLivePage(browser, { failInitial: true });
    await empty.page.waitForFunction(() => document.body.dataset.readState === "UNAVAILABLE_NO_DATA");
    assert.equal(await empty.page.locator("[data-bag-id]").count(), 0);
    assert.match(await empty.page.locator("#garbage-grid").innerText(), /DUMPSTER DATA UNAVAILABLE[\s\S]*LIVE INDEX NOT AVAILABLE/);
    await empty.page.locator("#retry-read-plane").click();
    await empty.page.waitForFunction(() => document.body.dataset.readState === "FRESH_VERIFIED");
    assert.equal(await empty.page.locator(".token-symbol").innerText(), "A");
    await empty.context.close();
  } finally {
    await browser.close();
  }
  console.log("BINRAT public read-plane browser resilience: PASS");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
