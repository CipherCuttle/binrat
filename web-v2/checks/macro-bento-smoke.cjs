/* P0 macro-bento isolated experiment. Real Chromium screenshots and independent read-plane fixtures.
 * LIVE fixture screenshots are labelled as mocked contract responses, never real network observations. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const origin = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4174").replace(/\/$/, "");
const output = path.resolve(__dirname, "../browser-artifacts/macro-bento");
fs.mkdirSync(output, { recursive: true });
const address = "0x" + "a".repeat(40), second = "0x" + "b".repeat(40);
const hash = "0x" + "f".repeat(64), digest = "3".repeat(64), activity = "1".repeat(64);
const feed = {
  schemaVersion: "binrat.public-feed/0.1", chainId: 5042, asOfBlock: "120", asOfBlockHash: hash,
  historyCoverage: "UNVERIFIED", bags: [],
  receipt: { projectionVersion: "BINRAT_PUBLIC_PROJECTION_V0", chainId: 5042,
    asOfBlock: "120", asOfBlockHash: hash, historyCoverage: "UNVERIFIED",
    inputDigest: digest, outputDigest: digest, receiptId: "binrat-public:" + digest },
};
const radar = {
  schemaVersion: "binrat.rat-radar-watchlist/0.1", rankingVersion: "binrat.rat-radar-ranking/0.1",
  chainId: 5042, asOfBlock: "121",
  coverage: { historyCoverage: "UNVERIFIED", indexedLaunchCount: 4, swapReceiptCount: 5,
    acquisitionReceiptCount: 3, distinctRecipientAddressCount: 3, rankedAddressCount: 2, status: "PARTIAL" },
  method: { evidencedRole: "V3_SWAP_RECIPIENT", freeLimit: 5,
    ordering: ["distinctLaunchCount DESC", "medianFirstEntryBlockDelta ASC",
      "acquisitionReceiptCount DESC", "observedRecipientAddress ASC"],
    identityBoundary: "An observed recipient address is not automatically a human trader identity.",
    recommendationBoundary: "Ranking describes recurrence, not a BUY/SELL recommendation." },
  candidates: [
    { rank: 1, observedRecipientAddress: address, distinctLaunchCount: 2,
      acquisitionReceiptCount: 2, medianFirstEntryBlockDelta: 1.5,
      earliestFirstEntryBlockDelta: 0, latestSeenBlock: "119",
      reasonCodes: ["RECURRENT_RECIPIENT_ACROSS_LAUNCHES"],
      reasons: ["Observed across two launches."], evidenceActivityIds: [activity] },
    { rank: 2, observedRecipientAddress: second, distinctLaunchCount: 1,
      acquisitionReceiptCount: 1, medianFirstEntryBlockDelta: 3,
      earliestFirstEntryBlockDelta: 3, latestSeenBlock: "118",
      reasonCodes: ["OBSERVED_RECIPIENT"],
      reasons: ["Observed in one launch."], evidenceActivityIds: [] },
  ],
  receipt: { receiptId: "binrat-rat-radar:" + digest, evidenceDigest: digest },
};
const healthy = () => ({ ok:true, chainId:5042, indexReady:true, checkpointBlock:"122",
  launchCount:4, runtimeFresh:true, runtimeUpdatedAtMs:Date.now()-30_000,
  historyBackfillComplete:false, observationReady:true, lastSyncError:null });
const sizes = [[320,720],[360,800],[390,844],[430,932],[768,900],[1024,768],[1440,900],[1672,941]];
const url = (mode = "live") => origin + "/?experiment=macro-bento" + (mode === "live" ? "&source=live" : "");
function fixtures(page, state) {
  page.route("**/api/health", route => {
    state.healthRequests++;
    return route.fulfill({ status:state.healthStatus ?? 200, json:state.healthPayload ?? healthy() });
  });
  page.route("**/api/feed", route => route.fulfill({ status:state.feedStatus ?? 200, json:state.feedPayload ?? feed }));
  page.route("**/api/rat-radar/watchlist", route => route.fulfill({ status:state.radarStatus ?? 200, json:state.radarPayload ?? radar }));
}
async function ready(page) { await page.getByTestId("macro-bento-home").waitFor(); }
async function noOverflow(page, width) {
  const geometry = await page.evaluate(() => ({
    root:document.documentElement.scrollWidth, body:document.body.scrollWidth,
    viewport:document.documentElement.clientWidth,
  }));
  assert.ok(geometry.root <= width + 1 && geometry.body <= width + 1,
    "Horizontal overflow " + width + ": " + JSON.stringify(geometry));
}
async function imagesReady(page) {
  await page.locator("img").evaluateAll(images => Promise.all(images.map(image =>
    image.complete ? undefined : new Promise(resolve => { image.onload=resolve; image.onerror=resolve; }))));
  const missing = await page.locator("img").evaluateAll(images => images.filter(img => !img.naturalWidth).map(img => img.src));
  assert.deepEqual(missing, [], "Source-backed G0 assets must actually load");
}
async function snapshot(browser, width, height, mode) {
  const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:"reduce"});
  const page = await context.newPage();
  const state = { healthRequests:0 };
  fixtures(page,state);
  try {
    await page.goto(url(mode),{waitUntil:"domcontentloaded"});
    await ready(page);
    if (mode === "live") await page.getByTestId("macro-health-state").getByText("READY").waitFor();
    await imagesReady(page);
    await noOverflow(page,width);
    assert.equal(await page.getByTestId("macro-bento-home").getAttribute("data-source-mode"),
      mode === "live" ? "LIVE" : "DEMO");
    assert.ok(await page.getByRole("link",{name:/EXPLORE RAT RADAR/}).isVisible(),"primary CTA in DOM");
    if (width <= 720) {
      assert.ok(await page.getByRole("navigation",{name:"Mobile primary navigation"}).isVisible());
      const rect = await page.getByRole("link",{name:/EXPLORE RAT RADAR/}).boundingBox();
      assert.ok(rect && rect.y < height, "Phone primary CTA must appear in first viewport");
    }
    await page.screenshot({path:path.join(output,mode + "-"+width+"x"+height+"-firstview.png"),animations:"disabled"});
    await page.screenshot({path:path.join(output,mode + "-"+width+"x"+height+"-full.png"),fullPage:true,animations:"disabled"});
    if (mode === "demo") assert.equal(state.healthRequests,0,"DEMO never requests live health");
    console.log("SCREENSHOT PASS", mode,width,height,"no overflow; G0 images loaded");
  } catch(error) {
    await page.screenshot({path:path.join(output,"FAIL-"+mode+"-"+width+".png"),fullPage:true}).catch(()=>{});
    throw error;
  } finally { await context.close(); }
}
async function contractualChecks(browser) {
  const ctx = await browser.newContext({viewport:{width:1440,height:900},reducedMotion:"reduce"});
  const page = await ctx.newPage();
  const state = {healthRequests:0};
  fixtures(page,state);
  async function visit() { await page.goto(url(),{waitUntil:"domcontentloaded"}); await ready(page); }
  try {
    await visit();
    await page.getByTestId("macro-health-state").getByText("READY").waitFor();
    const text = await page.getByTestId("macro-bento-home").innerText();
    assert.equal(await page.getByTestId("macro-launch-count").innerText(),"4","health total != feed response length");
    assert.match(text,/Feed as-of block 120/);
    assert.match(text,/Radar as-of block 121/);
    assert.match(text,/DIFFERENT CHECKPOINTS/);
    assert.match(text,/3\s+observed recipient addresses/);
    assert.match(text,/UNVERIFIED/);
    const first = page.getByRole("link",{name:"Open evidence for observed recipient "+address});
    assert.match(await first.getAttribute("href"),new RegExp("/radar/address/"+address,"i"));
    await page.getByRole("button",{name:/REPEAT RECIPIENTS/}).click();
    assert.equal(await page.getByRole("link",{name:/Open evidence for observed recipient/}).count(),1);
    await first.click();
    assert.ok(new URL(page.url()).pathname.endsWith("/radar/address/"+address),"real route navigation");
    await page.goto(url("demo"),{waitUntil:"domcontentloaded"});
    await ready(page);
    assert.match(await page.locator("main").innerText(),/DETERMINISTIC DEMO/);
    assert.ok((await page.getByRole("link",{name:/SWITCH TO LIVE/}).getAttribute("href")).includes("experiment=macro-bento"));
    await page.getByRole("link",{name:/SWITCH TO LIVE/}).click();
    await ready(page);
    assert.equal(await page.getByTestId("macro-bento-home").getAttribute("data-source-mode"),"LIVE");
    console.log("PASS health-derived launch total; independent checkpoints; filter; real route; source switch");
    state.healthPayload = {...healthy(),ok:false,indexReady:false};
    await visit(); await page.getByTestId("macro-health-state").getByText("NOT READY").waitFor();
    assert.equal(await page.getByTestId("macro-launch-count").innerText(),"—");
    state.healthPayload = {...healthy(),ok:false,indexReady:false,runtimeFresh:false};
    await visit(); await page.getByTestId("macro-health-state").getByText("STALE").waitFor();
    state.healthPayload = {...healthy(),ok:false,indexReady:false,checkpointBlock:null,runtimeUpdatedAtMs:null};
    state.feedStatus=503; state.radarStatus=200;
    await visit(); await page.getByText(/FEED UNAVAILABLE \/ PUBLIC_READ_PLANE_UNAVAILABLE/).waitFor();
    assert.match(await page.getByTestId("macro-bento-home").innerText(),/3\s+observed recipient addresses/);
    state.feedStatus=200; state.radarStatus=503;
    await visit(); await page.getByText(/RADAR UNAVAILABLE \/ RAT_RADAR_UNAVAILABLE/).waitFor();
    assert.match(await page.getByTestId("macro-bento-home").innerText(),/0\s+launch records in current response/);
    state.radarStatus=200; state.feedPayload={...feed,historyCoverage:"COMPLETE"};
    state.healthPayload={...healthy(),chainId:1};
    await visit(); await page.getByText(/FEED UNAVAILABLE \/ PUBLIC_FEED_SCHEMA_INVALID/).waitFor();
    await page.getByTestId("macro-health-state").getByText("UNAVAILABLE").waitFor();
    assert.doesNotMatch(await page.getByTestId("macro-bento-home").innerText(),/FERAL|DEMO INDEX RECEIPT/);
    console.log("PASS not ready/stale; independent 503s; malformed live JSON fails closed");
  } finally { await ctx.close(); }
}
async function pollingCheck(browser) {
  const ctx = await browser.newContext({viewport:{width:1024,height:768}});
  const page = await ctx.newPage();
  const state={healthRequests:0};
  fixtures(page,state);
  await page.addInitScript(() => {
    window.__binratVisible=true;
    Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>window.__binratVisible?"visible":"hidden"});
  });
  try {
    await page.clock.install();
    await page.goto(url(),{waitUntil:"domcontentloaded"});
    await page.getByTestId("macro-health-state").getByText("READY").waitFor();
    const before=state.healthRequests;
    await page.clock.fastForward(61_000);
    await page.waitForFunction(() => document.querySelector('[data-testid="macro-health-state"]')?.textContent?.includes("READY"));
    assert.ok(state.healthRequests>before,"60s visible refresh");
    await page.evaluate(() => {window.__binratVisible=false; document.dispatchEvent(new Event("visibilitychange"));});
    const hidden=state.healthRequests;
    await page.clock.fastForward(61_000);
    assert.equal(state.healthRequests,hidden,"hidden tab pauses polling");
    await page.evaluate(() => {window.__binratVisible=true; document.dispatchEvent(new Event("visibilitychange"));});
    await page.waitForTimeout(50);
    assert.equal(state.healthRequests,hidden+1,"visible tab refetches once");
    await page.goto(origin+"/radar?experiment=macro-bento&source=live",{waitUntil:"domcontentloaded"});
    const after=state.healthRequests;
    await page.clock.fastForward(61_000);
    assert.equal(state.healthRequests,after,"unmounted home stops health polling");
    console.log("PASS bounded visible health polling / hidden / unmount");
  } finally { await ctx.close(); }
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try {
    await contractualChecks(browser);
    await pollingCheck(browser);
    for(const [w,h] of sizes) await snapshot(browser,w,h,"demo");
    for(const [w,h] of [[390,844],[430,932],[1024,768],[1440,900],[1672,941]]) await snapshot(browser,w,h,"live");
    fs.writeFileSync(path.join(output,"README.txt"),
      "BROWSER SCREENSHOTS / experimental build. demo-* = deterministic synthetic fixtures. "+
      "live-* = mocked LIVE API contracts (health 122, Feed 120, Radar 121), NOT observed production state. "+
      "DPR=1; reduced motion. Owner visual approval pending.\n");
    console.log("MACRO BENTO: ALL CONTRACT CHECKS AND SCREENSHOTS PASS");
  } finally {await browser.close();}
})().catch(error=>{console.error("MACRO BENTO FAILED",error);process.exitCode=1;});
