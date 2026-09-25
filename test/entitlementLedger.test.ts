import assert from 'node:assert/strict';
import test from 'node:test';
import { D1CompatDatabase } from './support/d1Compat.js';
import { ENTITLEMENTS_CANDIDATE_SQL } from '../src/entitlements/schema.js';
import { D1EntitlementsCandidate, type MeteredRequest } from '../src/entitlements/ledger.js';

const NOW=1_800_000_000_000;
async function setup(options={enabled:true,allowOfflineFixtures:true}) {
  const db=new D1CompatDatabase();
  await db.exec(ENTITLEMENTS_CANDIDATE_SQL);
  const ledger=new D1EntitlementsCandidate(db,options);
  return {db,ledger};
}
const period={accountId:'acct_demo',periodId:'2026-09',fundingRef:'offline-receipt-001',
  globalCapUnits:100,arcCapUnits:80,ponsCapUnits:40,expiresAtMs:NOW+86_400_000};
const request=(key:string,chainId:5042|4663,units:number):MeteredRequest=>({
  accountId:period.accountId,periodId:period.periodId,requestKey:key,chainId,
  feature:'EXTENDED_RADAR',units,nowMs:NOW
});
test('both entitlement grants and spending default OFF; no payment URL or holder route enables Pro', async()=>{
  const {db,ledger}=await setup({enabled:false,allowOfflineFixtures:false});
  try {
    await assert.rejects(ledger.openOfflinePeriod(period),/OFFLINE_GRANTS_DISABLED/);
    await assert.rejects(ledger.reserve(request('one',5042,1)),/ENTITLEMENTS_DISABLED/);
  } finally {db.close();}
});
test('1000 concurrent contenders cannot exceed 100 global units; one exact key never double spends',async()=>{
  const {db,ledger}=await setup();
  try {
    assert.equal(await ledger.openOfflinePeriod(period),'CREATED');
    const attempts=await Promise.all(Array.from({length:1000},(_,i)=>
      ledger.reserve(request('req-'+i,(i%2===0?5042:4663),1))));
    assert.equal(attempts.filter(r=>r.outcome==='RESERVED').length,100);
    assert.equal(attempts.filter(r=>r.outcome==='EXHAUSTED').length,900);
    assert.equal((await ledger.balance(period.accountId,period.periodId)).globalAvailable,0);
    const already=attempts.findIndex(r=>r.outcome==='RESERVED');
    assert.equal((await ledger.reserve(request('req-'+already,(already%2===0?5042:4663),1))).outcome,'DUPLICATE');
  } finally {db.close();}
});
test('chain-specific caps hold even when the other chain still has room',async()=>{
  const {db,ledger}=await setup();
  try {
    await ledger.openOfflinePeriod(period);
    assert.equal((await ledger.reserve(request('pons40',4663,40))).outcome,'RESERVED');
    assert.equal((await ledger.reserve(request('pons1',4663,1))).outcome,'EXHAUSTED');
    assert.equal((await ledger.reserve(request('arc60',5042,60))).outcome,'RESERVED');
    assert.equal((await ledger.reserve(request('arc1',5042,1))).outcome,'EXHAUSTED');
  } finally {db.close();}
});
test('reserve, consume, duplicate, release, refund and final-key replay are idempotent',async()=>{
  const {db,ledger}=await setup();
  try {
    await ledger.openOfflinePeriod(period);
    const x=request('buy',5042,10);
    assert.equal((await ledger.reserve(x)).outcome,'RESERVED');
    assert.equal(await ledger.consume(x),'CONSUMED');
    assert.equal(await ledger.consume(x),'DUPLICATE');
    assert.equal((await ledger.reserve(x)).state,'CONSUMED');
    await assert.rejects(ledger.reserve({...x,units:11}),/IDEMPOTENCY_CONFLICT/);
    assert.equal(await ledger.refundConsumed(x),true);
    assert.equal(await ledger.refundConsumed(x),false);
    await assert.rejects(ledger.reserve(x),/FINAL_REQUEST_KEY/);
    const r=request('unused',4663,5);
    assert.equal((await ledger.reserve(r)).outcome,'RESERVED');
    assert.equal(await ledger.release(r),true);
    assert.equal(await ledger.release(r),false);
    await assert.rejects(ledger.consume(r),/CONSUME_DENIED/);
    assert.equal((await ledger.balance(period.accountId,period.periodId)).globalAvailable,100);
  } finally {db.close();}
});
test('expired period, revoked period and unsupported public/unknown chain fail closed',async()=>{
  const {db,ledger}=await setup();
  try {
    await ledger.openOfflinePeriod(period);
    assert.equal((await ledger.reserve({...request('late',5042,1),nowMs:period.expiresAtMs})).outcome,'EXHAUSTED');
    await assert.rejects(ledger.reserve({...request('invalid',5042,1),chainId:999 as 5042}),/CHAIN_UNSUPPORTED/);
    await assert.rejects(ledger.reserve({...request('free',5042,1),feature:'PUBLIC_RECEIPT' as 'DEEP_REPLAY'}),/CLASS_UNSUPPORTED/);
    const reserved=request('open',5042,3);
    assert.equal((await ledger.reserve(reserved)).outcome,'RESERVED');
    assert.equal(await ledger.revokePeriod(period.accountId,period.periodId),true);
    assert.equal((await ledger.reserve(request('revoked',5042,1))).outcome,'EXHAUSTED');
    await assert.rejects(ledger.consume(reserved),/CONSUME_DENIED/);
    assert.equal((await ledger.balance(period.accountId,period.periodId)).active,false);
  } finally {db.close();}
});
test('offline fixture funding identity is immutable, even across two accounts',async()=>{
  const {db,ledger}=await setup();
  try {
    assert.equal(await ledger.openOfflinePeriod(period),'CREATED');
    assert.equal(await ledger.openOfflinePeriod(period),'DUPLICATE');
    await assert.rejects(ledger.openOfflinePeriod({...period,globalCapUnits:999}),/FUNDING_IDENTITY_CONFLICT/);
    await assert.rejects(ledger.openOfflinePeriod({...period,accountId:'attacker'}),/FUNDING_IDENTITY_CONFLICT/);
  } finally {db.close();}
});
