// EXPLICIT SYNTHETIC OFFLINE INTEGRATION. Collector and UI share this local D1.
import {createServer} from 'node:http';
import {createReadStream,existsSync,statSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {outcomePilotFixture,publishFixture} from '../../test/support/outcomePilotFixture.ts';
import {handleWorkerRequest} from '../../dist/src/cloudflare/worker.js';
const manifest=JSON.parse(readFileSync('.artifacts/v3-frontdoor/manifest.json','utf8'));
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(manifest.sourceSha!==sha || manifest.sourceDirty || execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()) throw Error('EXACT_CLEAN_PREVIEW_REQUIRED');
const f=await outcomePilotFixture();
for(const [h,block] of [[300000,110],[3600000,161],[86400000,1541]]) {
  if(h>300000){f.advance(f.origin+h+60000-f.now());await f.checkpoint(block);}
  if(h===86400000) f.setGraduated(true);
  await publishFixture(f);await f.execute(await f.schedule());
}
// End collection before exposing the local GET preview.
f.env.BINRAT_PONS_OUTCOME_COLLECT_AUTHORIZED='false';
mkdirSync('.artifacts/a2-2',{recursive:true});
writeFileSync('.artifacts/a2-2/browser-input.json',JSON.stringify({provenance:'EXPLICIT SYNTHETIC OFFLINE FIXTURE — NOT LIVE INTELLIGENCE',sourceSha:sha,caseId:f.current.launchId,nowMs:f.now()}));
const root=resolve('.artifacts/v3-frontdoor/site');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try {
    res.setHeader('x-binrat-preview-source','EXPLICIT_SYNTHETIC_OFFLINE_FIXTURE');
    res.setHeader('x-robots-tag','noindex,nofollow,noarchive');
    if(req.method!=='GET'){res.writeHead(405).end();return;}
    const u=new URL(req.url,'http://127.0.0.1:4206');
    if(u.pathname.startsWith('/api/') || u.pathname==='/health') {
      const r=await handleWorkerRequest(new Request(u),f.env,{now:f.now,externalFetch:async()=>{throw Error('FIXTURE_NETWORK_FORBIDDEN');}});
      res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;
    }
    const file=resolve(root,'.'+u.pathname);
    if(!file.startsWith(root+'/') && file!==root){res.writeHead(400).end();return;}
    const target=existsSync(file)&&statSync(file).isFile()?file:extname(file)?null:resolve(root,'index.html');
    if(!target){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':mime[extname(target)]||'application/octet-stream'});createReadStream(target).pipe(res);
  }catch(e){res.writeHead(503,{'content-type':'application/json'}).end(JSON.stringify({error:e.message}));}
}).listen(4206,'127.0.0.1',()=>console.log('SYNTHETIC_OFFLINE_PREVIEW http://127.0.0.1:4206'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close();f.db.close();process.exit(0);});
