const assert = require('node:assert/strict');
const { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('playwright');
const artifact = 'browser-artifacts/local-den';
const widths = [320,360,390,430,768,1024,1440];
mkdirSync(artifact,{recursive:true});

(async()=>{
  const {startLocalDen} = await import('../dist/src/workforce/localDen.js');
  const dir=mkdtempSync(join(tmpdir(),'binrat-den-browser-')),dbPath=join(dir,'den.sqlite');
  const {LocalRatJobs}=await import('../dist/src/workforce/localJob.js');
  const recorded=JSON.parse(readFileSync('test/fixtures/workforce/recorded/pons-funding-a-bundle-v1.json','utf8'));
  const imported=new LocalRatJobs(dbPath,{create:true});await imported.createRecorded(recorded);imported.close();
  let app=await startLocalDen({dbPath,port:0}),browser;
  const report={mode:'LOCAL_REPLAY',viewports:[],restart:false,cancel:false,expiry:false,incomplete:false,exhaustion:false,
    unavailableRecovery:false,malformedRecovery:false,uncertainWriteRecovery:false,openTabRestartRecovery:false,newModelCalls:0,deliveredNotifications:0};
  try{
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    for(const width of widths){
      const height=width<=390?844:width===430?932:900;
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',acceptDownloads:true});
      let page=await context.newPage();const errors=[],external=[];
      const observe=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',request=>{if(new URL(request.url()).origin!==app.url)external.push(request.url());});};
      observe(page);await page.goto(app.url,{waitUntil:'networkidle'});
      await page.locator('#start:enabled').waitFor();
      const primary=await page.locator('#start').boundingBox();
      assert.ok(primary && primary.y+primary.height<=height,`start action below first viewport at ${width}`);
      assert.match(await page.locator('body').innerText(),/OFFLINE REPLAY[\s\S]*No live watcher or sends/);
      await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent==='Replay job saved. You can leave and return.');await page.locator('#detail[data-phase="READY"]').waitFor();
      const bookmark=page.url();
      for(const expected of ['100','101']){
        await page.locator('#advance:enabled').click();
        await page.waitForFunction(block=>document.querySelector('#notice').textContent==='Replay checkpoint saved.' &&
          document.querySelectorAll('#timeline .complete').length===(block==='100'?1:2),expected);
      }
      assert.equal(await page.locator('#detail').evaluate(node=>node===document.activeElement),true);
      await page.screenshot({path:`${artifact}/waiting-${width}.png`,fullPage:true});
      await page.close();page=await context.newPage();observe(page);
      if(width===320){
        const port=Number(new URL(app.url).port);await app.close();app=await startLocalDen({dbPath,port});report.restart=true;
      }
      await page.goto(bookmark,{waitUntil:'networkidle'});await page.locator('#detail[data-phase="WAITING"]').waitFor();
      await page.waitForFunction(()=>document.querySelector('#detail')===document.activeElement);
      assert.equal(await page.locator('#detail').evaluate(node=>node===document.activeElement),true,'bookmark must return to saved job');
      assert.equal(await page.locator('#timeline .complete').count(),2);
      await page.locator('#advance:enabled').click();await page.locator('#detail[data-phase="FOUND"]').waitFor();
      await page.locator('#start:enabled').waitFor();
      assert.match(await page.locator('#case').innerText(),/Pons reported a deployment[\s\S]*The funding transaction occurred before the launch/);
      assert.match(await page.locator('#notification').innerText(),/PREPARED ONLY · NOTHING SENT/);
      assert.equal(await page.locator('#advance').isVisible(),false);
      assert.equal(await page.locator('#cancel').isVisible(),false);
      const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();
      const download=await downloadPromise;await download.saveAs(`${artifact}/evidence-${width}.json`);
      await page.locator('#start:enabled').waitFor();
      await page.locator('#receipts summary').click();
      assert.equal(await page.locator('#receipt-rows tr').count(),3);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);
      await page.screenshot({path:`${artifact}/found-${width}.png`,fullPage:true});
      await page.locator('#start').focus();await page.keyboard.press('Enter');
      await page.locator('#detail[data-phase="READY"]').waitFor();await page.locator('#cancel:enabled').click();
      await page.locator('#detail[data-phase="CANCELLED"]').waitFor();report.cancel=true;
      assert.equal(await page.locator('#case').isVisible(),false);
      assert.equal(await page.locator('#notification').isVisible(),false);
      await page.reload({waitUntil:'networkidle'});await page.locator('#detail[data-phase="CANCELLED"]').waitFor();
      assert.deepEqual(external,[],'local Den must never contact external APIs');assert.deepEqual(errors,[],`page errors at ${width}`);
      report.viewports.push({width,passed:true});await context.close();
    }
    report.recorded={sourceDigest:recorded.digest,viewports:[],predictionEstablished:false,recipientFreshnessEstablished:false};
    for(const width of widths){
      const context=await browser.newContext({viewport:{width,height:width<=390?844:width===430?932:900},reducedMotion:'reduce'});
      let page=await context.newPage();const errors=[],external=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==app.url)external.push(r.url());});
      const bookmark=`${app.url}/#job=${recorded.job.jobId}`;await page.goto(bookmark,{waitUntil:'networkidle'});
      await page.locator('#detail').waitFor();
      if(await page.locator('#advance').isVisible()){await page.locator('#advance:enabled').click();}
      await page.locator('#detail[data-phase="FOUND"]').waitFor();
      assert.match(await page.locator('#coverage').innerText(),/retrospective.*recipient history unavailable/);
      assert.match(await page.locator('#case-provenance').innerText(),/RECORDED CASE/);
      assert.match(await page.locator('#notification-text').innerText(),/No earlier prediction or recipient freshness/);
      assert.equal(await page.locator('#advance').isVisible(),false);
      await page.locator('#receipts summary').click();assert.equal(await page.locator('#receipt-rows tr').count(),2);assert.equal(await page.locator('#receipt-caption').innerText(),'Recorded receipt availability');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`recorded overflow ${width}`);
      await page.screenshot({path:`${artifact}/recorded-${width}.png`,fullPage:true});
      await page.close();page=await context.newPage();await page.goto(bookmark,{waitUntil:'networkidle'});await page.locator('#detail[data-phase="FOUND"]').waitFor();
      assert.deepEqual(errors,[]);assert.deepEqual(external,[]);report.recorded.viewports.push({width,passed:true});await context.close();
    }
    const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto(app.url,{waitUntil:'networkidle'});
    for(const [scenario,phase,outcome,flag] of [
      ['NO_LAUNCH','EXPIRED','No supported launch was found','expiry'],
      ['INCOMPLETE_HISTORY','EXPIRED','missing history','incomplete'],
      ['EXHAUSTED','EXHAUSTED','original replay budget','exhaustion']]){
      await page.locator('#scenario:enabled').selectOption(scenario);await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent==='Replay job saved. You can leave and return.');await page.locator('#detail[data-phase="READY"]').waitFor();
      while(await page.locator('#advance').isVisible()){
        await page.locator('#advance:enabled').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent==='Replay checkpoint saved.');
      }
      assert.equal(await page.locator('#detail').getAttribute('data-phase'),phase);assert.match(await page.locator('#outcome').innerText(),new RegExp(outcome));
      assert.equal(await page.locator('#case').isVisible(),false);assert.equal(await page.locator('#notification').isVisible(),false);report[flag]=true;
    }
    await page.route('**/api/jobs',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:'LOCAL_REPLAY',jobs:[{jobId:recorded.job.jobId,verification:'FAILED',error:'LOCAL_CHECKPOINT_INVALID'}]})}));
    await page.locator('#refresh').click();await page.locator('#phase').filter({hasText:'UNVERIFIED'}).waitFor();
    assert.equal(await page.locator('#coverage').innerText(),'Saved evidence unavailable or unverified.');
    assert.equal(await page.locator('#case').isVisible(),false);assert.equal(await page.locator('#notification').isVisible(),false);
    await page.unroute('**/api/jobs');await page.locator('#refresh').click();await page.locator('#start:enabled').waitFor();report.unverifiedProvenance=true;
    const port=Number(new URL(app.url).port);await app.close();app=await startLocalDen({dbPath,port});
    await page.locator('#refresh').click();await page.locator('#error').waitFor();
    assert.equal(await page.locator('#retry').innerText(),'Reload local Den');
    await page.locator('#retry').click();await page.locator('#start:enabled').waitFor();report.openTabRestartRecovery=true;
    const savedCount=await page.locator('.job-item').count();const savedTitle=await page.locator('#detail-title').innerText();
    await page.route('**/api/jobs',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"LOCAL_DEN_BUSY"}'}));
    await page.locator('#refresh').click();await page.locator('#error').waitFor();
    assert.equal(await page.locator('.job-item').count(),savedCount);assert.equal(await page.locator('#detail-title').innerText(),savedTitle);
    assert.equal(await page.locator('#start').isEnabled(),false);
    await page.unroute('**/api/jobs');await page.locator('#retry').click();await page.locator('#start:enabled').waitFor();report.unavailableRecovery=true;
    await page.route('**/api/jobs',route=>route.fulfill({status:200,contentType:'application/json',body:'{"mode":"LOCAL_SYNTHETIC_REPLAY","jobs":[{"jobId":"bad","verification":"VERIFIED"}]}'}));
    await page.locator('#refresh').click();await page.locator('#error').waitFor();assert.equal(await page.locator('.job-item').count(),savedCount);
    await page.unroute('**/api/jobs');await page.locator('#retry').click();await page.locator('#start:enabled').waitFor();report.malformedRecovery=true;
    await page.locator('#scenario').selectOption('FINDING');
    await page.route('**/api/jobs',async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort();}else await route.continue();});
    await page.locator('#start').click();await page.locator('#error').waitFor();
    await page.unroute('**/api/jobs');await page.locator('#retry').click();await page.locator('#detail[data-phase="READY"]').waitFor();
    assert.equal(await page.locator('.job-item').count(),savedCount+1);
    await page.locator('#start:enabled').click();await page.waitForFunction(count=>document.querySelectorAll('.job-item').length===count,savedCount+2);
    report.uncertainWriteRecovery=true;
    await page.close();writeFileSync(`${artifact}/report.json`,JSON.stringify(report,null,2)+'\n');
    console.log('BINRAT local Den browser: PASS (7 widths, restart, return, Case/export, cancel, expiry/coverage/budget, failed refresh, uncertain write)');
  }finally{await browser?.close();await app.close();rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
