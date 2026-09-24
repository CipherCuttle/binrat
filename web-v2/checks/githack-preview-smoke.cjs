/** Static GitHack V2 preview acceptance against explicitly mocked public endpoint responses. */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4175").replace(/\/$/, "");
const api = "https://binrat-journey-preview.pettevik.workers.dev";
const digest = "d".repeat(64);
const hash = "0x" + "a".repeat(64);
const emptyFeed = {
  schemaVersion: "binrat.public-feed/0.1", chainId: 5042, asOfBlock: "120",
  asOfBlockHash: hash, historyCoverage: "UNVERIFIED", bags: [],
  receipt: { projectionVersion: "BINRAT_PUBLIC_PROJECTION_V0", chainId: 5042,
    asOfBlock: "120", asOfBlockHash: hash, historyCoverage: "UNVERIFIED",
    inputDigest: digest, outputDigest: digest, receiptId: "binrat-public:" + digest },
};
const emptyRadar = {
  schemaVersion: "binrat.rat-radar-watchlist/0.1",
  rankingVersion: "binrat.rat-radar-ranking/0.1", chainId: 5042, asOfBlock: "121",
  coverage: { historyCoverage: "UNVERIFIED", indexedLaunchCount: 0,
    swapReceiptCount: 0, acquisitionReceiptCount: 0,
    distinctRecipientAddressCount: 0, rankedAddressCount: 0, status: "NO_SWAP_EVIDENCE" },
  method: {
    evidencedRole: "V3_SWAP_RECIPIENT", freeLimit: 5,
    ordering: ["distinctLaunchCount DESC", "medianFirstEntryBlockDelta ASC",
      "acquisitionReceiptCount DESC", "observedRecipientAddress ASC"],
    identityBoundary: "An observed recipient address is not automatically a human trader identity.",
    recommendationBoundary: "Ranking describes recurrence, not a BUY/SELL recommendation.",
  },
  candidates: [],
  receipt: { receiptId: "binrat-rat-radar:" + digest, evidenceDigest: digest },
};
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on("pageerror", error => console.error("GITHACK_PAGE_ERROR", error.message));
      page.on("console", message => { if (message.type() === "error") console.error("GITHACK_CONSOLE_ERROR", message.text()); });
      page.on("requestfailed", request => console.error("GITHACK_REQUEST_FAILED", request.url(), request.failure()?.errorText));

      let requests = [];
      await page.route(api + "/api/**", async (route) => {
        const url = route.request().url();
        requests.push({ method: route.request().method(), url });
        const body = url.endsWith("/api/feed") ? emptyFeed :
          url.endsWith("/api/rat-radar/watchlist") ? emptyRadar : null;
        return route.fulfill({ status: body ? 200 : 503,
          headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
          body: JSON.stringify(body ?? { error: "UNAVAILABLE" }) });
      });
      try {
        await page.goto(base + "/index.html#/radar", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        console.log("GITHACK_BOOT_DIAG", JSON.stringify({
          url:page.url(), body:(await page.locator("body").innerText()).slice(0,1200),
          scriptUrls:await page.locator("script[src]").evaluateAll(xs=>xs.map(x=>x.getAttribute("src"))),
          images:await page.locator("img").count(),
        }));
        await page.getByRole("heading", { name: /RAT RADAR/ }).first().waitFor({ timeout: 8000 });
        assert.equal(requests.length, 0, "DEMO must not request live API");
        const toggle = page.getByRole("link", { name: "Switch to public LIVE evidence" });
        assert.equal(new URL(await toggle.getAttribute("href"), base).search, "?source=live");
        await toggle.click();
        await page.getByText(/NO RADAR FILE IN THIS INDEX|NO MATCHING RADAR|NO RADAR SHORTLIST/i).first().waitFor();
        assert.ok(requests.some(x => x.url === api + "/api/feed"));
        assert.ok(requests.some(x => x.url === api + "/api/rat-radar/watchlist"));
        assert.ok(requests.every(x => x.method === "GET"));
        assert.equal(new URL(page.url()).hash, "#/radar");
        const nav = page.getByRole("navigation", { name: width < 721 ? "Mobile primary navigation" : "Primary" });
        await nav.getByRole("link", { name: /DUMPSTER|Discover/i }).first().click();
        assert.equal(new URL(page.url()).hash, width < 721 ? "#/" : "#/dumpster");
        await page.goBack({ waitUntil: "domcontentloaded" });
        assert.equal(new URL(page.url()).hash, "#/radar");
        const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(docWidth <= width + 1, width + "px horizontal overflow: " + docWidth);
        console.log("GITHACK_STATIC_PREVIEW_PASS", { width, requests: requests.length, url: page.url() });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error("GITHACK_STATIC_PREVIEW_FAILED", error); process.exitCode = 1; });
