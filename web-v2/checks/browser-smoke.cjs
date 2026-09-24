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
  if (result.doc > width + 1 || result.body > width + 1) {
    const offenders = await page.evaluate(() => [...document.querySelectorAll("main *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.right > innerWidth + 1;
      })
      .slice(0, 12)
      .map((element) => ({
        tag: element.tagName, className: String(element.className).slice(0, 80),
        text: (element.textContent || "").slice(0, 50),
        right: Math.round(element.getBoundingClientRect().right),
        scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
      })));
    assert.fail(label + ": horizontal overflow " + JSON.stringify({ ...result, offenders }));
  }
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
  // The old smoke fixture intentionally skipped receipt/checkpoint fields.
  // LIVE mode now validates the real API contract; use a structurally honest
  // empty response so this test still checks missing evidence, not a schema error.
  const digest = "a".repeat(64);
  const checkpointHash = "0x" + "b".repeat(64);
  const emptyFeed = {
    schemaVersion: "binrat.public-feed/0.1",
    chainId: 5042,
    asOfBlock: "123",
    asOfBlockHash: checkpointHash,
    historyCoverage: "UNVERIFIED",
    bags: [],
    receipt: {
      projectionVersion: "BINRAT_PUBLIC_PROJECTION_V0",
      chainId: 5042,
      asOfBlock: "123",
      asOfBlockHash: checkpointHash,
      historyCoverage: "UNVERIFIED",
      inputDigest: digest,
      outputDigest: digest,
      receiptId: "binrat-public:" + digest,
    },
  };
  const emptyRadar = {
    schemaVersion: "binrat.rat-radar-watchlist/0.1",
    rankingVersion: "binrat.rat-radar-ranking/0.1",
    chainId: 5042,
    asOfBlock: "123",
    coverage: {
      historyCoverage: "UNVERIFIED",
      indexedLaunchCount: 0,
      swapReceiptCount: 0,
      acquisitionReceiptCount: 0,
      distinctRecipientAddressCount: 0,
      rankedAddressCount: 0,
      status: "NO_SWAP_EVIDENCE",
    },
    method: {
      evidencedRole: "V3_SWAP_RECIPIENT",
      freeLimit: 5,
      ordering: [
        "distinctLaunchCount DESC",
        "medianFirstEntryBlockDelta ASC",
        "acquisitionReceiptCount DESC",
        "observedRecipientAddress ASC",
      ],
      identityBoundary: "An observed recipient address is not automatically a human trader identity.",
      recommendationBoundary: "Ranking describes observed recurrence and timing; it is not a BUY/SELL recommendation.",
    },
    candidates: [],
    receipt: { receiptId: "binrat-rat-radar:" + digest, evidenceDigest: digest },
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
      // Native links must preserve LIVE mode on copied/new-tab destinations too.
      assert.match(await page.locator('nav[aria-label="Primary"] a[href*="/dumpster"]').first().getAttribute("href"), /\?source=live$/);
      await ready(page, "/radar?source=live");
      assert.match(await page.locator("main").innerText(), /NO RADAR FILE IN THIS INDEX/);
      await assertNoHorizontalOverflow(page, "Mocked empty Radar", 390);
    });

    await check("mocked LIVE Replay/Ledger are canonical, recurrence 123 stays bounded and unavailable replay fails closed", async () => {
      const id = "1".repeat(64);
      const address = "0x" + "c".repeat(40);
      const token = "0x" + "d".repeat(40);
      const bag = {
        id, source: "ARCPAD", token, symbol: "LIVE", name: "Live bag",
        blockNumber: "100", blockHash: checkpointHash, txHash: checkpointHash,
        logIndex: 0, reportedCreatorAddress: address, pool: token,
        metadata: { imageUri: "", website: "", twitter: "", telegram: "" },
        evidence: [{ state: "OBSERVED", code: "SOURCE_CREATOR", text: "ArcPad reported this address.",
          sourceFactIds: [] }],
        trashTrail: { coverage: "UNVERIFIED", priorLaunchCount: 0, prior: [] },
      };
      const liveFeed = { ...emptyFeed, bags: [bag] };
      const candidate = {
        rank: 1, observedRecipientAddress: token, distinctLaunchCount: 123,
        acquisitionReceiptCount: 99, medianFirstEntryBlockDelta: 1.5,
        earliestFirstEntryBlockDelta: 0, latestSeenBlock: "120",
        reasonCodes: ["RECURRENT_RECIPIENT"], reasons: ["Observed recipient evidence."],
        evidenceActivityIds: [id],
      };
      const liveRadar = {
        ...emptyRadar,
        coverage: {
          ...emptyRadar.coverage, indexedLaunchCount: 189, swapReceiptCount: 200,
          acquisitionReceiptCount: 100, distinctRecipientAddressCount: 485,
          rankedAddressCount: 1, status: "PARTIAL",
        },
        candidates: [candidate],
      };
      const observation = {
        kind: "OBSERVATION", label: "5m", status: "COMPLETE",
        blockNumber: "122", blockHash: checkpointHash,
        targetTimestampMs: 1_700_000_300_000, observedTimestampMs: 1_700_000_300_001,
        evidenceId: "2".repeat(64), evidenceDigest: digest,
      };
      const replay = {
        schemaVersion: "binrat.replay-bundle/0.1",
        projectionVersion: "BINRAT_REPLAY_BUNDLE_V0",
        chainId: 5042, asOfBlock: "123", asOfBlockHash: checkpointHash,
        historyCoverage: "UNVERIFIED",
        canonicalAuthority: {
          chainId: 5042, asOfBlock: "123", asOfBlockHash: checkpointHash,
          sourcePublicReceiptId: "binrat-public:" + digest,
        },
        coverage: { historyCoverage: "UNVERIFIED", observationCoverage: "PARTIAL",
          availableHorizons: ["5m"], missingHorizons: ["1h", "24h"] },
        launch: bag,
        creatorFile: {
          schemaVersion: "binrat.creator-file/0.1", chainId: 5042,
          asOfBlock: "123", historyCoverage: "UNVERIFIED",
          reportedCreatorAddress: address, indexedLaunchCount: 1,
          launches: [{ ...bag, priorLaunchCount: 0 }],
          receipt: { receiptId: "binrat-creator:" + digest, sourcePublicReceiptId: "binrat-public:" + digest },
        },
        intelligence: {
          schemaVersion: "binrat.bag-intelligence/0.1", chainId: 5042,
          asOfBlock: "123", bagId: id, token, reportedCreatorAddress: address,
          observationCoverage: "PARTIAL",
          snapshots: [{
            horizonLabel: "5m", status: "COMPLETE", observationId: observation.evidenceId,
            evidenceDigest: digest, observedBlock: "122", observedBlockHash: checkpointHash,
            targetTimestampMs: observation.targetTimestampMs,
            observedTimestampMs: observation.observedTimestampMs,
          }],
          receipt: { sourcePublicReceiptId: "binrat-public:" + digest,
            observationEvidenceDigests: [digest], receiptId: "binrat-intelligence:" + digest },
        },
        stages: [
          { kind: "LAUNCH", label: "LAUNCH", status: "OBSERVED", blockNumber: "100",
            blockHash: checkpointHash, targetTimestampMs: null, observedTimestampMs: null,
            evidenceId: "binrat-public:" + digest, evidenceDigest: null },
          observation,
        ],
        receipt: {
          projectionVersion: "BINRAT_REPLAY_BUNDLE_V0",
          sourcePublicReceiptId: "binrat-public:" + digest,
          creatorFileReceiptId: "binrat-creator:" + digest,
          intelligenceReceiptId: "binrat-intelligence:" + digest,
          observationEvidenceDigests: [digest], outputDigest: digest,
          receiptId: "binrat-replay:" + digest,
        },
      };
      const ledger = {
        schemaVersion: "binrat.dumpster-ledger/0.1",
        projectionVersion: "BINRAT_DUMPSTER_LEDGER_V0",
        chainId: 5042, accountingState: "PRE_LAUNCH_AUTHORITIES_CONFIGURED",
        tokenState: "NOT_LAUNCHED", launchAuthorization: "BLOCKED",
        marketingAuthorized: false,
        configuredAuthorities: {
          status: "OWNER_SELECTED_PRE_LAUNCH", custodyEvidence: "OWNER_DECLARATION_ONLY",
          onChainRoleProof: "NOT_YET_AVAILABLE",
          launchMechanicsReceiptDigest: "aff37d6d82cced00a34284453c0327bb51e5624b5761b621264f55602e8245e6",
          treasury: { role: "TREASURY", address: "0xab063A9b53a2Ab832a941aE5890ea05c1672339D" },
          projectFeeRecipient: { role: "PROJECT_FEE_RECIPIENT", address: "0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866" },
        },
        fundingAuthority: { status: "PRELAUNCH_AUTHORITIES_CONFIGURED", accountingEnabled: false,
          tokenAddress: null, creatorFeeRecipients: [], treasuryAddresses: [],
          effectiveFromBlock: null, configVersion: null, categoryPolicyVersion: null },
        totals: { entryCount: 0, inflowEntryCount: 0, outflowEntryCount: 0,
          tokenInflowsRaw: "0", tokenOutflowsRaw: "0", byAsset: [] },
        entries: [], coverage: { status: "NO_TOKEN_OBSERVATIONS_AVAILABLE",
          fromBlock: null, throughBlock: null },
        observedDataAvailability: {
          tokenAddress: "NOT_YET_AVAILABLE", launchBlock: "NOT_YET_AVAILABLE",
          launchTransaction: "NOT_YET_AVAILABLE", tokenRelatedInflows: "NOT_YET_AVAILABLE",
          tokenRelatedOutflows: "NOT_YET_AVAILABLE",
        },
        utilityStatus: { source: "CAPABILITY_MANIFEST", shipped: [], building: [], planned: [] },
        awaitingCanonicalAuthority: ["TOKEN_CONTRACT_ADDRESS"],
        explanation: "BINRAT is not launched. Production accounting is disabled.",
        evidenceBoundary: "Zero entries are not a zero balance.",
        receipt: { manifestDigest: digest, entryEvidenceDigests: [], outputDigest: digest,
          receiptId: "binrat-dumpster-ledger:" + digest },
      };
      await page.unroute("**/api/feed");
      await page.unroute("**/api/rat-radar/watchlist");
      await page.route("**/api/feed", (route) => route.fulfill({ json: liveFeed }));
      await page.route("**/api/rat-radar/watchlist", (route) => route.fulfill({ json: liveRadar }));
      await page.route("**/api/bag/**/replay", (route) => route.fulfill({ json: replay }));
      await page.route("**/api/dumpster-ledger", (route) => route.fulfill({ json: ledger }));

      await ready(page, "/radar?source=live");
      assert.equal(await page.locator(".evidence-dossier .recurrence-marks i").count(), 8);
      assert.match(await page.locator(".evidence-dossier .recurrence-marks").innerText(), /123 TOTAL/);
      assert.doesNotMatch(await page.locator(".evidence-dossier").innerText(), /WATCH ARMED/);
      await assertNoHorizontalOverflow(page, "Live Radar recurrence 123", 390);

      await ready(page, "/bag/" + id + "?source=live");
      await page.locator(".replay-proof-meta .checkpoint-rail").waitFor();
      const tabs = page.locator('[role="tab"]');
      await tabs.nth(1).click();
      assert.match(await page.locator('[role="tabpanel"]').innerText(), /OBSERVED BLOCK 122/);
      await tabs.nth(2).click();
      assert.match(await page.locator('[role="tabpanel"]').innerText(), /NO OBSERVATION RECEIPT/);
      assert.doesNotMatch(await page.locator("main").innerText(), /DEMO \+5m/);
      await assertNoHorizontalOverflow(page, "Live Replay", 390);
      await page.screenshot({ path: path.join(output, "mock-live-replay-390.png") });

      await ready(page, "/ledger?source=live");
      await page.getByText("CANONICAL PRE-LAUNCH LEDGER RECEIPT").waitFor();
      const text = await page.locator("main").innerText();
      assert.match(text, /PRODUCTION ACCOUNTING IS DISABLED/);
      assert.match(text, /NOT_LAUNCHED/);
      assert.match(text, /not a zero balance/i);
      await assertNoHorizontalOverflow(page, "Live prelaunch Ledger", 390);
      await page.screenshot({ path: path.join(output, "mock-live-ledger-390.png") });

      // Live authority values are longer than DEMO labels: verify the badge
      // itself stays within its card, as well as the entire narrow viewport.
      await page.setViewportSize({ width: 320, height: 700 });
      const badgeBounds = await page.locator(".route-card > .case-tab.orange").first()
        .evaluate((badge) => {
          const badgeRect = badge.getBoundingClientRect();
          const cardRect = badge.closest(".route-card").getBoundingClientRect();
          return { badgeRight: badgeRect.right, cardRight: cardRect.right };
        });
      assert.ok(badgeBounds.badgeRight <= badgeBounds.cardRight + 1,
        "Live Ledger status badge must wrap within its card: " + JSON.stringify(badgeBounds));
      await assertNoHorizontalOverflow(page, "Live prelaunch Ledger narrow phone", 320);
      await page.screenshot({ path: path.join(output, "mock-live-ledger-320.png") });
      await page.setViewportSize({ width: 390, height: 844 });

      await page.unroute("**/api/bag/**/replay");
      await page.route("**/api/bag/**/replay", (route) =>
        route.fulfill({ status: 503, json: { error: "temporarily unavailable" } }));
      await ready(page, "/bag/" + id + "?source=live");
      await page.locator(".replay-proof-meta [role=alert]").waitFor();
      const errorText = await page.locator("main").innerText();
      assert.match(errorText, /REPLAY UNAVAILABLE/);
      assert.match(errorText, /NO VALIDATED REPLAY STAGE/);
      assert.doesNotMatch(errorText, /OBSERVED BLOCK 122/);
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
