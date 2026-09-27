import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('design-review');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  const file=['/review.js','/review.css','/versions.json'].includes(pathname)?pathname.slice(1):'index.html';
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html; charset=utf-8');
  fs.createReadStream(path.join(root,file)).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [1440,390,320]){
    const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(origin+'/?v=g4a');
    assert.equal(await page.locator('#current-title').textContent(),"G4a · The Rat's Field Instrument");
    assert.equal(await page.locator('#count').textContent(),'(21/21)');
    assert.equal(await page.locator('#openPreview').getAttribute('href'),'https://raw.githack.com/CipherCuttle/binrat/65e983a5ba7655f063be57a7ee12b23cfcc91e06/prototype/g3a/dist/index.html');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow at '+width);
    if(width<=390){
      await page.waitForFunction(()=>window.scrollY>100);
      assert.equal(await page.locator('#current-title').textContent(),"G4a · The Rat's Field Instrument");
    }
    await page.screenshot({path:'/tmp/binrat-initial-'+width+'.png',fullPage:false});
    await page.locator('#r-overall').selectOption('5');
    await page.locator('#likes [data-facet="Warm paper dossier"]').click();
    await page.locator('#dislikes [data-facet="Rat/background seam"]').click();
    await page.locator('#keep').fill('Keep the warm paper dossier.');
    await page.locator('#device').selectOption('Android phone 390px');
    await page.reload();
    assert.equal(await page.locator('#r-overall').inputValue(),'5');
    assert.equal(await page.locator('#likes [data-facet="Warm paper dossier"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#keep').inputValue(),'Keep the warm paper dossier.');
    const out=page.waitForEvent('download');
    await page.locator('#export').click();
    const dl=await out;
    const json=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
    assert.equal(json.schema,'binrat.design-feedback.v1');
    assert.equal(json.reviews[0].feedback.ratings.overall,5);
    assert.ok(json.reviews[0].feedback.likes.includes('Warm paper dossier'));
    const issue=await page.locator('#issue').getAttribute('href');
    assert.ok(issue.includes('issues/new?title=')&&decodeURIComponent(issue).includes('Warm paper dossier'));
    await page.locator('#versus').selectOption('g4r');
    await page.locator('#choice').selectOption('A');
    await page.locator('#compareWhy').fill('Prefer the light paper dossier, but keep the cinematic Rat Radar structure.');
    await page.locator('#saveComparison').click();
    const comparisonDownload=page.waitForEvent('download');
    await page.locator('#export').click();
    const compared=JSON.parse(fs.readFileSync(await (await comparisonDownload).path(),'utf8'));
    assert.equal(compared.comparisons.length,1,'Pairwise preference persists');
    await page.locator('#versionList [data-id="g3c"]').click();
    await page.locator('#r-overall').selectOption('2');
    await page.locator('#versionList [data-id="g4a"]').click();
    assert.equal(await page.locator('#r-overall').inputValue(),'5','Ratings remain isolated per version');
    await page.screenshot({path:'/tmp/binrat-review-'+width+'.png',fullPage:false});
    await page.locator('#review-title').scrollIntoViewIfNeeded();
    await page.screenshot({path:'/tmp/binrat-feedback-'+width+'.png',fullPage:false});
    assert.deepEqual(errors,[],'No script errors at '+width);
    await page.close()
  }
  const fallback=await browser.newPage({viewport:{width:390,height:844}});
  await fallback.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true}));
  await fallback.goto(origin+'/?v=g6a');
  await fallback.locator('#copyDigest').click();
  assert.equal(await fallback.locator('#copyFallback').count(),1,'Clipboard fallback is available');
  await fallback.locator('#r-overall').selectOption('4');
  assert.equal(await fallback.locator('#summary').count(),1,'Clipboard fallback must not destroy the live summary');
  assert.ok((await fallback.locator('#summary').textContent()).includes('Reviewed: 1/21'));
  await fallback.close();
  console.log('PASS: 21 URLs, 1440/390/320 layout, local persistence, version isolation, pairwise comparison, JSON export, GitHub draft and denied-clipboard recovery.');
} finally {
  if(browser)await browser.close();
  server.close();
}
