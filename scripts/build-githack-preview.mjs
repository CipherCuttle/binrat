/** Isolated, offline, no-secret GitHack export of V3.
 * Uses captured public Pons fixtures. Never a live API or Watch.
 * Writes only ignored .artifacts/githack/site; publication is separate CI.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,renameSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve('.');
const webV2=join(root,'web-v2');
const out=join(root,'.artifacts/githack/site');
const PREVIEW_BRANCH=process.env.BINRAT_GITHACK_BRANCH || 'binrat-v3-githack-20261016';
if (!/^(?:binrat-v3-githack(?:-v2(?:-r[12])?)?-20261016|binrat-v3-githack-casevalue-20261017|binrat-v3-githack-leads-20261017)$/.test(PREVIEW_BRANCH)) throw Error('PREVIEW_BRANCH_NOT_SCOPED');
const prefix='/CipherCuttle/binrat/'+PREVIEW_BRANCH+'/preview/githack/';
const feed=JSON.parse(readFileSync(join(root,'docs/receipts/sprint-a1/public-feed.json'),'utf8'));
const status=JSON.parse(readFileSync(join(root,'docs/receipts/sprint-a1/public-status.json'),'utf8'));
if(feed.chainId!==4663 || status.chainId!==4663 ||
   !Array.isArray(feed.launches) || !Number.isSafeInteger(status.verifiedAtMs)) {
 throw Error('GITHACK_FIXTURE_NOT_PONS_OR_INVALID');
}
rmSync(out,{recursive:true,force:true});
const env={...process.env,VITE_BINRAT_V3_CANDIDATE:'1',
 VITE_BINRAT_V3_PRODUCTION:'0',VITE_BINRAT_GITHACK_PREVIEW:'1'};
execFileSync('pnpm',['exec','tsc','-b'],{cwd:webV2,env,stdio:'inherit'});
execFileSync('pnpm',['exec','vite','build','--base',prefix,'--outDir',out,'--emptyOutDir'],{
 cwd:webV2,env,stdio:'inherit'
});
renameSync(join(out,'frontdoor-candidate.html'),join(out,'index.html'));
let html=readFileSync(join(out,'index.html'),'utf8');
const warning='<div id="binrat-preview-label" role="status" style="padding:9px 12px;background:#292137;color:#ead1b6;border-bottom:1px solid #88718c66;text-align:center;font:500 12px/1.4 system-ui,sans-serif">OFFLINE PREVIEW · RECORDED PONS DATA · NOT LIVE</div>';
html=html.replace('<div id="root"></div>',warning+'<div id="root"></div>');
html=html.replaceAll('href="/fonts/', 'href="'+prefix+'fonts/');
html=html.replaceAll('href="/favicon', 'href="'+prefix+'favicon');
html=html.replace('</head>','<script src="'+prefix+'githack-fixture.js"></script></head>');
html=html.replace(/<title>[^<]*<\/title>/,'<title>BINRAT Investigation Experience V2 · Offline Preview</title>');
if(!html.includes('githack-fixture.js') || !html.includes('NOT LIVE'))throw Error('PREVIEW_BAD_HTML');
writeFileSync(join(out,'index.html'),html);

const jsFixture=[
'/* Recorded public GET replay for static GitHack preview only; no live RPC or Watch. */\n',
'(()=>{\n"use strict";\nconst fixture=',JSON.stringify({feed,status}),';\n',
'const originalFetch=window.fetch.bind(window);\n',
'window.fetch=function(input,init){\n',
' const raw=typeof input==="string"?input:input instanceof URL?input.href:input.url;\n',
' const url=new URL(raw,window.location.href);\n',
' if(url.origin!==window.location.origin)return Promise.reject(Error("PREVIEW_EXTERNAL_NETWORK_DISABLED"));\n',
' const pathname=url.pathname;\n',
' let body=null;\n',
' if(pathname==="/api/status")body=fixture.status;\n',
' else if(pathname==="/api/launches/latest")body=fixture.feed;\n',
' else if(pathname.startsWith("/api/"))return Promise.resolve(new Response(\n',
'   JSON.stringify({error:"GITHACK_OFFLINE_PREVIEW_NO_SOURCE"}),{\n',
'   status:503,headers:{"content-type":"application/json"}}));\n',
' else return originalFetch(input,init);\n',
' if(init?.method && init.method!=="GET")return Promise.resolve(new Response(\n',
'   JSON.stringify({error:"PREVIEW_READ_ONLY"}),{status:405,headers:{"content-type":"application/json"}}));\n',
' return Promise.resolve(new Response(JSON.stringify(body),{\n',
'   status:200,headers:{"content-type":"application/json"}}));\n',
'};\n})();\n'
].join('');
writeFileSync(join(out,'githack-fixture.js'),jsFixture);
// publicDir and static CSS/JS URLs: prefix only asset paths, never source API paths.
const assetDir=join(out,'assets');
for(const file of readdirSync(assetDir)){
 if(!/\.(js|css)$/.test(file))continue;
 const filePath=join(assetDir,file);
 let code=readFileSync(filePath,'utf8');
 code=code.replaceAll('"/crew/','"'+prefix+'crew/')
          .replaceAll("'/crew/","'"+prefix+'crew/')
          .replaceAll('`/crew/','`'+prefix+'crew/')
          .replaceAll('"/fonts/','"'+prefix+'fonts/')
          .replaceAll("'/fonts/","'"+prefix+'fonts/')
          .replaceAll('`/fonts/','`'+prefix+'fonts/')
          .replaceAll('url(/fonts/','url('+prefix+'fonts/')
          .replaceAll('url("/fonts/','url("'+prefix+'fonts/')
          .replaceAll("url('/fonts/","url('"+prefix+'fonts/');
 if (/["'`]\/(?:crew|fonts)\//.test(code)) throw Error('GITHACK_ROOT_ASSET_REMAINS:' + file);
 writeFileSync(filePath,code);
}
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
writeFileSync(join(out,'GITHACK_PREVIEW.json'),JSON.stringify({
 schema:'binrat.githack-offline-preview/1',sourceCommit:source,
 liveSource:false,fixtureVerifiedAtMs:status.verifiedAtMs,fixtureCount:feed.launches.length,
 display:'RECORDED_PRODUCTION_PUBLIC_GET_REPLAY',noWatch:true,noRPC:true,
 previewBranch:PREVIEW_BRANCH,basePath:prefix
},null,2)+'\n');
console.log('GITHACK_OFFLINE_BUILD_PASS '+JSON.stringify({source,files:readdirSync(out).length,prefix,fixtureLaunches:feed.launches.length}));
