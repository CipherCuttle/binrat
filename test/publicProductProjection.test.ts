import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectPublicProduct } from '../src/public/productProjection.js';
import { decodePublicCapabilityManifest, validateCapabilityManifest } from '../src/telegram/rat.js';
import { buildPublicSnapshot } from '../src/cloudflare/publicSnapshot.js';
import { researchEvidence } from '../src/public/generated/researchEvidence.js';

const manifest=()=>decodePublicCapabilityManifest(JSON.parse(readFileSync('docs/CAPABILITY_MANIFEST_V0.json','utf8')));
async function evidence() {
  const snapshot=await buildPublicSnapshot({schemaVersion:'binrat.latest-launches/0.1',chainId:4663,sourceCheckpoint:'100',
    checkpointBlockHash:`0x${'1'.repeat(64)}`,historyCoverage:'PARTIAL',launches:[]});
  const status={schemaVersion:'binrat.public-status/0.1',verifiedAtMs:Date.now(),runtimeUpdatedAtMs:Date.now(),publicationVersion:1,lastSyncError:null,chainId:4663,state:'FRESH_VERIFIED',checkpointBlock:snapshot.sourceCheckpoint,
    checkpointBlockHash:snapshot.checkpointBlockHash,feedDigest:snapshot.feedDigest,freshnessValidUntilMs:Date.now()+180_000};
  return {snapshot,status};
}
test('one deterministic projection establishes the frozen public stages from canonical evidence',async()=>{
  const input={manifest:manifest(),...await evidence()};
  const product=await projectPublicProduct(input);
  assert.deepEqual(product.crew.map(rat=>[rat.id,rat.status]),[['rat-zero','LIVE'],['tripwire','BUILDING'],['sniffer','PROVING'],
    ['working-rat','PLANNED'],['den','PLANNED'],['locked-1','LOCKED'],['locked-2','LOCKED']]);
  assert.equal(product.workingRat.productionEntitlementActive,false);
  assert.equal(product.crew.find(rat=>rat.id==='den')!.phase,'POST_LAUNCH');
  assert.equal(product.currentAuthority.chainId,4663);
  assert.equal(product.currentAuthority.treasuryAddress,null);
  assert.equal(product.currentWatch.audience,'UNVERIFIED');
  assert.equal(product.currentWatch.employmentAvailable,false);
  assert.deepEqual(product.crew.filter(rat=>rat.actionAvailable).map(rat=>rat.id),['rat-zero']);
  assert.deepEqual(await projectPublicProduct(input),product);
});
test('unsupported or conflicting source claims project unverified without substitute authority',async()=>{
  const raw=manifest();raw.capabilities.ratDenV0={engineeringStatus:'BUILDING',phase:'POST_LAUNCH'};
  const bound=await evidence();bound.status.feedDigest='b'.repeat(64);
  const product=await projectPublicProduct({manifest:raw,...bound,research:null});
  assert.equal(product.crew.find(rat=>rat.id==='rat-zero')!.status,'UNVERIFIED');
  assert.equal(product.crew.find(rat=>rat.id==='sniffer')!.status,'UNVERIFIED');
  assert.equal(product.crew.find(rat=>rat.id==='den')!.status,'UNVERIFIED');
  assert.equal(product.snapshotBinding,null);
});
test('same snapshot can establish a shipped surface while fresh data becomes stale',async()=>{
  const bound=await evidence();bound.status.state='STALE_VERIFIED';
  const product=await projectPublicProduct({manifest:manifest(),...bound});
  assert.equal(product.crew[0]!.status,'LIVE');assert.equal(product.runtimeFreshness,'STALE_VERIFIED');
});
test('legacy Arc wallet declarations cannot populate current authority',async()=>{
  const raw=manifest();delete raw.currentPonsLaunchConfiguration;
  raw.launchConfiguration={treasuryAddress:`0x${'a'.repeat(40)}`,projectFeeRecipientAddress:`0x${'b'.repeat(40)}`,
    tokenAddressState:'NOT_YET_CREATED',accountingActive:false,holderGateStatus:'TOKEN_AUTHORITY_NOT_CONFIGURED'};
  const product=await projectPublicProduct({manifest:raw,snapshot:null,status:null});
  assert.equal(product.currentAuthority.status,'UNVERIFIED');
  assert.equal(product.currentAuthority.treasuryAddress,null);
  assert.equal(product.currentAuthority.creatorFeeRecipientAddress,null);
});
test('research result and handoff tampering cannot establish PROVING',async()=>{
  const modified=JSON.parse(JSON.stringify(researchEvidence));modified.audit.handoff.afterBlock='1';
  const product=await projectPublicProduct({manifest:manifest(),snapshot:null,status:null,research:modified});
  assert.equal(product.crew.find(rat=>rat.id==='sniffer')!.status,'UNVERIFIED');
});
test('presentation decoder accepts the C2 Pons manifest without relaxing execution validation',()=>{
  const raw=manifest();assert.equal(raw.currentLaunchPlan?.chainId,4663);
  assert.equal(validateCapabilityManifest(raw),raw);
  raw.launchGateStatus!.matrix='docs/LAUNCH_GATE_MATRIX_V0.json';
  assert.equal(decodePublicCapabilityManifest(raw),raw);
  assert.throws(()=>validateCapabilityManifest(raw),/CAPABILITY_MANIFEST_LAUNCH_GATES_INVALID/);
  raw.launchAuthorization.launchAuthorized=true;
  assert.throws(()=>decodePublicCapabilityManifest(raw),/CAPABILITY_MANIFEST_INVALID/);
});

test('regression: malformed freshness contract cannot establish Rat Zero LIVE',async()=>{
  for(const key of ['schemaVersion','verifiedAtMs','publicationVersion','runtimeUpdatedAtMs','freshnessValidUntilMs','lastSyncError']) {
    const bound=await evidence();delete (bound.status as Record<string,unknown>)[key];
    const product=await projectPublicProduct({manifest:manifest(),...bound});
    assert.equal(product.snapshotBinding,null,key);assert.equal(product.crew[0]!.status,'UNVERIFIED',key);
  }
});
test('contradictory entitlement fails closed in every public field',async()=>{
  const raw=manifest() as ReturnType<typeof manifest>&{productionEntitlementActive:boolean};raw.productionEntitlementActive=true;
  const product=await projectPublicProduct({manifest:raw,snapshot:null,status:null});
  assert.equal(product.crew.find(r=>r.id==='working-rat')!.status,'UNVERIFIED');
  assert.equal(product.workingRat.workingRatStatus,'UNVERIFIED');assert.equal(product.workingRat.productionEntitlementActive,null);
});

test('Watch audience is derived from existing tester runtime configuration only',async()=>{
 const product=await projectPublicProduct({manifest:manifest(),snapshot:null,status:null,watchRuntime:{enabled:true,publicEnabled:false,allowedUserId:'123'}});
 assert.equal(product.currentWatch.audience,'PRIVATE_TESTER');assert.equal(product.currentWatch.employmentAvailable,false);
});
