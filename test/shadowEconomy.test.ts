import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SHADOW_ECONOMY_VERSION,
  SHADOW_PAYMENT_ASSETS,
  applyShadowInvestigationEvent,
  canAutoPromoteShadowClaim,
  createShadowInvestigation,
  shadowEntitlement,
  validateShadowEvidenceClaim
} from '../src/economy/shadowEconomy.js';

const launchId='a'.repeat(64);

test('Shadow Economy V0 keeps free useful and sells leverage rather than basic evidence',()=>{
  const free=shadowEntitlement('FREE');
  const pro=shadowEntitlement('PRO');

  assert.equal(free.version,SHADOW_ECONOMY_VERSION);
  assert.equal(free.investigationRequestEnabled,true);
  assert.equal(free.watchLimit,5);
  assert.equal(free.priorLaunchDepth,5);
  assert.equal(free.advancedAlerts,false);
  assert.equal(free.exportEnabled,false);

  assert.equal(pro.investigationRequestEnabled,true);
  assert.equal(pro.watchLimit,25);
  assert.equal(pro.priorLaunchDepth,50);
  assert.equal(pro.advancedAlerts,true);
  assert.equal(pro.exportEnabled,true);
});

test('Shadow Economy V0 has no native token payment rail',()=>{
  assert.deepEqual(SHADOW_PAYMENT_ASSETS,['FIAT','USDC']);
  assert.equal(SHADOW_PAYMENT_ASSETS.includes('BINRAT' as never),false);
});

test('investigation lifecycle requires real funding before assignment and submission',()=>{
  const created=createShadowInvestigation({
    requestId:'req:1',
    principalId:'tg:77',
    chainId:4663,
    launchId,
    kind:'FUNDING_SOURCE',
    question:'Where did this deployer receive its pre-launch funding?',
    nowMs:1000
  });

  assert.equal(created.state,'DRAFT');
  assert.throws(()=>applyShadowInvestigationEvent(created,{
    type:'ASSIGNED',
    eventId:'evt:bad',
    occurredAtMs:1100,
    investigatorId:'researcher:1'
  }),/SHADOW_STATE_CONFLICT/);

  const quoted=applyShadowInvestigationEvent(created,{
    type:'QUOTE_ISSUED',
    eventId:'evt:quote',
    occurredAtMs:1100,
    amountMinor:2500,
    asset:'USDC',
    expiresAtMs:10_000
  });
  const funded=applyShadowInvestigationEvent(quoted,{
    type:'PAYMENT_CONFIRMED',
    eventId:'evt:paid',
    occurredAtMs:1200,
    paymentReference:'payment:fixture-1',
    amountMinor:2500,
    asset:'USDC'
  });
  const assigned=applyShadowInvestigationEvent(funded,{
    type:'ASSIGNED',
    eventId:'evt:assigned',
    occurredAtMs:1300,
    investigatorId:'researcher:1'
  });
  const submitted=applyShadowInvestigationEvent(assigned,{
    type:'SUBMITTED',
    eventId:'evt:submitted',
    occurredAtMs:1400,
    submissionId:'submission:1'
  });
  const accepted=applyShadowInvestigationEvent(submitted,{
    type:'ACCEPTED',
    eventId:'evt:accepted',
    occurredAtMs:1500,
    decisionId:'decision:1'
  });

  assert.equal(accepted.state,'ACCEPTED');
  assert.equal(accepted.paymentReference,'payment:fixture-1');
  assert.equal(accepted.investigatorId,'researcher:1');
  assert.equal(accepted.submissionId,'submission:1');
  assert.equal(accepted.decisionId,'decision:1');

  assert.throws(()=>applyShadowInvestigationEvent(accepted,{
    type:'CANCELLED',
    eventId:'evt:cancel',
    occurredAtMs:1600
  }),/SHADOW_FUNDED_CANCELLATION_REQUIRES_REFUND_FLOW/);
});

test('expired quotes cannot silently become funded jobs',()=>{
  const created=createShadowInvestigation({
    requestId:'req:2',
    principalId:'tg:77',
    chainId:4663,
    launchId,
    kind:'CUSTOM',
    question:'Check whether these wallets share an evidence-backed trail.',
    nowMs:1000
  });
  const quoted=applyShadowInvestigationEvent(created,{
    type:'QUOTE_ISSUED',
    eventId:'evt:q2',
    occurredAtMs:1100,
    amountMinor:1000,
    asset:'FIAT',
    expiresAtMs:1200
  });

  assert.throws(()=>applyShadowInvestigationEvent(quoted,{
    type:'PAYMENT_CONFIRMED',
    eventId:'evt:p2',
    occurredAtMs:1200,
    paymentReference:'payment:late',
    amountMinor:1000,
    asset:'FIAT'
  }),/SHADOW_QUOTE_EXPIRED/);
});

test('evidence claims preserve source class and never auto-promote into canonical facts',()=>{
  const observed=validateShadowEvidenceClaim({
    claimId:'claim:1',
    evidenceClass:'OBSERVED',
    statement:'Wallet A transferred native ETH to the deployer before launch.',
    refs:['receipt:tx:1','receipt:tx:1']
  });
  assert.deepEqual(observed.refs,['receipt:tx:1']);
  assert.equal(canAutoPromoteShadowClaim(observed),false);

  const claim=validateShadowEvidenceClaim({
    claimId:'claim:2',
    evidenceClass:'UNVERIFIED_CLAIM',
    statement:'These wallets may be operated by the same person.',
    refs:[]
  });
  assert.equal(claim.evidenceClass,'UNVERIFIED_CLAIM');
  assert.equal(canAutoPromoteShadowClaim(claim),false);

  assert.throws(()=>validateShadowEvidenceClaim({
    claimId:'claim:3',
    evidenceClass:'DERIVED',
    statement:'Same funding source.',
    refs:[]
  }),/SHADOW_EVIDENCE_REF_REQUIRED/);
});


test('payment confirmation must match the exact quoted amount and asset',()=>{
  const created=createShadowInvestigation({
    requestId:'req:3',
    principalId:'tg:77',
    chainId:4663,
    launchId,
    kind:'PREVIOUS_PROJECTS',
    question:'Find prior projects supported by retained evidence.',
    nowMs:1000
  });
  const quoted=applyShadowInvestigationEvent(created,{
    type:'QUOTE_ISSUED',
    eventId:'evt:q3',
    occurredAtMs:1100,
    amountMinor:1500,
    asset:'USDC',
    expiresAtMs:5000
  });

  assert.throws(()=>applyShadowInvestigationEvent(quoted,{
    type:'PAYMENT_CONFIRMED',
    eventId:'evt:p3',
    occurredAtMs:1200,
    paymentReference:'payment:wrong',
    amountMinor:1499,
    asset:'USDC'
  }),/SHADOW_PAYMENT_QUOTE_MISMATCH/);

  assert.throws(()=>applyShadowInvestigationEvent(quoted,{
    type:'PAYMENT_CONFIRMED',
    eventId:'evt:p4',
    occurredAtMs:1200,
    paymentReference:'payment:wrong-asset',
    amountMinor:1500,
    asset:'FIAT'
  }),/SHADOW_PAYMENT_QUOTE_MISMATCH/);
});
