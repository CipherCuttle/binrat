// Offline only. Packages reviewed code and retains byte-verified active resources.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root=process.cwd(), git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git(['status','--porcelain']),'','Commit the complete candidate before packaging');
const sha=git(['rev-parse','HEAD']);
const evidence=join(root,'.artifacts/a1-3-evidence');
const frontdoor=join(root,'.artifacts/v3-frontdoor');
const read=p=>JSON.parse(readFileSync(p));
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const current=read(join(frontdoor,'manifest.json'));
assert.equal(current.sourceSha,sha);assert.equal(current.sourceDirty,false);
assert.equal(current.ownerVisualApproval,'PENDING');assert.equal(current.productionAuthorized,false);
const before=read(join(evidence,'provider-before.json')), after=read(join(evidence,'provider-after.json'));
const independent=read(join(evidence,'rollback-independent-wrangler.json'));
assert.equal(before.versionId,after.versionId);assert.equal(after.versionId,independent.id);assert.equal(after.number,105);
assert.deepEqual(before.bindings,after.bindings);assert.deepEqual(before.assetConfig,after.assetConfig);
assert.deepEqual(Object.fromEntries(independent.resources.bindings.map(b=>[b.name,b])),after.bindings);
const rollback=read(join(evidence,'rollback-assets.json'));assert.equal(rollback.verdict,'PASS');
assert.equal(rollback.versionId,after.versionId);
const out=join(root,'.artifacts/a1-3-candidate');rmSync(out,{recursive:true,force:true});mkdirSync(join(out,'site'),{recursive:true});
function put(path,raw){assert.ok(!path.startsWith('/')&&!path.split('/').includes('..'));const target=join(out,'site',path);mkdirSync(resolve(target,'..'),{recursive:true});writeFileSync(target,raw);}
for(const f of rollback.verifiedAssets){
  const raw=readFileSync(join(evidence,'rollback-site',f.path));assert.equal(hash(raw),f.sha256);assert.equal(f.sha256,f.previewSha256);
  if(!f.path.endsWith('.html'))put(f.path,raw);
}
for(const f of current.files){const raw=readFileSync(join(frontdoor,'site',f.path));assert.equal(hash(raw),f.sha256);assert.equal(raw.length,f.bytes);put(f.path,raw);}
const module=readFileSync(join(root,'.artifacts/a1-3-bundle/compiled/worker.js'));
assert.notEqual(hash(module),after.modules[0].sha256,'Historical endpoint requires the new backend module');
assert.ok(module.includes(Buffer.from('binrat.case-evidence/1')));
writeFileSync(join(out,'worker.js'),module);
cpSync(join(evidence,'rollback-worker.js'),join(out,'rollback-worker.js'));
function inventory(base,prefix=''){return readdirSync(join(base,prefix),{withFileTypes:true}).flatMap(e=>{const p=prefix+e.name;if(e.isDirectory())return inventory(base,p+'/');assert.ok(e.isFile());const raw=readFileSync(join(base,p));return [{path:p,bytes:raw.length,sha256:hash(raw)}];}).sort((a,b)=>a.path.localeCompare(b.path));}
const files=inventory(join(out,'site'));assert.equal(files.filter(f=>f.path.endsWith('.html')).length,1);
const release=read(join(root,'web/release.json'));assert.equal(release.sourceSha,sha);assert.equal(release.sourceClean,true);
const manifest={schemaVersion:'binrat.a1-3-offline-candidate/1',sourceSha:sha,sourceClean:true,
  frontdoorAuthority:'db13d4d8568bd99d72c6f318462664a8157e88eb',backendAuthority:'695e813eacb8f70e169d45b814ecc180ec01d50e',historicalUiAuthority:'ac5e2b97d1ec1b8d870b1d2b02e1b55818ebac59',
  candidateModule:{path:'worker.js',bytes:module.length,sha256:hash(module)},publicRelease:release,
  rollbackVersion:after.versionId,rollbackNumber:105,rollbackModule:after.modules[0],rollbackAssets:rollback.verifiedAssets,
  retainedResources:rollback.verifiedAssets.filter(f=>!f.path.endsWith('.html')).length,
  files,assetConfig:after.assetConfig,resourceBindings:after.bindings,schedules:after.schedules,queue:after.queue,domain:after.domain,routes:after.routes,
  requiredFutureReleaseIdentity:{name:'BINRAT_RELEASE_SHA',previous:after.bindings.BINRAT_RELEASE_SHA.text,value:sha,reason:'New backend code must report its own exact source authority.'},
  ownerVisualApproval:'PENDING',productionAuthorized:false,candidateProviderVerified:false,providerAssetEnumerationClaimed:false,
  releaseGate:'Requires owner visual approval, separate production authorization, fresh provider/billing preflight and staged module/binding/static readback.',remoteMutations:0};
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({verdict:'OFFLINE_A1_3_PACKAGE_PASS',sourceSha:sha,files:files.length,retainedResources:manifest.retainedResources,moduleSha256:manifest.candidateModule.sha256,productionAuthorized:false}));
