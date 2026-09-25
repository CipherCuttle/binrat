/* P0 bento v1: source-backed gallery, independent LIVE read planes, bounded tiles.
 * Screenshot LIVE fixtures are MOCKED CONTRACT DATA, never production observations. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const origin = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4174").replace(/\/$/, "");
const output = path.resolve(__dirname, "../browser-artifacts/bento-v1");
fs.mkdirSync(output,{recursive:true});
const address="0x"+"a".repeat(40), hash="0x"+"f".repeat(64), digest="3".repeat(64);
const image="https://ipfs.io/ipfs/QmYwAPJzv5CZsnAzt8auVZRnG77WQY6Y1QV3M5XK6Fv2go";
const transparent=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/Sc1WGAAAAABJRU5ErkJggg==","base64");
function launch(i) {
  return {id:i.toString(16).padStart(64,"0"),source:"ARCPAD",
    token:"0x"+i.toString(16).padStart(40,"0"),symbol:"TOK"+i,name:"Observed launch "+i,
    blockNumber:String(1000-i),blockHash:hash,txHash:hash,logIndex:i,
    reportedCreatorAddress:address,pool:address,
    metadata:{imageUri:i===0?image:"",website:"",twitter:"",telegram:""},
    trashTrail:{coverage:"UNVERIFIED",priorLaunchCount:0,prior:[]},evidence:[]};
}
function feed(count=500) {
  return {schemaVersion:"binrat.public-feed/0.1",chainId:5042,
    asOfBlock:"1000",asOfBlockHash:hash,historyCoverage:"UNVERIFIED",
    bags:Array.from({length:count},(_,i)=>launch(i)),
    receipt:{projectionVersion:"BINRAT_PUBLIC_PROJECTION_V0",chainId:5042,
      asOfBlock:"1000",asOfBlockHash:hash,historyCoverage:"UNVERIFIED",
      inputDigest:digest,outputDigest:digest,receiptId:"binrat-public:"+digest}};
}
const radar={schemaVersion:"binrat.rat-radar-watchlist/0.1",rankingVersion:"binrat.rat-radar-ranking/0.1",
  chainId:5042,asOfBlock:"999",
  coverage:{historyCoverage:"UNVERIFIED",indexedLaunchCount:500,swapReceiptCount:9,
    acquisitionReceiptCount:4,distinctRecipientAddressCount:3,rankedAddressCount:1,status:"PARTIAL"},
  method:{evidencedRole:"V3_SWAP_RECIPIENT",freeLimit:5,
    ordering:["distinctLaunchCount DESC","medianFirstEntryBlockDelta ASC",
      "acquisitionReceiptCount DESC","observedRecipientAddress ASC"],
    identityBoundary:"Observed address is not an identified human.",
    recommendationBoundary:"Recurrence is not a buy recommendation."},
  candidates:[{rank:1,observedRecipientAddress:address,distinctLaunchCount:3,acquisitionReceiptCount:4,
    medianFirstEntryBlockDelta:2,earliestFirstEntryBlockDelta:1,latestSeenBlock:"997",
    reasonCodes:["RECURRENT_RECIPIENT_ACROSS_LAUNCHES"],
    reasons:["Observed across three indexed launches."],evidenceActivityIds:["1".repeat(64)]}],
  receipt:{receiptId:"binrat-rat-radar:"+digest,evidenceDigest:digest}};
function health(){return{ok:true,chainId:5042,indexReady:true,checkpointBlock:"1001",headBlock:"1003",
  targetBlock:"1001",liveCaughtUp:true,launchCount:517,historyBackfillComplete:false,
  observationReady:false,lastSyncError:null,runtimeFresh:true,runtimeUpdatedAtMs:Date.now()};}
const url=(mode="demo")=>origin+"/?experiment=bento-v1"+(mode==="live"?"&source=live":"");
const sizes=[[320,720],[360,800],[390,844],[430,932],[721,900],[768,900],[1024,768],[1100,800],[1440,900],[1672,941]];
async function mock(page,state){
  await page.route("https://ipfs.io/ipfs/**",async r=>r.fulfill({status:200,contentType:"image/png",body:transparent}));
  await page.route("**/api/**",async route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(route.request().method()!=="GET")throw Error("MUTATING_NETWORK_REQUEST");
    const scope=pathname==="/api/feed"?"feed":pathname==="/api/health"?"health":
      pathname==="/api/rat-radar/watchlist"?"radar":null;
    if(!scope){await route.fulfill({status:404,body:"UNAVAILABLE"});return;}
    state.requests[scope]++;
    if(state.status[scope]!==200){await route.fulfill({status:state.status[scope],contentType:"application/json",body:"{}"});return;}
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(state[scope])});
  });
}
async function ready(page){
  await page.getByTestId("binrat-bento-home").waitFor({timeout:20000});
  await page.getByTestId("launch-portrait-wall").waitFor();
}
async function screenshot(browser,w,h,mode){
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,reducedMotion:"reduce"});
  const page=await ctx.newPage(),state={feed:feed(),radar,health:health(),
    requests:{feed:0,radar:0,health:0},status:{feed:200,radar:200,health:200}};
  await mock(page,state);
  try{
    await page.goto(url(mode),{waitUntil:"domcontentloaded"});await ready(page);
    if(mode==="live"){
      await page.locator('[data-testid="bento-health-state"]:text-is("READY")').waitFor();
      assert.equal(await page.getByTestId("bento-launch-count").innerText(),"517");
      assert.equal(await page.getByTestId("launch-portrait-wall").getAttribute("data-visible-tiles"),"24");
    }else{
      assert.match(await page.getByTestId("binrat-bento-home").innerText(),/SYNTHETIC DEMO/);
      assert.equal(state.requests.health,0,"DEMO never reads LIVE health");
    }
    await page.locator("img").first().evaluate(img=>img.decode().catch(()=>{}));
    const radarBox=await page.getByTestId("bento-radar").boundingBox();
    const galleryBox=await page.getByTestId("launch-portrait-wall").boundingBox();
    assert.ok(radarBox&&galleryBox&&radarBox.y<galleryBox.y,
      "featured Rat Radar must precede the optional token gallery at "+w);
    const rat=page.getByTestId("bento-rat");
    assert.ok(await rat.isVisible(),"canonical rat missing at "+w);
    assert.ok((await rat.locator("img").getAttribute("src")).endsWith("/binrat-character-master.png"),
      "hero rat must use the canonical source, not the retired hero derivative");
    await rat.locator("img").evaluate(img=>img.decode());
    const ratBox=await rat.boundingBox();
    assert.ok(ratBox&&ratBox.x>=0&&ratBox.x+ratBox.width<=w+1&&ratBox.y>=0,
      "rat must remain within the viewport at "+w);
    const introBox=await page.locator('[class*="intro"]').first().boundingBox();
    const titleBox=await page.getByRole("heading",{name:/THE RAT.*REMEMBERS/i}).first().boundingBox();
    assert.ok(introBox&&titleBox&&titleBox.x+titleBox.width<=introBox.x+introBox.width+2,
      "hero heading clips beyond introduction at "+w+"; title="+JSON.stringify(titleBox)+" intro="+JSON.stringify(introBox));
    const bounds=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,width:innerWidth}));
    assert.ok(bounds.doc<=w+1&&bounds.body<=w+1,"horizontal overflow "+JSON.stringify(bounds));
    if(w<=720){
      const nav=page.getByRole("navigation",{name:"Mobile primary navigation"});
      assert.ok(await nav.isVisible(),"M1 mobile navigation hidden at "+w);
      for(const label of ["Discover","Radar","Saved","More"]){
        const link=nav.getByRole("link",{name:label,exact:true});
        const rect=await link.boundingBox();
        assert.ok(rect&&rect.width>=40&&rect.height>=44,"mobile "+label+" touch target at "+w);
      }
    }else if(w<=1100){
      const nav=page.getByRole("navigation",{name:"BINRAT desktop navigation"});
      assert.ok(await nav.isVisible(),"desktop navigation hidden between 721–1100px at "+w);
      for(const label of ["DUMPSTER","RADAR","REPLAY","LEDGER","WATCH"]){
        const link=nav.getByRole("link",{name:label,exact:true});
        const rect=await link.boundingBox();
        assert.ok(rect&&rect.height>=44&&rect.x>=0&&rect.x+rect.width<=w+1,
          "desktop "+label+" inaccessible at "+w);
      }
    }
    const firstTile=page.getByTestId("launch-portrait-wall")
      .locator('a[aria-label^="Open indexed launch"]').first();
    if(await firstTile.count()){
      const tile=await firstTile.boundingBox();
      const view=await page.getByTestId("portrait-wall-viewport").boundingBox();
      assert.ok(tile&&view,"portrait gallery geometry exists");
      const middle=tile.y+tile.height/2;
      assert.ok(middle>=view.y+8 && middle<=view.y+view.height-8,
        "visible portrait must actually be inside gallery viewport");
    }
    const columns=await page.getByTestId("launch-portrait-column").count();
    assert.ok(columns<=4,"gallery must mount bounded columns");
    await page.screenshot({path:path.join(output,mode+"-"+w+"x"+h+"-firstview.png"),fullPage:false});
    if(w===390)await page.screenshot({path:path.join(output,mode+"-"+w+"x"+h+"-full.png"),fullPage:true});
    if(w===768&&mode==="demo"){
      const nav=page.getByRole("navigation",{name:"BINRAT desktop navigation"});
      await nav.getByRole("link",{name:"RADAR",exact:true}).click();
      assert.equal(new URL(page.url()).pathname,"/radar","tablet RADAR navigation routes to the working page");
    }
    console.log("BENTO SCREENSHOT PASS",mode,w,h,"bounded DOM, no overflow");
  }finally{await ctx.close();}
}
async function contract(browser){
  const ctx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:"reduce"});
  const page=await ctx.newPage(),state={feed:feed(),radar,health:health(),
    requests:{feed:0,radar:0,health:0},status:{feed:200,radar:200,health:200}};
  await mock(page,state);
  try{
    await page.goto(origin+"/",{waitUntil:"domcontentloaded"});
    await page.locator("main").waitFor();
    assert.equal(await page.getByTestId("binrat-bento-home").count(),0,"old default / remains stable");
    await page.goto(url(),{waitUntil:"domcontentloaded"});await ready(page);
    assert.equal(await page.getByTestId("binrat-bento-home").getAttribute("data-source-mode"),"DEMO");
    assert.equal(state.requests.health,0);
    assert.ok((await page.getByRole("link",{name:/SWITCH TO LIVE/}).getAttribute("href")).includes("experiment=bento-v1"));
    await page.goto(url("live"),{waitUntil:"domcontentloaded"});await ready(page);
    await page.locator('[data-testid="bento-health-state"]:text-is("READY")').waitFor();
    assert.equal(await page.getByTestId("bento-launch-count").innerText(),"517");
    assert.match(await page.getByTestId("binrat-bento-home").innerText(),/DIFFERENT SOURCE CHECKPOINTS/);
    assert.match(await page.getByTestId("binrat-bento-home").innerText(),/3 DISTINCT LAUNCHES/);
    assert.equal(await page.getByTestId("launch-portrait-wall").getAttribute("data-visible-tiles"),"24");
    assert.equal(await page.getByTestId("launch-portrait-wall").locator("a").count(),25,
      "24 visible portrait links + one browse link, independent of the 500 record data pool");
    assert.equal(await page.getByTestId("launch-portrait-wall").locator("a[aria-label^='Open indexed launch'] img").count(),1,
      "Only exact source-reported imagery may load; absent images get placeholders");
    assert.equal(await page.getByTestId("launch-portrait-column").count(),4);
    await page.getByRole("button",{name:/REPEAT RECIPIENTS/}).click();
    assert.equal(await page.getByRole("link",{name:/Inspect observed recipient/}).count(),1);
    const first=page.getByRole("link",{name:/Open indexed launch TOK0 /});
    assert.ok((await first.getAttribute("href")).includes("/bag/"+launch(0).id));
    await first.focus();
    const css=await page.getByTestId("launch-portrait-column").first()
      .evaluate(el=>getComputedStyle(el).animationName);
    assert.equal(css,"none","prefers-reduced-motion must stop drifting");
    await first.click();
    assert.ok(new URL(page.url()).pathname.endsWith("/bag/"+launch(0).id));
    console.log("BENTO CONTRACT PASS: 500 pool, 24 mounted, source image, real links, reduced motion");
    await page.goto(url("live"));await ready(page);
    state.status.feed=503;
    await page.goto(url("live"));await page.getByText(/LAUNCH FEED UNAVAILABLE/).waitFor();
    assert.match(await page.getByTestId("binrat-bento-home").innerText(),/3 DISTINCT LAUNCHES/);
    state.status.feed=200;state.status.radar=503;
    await page.goto(url("live"));await page.getByText(/RADAR UNAVAILABLE/).waitFor();
    assert.equal(await page.getByTestId("launch-portrait-wall").getAttribute("data-visible-tiles"),"24");
    state.status.radar=200;state.health={...health(),ok:false,indexReady:false,runtimeFresh:false};
    await page.goto(url("live"));await page.locator('[data-testid="bento-health-state"]:text-is("STALE")').waitFor();
    assert.equal(await page.getByTestId("bento-launch-count").innerText(),"—");
    state.health={...health(),ok:false,indexReady:true};
    await page.goto(url("live"));await page.locator('[data-testid="bento-health-state"]:text-is("UNAVAILABLE")').waitFor();
    assert.equal(await page.getByTestId("bento-launch-count").innerText(),"—");
    state.health=health();state.feed=feed(2);state.feed.bags[0].metadata.imageUri="javascript:alert(1)";
    await page.goto(url("live"));await ready(page);
    assert.equal(await page.getByTestId("launch-portrait-wall").locator("a[aria-label^='Open indexed launch'] img").count(),0,"unsafe source URI rejected");
    state.status.health=503;
    await page.goto(url("live"));await ready(page);
    await page.locator('[data-testid="bento-health-state"]:text-is("UNAVAILABLE")').waitFor();
    assert.equal(await page.getByTestId("bento-launch-count").innerText(),"—",
      "failed Health must not reuse a previously ready total");
    state.status.health=200;
    state.feed=feed(0);
    state.radar={...radar,coverage:{...radar.coverage,indexedLaunchCount:0,
      swapReceiptCount:0,acquisitionReceiptCount:0,distinctRecipientAddressCount:0,
      rankedAddressCount:0,status:"NO_SWAP_EVIDENCE"},candidates:[]};
    await page.goto(url("live"));await ready(page);
    await page.getByText("NO INDEXED LAUNCHES AT THIS CHECKPOINT.").waitFor();
    await page.getByText("NO OBSERVED RECIPIENTS MATCH THIS FILTER AT THE CURRENT CHECKPOINT.").waitFor();
    assert.match(await page.getByTestId("binrat-bento-home").innerText(),/UNVERIFIED/,
      "empty observations must retain unknown history coverage");
    assert.equal(await page.getByRole("link",{name:/Inspect observed recipient/}).count(),0,
      "empty Radar must not invent a ranked candidate");
    console.log("BENTO CONTRACT PASS: failed Health clears totals; independently validated empty Feed and Radar preserve UNVERIFIED coverage");
    console.log("BENTO CONTRACT PASS: independent feed/Radar failures, stale/contradictory health, unsafe media");
  }finally{await ctx.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
   await contract(browser);
   for(const [w,h] of sizes)await screenshot(browser,w,h,"demo");
   for(const [w,h] of [[390,844],[430,932],[1024,768],[1440,900],[1672,941]])
     await screenshot(browser,w,h,"live");
   fs.writeFileSync(path.join(output,"README.txt"),
     "PR #31 / bento-v1 isolated experiment. SHA="+(process.env.BINRAT_BRANCH_SHA||"LOCAL")+
     "; DEMO = deterministic synthetic fixture; LIVE screenshots = mocked 500-record Feed, health 1001, Feed 1000, Radar 999, NOT production observations.\n"+
     "Browser DPR=1, reduced motion; original pixel-world background, source-URI portrait validation, 24 mounted tiles. Owner visual approval PENDING.\n");
   console.log("BENTO-V1: ALL CONTRACTS AND SCREENSHOTS PASS");
 }finally{await browser.close();}
})().catch(e=>{console.error("BENTO-V1 FAILED",e);process.exitCode=1;});
