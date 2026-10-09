/* Compiled local candidate with native request forwarding of real public production GETs. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const runner = require('node:module').createRequire(path.join(process.env.BINRAT_FRONTDOOR_TOOLS || '/tmp/binrat-v3-sprint-runner/node_modules', 'runner.cjs'));
assert.equal(runner('playwright/package.json').version, '1.56.1');
const { chromium } = runner('playwright');
const base = process.env.BINRAT_FRONTDOOR_URL || 'http://127.0.0.1:4189';
const origin = 'https://binrat.tech';
const publicGet = async route => {
  // Match the preview's bounded IPv4 GET transport; forward no browser credentials.
  const {stdout}=await require('node:util').promisify(require('node:child_process').execFile)('curl',['-4','--silent','--show-error','--max-time','20','--write-out','\n%{http_code}',origin+route],{maxBuffer:2*1024*1024});
  const split=stdout.lastIndexOf('\n');
  return {status:Number(stdout.slice(split+1)),body:JSON.parse(stdout.slice(0,split))};
};
const out = path.resolve(process.env.BINRAT_LIVE_OUTPUT || '.artifacts/sprint-a1/live');fs.mkdirSync(out,{recursive:true});
const report={provenance:'COMPILED_LOCAL_FRONTEND_REAL_PRODUCTION_PUBLIC_GETS',origin,checkedAt:new Date().toISOString(),sourceSha:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],requests:[],errors:[],verdict:'FAIL'};
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');
(async()=>{const browser=await chromium.launch({headless:true});try{
  for(const [width,height] of [[1440,900],[768,1024],[390,844],[320,800]]){
    const c=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
    const responses={};
    await c.route('**/api/**',async r=>{const route=new URL(r.request().url()).pathname;assert.equal(r.request().method(),'GET');assert.ok(['/api/status','/api/launches/latest'].includes(route)||/^\/api\/creator\/0x[0-9a-f]{40}\/summary$/.test(route));
      try{const response=await publicGet(route);responses[route]=response.body;report.requests.push({method:'GET',route,status:response.status,body:response.body});await r.fulfill({status:response.status,contentType:'application/json',body:JSON.stringify(response.body)});}
      catch(error){report.errors.push('PUBLIC_GET_TRANSPORT_FAILED:'+route);await r.fulfill({status:503,contentType:'application/json',body:'{"error":"PUBLIC_GET_TRANSPORT_FAILED"}'});}
    });
    // Bounded real-source freshness sampling. Preserve every failed observation.
    for(let attempt=1;attempt<=3;attempt++){
      await p.goto(base,{waitUntil:'networkidle'});
      const state=await p.locator('[data-read-state]').getAttribute('data-read-state');
      (report.healthSamples ||= []).push({width,attempt,state,at:new Date().toISOString()});
      console.log('LIVE_SAMPLE '+JSON.stringify(report.healthSamples.at(-1)));
      if(state==='FRESH_VERIFIED')break;
      if(attempt<3)await new Promise(resolve=>setTimeout(resolve,8000));
    }
    assert.equal(await p.locator('[data-read-state]').getAttribute('data-read-state'),'FRESH_VERIFIED');
    const apiBefore=report.requests.length;await p.getByRole('button',{name:'START DIGGING'}).click();await p.getByRole('button',{name:'Familiar deployers',exact:true}).click();assert.equal(report.requests.length,apiBefore);
    const feed=responses['/api/launches/latest'];assert.ok(feed&&feed.chainId===4663);
    const expected=feed.launches.filter(l=>l.priorLaunchCount>0);assert.equal(await p.locator('[data-case-id]').count(),Math.min(4,expected.length));
    await p.getByRole('button',{name:'Latest launches',exact:true}).click();const selected=feed.launches[0];assert.ok(selected);await p.locator('[data-case-id="'+selected.launchId+'"]').click();assert.equal(await p.locator('#vl-case').getAttribute('data-case'),selected.launchId);assert.equal(new URL(p.url()).pathname,'/bag/'+selected.launchId);
    await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.loading!=='lazy').map(i=>i.decode()));});await p.screenshot({path:path.join(out,`case-${width}x${height}.png`)});
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth)<=width+1);
    if(width===1440){
      await p.getByRole('tab',{name:/\bTRAIL\b/}).click();
      await p.waitForFunction(() => document.querySelector('.vl-source-trail') || document.querySelector('.vl-trail-view [role="status"]')?.textContent?.includes('Trail unavailable'), null, {timeout:20000});
      const summary=responses['/api/creator/'+selected.deployer+'/summary'];
      assert.ok(summary, 'actual creator GET evidence required');
      const status=responses['/api/status'];
      const bound=summary.chainId===4663 && summary.checkpointBlock===status.checkpointBlock && summary.checkpointBlockHash===status.checkpointBlockHash && summary.feedDigest===feed.feedDigest;
      if(bound){assert.ok(await p.locator('.vl-source-trail li').count()>0);assert.ok(await p.locator('.vl-source-trail li').count()<=4);}
      else {assert.equal(await p.locator('.vl-source-trail').count(),0);assert.match(await p.locator('.vl-trail-view [role="status"]').innerText(),/PONS_TRAIL_BINDING_MISMATCH/);report.checks.push('real publication movement fails closed without mixing a newer creator projection');}
      assert.equal(await p.locator('#vl-case').getAttribute('data-case'),selected.launchId);
      await p.screenshot({path:path.join(out,'trail.png')});
      await p.getByRole('tab',{name:/\bRECEIPTS\b/}).click();await p.locator('summary').click();
      const receipt=JSON.parse(await p.locator('pre').innerText());assert.equal(receipt.launchId,selected.launchId);assert.equal(receipt.token,selected.token);assert.equal(receipt.feedDigest,feed.feedDigest);assert.equal(receipt.priorLaunchCount,selected.priorLaunchCount);
      const source=await publicGet('/api/bag/'+selected.launchId);assert.equal(source.status,200);const value=source.body;assert.equal(value.bag.id,selected.launchId);report.exactCase=value;await p.screenshot({path:path.join(out,'receipts.png')});report.caseUrl=origin+'/bag/'+selected.launchId;
    }
    report.checks.push(`${width}x${height} fresh real feed, supported recurrence, exact Case and no overflow`);console.log('PASS '+report.checks.at(-1));await c.close();
  }
  assert.deepEqual(report.errors,[]);report.verdict='PASS';console.log('LIVE_PUBLIC_GET_BROWSER_PASS');
}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');}})().catch(e=>{console.error(e);process.exitCode=1;});
