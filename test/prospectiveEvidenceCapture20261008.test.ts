import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PROSPECTIVE_EVIDENCE_CAPTURE_20261008 as sample } from './fixtures/prospectiveEvidenceCapture20261008.js';
import { PROSPECTIVE_SHADOW_ROSTER_V1 } from './fixtures/prospectiveShadowRosterV1.js';

test('immutable first-pass snapshot has exactly frozen three prospective project IDs',()=>{
 assert.equal(sample.projects.length,3);
 assert.deepEqual(sample.projects.map(x=>x.projectId),PROSPECTIVE_SHADOW_ROSTER_V1.targets.map(x=>x.projectId));
 assert.equal(sample.freezeOn,'2026-10-08');
 assert.ok(sample.projects.every(x=>x.coverage==='PARTIAL'&&!x.pressureV0Admitted&&!x.convergenceV1Admitted));
});
test('source-hash checks validate exact GitHub API response bytes, not remote HTML',()=>{
 assert.equal(sample.rawGithubSources.length,3);
 for(const file of sample.rawGithubSources){
  const content=readFileSync(file.sourceFile);
  assert.equal(content.length,file.bytesUtf8);
  assert.equal(createHash('sha256').update(content).digest('hex'),file.contentSha256);
  const source=JSON.parse(content.toString('utf8'));
  const published=source.published_at??source.merged_at;
  assert.ok(published<=sample.capturedAt);
 }
});
test('Miden source corpus has one real released version and two merged PRs',()=>{
 const [release,network,genesis]=sample.rawGithubSources.map(x=>JSON.parse(readFileSync(x.sourceFile,'utf8')));
 assert.equal(release.tag_name,'v0.17.2');
 assert.equal(network.number,2744);
 assert.equal(genesis.number,2743);
 assert.ok(network.merged_at && genesis.merged_at);
 assert.ok(network.body.includes('--network mainnet'));
 assert.ok(genesis.body.includes('TokenPolicyManagerV2'));
});
test('webpage text capture limitations and Rialo conflict are explicit',()=>{
 const [logos,miden,rialo]=sample.projects;
 assert.ok(logos.sources.every(x=>x.type==='WEB_TEXT_EXCERPT_NOT_RAW_CAPTURE'));
 assert.ok(miden.sources.every(x=>x.type==='GITHUB_API_JSON_CAPTURED'));
 assert.equal(rialo.observedReadiness,'SOURCE_CONFLICT_UNRESOLVED');
 assert.ok(rialo.sources.some(x=>x.type==='UNVERIFIED_EXPLORER_SEARCH_RESULT_HTTP_402'));
});
