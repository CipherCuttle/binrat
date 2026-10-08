import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateDatedLaunchBaseline,type DatedLaunchEvent} from '../src/intelligence/datedLaunchBaselineV1.js';
import { ARC_SCHEDULE_DIAGNOSTIC,ARC_REPORTED_OUTCOME } from './fixtures/datedLaunchDiagnosticV1.js';
import { PROSPECTIVE_SHADOW_ROSTER_V1 } from './fixtures/prospectiveShadowRosterV1.js';

const source=(overrides:Partial<DatedLaunchEvent>={}):DatedLaunchEvent=>({
 projectId:'example-network',targetId:'public',event:'SCHEDULED',
 observedOn:'2026-08-05',publishedOn:'2026-08-05',launchOn:'2026-09-16',
 sourceRef:'https://source.example/launch',sourceOrigin:'source.example',...overrides
});
const score=(events:readonly DatedLaunchEvent[],asOf:string,coverage:'VERIFIED'|'PARTIAL'='VERIFIED')=>
 evaluateDatedLaunchBaseline({projectId:'example-network',targetId:'public',asOf,events,coverage});

test('synthetic future date is 14 days out at cutoff',()=>{
 const r=score([source()],'2026-09-02');
 assert.equal(r.state,'SCHEDULE_WITHIN_30D');
 assert.equal(r.scheduledFor,'2026-09-16');
});
test('30d threshold and future-publication fails closed',()=>{
 assert.equal(score([source()],'2026-08-15').state,'NO_30D_DATE'); // 32d
 assert.equal(score([source()],'2026-08-04').state,'NO_30D_DATE');
 assert.equal(score([source({publishedOn:'2026-09-03'})],'2026-09-02').state,'NO_30D_DATE');
});
test('cancellation and rescheduling override earlier dated claim',()=>{
 assert.equal(score([source(),source({event:'CANCELLED',launchOn:null,publishedOn:'2026-09-01'})],'2026-09-02').state,'NO_30D_DATE');
 const r=score([source(),source({event:'RESCHEDULED',launchOn:'2026-10-30',publishedOn:'2026-08-20'})],'2026-09-02');
 assert.equal(r.state,'NO_30D_DATE');
});
test('same-day conflicting sources have indeterminate order',()=>{
 assert.equal(score([source(),source({sourceRef:'https://source.example/revision',event:'CANCELLED',launchOn:null})],'2026-09-02').state,'INSUFFICIENT_EVIDENCE');
});
test('target, coverage and past launch dates fail closed',()=>{
 assert.equal(score([source({targetId:'testnet'})],'2026-09-02').state,'NO_30D_DATE');
 assert.equal(score([source()],'2026-09-02','PARTIAL').state,'INSUFFICIENT_EVIDENCE');
 assert.equal(score([source()],'2026-09-17').state,'NO_30D_DATE');
});
test('Arc source claim only supports retrospective illustration, never holdout efficacy',()=>{
 const diagnostic=evaluateDatedLaunchBaseline({
  projectId:'arc-public-mainnet',targetId:'public-mainnet',
  asOf:'2026-09-02',coverage:'PARTIAL',events:ARC_SCHEDULE_DIAGNOSTIC
 });
 assert.equal(diagnostic.state,'INSUFFICIENT_EVIDENCE');
 assert.equal(ARC_REPORTED_OUTCOME.publicLaunchOn,'2026-09-16');
});
test('prospective roster is new, source-attributed and not scores',()=>{
 assert.equal(PROSPECTIVE_SHADOW_ROSTER_V1.freezeOn,'2026-10-08');
 assert.equal(PROSPECTIVE_SHADOW_ROSTER_V1.targets.length,3);
 assert.equal(new Set(PROSPECTIVE_SHADOW_ROSTER_V1.targets.map(x=>x.projectId)).size,3);
 assert.ok(PROSPECTIVE_SHADOW_ROSTER_V1.targets.every(x=>x.evidenceStatus==='PARTIAL'&&x.sourceRef.startsWith('https://')));
});
