/* Replays recorded genuine candidate transport; does NOT certify live freshness. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = "http://127.0.0.1:4189";
const root = path.resolve(__dirname, "../..");
const response = (p) => JSON.parse(fs.readFileSync(path.join(root, "docs/receipts/pons-runtime-v1/",p),"utf8")).body;
const feed = response("1440x900-api-launches-latest.json");
const status = response("1440x900-api-status.json");
const out = path.resolve(root, process.env.BINRAT_FRONTDOOR_OUTPUT || ".artifacts/v3-frontdoor/browser");
fs.mkdirSync(out, { recursive: true });
const checks = [], errors = [], api = [];
async function visit(context, pathname, intercept = true) {
 const page = await context.newPage();
 page.on("pageerror", err => errors.push(err.message));
 page.on("request", r => {
  const url=new URL(r.url());
  if(url.pathname.startsWith("/api/")) api.push({ path:url.pathname,method:r.method() });
 });
 if(intercept) await page.route("**/api/**",route => {
  const u=new URL(route.request().url()).pathname;
  assert.equal(route.request().method(),"GET");
  assert.ok(["/api/status","/api/launches/latest"].includes(u),u);
  return route.fulfill({contentType:"application/json",body:JSON.stringify(u === "/api/status" ? status : feed)});
 });
 await page.goto(base+pathname,{waitUntil:"networkidle"});
 return page;
}
async function check(label,fn){await fn(); checks.push(label);console.log("PASS "+label);}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const [w,h] of [[1440,900],[390,844],[768,1024]]){
   const context=await browser.newContext({viewport:{width:w,height:h}});
   const page=await visit(context,"/");
   await check(w+"x"+h+" root Case is recorded Pons source, not ARC",async()=>{
    assert.equal(await page.locator("#vl-case").getAttribute("data-case"),feed.launches[0].launchId);
    assert.match(await page.locator(".vl-lab-stamp").innerText(),/STALE_VERIFIED/);
    assert.equal(await page.locator(".vl-find").count(),feed.launches.length);
    assert.doesNotMatch(await page.locator("body").innerText(),/SYNTHETIC INVESTIGATION/);
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    assert.ok(width<=w+1,"horizontal overflow at "+w);
   });
   await page.screenshot({path:path.join(out,`root-${w}x${h}.png`)});
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await visit(context,"/");
  await check("Case share link remains bound to selected launch",async()=>{
   await page.getByRole("button",{name:"Open Case "+feed.launches[1].launchId}).click();
   assert.equal(await page.locator("#vl-case").getAttribute("data-case"),feed.launches[1].launchId);
   assert.match(page.url(),new RegExp("case="+feed.launches[1].launchId));
   await page.reload({waitUntil:"networkidle"});
   assert.equal(await page.locator("#vl-case").getAttribute("data-case"),feed.launches[1].launchId);
  });
  await check("Prior /bag link resolves to exact Case",async()=>{
   await page.goto(base+"/bag/"+feed.launches[2].launchId,{waitUntil:"networkidle"});
   assert.equal(await page.locator("#vl-case").getAttribute("data-case"),feed.launches[2].launchId);
  });
  await check("Legacy ARC route cannot be reached",async()=>{
   await page.goto(base+"/radar",{waitUntil:"networkidle"});
   assert.match(await page.locator("body").innerText(),/NOT IN THIS BUILD/);
  });
  await check("Synthetic Lab stays separate",async()=>{
   await page.goto(base+"/visual-lab",{waitUntil:"networkidle"});
   assert.match(await page.locator(".vl-lab-stamp").innerText(),/SYNTHETIC/);
   assert.equal(await page.locator("#vl-case").getAttribute("data-case"),"$MOLDY");
  });
  const unavailable=await context.newPage();
  await unavailable.route("**/api/**",route=>route.fulfill({status:503,contentType:"application/json",body:'{"error":"SIMULATED_UPSTREAM_UNAVAILABLE"}'}));
  await unavailable.goto(base+"/",{waitUntil:"networkidle"});
  await check("Upstream 503 fails closed, no fixture Case",async()=>{
   assert.equal(await unavailable.locator("#vl-case").count(),0);
   assert.match(await unavailable.locator("body").innerText(),/unavailable|READ DEGRADED/i);
   await unavailable.screenshot({path:path.join(out,"simulated-503.png")});
  });
  await context.close();
  const expected=["/api/status","/api/launches/latest"];
  await check("Never request legacy ARC routes",async()=>{
   assert.ok(api.length>0);
   assert.ok(api.every(z=>z.method==="GET"&&expected.includes(z.path)));
   assert.deepEqual(errors,[]);
  });
 }finally{await browser.close();}
 fs.writeFileSync(path.join(out,"results.json"),JSON.stringify({checks,errors,api,provenance:"RECORDED_REAL_PUBLIC_TRANSPORT_REPLAY",productionAuthorization:false},null,2));
 console.log("CUTOVER_STATIC_BROWSER_PASS "+checks.length);
})().catch(err=>{console.error(err);process.exitCode=1});
