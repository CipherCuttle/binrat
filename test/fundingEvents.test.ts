import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import test from 'node:test';
import { D1FundingEventCandidate } from '../src/entitlements/fundingEvents.js';
import { ENTITLEMENTS_CANDIDATE_SQL } from '../src/entitlements/schema.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const NOW = 1_800_000_000_000;
const SECRET = 'offline-fixture-only';
const sign = (raw: string) => createHmac('sha256', SECRET).update(raw).digest('hex');
const verify = (raw: string, signature: string) => {
  const expected = sign(raw);
  return /^[0-9a-f]{64}$/.test(signature) && timingSafeEqual(Buffer.from(expected),Buffer.from(signature));
};
const payload = (eventId: string, revision: number, action: string, fundingRef='receipt-1') => JSON.stringify({
  provider:'OFFLINE_SIGNED_FIXTURE',eventId,fundingRef,accountId:'acct-1',periodId:'2026-09',
  revision,action,occurredAtMs:NOW-revision
});
async function setup(enabled=true) {
  const db = new D1CompatDatabase(); await db.exec(ENTITLEMENTS_CANDIDATE_SQL);
  return {db,events:new D1FundingEventCandidate(db,{enabled,allowSignedFixtures:true,now:()=>NOW,verify})};
}

test('signed funding receipts default off and never grant quota authority',async()=>{
  const {db,events}=await setup(false);
  try {
    const raw=payload('event-1',1,'AUTHORIZED');
    await assert.rejects(events.record(raw,sign(raw)),/FUNDING_EVENTS_DISABLED/);
  } finally {db.close();}
});

test('authorization, refund and chargeback are immutable ordered receipts only',async()=>{
  const {db,events}=await setup();
  try {
    const one=payload('event-1',1,'AUTHORIZED');
    assert.equal(await events.record(one,sign(one)),'APPLIED');
    assert.equal(await events.record(one,sign(one)),'REPLAY');
    assert.deepEqual(await events.status('receipt-1'),{known:true,action:'AUTHORIZED',revision:1,grantAuthority:false});
    const three=payload('event-3',3,'CHARGEBACK');
    assert.equal(await events.record(three,sign(three)),'APPLIED');
    const two=payload('event-2',2,'REFUNDED');
    assert.equal(await events.record(two,sign(two)),'STALE_RECORDED');
    assert.deepEqual(await events.status('receipt-1'),{known:true,action:'CHARGEBACK',revision:3,grantAuthority:false});
    await assert.rejects(db.prepare('DELETE FROM candidate_entitlement_funding_events').run(),/IMMUTABLE/);
  } finally {db.close();}
});

test('bad signatures and conflicting event or revision identities fail closed',async()=>{
  const {db,events}=await setup();
  try {
    const raw=payload('event-1',1,'AUTHORIZED');
    await assert.rejects(events.record(raw,'0'.repeat(64)),/SIGNATURE_INVALID/);
    assert.equal(await events.record(raw,sign(raw)),'APPLIED');
    const sameIdDifferent=payload('event-1',2,'REFUNDED');
    await assert.rejects(events.record(sameIdDifferent,sign(sameIdDifferent)),/EVENT_ID_CONFLICT/);
    const sameRevisionDifferent=payload('event-other',1,'REFUNDED');
    await assert.rejects(events.record(sameRevisionDifferent,sign(sameRevisionDifferent)),/REVISION_CONFLICT/);
    const rebound=JSON.stringify({
      provider:'OFFLINE_SIGNED_FIXTURE',eventId:'event-rebound',fundingRef:'receipt-1',
      accountId:'attacker',periodId:'2026-10',revision:2,action:'REFUNDED',occurredAtMs:NOW-2
    });
    await assert.rejects(events.record(rebound,sign(rebound)),/IDENTITY_CONFLICT/);
    await assert.rejects(db.prepare(
      'INSERT INTO candidate_entitlement_funding_events ' +
      '(event_id,provider,funding_ref,account_id,period_id,revision,action,payload_sha256,occurred_at_ms,received_at_ms) ' +
      "VALUES ('direct-rebind','OFFLINE_SIGNED_FIXTURE','receipt-1','attacker','2026-10',4,'REVOKED'," +
      "'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',1,1)"
    ).run(),/IDENTITY_CONFLICT/);
    await assert.rejects(events.record('x'.repeat(4097),'valid-looking'),/ENVELOPE_BOUNDS/);
  } finally {db.close();}
});
