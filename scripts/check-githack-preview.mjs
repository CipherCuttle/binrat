/** Browser acceptance of exact static GitHack base path and offline Pons fixture. */
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,existsSync,statSync,createReadStream,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('.');
const site=join(root,'.artifacts/githack/site');
const preview=JSON.parse(readFileSync(join(site,'GITHACK_PREVIEW.json')));
const prefix=preview.basePath;
assert.equal(prefix, '/CipherCuttle/binrat/binrat-v3-githack-micrographics-20261017/preview/githack/');
const html=readFileSync(join(site,'index.html'),'utf8');
assert.ok(html.includes('RECORDED PONS DATA · NOT LIVE'));
assert.ok(html.includes(prefix+'githack-fixture.js'));
assert.ok(html.includes(prefix+'assets/'));
if(process.argv.includes('--static')){console.log('GITHACK_STATIC_CONTRACT_PASS');process.exit(0);}
const browserRequire=createRequire(join(process.env.BINRAT_FRONTDOOR_TOOLS,'runner.cjs'));
const {chromium}=browserRequire('playwright');
assert.equal(browserRequire('playwright/package.json').version,'1.56.1');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp',
 '.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(!url.pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
 const relative=url.pathname.slice(prefix.length) || 'index.html';
 const file=resolve(site,relative);
 if(!file.startsWith(site+'/')||!existsSync(file)||!statSync(file).isFile()){
   res.writeHead(404);res.end();return;
 }
 res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});
 createReadStream(file).pipe(res);
});
const report={source:preview.sourceCommit,mode:'OFFLINE_PONS_GITHACK_FIXTURE',checks:[],errors:[]};
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port+prefix+'index.html';
 const b=await chromium.launch({headless:true});
 try{
  for(const width of [1440,390]){
   const ctx=await b.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   const p=await ctx.newPage();
   p.on('pageerror',e=>report.errors.push(e.message));
   p.on('response',r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());});
   await p.goto(base,{waitUntil:'networkidle'});
   await p.locator('#a1-title').waitFor();
   assert.match(await p.locator('#a1-title').innerText(),/THE RAT\s+REMEMBERS/);
   assert.ok(await p.locator('[data-case-id]').count()>0,'fixture Cases missing');
   assert.ok(await p.locator('#binrat-preview-label').isVisible());
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth)<=width+1);
   const nav=p.locator(width>1040?'.inv-sidebar nav':'.inv-mobile-nav');
   const id=await p.locator('[data-case-id]').first().getAttribute('data-case-id');
   await p.locator('[data-case-id]').first().click();
   assert.equal(new URL(p.url()).searchParams.get('case'),id);
   await p.getByRole('button',{name:'SAVE CASE',exact:true}).click();
   await nav.locator('a[data-route="/saved"]').click();
   assert.equal(new URL(p.url()).searchParams.get('view'),'saved');
   await p.reload({waitUntil:'networkidle'});
   assert.equal(await p.locator('.inv-saved-list li').count(),1);
   await p.locator('.inv-saved-list li button').first().click();
   assert.equal(new URL(p.url()).searchParams.get('case'),id);
   await p.reload({waitUntil:'networkidle'});
   assert.ok(await p.locator('#vl-case').count(),'refresh loses Case');
   await ctx.close();
   report.checks.push(width+' static preview, saved Case, URL/reload and assets');
   console.log('PASS '+report.checks.at(-1));
  }
  assert.deepEqual(report.errors,[]);
  console.log('GITHACK_BROWSER_PASS '+report.checks.length);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 writeFileSync(join(root,'.artifacts/githack/check.json'),JSON.stringify(report,null,2)+'\n');
 await new Promise(ok=>server.close(ok));
});
