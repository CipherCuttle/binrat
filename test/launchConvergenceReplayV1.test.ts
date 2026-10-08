import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateConvergenceReplay, summarizeConvergenceEvidenceInventory,
  type ConvergenceEvidence
} from '../src/intelligence/launchConvergenceReplayV1.js';
import { LAUNCH_CONVERGENCE_HOLDOUT_V1 } from './fixtures/launchConvergenceHoldoutV1.js';
import {
  CONVERGENCE_OUTCOME_CANDIDATES_V1,CONVERGENCE_EVIDENCE_INVENTORY_V1
} from './fixtures/launchConvergenceEvidenceInventoryV1.js';

const hash='a'.repeat(64);
const source=(kind:ConvergenceEvidence['kind'],observedOn:string,rest:Partial<ConvergenceEvidence>={}):ConvergenceEvidence=>({
  projectId:'synthetic-chain',targetId:'phase-public',kind,observedOn,publishedOn:observedOn,
  sourceRef:'https://example.org/source/'+kind+'/'+observedOn,
  sourceOrigin:'example.org',sourceHash:hash,...rest
});
const open=source('OPEN_BLOCKER','2024-01-01',{blockerId:'audits'});
const closed=source('BLOCKER_CLOSED','2024-01-05',{blockerId:'audits'});
const action=source('EXECUTION_COMMITMENT','2024-01-10',{
  executionKind:'ONCHAIN_PRODUCTION_TX',
  executionCoordinates:'chain:123:tx:0xabc',
  independentSourceRef:'https://explorer.example.net/tx/0xabc',
  independentSourceOrigin:'explorer.example.net',
  independentSourceHash:'b'.repeat(64),independentSourcePublishedOn:'2024-01-10'
});
const evaluate=(receipts:ConvergenceEvidence[],asOf='2024-01-11',coverage:'VERIFIED'|'PARTIAL'='VERIFIED')=>
  evaluateConvergenceReplay({projectId:'synthetic-chain',targetId:'phase-public',asOf,coverage,receipts});

test('synthetic positive requires prior explicit blocker closure and fresh independent production commitment',()=>{
  const out=evaluate([open,closed,action]);
  assert.equal(out.state,'CONVERGENCE_CANDIDATE');
  assert.equal(out.eligibleExecutionCount,1);
});
test('partial evidence is unscorable even if positive-looking receipts exist',()=>{
  assert.equal(evaluate([open,closed,action],'2024-01-11','PARTIAL').state,'INSUFFICIENT_EVIDENCE');
});
test('future published evidence is never counted retrospectively',()=>{
  const late={...closed, publishedOn:'2024-01-12'};
  const out=evaluate([open,late,action]);
  assert.equal(out.state,'NO_CONVERGENCE_SIGNAL');
  assert.equal(out.ignoredFutureEvidence,1);
});
test('an explicit reopened blocker suppresses launch convergence',()=>{
  const reopened=source('OPEN_BLOCKER','2024-01-09',{blockerId:'audits'});
  assert.equal(evaluate([open,closed,reopened,action]).state,'NO_CONVERGENCE_SIGNAL');
});
test('no known blockers means unknown, not closed',()=>{
  assert.equal(evaluate([action]).state,'NO_CONVERGENCE_SIGNAL');
});
test('same-day closure and action is not strict causal order',()=>{
  const same={...action,observedOn:'2024-01-05',publishedOn:'2024-01-05'};
  assert.equal(evaluate([open,closed,same]).state,'NO_CONVERGENCE_SIGNAL');
});
test('independence cannot be two mirrors from the same origin',()=>{
  const mirrored={...action,independentSourceOrigin:'example.org'};
  assert.equal(evaluate([open,closed,mirrored]).state,'NO_CONVERGENCE_SIGNAL');
});
test('action must not exceed preregistered 30-day freshness or closure window',()=>{
  assert.equal(evaluate([open,closed,action],'2024-02-15').state,'NO_CONVERGENCE_SIGNAL');
  const late=source('EXECUTION_COMMITMENT','2024-02-10',{
    ...action,observedOn:'2024-02-10',publishedOn:'2024-02-10',
    independentSourcePublishedOn:'2024-02-10'
  });
  assert.equal(evaluate([open,closed,late],'2024-02-11').state,'NO_CONVERGENCE_SIGNAL');
});
test('evidence from another target phase never counts',()=>{
  const other={...action,targetId:'phase-testnet'};
  assert.equal(evaluate([open,closed,other]).state,'NO_CONVERGENCE_SIGNAL');
});
test('a closure without source-literal prior OPEN_BLOCKER is rejected',()=>{
  assert.throws(()=>evaluate([closed,action]),/CONVERGENCE_UNMATCHED_CLOSURE/);
});
test('inventory refuses to convert launch-label dates to efficacy metrics',()=>{
  const report=summarizeConvergenceEvidenceInventory(
    LAUNCH_CONVERGENCE_HOLDOUT_V1,CONVERGENCE_OUTCOME_CANDIDATES_V1,CONVERGENCE_EVIDENCE_INVENTORY_V1
  );
  assert.equal(report.totalTargets,12);
  assert.equal(report.verifiedTargetReceiptCoverage,0);
  assert.equal(report.partialTargetReceiptCoverage,12);
  assert.equal(report.datedOutcomeCandidates,9);
  assert.equal(report.phaseOrDateUnresolved,3);
  assert.equal(report.result,'INSUFFICIENT_DATA');
});
