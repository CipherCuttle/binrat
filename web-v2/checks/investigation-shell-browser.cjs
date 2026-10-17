/* Pinned, bounded compiled-browser acceptance. All API responses are recorded
   public Pons data or explicitly simulated controls; never live provider proof. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
const runner = createRequire(path.join(process.env.BINRAT_FRONTDOOR_TOOLS, 'runner.cjs'));
assert.equal(runner('playwright/package.json').version, '1.56.1');
const { chromium } = runner('playwright');
const root = path.resolve(__dirname, '../..');
const site = path.join(root, '.artifacts/v3-frontdoor/site');
const out = path.join(root, '.artifacts/investigation-shell/browser');
const feed = JSON.parse(fs.readFileSync(path.join(root,'docs/receipts/sprint-a1/public-feed.json')));
const status = JSON.parse(fs.readFileSync(path.join(root,'docs/receipts/sprint-a1/public-status.json')));
const envelope = JSON.parse(fs.readFileSync(path.join(root,'docs/receipts/sprint-a1-2-contract/old-case-envelope.json')));
const capture = JSON.parse(fs.readFileSync(path.join(root,'docs/receipts/sprint-a1-2-contract/production-records.json')));
const manifest = JSON.parse(fs.readFileSync(path.join(root,'.artifacts/v3-frontdoor/manifest.json')));
const report = {source:manifest.sourceSha, sourceDirty:manifest.sourceDirty, provenance:'RECORDED_PUBLIC_PONS_REPLAY',
  controls:'EXPLICIT_SIMULATED_ADVERSE_STATES', liveProvider:false, send:false, ownerVisualApproval:'PENDING',
  tests:[], requests:[], errors:[], metrics:[], screenshots:[], apiRequestCeiling:160, verdict:'FAIL'};
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  const file=path.resolve(site,'.'+pathname);
  const valid=file.startsWith(site+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile();
  const target=valid?file:!path.extname(pathname)?path.join(site,'index.html'):null;
  if(!target){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream'});
  fs.createReadStream(target).pipe(res);
});
let base;
async function check(name,fn){await fn();report.tests.push(name);console.log('PASS '+name);}
async function shot(page,name){await page.screenshot({path:path.join(out,name+'.png')});report.screenshots.push(name+'.png');}
async function ready(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});}
async function noOverflow(page,width){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+1,'overflow '+width);}
async function context(browser,width=390,height=844,state={feed,status}) {
  const ctx=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',hasTouch:width<700});
  ctx.on('page',page=>{
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('request',r=>{assert.equal(new URL(r.url()).origin,base,'external network');assert.equal(r.method(),'GET');});
    page.on('response',r=>{if(r.status()>=400&&!new URL(r.url()).pathname.startsWith('/api/'))report.errors.push('STATIC_'+r.status()+':'+r.url());});
  });
  await ctx.route('**/api/**',async route=>{
    const p=new URL(route.request().url()).pathname;
    assert.equal(route.request().method(),'GET');
    assert.ok(['/api/status','/api/launches/latest'].includes(p)||/^\/api\/creator\/0x[0-9a-f]{40}\/summary$/.test(p)||/^\/api\/bag\/[0-9a-f]{64}(\/evidence)?$/.test(p),p);
    report.requests.push({path:p,method:route.request().method()});
    assert.ok(report.requests.length<=report.apiRequestCeiling,'request ceiling');
    let code=404,body={error:'RECORDED_SOURCE_NOT_INCLUDED'};
    if(p==='/api/status'){code=state.unavailable?503:200;body=state.status;}
    else if(p==='/api/launches/latest'){code=state.unavailable?503:200;body=state.feed;}
    else if(state.envelope&&p==='/api/bag/'+state.envelope.material.caseId+'/evidence'){code=200;body=state.envelope;}
    await route.fulfill({status:code,contentType:'application/json',body:JSON.stringify(body)});
  });
  return ctx;
}
async function visit(ctx,route='/'){const p=await ctx.newPage();await p.goto(base+route,{waitUntil:'networkidle'});await ready(p);return p;}
const nav=(p,w)=>p.locator(w>1040?'.inv-sidebar nav':'.inv-mobile-nav');
const routeLink=(p,w,route)=>nav(p,w).locator('a[data-route="'+route+'"]');
const clone=x=>JSON.parse(JSON.stringify(x));
const compareCase=feed.launches.find(l=>feed.launches.some(other=>other.launchId!==l.launchId&&other.deployer===l.deployer&&BigInt(other.blockNumber)<BigInt(l.blockNumber)));
assert.ok(compareCase,'frozen replay contains no comparable pair');
(async()=>{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});report.browser=browser.version();
  try {
    for(const [width,height] of [[1440,900],[768,1024],[390,844],[320,800]]) {
      const ctx=await context(browser,width,height),page=await visit(ctx);
      const id=feed.launches[0].launchId;
      await check(width+' first-screen finds, loaded art, readable body and touch targets',async()=>{
        assert.match(await page.locator('#a1-title').innerText(),/THE RAT\s+REMEMBERS/);
        assert.ok(await nav(page,width).isVisible());
        assert.equal(await page.locator('[data-case-id]').count(),6);
        assert.equal(await page.locator('.vl-rat-scene img').evaluate(e=>e.complete&&e.naturalWidth>0),true);
        const first=await page.locator('[data-case-id]').first().boundingBox();
        const available=width>1040?height:await nav(page,width).evaluate(e=>e.getBoundingClientRect().top);
        assert.ok(first&&first.y+first.height<=available,'first whole Case below viewport: '+JSON.stringify({first,available}));
        const sizes=await nav(page,width).locator('a[data-route]').evaluateAll(es=>es.map(e=>({h:e.getBoundingClientRect().height,w:e.getBoundingClientRect().width})));
        assert.ok(sizes.every(s=>s.h>=44&&s.w>=44),'nav touch targets');
        if(width<=390) {
          const second=await page.locator('[data-case-id]').nth(1).boundingBox();
          assert.ok(second&&second.y+second.height<=available,
            'second whole Case below mobile navigation: '+JSON.stringify({first,second,available}));
        }
        report.metrics.push({width,height,firstFindTop:first.y,firstFindBottom:first.y+first.height,available});
        await noOverflow(page,width);
      });
      await check(width+' warm paper hierarchy and individual dossier tickets',async()=>{
        const shellColor=await page.locator('.inv-layout').evaluate(el=>getComputedStyle(el).backgroundColor);
        assert.equal(shellColor,'rgb(238, 232, 222)','workspace must be light');
        const firstTicket=page.locator('[data-case-id]').first();
        assert.equal(await firstTicket.evaluate(el=>getComputedStyle(el).borderLeftWidth),'3px');
        const ticketGradient=await firstTicket.evaluate(el=>getComputedStyle(el).backgroundImage);
        assert.match(ticketGradient,/linear-gradient/);
        const heroColor=await page.locator('.inv-arrival').evaluate(el=>getComputedStyle(el).backgroundColor);
        assert.equal(heroColor,'rgb(33, 27, 43)','canonical alley hero must retain dark art');
        await noOverflow(page,width);
      });
      await check(width+' Paperwork V2 contrast, source sigils and usable find hierarchy',async()=>{
        const contrast = await page.locator('[data-case-id]').first().evaluate(el => {
          const fg=window.getComputedStyle(el.querySelector('.inv-find-next')).color;
          const bg=window.getComputedStyle(el).backgroundColor;
          const white=[255,254,250]; // paper ticket gradient is deliberately pale
          const nums= s => (s.match(/[0-9.]+/g)||[]).slice(0,3).map(Number);
          const lum = xs=>xs.map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)})
            .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
          const x=lum(nums(fg)),y=lum(white);
          return {fg,bg,ratio:(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
        });
        assert.ok(contrast.ratio>=4.5,'light find action under 4.5 contrast: '+JSON.stringify(contrast));
        assert.equal(await page.locator('.inv-case-sigil').first().evaluate(el=>Math.round(el.getBoundingClientRect().width)),width<=700?(width<=390?22:26):26);
        const splashes=await page.locator('.inv-case-sigil').evaluateAll(els=>els.map(el=>({tag:el.tagName.toLowerCase(), variant:el.getAttribute('data-splash-variant'), bg:getComputedStyle(el).backgroundImage})));
        assert.ok(splashes.length>=1 && splashes.every(x=>x.tag==='span' && /^[0-7]$/.test(x.variant) && x.bg.includes('case-splash-sprite.webp')), 'address splash assignment missing');
        const art=await page.evaluate(async()=>{const im=new Image();im.src='/case-splash-sprite.webp';await im.decode();return {width:im.naturalWidth,height:im.naturalHeight};});
        assert.deepEqual(art,{width:160,height:80},'approved eight-splash sprite missing or corrupt');
        if(width>700)assert.equal(await page.locator('.inv-proof-thread').evaluate(el=>Math.round(el.getBoundingClientRect().width)),54);
      });
      await shot(page,'find-'+width);
      await check(width+' React Bits starter elements honor reduced motion and button semantics',async()=>{
        assert.equal(await page.locator('.rb-spotlight.inv-evidence-lead').count(),1);
        assert.equal(await page.locator('.inv-evidence-lead-tag .rb-shiny-text').count(),1);
        const button=page.locator('.rb-star-border.inv-evidence-lead-action');
        assert.equal(await button.count(),1);
        assert.equal(await button.getAttribute('type'),'button');
        assert.equal(await page.locator('.rb-shiny-text').evaluate(el => getComputedStyle(el).animationName),'none');
        assert.equal(await page.locator('.rb-spotlight').evaluate(el => getComputedStyle(el, '::before').display),'none');
        assert.equal(await page.locator('.rb-star-border').evaluate(el => getComputedStyle(el, '::after').display),'none');
        assert.equal(await page.locator('.inv-proof-thread circle').count(),2);
        assert.equal(await page.locator('.rb-glare-hover[data-case-id]').count(),6);
        assert.equal(await page.locator('.inv-case-sigil').count(),6);
        assert.equal(await page.locator('.rb-glare-hover').first().evaluate(el => getComputedStyle(el, '::after').display),'none');
        await noOverflow(page,width);
      });
      if(width===1440) {
        await page.emulateMedia({reducedMotion:'no-preference'});
        await check('React Bits desktop hover has real pointer spotlight and no DOM/source mutations',async()=>{
          const before=report.requests.length;
          const surface=page.locator('.rb-spotlight');
          await surface.hover();
          const pos=await surface.evaluate(el=>el.style.getPropertyValue('--rb-spot-x'));
          assert.match(pos,/^[0-9.]+px$/,'pointer spotlight did not move');
          assert.notEqual(await page.locator('.rb-shiny-text').evaluate(el=>getComputedStyle(el).animationName),'none');
          assert.equal(report.requests.length,before,'hover must not poll');
        });
        await shot(page,'react-bits-desktop');
        await page.emulateMedia({reducedMotion:'reduce'});
      }
      await check(width+' evidence-based link leads to two real Cases in this window',async()=>{
        const match=page.locator('.inv-evidence-lead');
        assert.match(await match.innerText(),/2 launches share one reported deployer in this window/);
        assert.match(await match.textContent(),/No ownership, risk or profit claim/);
        const before=report.requests.length;
        await page.locator('.inv-evidence-lead-action').click();
        assert.equal(new URL(page.url()).pathname,'/trails');
        assert.equal(await page.getByRole('searchbox').inputValue(),'0x4e0561054f4fabbaa183a8c16ef1f4e125881eaf');
        assert.equal(await page.locator('.inv-deployer-group').count(),1);
        assert.equal(await page.locator('.inv-deployer-group [data-case-id]').count(),2);
        assert.equal(report.requests.length,before,'finding must not spend an additional RPC request');
        await routeLink(page,width,'/').click();
      });
      await check(width+' bounded search, empty recovery and zero search requests',async()=>{
        const before=report.requests.length;
        await page.getByRole('searchbox').fill('ZZZ_NOT_A_REAL_LAUNCH_98765');
        assert.equal(await page.locator('[data-case-id]').count(),0);
        assert.match(await page.getByRole('status').innerText(),/Only these published launches/);
        await page.getByRole('button',{name:'CLEAR SEARCH',exact:true}).click();
        assert.equal(await page.locator('[data-case-id]').count(),6);
        assert.equal(report.requests.length,before);
      });
      await page.locator('[data-case-id="'+id+'"]').click();
      await ready(page);
      await check(width+' exact Case, summary, save and keyboard tabs',async()=>{
        assert.equal(new URL(page.url()).pathname,'/bag/'+id);
        assert.equal(await page.locator('#vl-case').getAttribute('data-case'),id);
        assert.equal(await page.locator('.inv-dossier-index').count(),1);
        assert.match(await page.locator('.inv-dossier-index').innerText(),/THREE SOURCE-BOUND VIEWS/);
        assert.equal(await page.locator('#vl-case').evaluate(el=>getComputedStyle(el).borderTopWidth),'4px');
        assert.match(await page.locator('#vl-case').evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient/);
        assert.match(await page.locator('.vl-case-intro').innerText(),/38 earlier indexed launches/);
        assert.equal(await page.getByRole('tab').count(),3);
        if(width<=700) {
          const geometry=await page.getByRole('tab').evaluateAll(tabs=>tabs.map(tab=>{
            const label=tab.querySelector('strong')?.getBoundingClientRect();
            const box=tab.getBoundingClientRect();
            return {labelLeft:label?.left, labelRight:label?.right, left:box.left, right:box.right};
          }));
          assert.ok(geometry.every(x=>x.labelLeft>=x.left-1&&x.labelRight<=x.right+1),
            'mobile tab label escapes filing-tab hitbox: '+JSON.stringify(geometry));
        }
        const finding=await page.locator('.vl-case-intro').boundingBox(),returnAction=await page.locator('.inv-case-return').boundingBox();
        assert.ok(finding.y<returnAction.y,'return action displaced the finding');
        const save=await page.getByRole('button',{name:'SAVE CASE',exact:true}).boundingBox();
        assert.ok(save&&save.y+save.height<height,'save below first viewport');
        await page.getByRole('button',{name:'SAVE CASE',exact:true}).click();
        assert.ok(await page.getByRole('button',{name:'SAVED ON THIS DEVICE',exact:true}).isVisible());
        assert.equal(await page.locator('.rb-click-spark.inv-save-case').count(),1);
        assert.equal(await page.locator('.rb-spark-burst[aria-hidden="true"]').count(),1);
        assert.equal(await page.locator('.rb-spark-burst').evaluate(el=>getComputedStyle(el).display),'none');
        await noOverflow(page,width);
      });
      await shot(page,'case-'+width);
      await check(width+' verified related Case opens, browser history and receipt fields',async()=>{
        await page.locator('#vl-tab-WHAT').focus();
        await page.locator('#vl-tab-WHAT').press('ArrowRight');
        assert.equal(await page.locator('#vl-tab-TRAIL').getAttribute('aria-selected'),'true');
        assert.equal(await page.locator('.inv-related-cases [data-case-id]').count(),0,'first Case has no older in-window record');
        await page.getByRole('button',{name:'BACK TO FINDS'}).click();
        await page.locator('[data-case-id="'+compareCase.launchId+'"]').click();
        await page.locator('#vl-tab-TRAIL').click();
        const related=page.locator('.inv-related-cases [data-case-id]');
        assert.ok(await related.count()>0,'no in-window trail');
        const relatedId=await related.first().getAttribute('data-case-id');
        const a=compareCase,other=feed.launches.find(l=>l.launchId===relatedId);
        assert.equal(other.deployer,a.deployer);assert.ok(BigInt(other.blockNumber)<BigInt(a.blockNumber));
        await shot(page,'trail-'+width);
        await related.first().click();assert.equal(await page.locator('#vl-case').getAttribute('data-case'),relatedId);
        await page.goBack();assert.equal(await page.locator('#vl-case').getAttribute('data-case'),compareCase.launchId);
        await page.locator('#vl-tab-RECEIPTS').click();
        await page.locator('.vl-receipt summary').click();
        assert.ok((await page.locator('.vl-receipt-body').innerText()).includes(a.txHash));
        await noOverflow(page,width);
        await page.locator('#vl-tab-RECEIPTS').press('Home');
        assert.equal(await page.locator('#vl-tab-WHAT').getAttribute('aria-selected'),'true');
      });
      await check(width+' Casebook persists and reopens exact ID with useful identity',async()=>{
        await routeLink(page,width,'/saved').click();
        await page.reload({waitUntil:'networkidle'});await ready(page);
        assert.equal(await page.locator('.inv-saved-list li').count(),1);
        assert.equal(await page.locator('.inv-casebook .inv-saved-open').count(),1);
        assert.match(await page.locator('.inv-casebook .inv-saved-arrow').innerText(),/OPEN/);
        assert.match(await page.locator('.inv-saved-open').innerText(),/0xea90…daf3/);
        assert.match(await page.locator('.inv-saved-evidence').innerText(),/earlier indexed launches/i);
        const note=page.getByRole('textbox',{name:'Research note for Case '+id});
        await note.fill('Compare receipts before drawing conclusions.');
        await page.reload({waitUntil:'networkidle'});await ready(page);
        assert.equal(await page.getByRole('textbox',{name:'Research note for Case '+id}).inputValue(),'Compare receipts before drawing conclusions.');
        assert.ok(await page.locator('.inv-saved-evidence').isVisible());
        const removal=await page.locator('.inv-casebook .inv-remove').evaluate(el=>getComputedStyle(el).color);
        assert.equal(removal,'rgb(101, 74, 80)','remove action must not inherit illegible lilac');
        await noOverflow(page,width);
        await shot(page,'casebook-'+width);
        await page.locator('.inv-saved-open').click();
        assert.equal(new URL(page.url()).pathname,'/bag/'+id);
        await page.reload({waitUntil:'networkidle'});
        assert.equal(await page.locator('#vl-case').getAttribute('data-case'),id);
        await page.getByRole('button',{name:'BACK TO CASEBOOK'}).click();
        assert.equal(new URL(page.url()).pathname,'/saved');
      });
      await check(width+' distinct deployer groups, return context and truthful crew/status',async()=>{
        await routeLink(page,width,'/trails').click();
        assert.match(await page.locator('#a1-finds-title').innerText(),/SMELLS FAMILIAR/);
        assert.equal(await page.locator('.inv-trails-linked .inv-deployer-linked').count(),1);
        assert.equal(await page.locator('.inv-trails-single').count(),1);
        assert.ok(await page.locator('.inv-trails-single .inv-deployer-single').count()>0);
        assert.equal(await page.locator('.inv-trails-single').evaluate(el=>el.open),false);
        assert.ok(await page.locator('.inv-deployer-group').count()>0);
        await shot(page,'deployer-groups-'+width);
        await page.locator('[data-case-id]').first().click();
        await page.getByRole('button',{name:'BACK TO TRAILS'}).click();
        assert.equal(new URL(page.url()).pathname,'/trails');
        await routeLink(page,width,'/crew').click();
        assert.match(await page.locator('#inv-crew-heading').innerText(),/ONE RAT DIGGING/);
        assert.match(await page.locator('.inv-crew-list').innerText(),/TRIPWIRE · BUILDING/);
        assert.equal(await page.getByRole('button',{name:/EMPLOY|CONNECT WALLET|START WATCH/}).count(),0);
        await ready(page);await shot(page,'crew-'+width);await noOverflow(page,width);
        await routeLink(page,width,'/status').click();
        assert.match(await page.locator('#inv-status-heading').innerText(),/CHECK THE SOURCE/);
        assert.match(await page.locator('.inv-status-list').innerText(),/STALE_VERIFIED/);
        await noOverflow(page,width);
      });
      await ctx.close();
    }
    for(const name of ['unavailable','wrong-chain','corrupt-digest','binding-mismatch']) {
      const state={feed:clone(feed),status:clone(status)};
      if(name==='unavailable')state.unavailable=true;
      if(name==='wrong-chain')state.feed.chainId=5042;
      if(name==='corrupt-digest')state.feed.feedDigest='0'.repeat(64);
      if(name==='binding-mismatch')state.status.checkpointBlock=String(BigInt(state.status.checkpointBlock)+1n);
      const ctx=await context(browser,390,844,state),page=await visit(ctx,'/bag/'+feed.launches[0].launchId);
      await check(name+' fails closed and preserves requested Case',async()=>{
        assert.equal(await page.locator('[data-case-id]').count(),0);
        assert.equal(await page.locator('#vl-case').getAttribute('data-case'),null);
        assert.equal(new URL(page.url()).pathname,'/bag/'+feed.launches[0].launchId);
        assert.equal(await page.locator('[data-read-state]').first().getAttribute('data-read-state'),'UNAVAILABLE');
        assert.match(await page.locator('#vl-case').innerText(),/CASE UNAVAILABLE/);
      });
      if(name==='unavailable')await shot(page,'unavailable-390');
      await ctx.close();
    }
    const retained={feed:clone(feed),status:clone(status)};
    const retainedCtx=await context(browser,390,844,retained),retainedPage=await visit(retainedCtx);
    await check('failed recheck retains exact stale verified window without fallback',async()=>{
      retained.unavailable=true;
      await retainedPage.getByRole('button',{name:'RECHECK',exact:true}).click();
      await retainedPage.getByRole('alert').waitFor();
      assert.equal(await retainedPage.locator('[data-case-id]').count(),6);
      assert.equal(await retainedPage.locator('[data-read-state]').first().getAttribute('data-read-state'),'STALE_VERIFIED');
    });await retainedCtx.close();
    const {canonicalSnapshotDigest}=await import(path.join(root,'web/snapshot-contract.js'));
    const empty={feed:{...clone(feed),launches:[]},status:clone(status)};
    empty.feed.feedDigest=await canonicalSnapshotDigest(empty.feed);empty.status.feedDigest=empty.feed.feedDigest;
    const emptyCtx=await context(browser,390,844,empty),emptyPage=await visit(emptyCtx);
    await check('verified empty feed stays distinct from source failure',async()=>{
      assert.equal(await emptyPage.locator('[data-case-id]').count(),0);
      assert.match(await emptyPage.getByRole('status').innerText(),/Verified empty feed/);
      assert.equal(await emptyPage.locator('[data-read-state]').first().getAttribute('data-read-state'),'STALE_VERIFIED');
    });await emptyCtx.close();
    const fresh={feed:clone(feed),status:{...status,state:'FRESH_VERIFIED',verifiedAtMs:Date.now()-1000,runtimeUpdatedAtMs:Date.now()-1000,freshnessValidUntilMs:Date.now()+2500,lastSyncError:null}};
    const freshCtx=await context(browser,390,844,fresh),freshPage=await visit(freshCtx);
    await check('fresh publication expires visibly without polling or stale promotion',async()=>{
      assert.equal(await freshPage.locator('[data-read-state]').first().getAttribute('data-read-state'),'FRESH_VERIFIED');
      const before=report.requests.length;
      await freshPage.locator('.vl-lab-stamp b[data-read-state="STALE_VERIFIED"]').waitFor({timeout:5000});
      assert.equal(report.requests.length,before);
    });await freshCtx.close();
    const snap=capture.snapshot;
    const historyState={feed:JSON.parse(snap.snapshot_json),status:{...status,state:'STALE_VERIFIED',checkpointBlock:snap.checkpoint_block,checkpointBlockHash:snap.checkpoint_block_hash,feedDigest:snap.feed_digest,verifiedAtMs:snap.verified_at_ms,publicationVersion:snap.publication_version,freshnessValidUntilMs:null,runtimeUpdatedAtMs:null},envelope:clone(envelope)};
    const historyCtx=await context(browser,390,844,historyState),historyPage=await visit(historyCtx,'/bag/'+envelope.material.caseId);
    await check('recorded historical envelope keeps its own 19-count and partial reconstruction',async()=>{
      await historyPage.locator('#vl-case[data-projection="HISTORICAL"]').waitFor();
      assert.match(await historyPage.locator('.vl-case-intro').innerText(),/19 earlier indexed launches in this returned window/);
      assert.match(await historyPage.locator('.a12-history-notice').innerText(),/not an immutable archived publication/);
      await historyPage.locator('#vl-tab-TRAIL').click();
      assert.equal(await historyPage.locator('.vl-source-trail li').count(),20);
      const href=await historyPage.locator('.vl-source-trail a').first().getAttribute('href');
      assert.match(href,/^\/bag\/[0-9a-f]{64}$/);
      await noOverflow(historyPage,390);
    });await historyCtx.close();
    historyState.envelope.digest='0'.repeat(64);
    const corruptCtx=await context(browser,390,844,historyState),corruptPage=await visit(corruptCtx,'/bag/'+envelope.material.caseId);
    await check('corrupt historical envelope cannot borrow latest-feed evidence',async()=>{
      await corruptPage.locator('#vl-case[data-historical-state="UNAVAILABLE"]').waitFor();
      assert.equal(await corruptPage.locator('#vl-case').getAttribute('data-case'),null);
      assert.equal(await corruptPage.locator('.vl-case-steps').count(),0);
    });await corruptCtx.close();
    const storageCtx=await context(browser);
    await storageCtx.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('CONTROL_STORAGE_UNAVAILABLE');};});
    const storagePage=await visit(storageCtx);
    await check('storage failure says session-only and still allows a reversible save',async()=>{
      await storagePage.locator('[data-case-id]').first().click();
      await storagePage.getByRole('button',{name:'SAVE CASE',exact:true}).click();
      assert.equal(await storagePage.getByRole('button',{name:'SAVED FOR THIS SESSION',exact:true}).count(),1);
      await routeLink(storagePage,390,'/saved').click();
      assert.match(await storagePage.getByRole('status').innerText(),/lasts only for this session/);
      await storagePage.getByRole('button',{name:/Remove saved Case/}).click();
      assert.equal(await storagePage.locator('.inv-saved-list li').count(),0);
    });await storageCtx.close();
    assert.deepEqual(report.errors,[]);report.verdict='PASS';console.log('INVESTIGATION_V2_BROWSER_PASS '+report.tests.length);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');server.close();});
