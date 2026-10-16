const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
const runner = createRequire(path.join(process.env.BINRAT_FRONTDOOR_TOOLS, 'runner.cjs'));
const { chromium } = runner('playwright');
const root = process.cwd();
const site = path.join(root, '.artifacts/v3-frontdoor/site');
const out = path.join(root, '.artifacts/v2-baseline');
fs.mkdirSync(out, { recursive: true });
const feed = JSON.parse(fs.readFileSync('docs/receipts/sprint-a1/public-feed.json'));
const status = JSON.parse(fs.readFileSync('docs/receipts/sprint-a1/public-status.json'));
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml'};
const server = http.createServer((req,res) => {
  const p = path.resolve(site, '.' + new URL(req.url, 'http://localhost').pathname);
  const f = p.startsWith(site+path.sep) && fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(site,'index.html');
  res.writeHead(200, {'content-type':mime[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
(async()=>{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const browser = await chromium.launch({headless:true});
  const metrics=[];
  try {
    for (const [width,height] of [[1440,900],[768,1024],[390,844],[320,800]]) {
      const ctx=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
      await ctx.route('**/api/**', route=> {
        const p=new URL(route.request().url()).pathname;
        const body=p==='/api/status'?status:p==='/api/launches/latest'?feed:{error:'RECORDED_BASELINE_SOURCE_UNAVAILABLE'};
        return route.fulfill({status:p==='/api/status'||p==='/api/launches/latest'?200:404,contentType:'application/json',body:JSON.stringify(body)});
      });
      const page=await ctx.newPage();
      await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
      await page.locator('[data-case-id]').first().waitFor();
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:path.join(out,'find-'+width+'.png')});
      const firstFindTop=await page.locator('[data-case-id]').first().evaluate(el=>el.getBoundingClientRect().top);
      await page.locator('[data-case-id]').first().click();
      await page.locator('#vl-case').waitFor();
      await page.screenshot({path:path.join(out,'case-'+width+'.png')});
      metrics.push({width,height,firstFindTop,firstFindVisible:firstFindTop<height});
      await ctx.close();
    }
    fs.writeFileSync(path.join(out,'baseline.json'),JSON.stringify({source:'4d748247474e1e506e6a54a44aacab4b81e096ed',mode:'RECORDED_PONS_REPLAY',metrics},null,2));
  } finally { await browser.close(); server.close(); }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
