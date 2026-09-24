/** Static GitHack V2 preview acceptance against explicitly mocked public endpoint responses. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const captures = path.resolve(__dirname, "../browser-artifacts/githack-bento-v1");
fs.mkdirSync(captures,{recursive:true});
const { chromium } = require("playwright");
const base = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4175").replace(/\/$/, "");
const api = "https://binrat-githack-proxy-v2.onrender.com";
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
        await page.getByRole("heading", { name: /rat radar/i }).first().waitFor({ timeout: 8000 });
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

    // Preview-specific tests: experiment query + hash routing + relative assets.
    for (const width of [390,1440]) {
      const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce"});
      const page=await context.newPage();
      const requests=[];
      const healthy={ok:true,chainId:5042,indexReady:true,checkpointBlock:"120",
        launchCount:0,runtimeFresh:true,runtimeUpdatedAtMs:Date.now(),
        historyBackfillComplete:false,observationReady:false,lastSyncError:null};
      await page.route(api+"/api/**",async route=>{
        const url=route.request().url(),method=route.request().method();
        requests.push({url,method});
        if(method!=="GET")throw Error("GITHACK_NON_READ_ONLY_REQUEST");
        const body=url.endsWith("/api/feed")?emptyFeed:
          url.endsWith("/api/rat-radar/watchlist")?emptyRadar:
          url.endsWith("/api/health")?healthy:null;
        await route.fulfill({status:body?200:404,contentType:"application/json",
          headers:{"access-control-allow-origin":"*"},
          body:JSON.stringify(body??{error:"NOT_FOUND"})});
      });
      try {
        await page.goto(base+"/index.html?experiment=bento-v1#/",{waitUntil:"domcontentloaded"});
        await page.getByTestId("binrat-bento-home").waitFor({timeout:12000});
        assert.equal(requests.length,0,"DEMO bento must not request the LIVE API");
        await page.waitForFunction(()=>{
          const img=document.querySelector('[data-testid="binrat-bento-home"] img');
          return img && img.complete && img.naturalWidth>0;
        },null,{timeout:10000});
        const portrait=page.getByTestId("launch-portrait-wall").locator('a[aria-label^="Open indexed launch"]').first();
        const tileBox=await portrait.boundingBox();
        const wallBox=await page.getByTestId("portrait-wall-viewport").boundingBox();
        assert.ok(tileBox&&wallBox&&tileBox.y+tileBox.height/2>=wallBox.y+8&&
          tileBox.y+tileBox.height/2<=wallBox.y+wallBox.height-8,
          "DEMO portrait must be visible within the GitHack gallery viewport");
        const toggle=page.locator('a[href*="source=live"]').first();
        const destination=new URL(await toggle.getAttribute("href"),base);
        assert.equal(destination.searchParams.get("experiment"),"bento-v1");
        assert.equal(destination.hash,"#/");
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
        assert.ok(overflow<=1,"GitHack bento horizontal overflow "+width+": "+overflow);
        await page.screenshot({path:path.join(captures,"demo-"+width+"x900.png"),fullPage:false});
        await toggle.click();
        await page.locator('[data-testid="bento-health-state"]:text-is("READY")').waitFor({timeout:12000});
        assert.equal(new URL(page.url()).hash,"#/");
        assert.equal(new URL(page.url()).searchParams.get("experiment"),"bento-v1");
        for(const route of ["/api/health","/api/feed","/api/rat-radar/watchlist"])
          assert.ok(requests.some(x=>x.url===api+route),"missing proxied "+route);
        assert.ok(requests.every(x=>x.method==="GET"));
        await page.screenshot({path:path.join(captures,"mocked-live-"+width+"x900.png"),fullPage:false});
        await page.getByRole("link",{name:/EXPLORE RAT RADAR/}).click();
        assert.equal(new URL(page.url()).hash,"#/radar");
        console.log("GITHACK_BENTO_V1_PASS",{width,requests:requests.length});
      }finally{await context.close();}
    }
    fs.writeFileSync(path.join(captures,"README.txt"),
      "Isolated bento-v1 static GitHack preview. Build SHA="+(process.env.GITHUB_SHA||"LOCAL")+
      "\nDEMO is synthetic. Mocked LIVE screenshots are NOT production data. Owner visual approval pending.\n");
  } finally { await browser.close(); }
})().catch(error => { console.error("GITHACK_STATIC_PREVIEW_FAILED", error); process.exitCode = 1; });
