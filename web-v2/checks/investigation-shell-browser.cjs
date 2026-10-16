/* Offline compiled-browser acceptance. Recorded public Pons data, never a live Watch. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {createRequire} = require('node:module');
const browserRequire = createRequire(path.join(process.env.BINRAT_FRONTDOOR_TOOLS, 'runner.cjs'));
assert.equal(browserRequire('playwright/package.json').version, '1.56.1');
const {chromium} = browserRequire('playwright');
const root = path.resolve(__dirname, '../..');
const site = path.join(root, '.artifacts/v3-frontdoor/site');
const out = path.join(root, '.artifacts/investigation-shell/browser');
const feed = JSON.parse(fs.readFileSync(path.join(root,'docs/receipts/sprint-a1/public-feed.json')));
const status = JSON.parse(fs.readFileSync(path.join(root,'docs/receipts/sprint-a1/public-status.json')));
const report = {provenance:'RECORDED_PUBLIC_PONS_REPLAY', liveProvider:false, send:false,
  tests:[], requests:[], errors:[], screenshots:[], verdict:'FAIL'};
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  const rel=pathname.replace(/^\/+/, '');
  const candidate=path.resolve(site,rel);
  const f=candidate.startsWith(site+path.sep)&&fs.existsSync(candidate)&&fs.statSync(candidate).isFile()
    ? candidate : path.join(site,'index.html');
  res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
async function check(label, fn) {await fn();report.tests.push(label);console.log('PASS '+label);}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    for(const [width,height] of [[1440,900],[390,844],[320,800]]){
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
      context.on('page',page=>page.on('pageerror',err=>report.errors.push(err.message)));
      await context.route('**/api/**',async route=>{
        const p=new URL(route.request().url()).pathname;
        report.requests.push({path:p,method:route.request().method()});
        assert.equal(route.request().method(),'GET');
        assert.ok(['/api/status','/api/launches/latest'].includes(p)||/^\/api\/creator\/0x[0-9a-f]{40}\/summary$/.test(p)||/^\/api\/bag\/[0-9a-f]{64}(\/evidence)?$/.test(p),p);
        const reply=p==='/api/status' ? {code:200,body:status} : p==='/api/launches/latest' ? {code:200,body:feed} : {code:404,body:{error:'OFFLINE_SOURCE_UNAVAILABLE'}};
        await route.fulfill({status:reply.code,contentType:'application/json',body:JSON.stringify(reply.body)});
      });
      const page=await context.newPage();
      const nav=page.locator(width>1040?'.inv-sidebar':'.inv-mobile-nav');
      await page.goto(base+'/',{waitUntil:'networkidle'});
      await check(width+' homepage, V3 art, old slogan and no overflow',async()=>{
        assert.match(await page.locator('#a1-title').innerText(),/THE RAT\s+REMEMBERS/);
        assert.ok(await nav.isVisible());
        assert.ok(await page.locator('.vl-rat-scene img').count());
        assert.ok(await page.locator('.vl-find').count()>0);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+1,'horizontal overflow');
      });
      const shot='find-'+width+'.png';
      await page.screenshot({path:path.join(out,shot),fullPage:true});
      report.screenshots.push(shot);
      await check(width+' saved Case persists after navigation and reload',async()=>{
        const id=await page.locator('[data-case-id]').first().getAttribute('data-case-id');
        await page.locator('[data-case-id]').first().click();
        assert.equal(new URL(page.url()).pathname,'/bag/'+id);
        await page.getByRole('button',{name:'SAVE CASE',exact:true}).click();
        assert.equal(await page.getByRole('button',{name:'SAVED ON THIS DEVICE'}).count(),1);
        await nav.locator('a[href="/saved"]').click();
        assert.equal(new URL(page.url()).pathname,'/saved');
        await page.reload({waitUntil:'networkidle'});
        assert.ok((await page.locator('.inv-saved-list li').count())>0);
        await page.locator('.inv-saved-list li button').first().click();
        assert.equal(new URL(page.url()).pathname,'/bag/'+id);
      });
      await check(width+' searchable Pons finds and truthful trails/crew/status',async()=>{
        await nav.locator('a[href="/"]').click();
        const input=page.getByRole('searchbox');
        await input.fill('ZZZ_NOT_A_REAL_LAUNCH_98765');
        assert.equal(await page.locator('[data-case-id]').count(),0);
        await input.fill('');
        await nav.locator('a[href="/trails"]').click();
        assert.match(await page.locator('#a1-finds-title').innerText(),/SMELLS FAMILIAR/);
        await nav.locator('a[href="/crew"]').click();
        assert.match(await page.locator('#inv-crew-heading').innerText(),/ONE RAT DIGGING/);
        await nav.locator('a[href="/status"]').click();
        assert.match(await page.locator('#inv-status-heading').innerText(),/CHECK THE SOURCE/);
        assert.equal(await page.getByText(/TRIPWIRE · BUILDING/).count()>0,true);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+1,'route overflow');
      });
      if(width===390){
        await page.goto(base+'/saved',{waitUntil:'networkidle'});
        const saved='casebook-'+width+'.png';await page.screenshot({path:path.join(out,saved),fullPage:true});report.screenshots.push(saved);
      }
      await context.close();
    }
    assert.deepEqual(report.errors,[]);
    assert.ok(report.requests.every(r=>r.method==='GET'));
    report.verdict='PASS';console.log('INVESTIGATION_SHELL_BROWSER_PASS '+report.tests.length);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');
  server.close();
});
