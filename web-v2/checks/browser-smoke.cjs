/* BINRAT V2 browser acceptance: isolated preview only, never production.
 * Executed in GitHub Actions with a temporary Playwright install; no lockfile mutation.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4174").replace(/\/$/, "");
const output = path.resolve(__dirname, "../browser-artifacts");
fs.mkdirSync(output, { recursive: true });
const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

async function assertNoHorizontalOverflow(page, label, width) {
  const result = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  assert.ok(
    result.doc <= width + 1 && result.body <= width + 1,
    label + ": horizontal overflow " + JSON.stringify(result),
  );
}

async function ready(page, url) {
  await page.goto(base + url, { waitUntil: "domcontentloaded" });
  await page.locator("main").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const text = document.querySelector("main")?.innerText || "";
    return text.length > 30 && !text.includes("RAT IS CHECKING THE RECEIPTS");
  });
}

async function check(name, fn) {
  try {
    await fn();
    process.stdout.write("PASS " + name + "\n");
  } catch (error) {
    process.stderr.write("FAIL " + name + ": " + (error?.stack || error) + "\n");
    throw error;
  }
}

async function runViewport(browser, viewport) {
  const tag = String(viewport.width);
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__binratCopied = value;
        },
      },
    });
  });
  const page = await context.newPage();
  try {
    await check(tag + "px Home truthful demo and no overflow", async () => {
      await ready(page, "/");
      const home = await page.locator("main").innerText();
      assert.match(home, /REMEMBERS/);
      assert.match(home, /DEMO INDEX RECEIPT \/ NOT CHAIN PROOF/);
      assert.ok(await page.getByText("DETERMINISTIC DEMO DATA").isVisible());
      await assertNoHorizontalOverflow(page, "Home", viewport.width);
      await page.screenshot({ path: path.join(output, "home-" + tag + ".png") });
    });

    await check(tag + "px Radar counts, synthetic proof and object-specific Watch", async () => {
      await ready(page, "/radar");
      const main = await page.locator("main").innerText();
      assert.match(main, /5 DISPLAYED \/ 5 RANKED \/ 414 OBSERVED/);
      assert.match(main, /SYNTHETIC; NOT CHAIN RECEIPTS/);
      assert.equal(await page.locator(".evidence-dossier[aria-live]").count(), 0);
      assert.equal(await page.locator(".evidence-dossier .evidence-receipt a[href]").count(), 0);
      const address = await page.locator(".evidence-dossier .full-address").innerText();
      await page.getByRole("button", { name: "Copy observed recipient address" }).click();
      assert.equal(await page.evaluate(() => window.__binratCopied), address);
      assert.ok(await page.getByRole("button", { name: "Copy observed recipient address" }).getByText("COPIED").isVisible());
      const watch = page.locator(".evidence-dossier .watch-control");
      await watch.click();
      assert.match(await watch.innerText(), /WATCH ARMED/);
      await page.locator(".radar-row").nth(1).click();
      const selectedAddress = await page.locator(".evidence-dossier .full-address").innerText();
      assert.match(new URL(page.url()).pathname, /\/radar\/address\//);
      await page.getByRole("button", { name: "Copy address dossier link" }).click();
      const copied = await page.evaluate(() => window.__binratCopied);
      assert.match(copied, /\/radar\/address\//);
      await ready(page, new URL(copied).pathname);
      assert.equal(await page.locator(".evidence-dossier .full-address").innerText(), selectedAddress);
      assert.doesNotMatch(await page.locator(".evidence-dossier .watch-control").innerText(), /WATCH ARMED/);
      await assertNoHorizontalOverflow(page, "Radar", viewport.width);
      await page.screenshot({ path: path.join(output, "radar-" + tag + ".png") });
    });

    await check(tag + "px Bag, exact Replay and keyboard navigation", async () => {
      await ready(page, "/bag/bag-feral-arc-20418791");
      const content = await page.locator("main").innerText();
      assert.match(content, /DEMO BAG FILE \/ NOT CHAIN PROOF/);
      assert.match(content, /FERAL/);
      const tabs = page.locator('[role="tab"]');
      assert.equal(await tabs.count(), 4);
      assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
      await tabs.nth(0).focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "true");
      assert.equal(await tabs.nth(0).getAttribute("tabindex"), "-1");
      assert.match(await page.locator('[role="tabpanel"]').innerText(), /DEMO \+5m/);
      await page.keyboard.press("End");
      assert.equal(await tabs.nth(3).getAttribute("aria-selected"), "true");
      assert.match(await page.locator('[role="tabpanel"]').innerText(), /NO RECEIPT/);
      await page.keyboard.press("Home");
      assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
      await assertNoHorizontalOverflow(page, "Bag", viewport.width);
      await page.screenshot({ path: path.join(output, "bag-" + tag + ".png") });
    });

    await check(tag + "px shareable Radar URL and explicit unknown address", async () => {
      await ready(page, "/radar");
      await page.locator(".radar-row").nth(2).click();
      const chosen = await page.locator(".evidence-dossier .full-address").innerText();
      assert.equal(new URL(page.url()).pathname.toLowerCase(), ("/radar/address/" + chosen).toLowerCase());
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator(".evidence-dossier .full-address").waitFor();
      assert.equal(await page.locator(".evidence-dossier .full-address").innerText(), chosen);
      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.locator(".evidence-dossier .full-address").waitFor();
      assert.notEqual(await page.locator(".evidence-dossier .full-address").innerText(), chosen);
      await page.goForward({ waitUntil: "domcontentloaded" });
      await page.locator(".evidence-dossier .full-address").waitFor();
      assert.equal(await page.locator(".evidence-dossier .full-address").innerText(), chosen);
      await ready(page, "/radar/address/0x0000000000000000000000000000000000000000");
      assert.match(await page.locator("main").innerText(), /NO MATCHING RADAR ADDRESS/);
    });

    await check(tag + "px Creator File deep link respects source-reported identity", async () => {
      const creator = "0x92f831C7E80cF1B3A2d96d6B6e03d98a21B57A40";
      await ready(page, "/creator/" + creator);
      const txt = await page.locator("main").innerText();
      assert.match(txt, /CREATOR FILE/);
      assert.match(txt, /BAGS? IN CURRENT FEED/);
      assert.match(txt, /REFERENCE ONLY/);
      assert.doesNotMatch(txt, /NO SUCH CREATOR FILE/);
      await assertNoHorizontalOverflow(page, "Creator File", viewport.width);
      await page.screenshot({ path: path.join(output, "creator-" + tag + ".png") });
      await ready(page, "/creator/0x0000000000000000000000000000000000000000");
      assert.match(await page.locator("main").innerText(), /NO SUCH CREATOR FILE/);
    });

    await check(tag + "px all five product destinations replace primary-nav placeholders", async () => {
      const routes = [
        ["/watch", /RAT WATCH/],
        ["/replay", /REPLAY FILES/],
        ["/ledger", /DUMPSTER LEDGER/],
        ["/binrat", /BINRAT STATUS/],
        ["/method", /HOW HE DIGS/],
      ];
      for (const [route, heading] of routes) {
        await ready(page, route);
        const text = await page.locator("main").innerText();
        assert.match(text, heading);
        assert.doesNotMatch(text, /ARCHITECTURE PLACEHOLDER/);
        await assertNoHorizontalOverflow(page, route, viewport.width);
      }
    });

    await check(tag + "px other Bag does not inherit FERAL's staged observations", async () => {
      await ready(page, "/bag/bag-slag-arc-20418502");
      const tabs = page.locator('[role="tab"]');
      await tabs.nth(1).click();
      const readout = await page.locator('[role="tabpanel"]').innerText();
      assert.match(readout, /NO RECEIPT/);
      assert.doesNotMatch(readout, /DEMO \+5m/);
      await assertNoHorizontalOverflow(page, "Second bag", viewport.width);
    });

    await check(tag + "px unknown Bag is checkpoint-bounded and fail-closed", async () => {
      await ready(page, "/bag/does-not-exist");
      const text = await page.locator("main").innerText();
      assert.match(text, /NO MATCHING BAG IN THIS INDEX/);
      assert.match(text, /Nothing else was substituted/);
      assert.doesNotMatch(text, /FERAL|Slag Heap|Green Gunk/);
      assert.equal(new URL(page.url()).pathname, "/bag/does-not-exist");
      await assertNoHorizontalOverflow(page, "Unknown bag", viewport.width);
      await page.screenshot({ path: path.join(output, "unknown-bag-" + tag + ".png") });
    });
    await check(tag + "px malformed client-side Bag URI fails closed without crashing", async () => {
      // The preview HTTP server may reject malformed percent encoding before
      // React boots. Test the application's route parser through history.
      await ready(page, "/");
      await page.evaluate(() => {
        history.pushState({}, "", "/bag/%ZZ");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.locator("main").getByText("NO MATCHING BAG IN THIS INDEX.").waitFor();
      assert.match(await page.locator("main").innerText(), /Nothing else was substituted/);
    });
  } catch (error) {
    await page.screenshot({ path: path.join(output, "failure-" + tag + ".png"), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

async function runMockedLive(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const emptyFeed = {
    schemaVersion: "binrat.public-feed/0.1",
    chainId: 5042,
    asOfBlock: "123",
    historyCoverage: "PARTIAL",
    bags: [],
    receipt: { receiptId: "binrat-public:test-empty" },
  };
  const emptyRadar = {
    schemaVersion: "binrat.rat-radar-watchlist/0.1",
    rankingVersion: "binrat.rat-radar-ranking/0.1",
    chainId: 5042,
    asOfBlock: "123",
    coverage: {
      historyCoverage: "PARTIAL",
      indexedLaunchCount: 0,
      swapReceiptCount: 0,
      acquisitionReceiptCount: 0,
      distinctRecipientAddressCount: 0,
      rankedAddressCount: 0,
      status: "NO_SWAP_EVIDENCE",
    },
    method: {
      evidencedRole: "V3_SWAP_RECIPIENT",
      identityBoundary: "An observed recipient address is not automatically a human trader identity.",
      recommendationBoundary: "Ranking describes observed recurrence and timing; it is not a BUY/SELL recommendation.",
    },
    candidates: [],
    receipt: { receiptId: "binrat-rat-radar:test-empty", evidenceDigest: "test-only" },
  };
  await page.route("**/api/feed", (route) => route.fulfill({ json: emptyFeed }));
  await page.route("**/api/rat-radar/watchlist", (route) => route.fulfill({ json: emptyRadar }));
  try {
    await check("mocked LIVE empty feed/Radar never substitutes demo fixtures", async () => {
      await ready(page, "/?source=live");
      const text = await page.locator("main").innerText();
      assert.match(text, /NO BAGS AT THIS CHECKPOINT/);
      assert.match(text, /NO RADAR SHORTLIST YET/);
      assert.doesNotMatch(text, /FERAL|DEMO \+5m/);
      assert.equal((await page.locator(".demo-flag").innerText()).trim(), "PUBLIC LIVE");
      await ready(page, "/radar?source=live");
      assert.match(await page.locator("main").innerText(), /NO RADAR FILE IN THIS INDEX/);
      await assertNoHorizontalOverflow(page, "Mocked empty Radar", 390);
    });
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    for (const viewport of viewports) await runViewport(browser, viewport);
    await runMockedLive(browser);
    process.stdout.write("BINRAT V2 browser smoke: ALL PASS\n");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write("BINRAT V2 browser smoke FAILED: " + (error?.stack || error) + "\n");
  process.exitCode = 1;
});
