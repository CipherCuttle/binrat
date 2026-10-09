/* Compiled local candidate with native request forwarding of real public production GETs. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const runner = require('node:module').createRequire(path.join(process.env.BINRAT_FRONTDOOR_TOOLS || '/tmp/binrat-v3-sprint-runner/node_modules', 'runner.cjs'));
assert.equal(runner('playwright/package.json').version, '1.56.1');
const { chromium } = runner('playwright');
const base = process.env.BINRAT_FRONTDOOR_URL || 'http://127.0.0.1:4189';
const origin = 'https://binrat.tech';
const out = path.resolve('.artifacts/sprint-a1/live');fs.mkdirSync(out,{recursive:true});
const report={provenance:'COMPILED_LOCAL_FRONTEND_REAL_PRODUCTION_PUBLIC_GETS',origin,checkedAt:new Date().toISOString(),checks:[],requests:[],errors:[],verdict:'FAIL'};
(async()=>{const browser=await chromium.launch({headless:true});try{
  for(const [width,height] of [[1440,900],[768,1024],[390,844],[320,800]]){
    const c=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
    const responses={};
    await c.route('**/api/**',async r=>{const route=new URL(r.request().url()).pathname;assert.equal(r.request().method(),'GET');assert.ok(['/api/status','/api/launches/latest'].includes(route)||/^\/api\/creator\/0x[0-9a-f]{40}\/summary$/.test(route));const response=await c.request.get(origin+route,{headers:{accept:'application/json'},timeout:20000});const body=await response.json();responses[route]=body;report.requests.push({method:'GET',route,status:response.status(),body});await r.fulfill({status:response.status(),contentType:'application/json',body:JSON.stringify(body)});});
    await p.goto(base,{waitUntil:'networkidle'});assert.equal(await p.locator('[data-read-state]').getAttribute('data-read-state'),'FRESH_VERIFIED');
    const apiBefore=report.requests.length;await p.getByRole('button',{name:'START DIGGING'}).click();await p.getByRole('button',{name:'Familiar deployers',exact:true}).click();assert.equal(report.requests.length,apiBefore);
    const feed=responses['/api/launches/latest'];assert.ok(feed&&feed.chainId===4663);
    const expected=feed.launches.filter(l=>l.priorLaunchCount>0);assert.equal(await p.locator('[data-case-id]').count(),Math.min(4,expected.length));
    await p.getByRole('button',{name:'Latest launches',exact:true}).click();const selected=feed.launches[0];assert.ok(selected);await p.locator('[data-case-id="'+selected.launchId+'"]').click();assert.equal(await p.locator('#vl-case').getAttribute('data-case'),selected.launchId);assert.equal(new URL(p.url()).pathname,'/bag/'+selected.launchId);
    await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.loading!=='lazy').map(i=>i.decode()));});await p.screenshot({path:path.join(out,`case-${width}x${height}.png`)});
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth)<=width+1);
    if(width===1440){await p.getByRole('tab',{name:/\bTRAIL\b/}).click();await p.locator('.vl-source-trail').waitFor({timeout:20000});assert.ok(await p.locator('.vl-source-trail li').count()<=4);await p.screenshot({path:path.join(out,'trail.png')});await p.getByRole('tab',{name:/\bRECEIPTS\b/}).click();await p.locator('summary').click();const receipt=JSON.parse(await p.locator('pre').innerText());assert.equal(receipt.launchId,selected.launchId);assert.equal(receipt.token,selected.token);assert.equal(receipt.feedDigest,feed.feedDigest);const source=await c.request.get(origin+'/api/bag/'+selected.launchId);assert.equal(source.status(),200);const value=await source.json();assert.equal(value.bag.id,selected.launchId);report.exactCase=value;await p.screenshot({path:path.join(out,'receipts.png')});report.caseUrl=origin+'/bag/'+selected.launchId;}
    report.checks.push(`${width}x${height} fresh real feed, supported recurrence, exact Case and no overflow`);console.log('PASS '+report.checks.at(-1));await c.close();
  }
  assert.deepEqual(report.errors,[]);report.verdict='PASS';console.log('LIVE_PUBLIC_GET_BROWSER_PASS');
}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');}})().catch(e=>{console.error(e);process.exitCode=1;});
