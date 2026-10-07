import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { observedPublicRelease } from '../src/public/releaseIdentity.js';
import { sha256Hex } from '../src/evidence/canonical.js';

test('release metadata has matching static identity and a digest of actual manifest content',async()=>{
  const manifest=JSON.parse(readFileSync('docs/CAPABILITY_MANIFEST_V0.json','utf8'));
  const marker=JSON.parse(readFileSync('web/release.json','utf8'));
  const release=await observedPublicRelease(manifest,marker.sourceSha);
  assert.equal(release.buildId,marker.buildId);
  assert.equal(release.observedManifestDigest,await sha256Hex(manifest));
  assert.equal(release.manifestDigest,release.observedManifestDigest);
  assert.equal(release.deploymentBinding,'REQUIRES_DEPLOYMENT_RECEIPT');
});
test('a SHA string cannot establish a release with another manifest',async()=>{
  const marker=JSON.parse(readFileSync('web/release.json','utf8'));
  const release=await observedPublicRelease({changed:true},marker.sourceSha);
  assert.equal(release.sourceBinding,'UNVERIFIED');
  assert.notEqual(release.observedManifestDigest,release.manifestDigest);
  assert.equal((await observedPublicRelease(null)).sourceBinding,'UNVERIFIED');
});
