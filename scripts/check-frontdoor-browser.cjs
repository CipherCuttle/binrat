const assert = require('node:assert/strict');
const { mkdirSync,readFileSync,writeFileSync } = require('node:fs');
const { chromium } = require('playwright');
const fixture=JSON.parse(readFileSync(process.env.BINRAT_BROWSER_FIXTURE_FILE??'.artifacts/public-truth/browser-fixtures.json','utf8'));
assert.equal(fixture.synthetic,true,'local fixtures must be explicitly synthetic');
const baseUrl = process.env.BINRAT_FRONTDOOR_URL ?? 'http://127.0.0.1:4173';
const artifactDir = 'browser-artifacts/frontdoor';
mkdirSync(artifactDir, { recursive: true });
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'phone', width: 430, height: 932 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'small-demo', width: 320, height: 844 },
  { name: 'phone-demo', width: 360, height: 844 },
  { name: 'tablet-demo', width: 768, height: 900 },
];
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{}), args: ['--no-sandbox'] });
  const receipt={status:'PASS',synthetic:true,viewports:[],consoleErrors:[],writes:[]};
  try {
    async function bind(context) {
      await context.route('**/api/**',async route=>{
        const entry=fixture.routes[new URL(route.request().url()).pathname];
        await route.fulfill(entry?{status:entry.status,contentType:'application/json',body:JSON.stringify(entry.body)}:{status:404,body:'{}'});
      });
    }
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      await bind(context);
      const page = await context.newPage();
      const errors = [], writes = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
      await page.goto(`${baseUrl}/?fixtures=1`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.body.dataset.readState === 'FIXTURE_DATA');
      assert.equal((await page.locator('#hero-title').innerText()).replace(/\s+/g, ' ').trim(), "YOU CAN'T WATCH ALL THIS SHIT. RAT ZERO IS DIGGING.");
      assert.equal(await page.locator('#dumpster-view').isVisible(), false);
      assert.match(await page.locator('.availability-strip').innerText(), /RAT ZERO · LIVE[\s\S]*TRIPWIRE · BUILDING[\s\S]*SNIFFER · PROVING/);
      assert.match(await page.locator('#home-freshness').innerText(), /FIXTURE.*NOT LIVE EVIDENCE/);
      assert.equal(await page.locator('[data-open-case]').count(), 3);
      assert.equal(await page.locator('#token-status').count(), 0);
      const primary = page.locator('.hero-actions a[href="#garbage"]');
      const primaryBox = await primary.boundingBox();
      assert.ok(primaryBox && primaryBox.height >= 44, 'primary touch target must be usable');
      assert.ok(primaryBox.y + primaryBox.height <= viewport.height, `first viewport must expose START DIGGING at ${viewport.width}`);
      const availability = await page.locator('.availability-strip').boundingBox();
      assert.ok(availability.y + availability.height <= viewport.height, `availability must not be buried at ${viewport.width}`);
      assert.ok(await primary.evaluate((element) => parseFloat(getComputedStyle(element).fontSize) >= 16), 'primary CTA copy must be readable');
      let lastTop = 0;
      for (const selector of ['#fresh-proof', '#crew', '#telegram', '#how', '#working-rat']) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box && box.y > lastTop, `homepage order drift: ${selector}`);
        lastTop = box.y;
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `horizontal overflow at ${viewport.width}`);
      await page.screenshot({ path: `${artifactDir}/${viewport.name}-${viewport.width}x${viewport.height}.png` });
      await page.screenshot({ path: `${artifactDir}/${viewport.name}-full.png`, fullPage: true });
      await page.locator('[data-open-case]').first().click();
      await page.locator('#drawer.open').waitFor();
      assert.match(await page.locator('#drawer').innerText(), /NOT LIVE EVIDENCE/);
      assert.match(await page.locator('.case-opening').innerText(), /RAT ZERO FOUND SOMETHING\.[\s\S]*SMELLS FAMILIAR\.[\s\S]*8 earlier indexed launches/);
      assert.match(await page.locator('.case-path').innerText(), /WHAT[\s\S]*TRAIL[\s\S]*RECEIPTS[\s\S]*NEXT/);
      assert.match(await page.locator('#drawer').innerText(), /01 \/ SUPPORTED FACTS[\s\S]*02 \/ FOLLOW THE TRAIL/);
      assert.match(await page.locator('.case-next-step').innerText(), /NEXT \/ CURRENT WATCH[\s\S]*Where enabled, Watch can alert you[\s\S]*Watch is not Tripwire[\s\S]*TRIPWIRE · BUILDING[\s\S]*Persistent Tripwire jobs are not available yet/);
      assert.equal(await page.locator('.case-next-step a[href="https://t.me/BinratBot"]').count(), 1);
      assert.equal(await page.locator('[data-copy-watch-subject]').count(), 1);
      await page.locator('[data-crew-handoff]').click();
      await page.waitForFunction(() => !document.querySelector('#drawer').classList.contains('open'));
      await page.locator('#crew-selected[data-rat="tripwire"]').waitFor();
      assert.match(await page.locator('#crew-selected').innerText(), /BUILDING · NOT AVAILABLE YET/);
      assert.equal(await page.locator('#crew-selected a').count(), 0);
      assert.equal(await page.locator('.locked-slot').count(), 2);
      await page.locator('[data-select-rat="sniffer"]').click();
      assert.match(await page.locator('#crew-selected').innerText(), /PROVING · NOT AVAILABLE YET/);
      assert.equal(await page.locator('#crew-selected a').count(), 0);
      await page.locator('[data-select-rat="rat-zero"]').click();
      assert.equal(await page.locator('[data-select-rat="rat-zero"]').getAttribute('aria-pressed'), 'true');
      // The URL is still #crew-tripwire after manual selection; repeating that link must restore Tripwire.
      await page.locator('.crew-overview a[href="#crew-tripwire"]').click();
      assert.equal(await page.locator('#crew-selected').getAttribute('data-rat'), 'tripwire');
      await page.locator('[data-select-rat="rat-zero"]').click();
      await page.locator('#crew-selected a[href="#garbage"]').click();
      await page.waitForFunction(() => document.body.dataset.view === 'dumpster');
      assert.equal(await page.locator('#hero-title').isVisible(), false);
      assert.equal(await page.locator('#garbage').isVisible(), true);
      await page.locator('[data-bag-id]').first().focus();
      await page.keyboard.press('Enter');
      await page.locator('#drawer.open').waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-bag-id]').first().evaluate((element) => element === document.activeElement), true);
      await page.locator('.brand').click();
      await page.waitForFunction(() => document.body.dataset.view === 'home');
      assert.equal(await primary.isVisible(), true);
      assert.equal(await page.locator('.site-header > nav a[href="#den"]').count(), 0);
      assert.equal(await page.locator('.section-nav a[href="#den"]').count(), 0);
      await page.locator('.availability-note a[href="#den"]').click();
      await page.locator('#den').waitFor();
      assert.match(await page.locator('#den').innerText(), /THE DEN · PLANNED · POST-LAUNCH[\s\S]*No production workforce/);
      assert.equal(await page.locator('.telegram-return a[href="https://t.me/BinratBot"]').count(), 1);
      assert.deepEqual(writes, [], 'browsing cannot create jobs or send writes');
      assert.deepEqual(errors, [], `page errors at ${viewport.width}`);
      receipt.viewports.push(viewport.width);
      await context.close();
    }
    const context=await browser.newContext();await bind(context);
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?fixtures=1#garbage`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#garbage').isVisible(), true);
    assert.equal(await page.locator('#hero-title').isVisible(), false);
    assert.equal(new URL(page.url()).hash, '#garbage');
    await page.close();await context.close();
    // Actual LIVE adapter: full binding, tampering, unavailable, stale retention.
    receipt.liveViewports=[];
    const {assertPublicTruth}=await import('./lib/public-acceptance.mjs');
    for(const width of [390,430,1024,1440]) {
      const context=await browser.newContext({viewport:{width,height:900}});await bind(context);
      const page=await context.newPage();const writes=[],errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method())) writes.push(r.url());});
      await page.goto(baseUrl,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.body.dataset.readState==='FRESH_VERIFIED');
      assertPublicTruth({capabilities:fixture.routes['/api/capabilities'].body,funding:fixture.routes['/api/dumpster-ledger'].body,customerText:await page.locator('body').innerText()});
      assert.equal(await page.locator('button,a').evaluateAll(elements=>elements.filter(e=>/^(EMPLOY|START TRIPWIRE|STAKE NOW|UNLOCK LABOR)/i.test(e.textContent.trim())).length),0);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
      await page.screenshot({path:`${artifactDir}/live-${width}.png`});receipt.liveViewports.push(width);await context.close();
    }
    const live=await browser.newContext({viewport:{width:390,height:844}});await bind(live);
    const lp=await live.newPage();const errors=[];lp.on('pageerror',e=>errors.push(e.message));
    await lp.goto(baseUrl,{waitUntil:'networkidle'});await lp.waitForFunction(()=>document.body.dataset.readState==='FRESH_VERIFIED');
    assert.match(await lp.locator('#home-freshness').innerText(),/Showing verified Pons launches/);
    await lp.locator('[data-open-case]').first().click();await lp.locator('#drawer.open').waitFor();
    assert.match(await lp.locator('.share-card-kicker').innerText(),/FRESH AT CAPTURE/);
    await live.route('**/api/status',route=>route.fulfill({status:503,body:'{}'}));
    // A visibility transition schedules an immediate status read, through the real read plane.
    await lp.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await lp.waitForFunction(()=>document.body.dataset.readState==='STALE_VERIFIED');
    assert.match(await lp.locator('.share-card-kicker').innerText(),/STALE VERIFIED/);
    assert.equal(await lp.locator('[data-open-case]').count(),3);assert.deepEqual(errors,[]);
    await live.close();
    for(const failure of ['tamper','binding','unavailable','future-time']) {
      const context=await browser.newContext();await bind(context);
      const routePath=['binding','future-time'].includes(failure)?'/api/status':'/api/launches/latest';
      await context.route('**'+routePath,route=>{
        const body=JSON.parse(JSON.stringify(fixture.routes[routePath].body));
        if(failure==='tamper') body.launches[0].symbol='TAMPERED';
        if(failure==='binding') body.checkpointBlockHash='0x'+'f'.repeat(64);
        if(failure==='future-time') {body.state='STALE_VERIFIED';body.verifiedAtMs=Date.now()+1_000_000;}
        return route.fulfill({status:failure==='unavailable'?503:200,contentType:'application/json',body:JSON.stringify(body)});
      });
      const page=await context.newPage();await page.goto(baseUrl,{waitUntil:'networkidle'});
      if(failure==='future-time') {
        await page.waitForFunction(()=>document.body.dataset.readState==='STALE_VERIFIED');
        assert.doesNotMatch(await page.locator('#home-freshness').innerText(),/snapshot verified/);await context.close();continue;
      }
      await page.waitForFunction(()=>document.body.dataset.readState==='UNAVAILABLE_NO_DATA');
      assert.equal(await page.locator('[data-open-case]').count(),0);assert.match(await page.locator('#home-freshness').innerText(),/unavailable/i);
      await context.close();
    }
    const mini=await browser.newContext();const mp=await mini.newPage();await mp.goto(baseUrl+'/app/',{waitUntil:'networkidle'});
    assert.match(await mp.locator('body').innerText(),/PRIVATE.*PREVIEW|Open.*Telegram|Telegram/i);await mini.close();
    receipt.liveScenarios=['fresh_case','stale_retention','tampering','conflicting_binding','unavailable','mini_app_unauthorized','future_timestamp_suppressed'];
    writeFileSync(artifactDir+'/receipt.json',JSON.stringify(receipt,null,2));

  } finally { await browser.close(); }
  console.log('BINRAT frontdoor journey browser smoke: PASS (7 viewports, Case/Crew/Den/discovery, no writes)');
})().catch((error) => { console.error(error); process.exit(1); });
