/* Native pinned Chromium. Public transport replay and controlled states are never live proof. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const runner = process.env.BINRAT_FRONTDOOR_TOOLS ? require('node:module').createRequire(path.join(process.env.BINRAT_FRONTDOOR_TOOLS, 'runner.cjs')) : require;
const { chromium } = runner('playwright');
assert.equal(runner('playwright/package.json').version, '1.56.1');
const root = path.resolve(__dirname, '../..');
const base = process.env.BINRAT_FRONTDOOR_URL || 'http://127.0.0.1:4189';
const beforeBase = process.env.BINRAT_A1_BEFORE_URL;
const out = path.resolve(root, process.env.BINRAT_FRONTDOOR_OUTPUT || '.artifacts/v3-frontdoor/browser');
fs.mkdirSync(out, { recursive: true });
const feed = JSON.parse(fs.readFileSync(path.join(root, 'docs/receipts/sprint-a1/public-feed.json')));
const status = JSON.parse(fs.readFileSync(path.join(root, 'docs/receipts/sprint-a1/public-status.json')));
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.artifacts/v3-frontdoor/manifest.json')));
const report = { sourceSha: manifest.sourceSha, sourceDirty: manifest.sourceDirty, checks: [], errors: [], measurements: [], requests: [], provenance: 'RECORDED_PRODUCTION_PUBLIC_GET_REPLAY', controls: 'SIMULATED_ADVERSE_STATES', ownerVisualApproval: 'PENDING', productionAuthorization: false, verdict: 'FAIL' };
const allowed = p => ['/api/status', '/api/launches/latest'].includes(p) || /^\/api\/creator\/0x[0-9a-f]{40}\/summary$/.test(p);
const tab = (p, s) => p.getByRole('tab', { name: new RegExp('\\b' + s + '\\b') });
async function check(name, fn) { await fn(); report.checks.push(name); console.log('PASS ' + name); }
async function capture(p, name) { await p.screenshot({ path: path.join(out, name + '.png') }); }
async function noOverflow(p, width) { assert.ok(await p.evaluate(() => document.documentElement.scrollWidth) <= width + 1, 'overflow at ' + width); }
async function settle(p) { await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(i => i.loading !== 'lazy').map(i => i.decode())); }); }
async function contextFor(b, viewport, state = { feed, status }) {
  const c = await b.newContext({ viewport, reducedMotion: 'reduce' });
  await c.addInitScript(() => {
    window.__a1Vitals = { cls: 0 };
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__a1Vitals.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  c.on('page', p => {
    p.on('pageerror', e => report.errors.push(e.message));
    p.on('request', r => report.requests.push({ url: r.url(), method: r.method() }));
    p.on('response', r => { if (!new URL(r.url()).pathname.startsWith('/api/') && r.status() >= 400) report.errors.push('STATIC_' + r.status() + ':' + r.url()); });
  });
  await c.route('**/api/**', async route => {
    const p = new URL(route.request().url()).pathname;
    assert.equal(route.request().method(), 'GET'); assert.ok(allowed(p), p);
    if (state.delayMs) await new Promise(r => setTimeout(r, state.delayMs));
    if (p.startsWith('/api/creator/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"REPLAY_HAS_NO_CREATOR_DETAIL"}' });
    return route.fulfill({ status: state.unavailable ? 503 : 200, contentType: 'application/json', body: JSON.stringify(state.unavailable ? { error: 'SIMULATED_UNAVAILABLE' } : p.endsWith('/status') ? state.status : state.feed) });
  });
  return c;
}
async function visit(c, route = '/', origin = base) {
  const p = await c.newPage();
  const r = await p.goto(origin + route, { waitUntil: 'networkidle' });
  assert.equal(r.status(), 200); await settle(p); return p;
}
async function open(p, id) {
  const card = p.locator('[data-case-id="' + id + '"]');
  if (!await card.count()) await p.getByRole('button', { name: /^SHOW ALL/ }).click();
  await p.locator('[data-case-id="' + id + '"]').click();
  assert.equal(await p.locator('#vl-case').getAttribute('data-case'), id);
  assert.equal(new URL(p.url()).pathname, '/bag/' + id);
}
async function recheck(p) { await p.getByRole('button', { name: 'RECHECK', exact: true }).click(); await p.getByRole('button', { name: 'RECHECK', exact: true }).waitFor(); }
(async () => {
  const { canonicalSnapshotDigest } = await import(pathToFileURL(path.join(root, 'web/snapshot-contract.js')));
  const b = await chromium.launch({ headless: true }); report.browser = b.version();
  try {
    for (const [width, height] of [[1440,900],[768,1024],[390,844],[320,800],[430,932],[360,800],[1024,768]]) {
      const c = await contextFor(b, { width, height });
      if (beforeBase && [1440,768,390,320].includes(width)) {
        const before = await visit(c, '/', beforeBase); await capture(before, `before-${width}x${height}`); await before.close();
      }
      const p = await visit(c);
      await check(`${width}x${height} frontdoor, visible CTA, bounded feed, art and fonts`, async () => {
        assert.equal(await p.locator('#vl-case').count(), 0);
        assert.match(await p.locator('h1').innerText(), /YOU CAN'T WATCH\s+ALL THIS SHIT./);
        assert.equal(await p.locator('[data-case-id]').count(), Math.min(4, feed.launches.length));
        assert.match(await p.locator('body').innerText(), /automatically finds Pons launches/);
        assert.match(await p.locator('.a1-explainer').innerText(), /More Rats are in the works/);
        assert.match(await p.locator('body').innerText(), /Unnamed launch/);
        assert.equal(await p.locator('[data-read-state]').getAttribute('data-read-state'), 'STALE_VERIFIED');
        const cta = await p.getByRole('button', { name: 'START DIGGING' }).boundingBox();
        assert.ok(cta && cta.y + cta.height <= height && cta.x >= 0 && cta.x + cta.width <= width + 1, 'CTA outside first viewport');
        const cls = await p.evaluate(() => window.__a1Vitals.cls); assert.ok(cls <= 0.1, 'CLS ' + cls);
        const world = await p.locator('.vl-world img').evaluateAll(es => es.every(e => e.complete && e.naturalWidth > 0)); assert.equal(world, true);
        assert.ok(await p.evaluate(() => document.fonts.check('17px "VL Sans"') && document.fonts.check('14px "VL Mono"')));
        report.measurements.push({ width, height, cta, cls }); await noOverflow(p, width);
      });
      await capture(p, `after-${width}x${height}`);
      await check(`${width}x${height} discovery filters, recurrence and deliberate selection`, async () => {
        const apiBefore = report.requests.filter(r => new URL(r.url).pathname.startsWith('/api/')).length;
        await p.getByRole('button', { name: 'START DIGGING' }).click();
        assert.equal(await p.locator('#vl-finds').evaluate(e => e === document.activeElement), true);
        assert.ok((await p.locator('#vl-finds').boundingBox()).y >= -1);
        await p.getByRole('button', { name: 'Familiar deployers', exact: true }).click();
        const expected = feed.launches.filter(l => l.priorLaunchCount > 0);
        assert.equal(await p.locator('[data-case-id]').count(), Math.min(4, expected.length));
        const ids = await p.locator('[data-case-id]').evaluateAll(es => es.map(e => e.dataset.caseId));
        assert.ok(ids.every(id => expected.some(l => l.launchId === id)));
        assert.equal(report.requests.filter(r => new URL(r.url).pathname.startsWith('/api/')).length, apiBefore);
      });
      // Assert IDs outside an async predicate so failures remain precise.
      const ids = await p.locator('[data-case-id]').evaluateAll(es => es.map(e => e.dataset.caseId));
      assert.ok(ids.every(id => feed.launches.some(l => l.launchId === id && l.priorLaunchCount > 0)));
      await capture(p, `discovery-${width}x${height}`);
      await p.getByRole('button', { name: 'Latest launches', exact: true }).click();
      await open(p, feed.launches[0].launchId); await settle(p);
      await check(`${width}x${height} exact Case, WHY → TRAIL → RECEIPTS → NEXT, keyboard and return`, async () => {
        assert.equal(await p.locator('#vl-case').evaluate(e => e === document.activeElement), true);
        await capture(p, `case-${width}x${height}`);
        const cta = await p.locator('.vl-case-intro .vl-primary').boundingBox(); assert.ok(cta.y + cta.height <= height, 'Case CTA outside viewport');
        for (const stage of ['WHY','TRAIL','RECEIPTS','NEXT']) {
          assert.equal(await tab(p, stage).getAttribute('aria-selected'), 'true');
          if (stage === 'RECEIPTS') {
            await p.locator('summary').click(); const receipt = JSON.parse(await p.locator('pre').innerText());
            assert.equal(receipt.launchId, feed.launches[0].launchId); assert.equal(receipt.token, feed.launches[0].token); assert.equal(receipt.feedDigest, status.feedDigest);
          }
          if (stage === 'NEXT') assert.match(await p.getByRole('tabpanel').innerText(), /UNAVAILABLE ON THIS SITE/);
          await noOverflow(p, width);
          if (stage !== 'NEXT') {
            await p.locator('.vl-case-intro .vl-primary').click();
            if (width <= 700) assert.ok((await p.locator('.vl-case-steps').boundingBox()).y >= -1 && (await p.locator('.vl-case-steps').boundingBox()).y < height / 2, 'advanced stage visible on mobile');
          }
        }
        await tab(p,'NEXT').press('Home'); await tab(p,'WHY').press('ArrowRight'); assert.equal(await tab(p,'TRAIL').getAttribute('aria-selected'),'true');
        await p.getByRole('button', { name: 'BACK TO DISCOVERY' }).click();
        assert.equal(await p.locator('#vl-case').count(), 0);
        assert.equal(await p.locator('[data-case-id="' + feed.launches[0].launchId + '"]').evaluate(e => e === document.activeElement), true);
      });
      await c.close();
    }
    const c = await contextFor(b, { width:390, height:844 }); const p = await visit(c);
    await check('browser back/forward, reload and exact deep links', async () => {
      await open(p, feed.launches[1].launchId); await p.goBack(); assert.equal(await p.locator('#vl-case').count(),0);
      await p.goForward(); assert.equal(await p.locator('#vl-case').getAttribute('data-case'),feed.launches[1].launchId);
      await p.reload({waitUntil:'networkidle'}); assert.equal(await p.locator('#vl-case').getAttribute('data-case'),feed.launches[1].launchId);
      for(const route of ['/bag/'+feed.launches[2].launchId,'/?case='+feed.launches[2].launchId]) { await p.goto(base+route,{waitUntil:'networkidle'}); assert.equal(await p.locator('#vl-case').getAttribute('data-case'),feed.launches[2].launchId); }
      for(const route of ['/bag/'+'f'.repeat(64),'/?case=','/?case=not-a-case','/bag/'+feed.launches[0].launchId+'?case='+feed.launches[1].launchId]) { await p.goto(base+route,{waitUntil:'networkidle'}); assert.match(await p.getByRole('alert').innerText(),/No replacement Case/); }
    });
    await check('targeted H3: unavailable Case skip destination and exact source', async () => {
      assert.equal(await p.locator('#vl-case').getAttribute('aria-label'), 'Requested Case unavailable');
      await p.goto(base + '/bag/' + 'f'.repeat(64), { waitUntil: 'networkidle' });
      assert.equal(await p.getByRole('link', { name: 'CHECK EXACT SOURCE RECORD' }).getAttribute('href'), '/api/bag/' + 'f'.repeat(64));
      assert.equal(await p.locator('#vl-case').evaluate(e => e === document.activeElement), true);
    });
    await check('compact approved crew, inactive future jobs, keyboard Escape',async()=>{
      await p.goto(base,{waitUntil:'networkidle'}); await p.locator('.a1-crew summary').click();
      assert.match(await p.locator('.a1-crew-content').innerText(),/TRIPWIRE\s+BUILDING/); assert.match(await p.locator('.a1-crew-content').innerText(),/SNIFFER\s+PROVING/); assert.match(await p.locator('.a1-crew-content').innerText(),/FUTURE RATS · LOCKED/);
      await capture(p,'crew-mobile'); await p.locator('.a1-crew summary').press('Escape'); assert.equal(await p.locator('.a1-crew').getAttribute('open'),null);
    });
    await check('historical routes fail closed; synthetic lab remains isolated',async()=>{
      for(const route of ['/radar','/watch','/replay','/unknown-route']) {await p.goto(base+route,{waitUntil:'networkidle'});assert.match(await p.locator('body').innerText(),/NOT IN THIS BUILD/);}
      const n=report.requests.filter(r=>new URL(r.url).pathname.startsWith('/api/')).length;
      await p.goto(base+'/visual-lab',{waitUntil:'networkidle'});assert.match(await p.locator('.vl-lab-stamp').innerText(),/SYNTHETIC/);assert.equal(report.requests.filter(r=>new URL(r.url).pathname.startsWith('/api/')).length,n);
      await p.goto(base+'/?visual=lab',{waitUntil:'networkidle'});assert.match(await p.locator('h1').innerText(),/RAT ZERO IS DIGGING/);assert.doesNotMatch(await p.locator('body').innerText(),/SYNTHETIC INVESTIGATION/);
    });await c.close();
    for(const name of ['http-503','verified-empty','no-recurrence','partial-metadata','wrong-chain','tampered-digest','retained-after-503','fresh-bound-replay','expired-freshness','bad-checkpoint-hash','no-snapshot','future-timestamp']) {
      const state={feed:structuredClone(feed),status:structuredClone(status)};
      if(['fresh-bound-replay','expired-freshness','retained-after-503'].includes(name)) {Object.assign(state.status,{state:'FRESH_VERIFIED',verifiedAtMs:Date.now()-1000,runtimeUpdatedAtMs:Date.now()-1000,freshnessValidUntilMs:Date.now()+60000,lastSyncError:null});}
      if(name==='expired-freshness')state.status.freshnessValidUntilMs=Date.now()-1;
      if(name==='http-503')state.unavailable=true;
      if(name==='bad-checkpoint-hash')state.status.checkpointBlockHash='0x'+'f'.repeat(64);
      if(name==='no-snapshot'){state.status.state='NO_VERIFIED_SNAPSHOT';for(const k of ['checkpointBlock','checkpointBlockHash','feedDigest','verifiedAtMs','publicationVersion','freshnessValidUntilMs'])state.status[k]=null;}
      if(name==='future-timestamp')state.status.verifiedAtMs=Date.now()+100000;
      if(name==='verified-empty')state.feed.launches=[];
      if(name==='no-recurrence')state.feed.launches.forEach(l=>l.priorLaunchCount=0);
      if(name==='partial-metadata'){state.feed.launches[0].name='Name without symbol';state.feed.launches[1].symbol='SYMBOLONLY';}
      if(['verified-empty','no-recurrence','partial-metadata'].includes(name)){state.feed.feedDigest=await canonicalSnapshotDigest(state.feed);state.status.feedDigest=state.feed.feedDigest;}
      if(name==='wrong-chain')state.feed.chainId=5042;
      if(name==='tampered-digest')state.feed.launches[0].symbol='TAMPERED';
      const c=await contextFor(b,{width:390,height:844},state);const p=await visit(c);
      await check('controlled '+name+' truth and recovery',async()=>{
        if(name==='retained-after-503'){await open(p,state.feed.launches[0].launchId);state.unavailable=true;await recheck(p);assert.equal(await p.locator('#vl-case').getAttribute('data-case'),feed.launches[0].launchId);assert.match(await p.getByRole('alert').innerText(),/Last verified snapshot retained/);}
        else if(name==='verified-empty')assert.match(await p.locator('#vl-finds').innerText(),/Verified empty feed/);
        else if(name==='no-recurrence'){await p.getByRole('button',{name:'Familiar deployers',exact:true}).click();assert.equal(await p.locator('[data-case-id]').count(),0);assert.match(await p.locator('#vl-finds').innerText(),/No familiar deployers/);}
        else if(name==='partial-metadata'){assert.match(await p.locator('#vl-finds').innerText(),/Name without symbol/);assert.match(await p.locator('#vl-finds').innerText(),/SYMBOLONLY/);}
        else if(['fresh-bound-replay','expired-freshness'].includes(name)){assert.equal(await p.locator('[data-read-state]').getAttribute('data-read-state'),name==='fresh-bound-replay'?'FRESH_VERIFIED':'STALE_VERIFIED');assert.match(await p.locator('.vl-live').innerText(),name==='fresh-bound-replay'?/LIVE/:/PAUSED/);}
        else {assert.equal(await p.locator('[data-case-id]').count(),0);assert.match(await p.locator('#vl-finds').innerText(),/Nothing was substituted/);}
        await noOverflow(p,390);await capture(p,'controlled-'+name);
      });await c.close();
    }
    await check('targeted H2: recheck retains Case, receipt focus and scroll; reduced motion and bounded reads', async () => {
      const state = { feed: structuredClone(feed), status: structuredClone(status) };
      const c = await contextFor(b, { width:390, height:844 }, state);
      const n = report.requests.filter(r => new URL(r.url).pathname.startsWith('/api/')).length;
      const p = await visit(c);
      assert.ok(report.requests.filter(r => new URL(r.url).pathname.startsWith('/api/')).length - n <= 3, 'at most one aborted strict-mode read plus feed and status');
      await open(p, feed.launches[0].launchId);
      await p.getByRole('tab', { name:/\bRECEIPTS\b/ }).click();
      await p.locator('summary').click();
      await p.locator('summary').focus(); await p.locator('summary').evaluate(e => e.scrollIntoView());
      const y = await p.evaluate(() => scrollY);
      state.unavailable = true;
      await p.getByRole('button', { name:'RECHECK', exact:true }).evaluate(e => e.click());
      await p.getByRole('button', { name:'RECHECK', exact:true }).waitFor();
      assert.equal(await p.locator('#vl-case').getAttribute('data-case'), feed.launches[0].launchId);
      assert.ok(Math.abs(await p.evaluate(() => scrollY) - y) < 5, 'retry must not jump to page top');
      assert.equal(await p.locator('summary').evaluate(e => e === document.activeElement), true);
      assert.equal(await p.locator('.a1-active-case').evaluate(e => getComputedStyle(e).animationName), 'none');
      assert.equal(await p.locator('.vl-primary').evaluate(e => getComputedStyle(e).transitionDuration), '0s');
      await p.getByRole('button', { name:'COPY CASE LINK' }).click();
      await p.locator('.a1-case-navigation [role=status]').filter({ hasText: /Case link copied|exact Case link/ }).waitFor();
      assert.match(await p.locator('.a1-case-navigation [role=status]').innerText(), /Case link copied|exact Case link/);
      await c.close();
    });
    await check('delayed unavailable read has checking UI and retained exact URL',async()=>{
      const c=await contextFor(b,{width:320,height:800},{feed,status,unavailable:true,delayMs:1500});const p=await c.newPage();await p.goto(base+'/bag/'+feed.launches[0].launchId,{waitUntil:'domcontentloaded'});await p.locator('.vl-loading-case').waitFor();assert.equal(await p.locator('.vl-find').count(),0);await p.getByRole('button',{name:'RECHECK',exact:true}).waitFor();assert.match(await p.getByRole('alert').innerText(),/exact Case link is preserved/);assert.equal(new URL(p.url()).pathname,'/bag/'+feed.launches[0].launchId);await capture(p,'controlled-case-unavailable');await c.close();
    });
    await check('same-origin public GETs only, bounded initial activity, no broken assets or JS errors',async()=>{
      for(const r of report.requests){assert.equal(r.method,'GET');const u=new URL(r.url);assert.ok([new URL(base).origin,beforeBase&&new URL(beforeBase).origin].includes(u.origin));if(u.pathname.startsWith('/api/'))assert.ok(allowed(u.pathname));}assert.deepEqual(report.errors,[]);
    });
    report.verdict='PASS';console.log('FRONTDOOR_BROWSER_PASS '+report.checks.length);
  } finally {await b.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
