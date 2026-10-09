// One compiled asset package; captured history and public GETs use separate ports.
// Start after pnpm build and the production-mode frontdoor build.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import worker from '../../dist/src/cloudflare/worker.js';
import { capturedCaseDatabase } from '../../test/support/caseProductionCapture.ts';
const db = await capturedCaseDatabase();
const site = resolve('.artifacts/v3-frontdoor/site');
const evidence = resolve('.artifacts/a1-3-evidence');
const manifest = JSON.parse(readFileSync(resolve(site, '../manifest.json')));
if (manifest.sourceDirty || manifest.sourceSha !== execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim()) throw new Error('EXACT_CLEAN_BUILD_REQUIRED');
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.woff2':'font/woff2', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.json':'application/json'};
const allowed = p => ['/health','/api/status','/api/launches/latest'].includes(p) || /^\/api\/bag\/[0-9a-f]{64}(\/evidence)?$/.test(p) || /^\/api\/creator\/0x[0-9a-f]{40}\/summary$/.test(p);
const servers = [];
for (const [port, live] of [[4192,false], [4193,true]]) {
  const server = createServer(async (req,res) => {
    try {
      const u = new URL(req.url, 'http://127.0.0.1:'+port);
      res.setHeader('x-binrat-preview-source',live?'PUBLIC_PRODUCTION_GETS':'CAPTURED_PRODUCTION_D1');
      res.setHeader('x-robots-tag','noindex, nofollow, noarchive');
      if (req.method !== 'GET') {res.writeHead(405).end();return;}
      if (u.pathname === '/health' || u.pathname.startsWith('/api/')) {
        if (!allowed(u.pathname)) {res.writeHead(404).end('{}');return;}
        let response;
        if (live) {
          // Fixed HTTPS destination, no redirects, no credential forwarding or fallback.
          const raw = execFileSync('curl',['-4','--silent','--show-error','--max-time','20','--write-out','\n%{http_code}','https://binrat.tech'+u.pathname],{maxBuffer:2*1024*1024});
          const split=raw.lastIndexOf(10), status=Number(raw.subarray(split+1).toString());
          res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'}).end(raw.subarray(0,split));return;
        }
        response=await worker.fetch(new Request(u),{DB:db,BINRAT_PONS_READ_ONLY:'true'});
        res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
      }
      const review=u.pathname.startsWith('/review/');
      const root=review?evidence:site;
      const file=resolve(root,'.'+(review?u.pathname.slice('/review'.length):u.pathname));
      if (file!==root && !file.startsWith(root+'/')) {res.writeHead(400).end();return;}
      const target=existsSync(file)&&statSync(file).isFile()?file:review?resolve(root,'review.html'):extname(file)?null:resolve(site,'index.html');
      if (!target || !existsSync(target)) {res.writeHead(404).end();return;}
      res.writeHead(200,{'content-type':mime[extname(target)]||'application/octet-stream'});createReadStream(target).pipe(res);
    } catch {res.writeHead(503,{'content-type':'application/json'}).end('{"error":"PREVIEW_SOURCE_UNAVAILABLE"}');}
  });
  server.listen(port,'127.0.0.1',()=>console.log((live?'PUBLIC_GET':'CAPTURED_HISTORY')+'_COMPILED_PREVIEW http://127.0.0.1:'+port));servers.push(server);
}
process.on('SIGTERM',()=>{for(const server of servers)server.close();db.close();process.exit(0);});
