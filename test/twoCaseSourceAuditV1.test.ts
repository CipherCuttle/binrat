import assert from 'node:assert/strict';
import test from 'node:test';
import { TWO_CASE_SOURCE_AUDIT_V1, DATED_SCHEDULE_TRAP_V1 } from './fixtures/twoCaseSourceAuditV1.js';

test('historical two-case sources are never silently admitted as verified efficacy',()=>{
  assert.deepEqual(TWO_CASE_SOURCE_AUDIT_V1.map(x=>x.projectId),['base','zksync-era']);
  assert.ok(TWO_CASE_SOURCE_AUDIT_V1.every(x=>x.evidenceCoverage==='PARTIAL' && !x.preregScoreEligible));
  assert.ok(TWO_CASE_SOURCE_AUDIT_V1.every(x=>x.prelaunchEvents.every(e=>e.sourceRef.startsWith('https://') && e.observedOn<x.outcomeOn)));
});
test('Base and zkSync test different public-access phases, not private mainnet milestones',()=>{
  const [base,zksync]=TWO_CASE_SOURCE_AUDIT_V1;
  assert.equal(base.outcomeOn,'2023-08-09');
  assert.equal(zksync.outcomeOn,'2023-03-24');
  assert.ok(base.targetNote.includes('bridge opening'));
  assert.ok(zksync.targetNote.includes('Baby Alpha'));
});
test('Neon is explicitly adversarial to date-only baseline, but not a verified benchmark statistic',()=>{
  assert.equal(DATED_SCHEDULE_TRAP_V1.schedulePublishedOn,'2022-11-07');
  assert.equal(DATED_SCHEDULE_TRAP_V1.scheduledLaunchOn,'2022-12-12');
  assert.equal(DATED_SCHEDULE_TRAP_V1.explicitDelayPublishedOn,'2022-12-12');
  assert.equal(DATED_SCHEDULE_TRAP_V1.actualLaunchOn,'2023-07-17');
  assert.equal(DATED_SCHEDULE_TRAP_V1.preregScoreEligible,false);
  assert.equal(DATED_SCHEDULE_TRAP_V1.evidenceCoverage,'PARTIAL');
});
