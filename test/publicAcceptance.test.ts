import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// @ts-expect-error A Node acceptance tool, kept outside the Worker bundle.
import { assertDeploymentProvenance,assertIndependentPublications,resolvedObservationCadence } from '../scripts/lib/public-acceptance.mjs';
import { buildPublicSnapshot } from '../src/cloudflare/publicSnapshot.js';
import { canonicalJson } from '../src/evidence/canonical.js';

const semantics={publicationIntervalMs:60000,statusCacheTtlMs:5000,feedSharedCacheTtlMs:60000,maxStatusAgeMs:180000};
const hash=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
test('acceptance cadence is derived from canonical TTL and publication semantics',()=>{
  assert.equal(resolvedObservationCadence(semantics),61000);
  assert.equal(resolvedObservationCadence({...semantics,feedSharedCacheTtlMs:70000}),71000);
  assert.throws(()=>resolvedObservationCadence({...semantics,publicationIntervalMs:null}),/UNVERIFIED/);
});
test('acceptance rejects one cached success, checkpoint conflict and tampering',async()=>{
  const feed=await buildPublicSnapshot({schemaVersion:'binrat.latest-launches/0.1',chainId:4663,sourceCheckpoint:'100',checkpointBlockHash:`0x${'1'.repeat(64)}`,historyCoverage:'PARTIAL',launches:[]});
  const first={observedAtMs:100000,status:{schemaVersion:'binrat.public-status/0.1',chainId:4663,state:'FRESH_VERIFIED',checkpointBlock:'100',checkpointBlockHash:feed.checkpointBlockHash,
    feedDigest:feed.feedDigest,verifiedAtMs:99000,runtimeUpdatedAtMs:99000,freshnessValidUntilMs:279000,publicationVersion:1,lastSyncError:null},feed};
  const cached={...first,observedAtMs:161000};
  await assert.rejects(assertIndependentPublications(first,cached,semantics),/CACHED_SUCCESS/);
  const second={...cached,status:{...first.status,verifiedAtMs:160000,runtimeUpdatedAtMs:160000,publicationVersion:2}};
  await assertIndependentPublications(first,second,semantics);
  await assert.rejects(assertIndependentPublications(first,{...second,observedAtMs:115000,status:{...second.status,verifiedAtMs:114000,runtimeUpdatedAtMs:114000}},semantics),/TOO_CLOSE/);
  await assert.rejects(assertIndependentPublications(first,{...second,feed:{...feed,chainId:5042}},semantics),/BINDING_INVALID/);
  const changed=await buildPublicSnapshot({...feed,checkpointBlockHash:`0x${'2'.repeat(64)}`});
  await assert.rejects(assertIndependentPublications(first,{...second,feed:changed,status:{...second.status,checkpointBlockHash:changed.checkpointBlockHash,feedDigest:changed.feedDigest}},semantics),/CHECKPOINT_CONFLICT/);
});
test('source SHA alone and revision after a secret mutation cannot pass acceptance',()=>{
  const sha='a'.repeat(40),revision='11111111-2222-3333-4444-555555555555';
  const material={schemaVersion:'binrat.public-release/1',sourceSha:sha,sourceClean:true,manifestDigest:'b'.repeat(64),assetsDigest:'c'.repeat(64)};
  const release={...material,buildId:hash(material)};
  const input={reviewedSha:sha,artifact:{release,workerSha256:'d'.repeat(64)},marker:release,
    provider:{sourceSha:sha,workerSha256:'d'.repeat(64),buildId:release.buildId,assetsDigest:release.assetsDigest,readbackSource:'CLOUDFLARE_READ_ONLY',workerName:'candidate',workerRevisionId:revision,
      activeVersions:[{id:revision,percentage:100}],runtimeSemantics:semantics},
    health:{release:{workerRevisionId:revision,buildId:release.buildId,sourceBinding:'BOUND',observedManifestDigest:release.manifestDigest,effectiveMaxStatusAgeMs:180000}},
    observedHeaders:[{'x-binrat-build-id':release.buildId,'x-binrat-source-sha':sha}]};
  assert.equal(assertDeploymentProvenance(input),release.buildId);
  assert.throws(()=>assertDeploymentProvenance({...input,provider:{...input.provider,activeVersions:[{id:'different-after-secret-put',percentage:100}]}}),/REVISION_UNVERIFIED/);
  assert.throws(()=>assertDeploymentProvenance({...input,artifact:{...input.artifact,release:{...release,sourceClean:false}}}),/ARTIFACT_UNVERIFIED/);
  assert.throws(()=>assertDeploymentProvenance({...input,observedHeaders:[{}]}),/RESPONSE_RELEASE_MISMATCH/);
});
