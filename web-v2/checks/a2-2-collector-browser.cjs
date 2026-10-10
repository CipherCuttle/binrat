const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const runner=require('node:module').createRequire(path.join(process.env.BINRAT_FRONTDOOR_TOOLS||'/tmp/binrat-v3-sprint-runner/node_modules','runner.cjs'));
assert.equal(runner('playwright/package.json').version,'1.56.1');
const {chromium}=runner('playwright');
const input=JSON.parse(fs.readFileSync('.artifacts/a2-2/browser-input.json'));
const out='.artifacts/a2-2/browser';fs.mkdirSync(out,{recursive:true});
const report={provenance:input.provenance,sourceSha:input.sourceSha,verdict:'FAIL',checks:[],errors:[],requests:[]};
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [width,height] of [[390,844],[430,900],[1024,900],[1440,900]]){
   const c=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
   await c.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4206'?route.continue():route.abort());
   const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
   p.on('request',r=>{report.requests.push({url:r.url(),method:r.method()});assert.equal(r.method(),'GET');});
   await p.clock.install({time:new Date(input.nowMs)});
   await p.goto('http://127.0.0.1:4206/bag/'+input.caseId,{waitUntil:'networkidle'});
   const brief=p.locator('.a2-outcome-brief');await brief.waitFor();
   assert.match(await p.locator('body').innerText(),/SYNTHETIC FIXTURE/);
   assert.match(await brief.innerText(),/1 of 1 earlier launches/);
   assert.match(await brief.innerText(),/1 have a recorded GRADUATED/);
   for(const tab of ['WHY','TRAIL','RECEIPTS']){
    await p.getByRole('tab',{name:new RegExp(tab)}).click();
    if(tab==='TRAIL'){
     const item=p.locator('.a2-outcome-trail > li');assert.equal(await item.count(),1);
     assert.match(await item.innerText(),/5m target: CURVE.*1h target: CURVE.*24h target: GRADUATED/);
     await item.locator('summary').click();assert.match(await item.innerText(),/V4 pool state is missing/);
    }
    if(tab==='RECEIPTS'){
     await p.locator('.a2-outcome-proof summary').click();assert.match(await p.locator('.a2-outcome-proof').innerText(),/not independent RPC proofs/);
    }
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth)<=width+1);
    await p.screenshot({path:path.join(out,`${width}-${tab.toLowerCase()}.png`)});
    report.checks.push(`${width} ${tab}: collector-produced synthetic receipts`);
   }
   await c.close();
  }
  assert.deepEqual(report.errors,[]);report.verdict='PASS';
 }finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify({verdict:report.verdict,checks:report.checks.length,sourceSha:report.sourceSha,provenance:report.provenance}));
})().catch(e=>{console.error(e);process.exitCode=1;});
