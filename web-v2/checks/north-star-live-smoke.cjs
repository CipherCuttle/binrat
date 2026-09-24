/* G2 browser acceptance. Mocked truthful LIVE contracts; never a production write. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4174").replace(/\/$/, "");
const output = path.resolve(__dirname, "../browser-artifacts/north-star-g2");
fs.mkdirSync(output, { recursive: true });
const a = "0x" + "a".repeat(40), b = "0x" + "b".repeat(40);
const token = "0x" + "c".repeat(40), quote = "0x" + "d".repeat(40);
const hash = "0x" + "f".repeat(64), id = "1".repeat(64), digest = "3".repeat(64);
const feed = {
  schemaVersion: "binrat.public-feed/0.1", chainId: 5042, asOfBlock: "120",
  asOfBlockHash: hash, historyCoverage: "UNVERIFIED", bags: [],
  receipt: { projectionVersion: "BINRAT_PUBLIC_PROJECTION_V0", chainId: 5042,
    asOfBlock: "120", asOfBlockHash: hash, historyCoverage: "UNVERIFIED",
    inputDigest: digest, outputDigest: digest, receiptId: "binrat-public:" + digest },
};
const radar = {
  schemaVersion: "binrat.rat-radar-watchlist/0.1", rankingVersion: "binrat.rat-radar-ranking/0.1",
  chainId: 5042, asOfBlock: "121",
  coverage: { historyCoverage: "UNVERIFIED", indexedLaunchCount: 4, swapReceiptCount: 5,
    acquisitionReceiptCount: 3, distinctRecipientAddressCount: 3, rankedAddressCount: 1, status: "PARTIAL" },
  method: { evidencedRole: "V3_SWAP_RECIPIENT", freeLimit: 5,
    ordering: ["distinctLaunchCount DESC", "medianFirstEntryBlockDelta ASC",
      "acquisitionReceiptCount DESC", "observedRecipientAddress ASC"],
    identityBoundary: "An observed recipient address is not automatically a human trader identity.",
    recommendationBoundary: "Ranking describes recurrence, not a BUY/SELL recommendation." },
  candidates: [{ rank: 1, observedRecipientAddress: a, distinctLaunchCount: 2,
    acquisitionReceiptCount: 2, medianFirstEntryBlockDelta: 1.5,
    earliestFirstEntryBlockDelta: 0, latestSeenBlock: "119",
    reasonCodes: ["RECURRENT_RECIPIENT_ACROSS_LAUNCHES"],
    reasons: ["Observed across two indexed launches."], evidenceActivityIds: [id] }],
  receipt: { receiptId: "binrat-rat-radar:" + digest, evidenceDigest: digest },
};
function activity(address, empty = false) {
  return {
    schemaVersion: "binrat.rat-radar-address-activity/0.1", chainId: 5042, asOfBlock: "130",
    observedRecipientAddress: address, activityCount: empty ? 0 : 1,
    identityBoundary: "An observed recipient address is not automatically a human trader identity.",
    activities: empty ? [] : [{
      schemaVersion: "binrat.rat-radar-activity/0.1", version: "binrat.rat-radar-swap/0.1",
      activityId: id, chainId: 5042, launchId: "2".repeat(64),
      pool: quote, token, token0: token, token1: quote, blockNumber: "125",
      blockHash: hash, txHash: hash, logIndex: 0, sender: b, recipient: address,
      tokenSide: "TOKEN0", amount0: "-42", amount1: "15",
      sqrtPriceX96: "123", liquidity: "456", tick: -10,
      launchedTokenDelta: "-42", launchedTokenFlow: "POOL_TO_RECIPIENT",
      evidenceDigest: digest,
      identityBoundary: "sender and recipient are evidenced protocol roles, not inferred human identities",
    }],
  };
}
async function noOverflow(page, width, label) {
  const size = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth, body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  assert.ok(size.html <= width + 1 && size.body <= width + 1, label + " " + JSON.stringify(size));
}
async function probe(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true, value: { writeText: async value => { window.__lastCopy = value; } },
    });
  });
  const page = await ctx.newPage();
  let feedFail = true, radarFail = false, recipientFail = false, recipientEmpty = false, activityFetches = 0;
  await page.route("**/api/feed", route => feedFail
    ? route.fulfill({ status: 503, json: { error: "FEED_DOWN" } })
    : route.fulfill({ json: feed }));
  await page.route("**/api/rat-radar/watchlist", route => radarFail
    ? route.fulfill({ status: 503, json: { error: "RADAR_DOWN" } })
    : route.fulfill({ json: radar }));
  await page.route("**/api/rat-radar/address/**/activity", route => {
    activityFetches++;
    const url = new URL(route.request().url());
    const address = decodeURIComponent(url.pathname.split("/").at(-2));
    return recipientFail ? route.fulfill({ status: 503, json: { error: "ACTIVITY_DOWN" } })
      : route.fulfill({ json: activity(address, recipientEmpty) });
  });
  try {
    // The independent Radar and activity work even if Feed has failed.
    await page.goto(origin + "/radar/address/" + a + "?source=live", { waitUntil: "domcontentloaded" });
    const panel = page.locator(".ns-recipient");
    await panel.getByRole("button", { name: /ID · BLOCK 125/ }).waitFor();
    const text = await panel.innerText();
    assert.match(text, /SHORTLIST CHECKPOINT 121/);
    assert.match(text, /ACTIVITY AS OF BLOCK\s*130/);
    assert.match(text, /INDEXED ACTIVITIES\s*1/);
    assert.doesNotMatch(text, /DEMO SHORTLIST|SYNTHETIC SHORTLIST/);
    await panel.locator(".ns-activity-row").click();
    await panel.getByText("ACTIVITY EVIDENCE").waitFor();
    const raw = page.locator(".ns-raw-link");
    assert.equal(await raw.getAttribute("href"), "/api/rat-radar/activity/" + id);
    await panel.getByRole("button", { name: "Copy evidence digest" }).click();
    assert.equal(await page.evaluate(() => window.__lastCopy), digest);
    await noOverflow(page, width, "exact ranked activity");
    await page.screenshot({ path: path.join(output, "activity-" + width + ".png"), fullPage: true, animations: "disabled" });
    console.log("PASS G2 " + width + "px exact ranked receipt / separate checkpoints / copy / source");
    await page.goto(origin + "/?source=live", { waitUntil: "domcontentloaded" });
    await page.getByText(/PUBLIC FEED UNAVAILABLE/).waitFor();
    assert.match(await page.locator("main").innerText(), /distinct indexed launches/);
    assert.doesNotMatch(await page.locator("main").innerText(), /FERAL|DEMO INDEX RECEIPT/);
    await page.goto(origin + "/dumpster?source=live", { waitUntil: "domcontentloaded" });
    assert.match(await page.locator("main").innerText(), /FEED UNAVAILABLE/);
    console.log("PASS G2 " + width + "px independent Radar survives Feed failure");
    // Outside a five-entry shortlist must not receive a fabricated rank or another recipient's receipts.
    feedFail = false;
    await page.goto(origin + "/radar/address/" + b + "?source=live", { waitUntil: "domcontentloaded" });
    await page.locator(".ns-activity-row").waitFor();
    assert.match(await page.locator(".ns-recipient").innerText(), new RegExp(b, "i"));
    assert.doesNotMatch(await page.locator(".ns-recipient").innerText(), new RegExp(a, "i"));
    if (width > 720) assert.match(await page.locator("main").innerText(), /ADDRESS OUTSIDE PUBLIC SHORTLIST/);
    await noOverflow(page, width, "out-of-shortlist activity");
    recipientEmpty = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(/indexed empty result at block 130/).waitFor();
    assert.equal(await page.locator(".ns-activity-row").count(), 0);
    recipientEmpty = false; recipientFail = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".ns-recipient").getByRole("alert").waitFor();
    assert.match(await page.locator(".ns-recipient").innerText(), /ACTIVITY UNAVAILABLE/);
    assert.doesNotMatch(await page.locator(".ns-recipient").innerText(), /INDEXED ACTIVITIES\s*0/);
    recipientFail = false; radarFail = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".ns-activity-row").waitFor();
    assert.match(await page.locator(".ns-recipient").innerText(), new RegExp(b, "i"));
    assert.doesNotMatch(await page.locator("main").innerText(), /distinct indexed launches share/);
    console.log("PASS G2 " + width + "px deep link / empty / 503 / shortlist failure");
    const before = activityFetches;
    await page.goto(origin + "/radar", { waitUntil: "domcontentloaded" });
    await page.locator(".ns-recipient").waitFor();
    assert.equal(activityFetches, before, "DEMO must never fetch LIVE recipient activity");
    assert.match(await page.locator(".ns-recipient").innerText(), /SYNTHETIC SHORTLIST/);
    await noOverflow(page, width, "demo Radar");
    console.log("PASS G2 " + width + "px DEMO boundary and reduced-motion layout");
  } catch (err) {
    await page.screenshot({ path: path.join(output, "FAIL-" + width + ".png"), fullPage: true }).catch(() => {});
    throw err;
  } finally { await ctx.close(); }
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    for (const [width, height] of [[320, 720], [390, 844], [1024, 768]]) await probe(browser, width, height);
    console.log("BINRAT G2 mocked LIVE browser smoke: ALL PASS");
  } finally { await browser.close(); }
})().catch(err => { console.error("G2 browser smoke FAILED:", err); process.exitCode = 1; });
