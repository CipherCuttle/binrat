import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex } from '../src/core/types.js';
import { sha256Hex } from '../src/evidence/canonical.js';
import { PONS_V2_FACTORY } from '../src/pons/chain.js';
import {
  NATIVE_QUOTE_ADDRESS,
  estimateFdvQuoteRaw,
  observePonsOutcome,
  verifyPonsOutcomeObservation,
  type PonsCurveState,
  type PonsOutcomeLaunch,
  type PonsOutcomeObservation,
  type PonsOutcomeSource
} from '../src/pons/outcome.js';
import { addr, hash } from './support/autonomousFixture.js';

const launch:PonsOutcomeLaunch={
  launchId:'a'.repeat(64),
  token:addr(100),
  curve:addr(200)
};

function source(
  state:PonsCurveState,
  options:{reorgAfterRead?:boolean}={}
):PonsOutcomeSource {
  let hashReads=0;
  return {
    async assertAuthority() {},
    async getBlockHash(blockNumber) {
      hashReads+=1;
      return options.reorgAfterRead && hashReads>1 ? hash(Number(blockNumber)+1) : hash(Number(blockNumber));
    },
    async readCurveState() { return state; }
  };
}

function curveState(overrides:Partial<PonsCurveState>={}):PonsCurveState {
  return {
    token:launch.token,
    pairToken:NATIVE_QUOTE_ADDRESS,
    factory:PONS_V2_FACTORY,
    graduated:false,
    quoteReserve:5n*10n**18n,
    tokenReserve:500_000_000n*10n**18n,
    tokenDecimals:18,
    totalSupply:1_000_000_000n*10n**18n,
    quoteDecimals:18,
    ...overrides
  };
}

function core(receipt:PonsOutcomeObservation) {
  return {
    observationVersion:receipt.observationVersion,
    chainId:receipt.chainId,
    launchId:receipt.launchId,
    token:receipt.token,
    curve:receipt.curve,
    observedBlock:receipt.observedBlock,
    observedBlockHash:receipt.observedBlockHash,
    phase:receipt.phase,
    quoteAsset:receipt.quoteAsset,
    quoteDecimals:receipt.quoteDecimals,
    tokenDecimals:receipt.tokenDecimals,
    quoteReserve:receipt.quoteReserve,
    tokenReserve:receipt.tokenReserve,
    totalSupply:receipt.totalSupply,
    estimatedFdvQuoteRaw:receipt.estimatedFdvQuoteRaw,
    status:receipt.status,
    missing:[...receipt.missing]
  };
}

test('pre-graduation native Pons observation derives estimated FDV in raw ETH units', async () => {
  const receipt=await observePonsOutcome(source(curveState()),launch,123n);
  assert.equal(receipt.phase,'CURVE');
  assert.equal(receipt.quoteAsset,NATIVE_QUOTE_ADDRESS);
  assert.equal(receipt.quoteDecimals,18);
  assert.equal(receipt.estimatedFdvQuoteRaw,10n*10n**18n);
  assert.equal(receipt.status,'COMPLETE');
  assert.deepEqual(receipt.missing,[]);
  await assert.doesNotReject(verifyPonsOutcomeObservation(receipt));
});

test('estimated FDV uses totalSupply observed at the same block, including holder burns', async () => {
  const full=estimateFdvQuoteRaw(
    5n*10n**18n,
    500_000_000n*10n**18n,
    1_000_000_000n*10n**18n
  );
  const burned=estimateFdvQuoteRaw(
    5n*10n**18n,
    500_000_000n*10n**18n,
    900_000_000n*10n**18n
  );
  assert.equal(full,10n*10n**18n);
  assert.equal(burned,9n*10n**18n);

  const receipt=await observePonsOutcome(
    source(curveState({totalSupply:900_000_000n*10n**18n})),
    launch,
    124n
  );
  assert.equal(receipt.estimatedFdvQuoteRaw,9n*10n**18n);
});

test('ERC20 quote observations retain quote decimals without pretending the quote is USD', async () => {
  const pair=addr(300);
  const receipt=await observePonsOutcome(
    source(curveState({
      pairToken:pair,
      quoteDecimals:6,
      quoteReserve:5_000_000n,
      tokenReserve:500_000_000n*10n**18n,
      totalSupply:1_000_000_000n*10n**18n
    })),
    launch,
    125n
  );
  assert.equal(receipt.quoteAsset,pair);
  assert.equal(receipt.quoteDecimals,6);
  assert.equal(receipt.estimatedFdvQuoteRaw,10_000_000n);
});

test('graduated observations fail closed instead of extrapolating curve valuation', async () => {
  const receipt=await observePonsOutcome(
    source(curveState({graduated:true})),
    launch,
    126n
  );
  assert.equal(receipt.phase,'GRADUATED');
  assert.equal(receipt.estimatedFdvQuoteRaw,null);
  assert.equal(receipt.quoteReserve,null);
  assert.equal(receipt.tokenReserve,null);
  assert.equal(receipt.status,'PARTIAL');
  assert.ok(receipt.missing.includes('POST_GRADUATION_PRICE_AUTHORITY'));
  await assert.doesNotReject(verifyPonsOutcomeObservation(receipt));
});

test('outcome observation rejects token/factory binding drift', async () => {
  await assert.rejects(
    observePonsOutcome(source(curveState({token:addr(999)})),launch,127n),
    /PONS_OUTCOME_TOKEN_BINDING_MISMATCH/
  );
  await assert.rejects(
    observePonsOutcome(source(curveState({factory:addr(998)})),launch,127n),
    /PONS_OUTCOME_FACTORY_BINDING_MISMATCH/
  );
});

test('outcome observation rejects a reorg across the historical read', async () => {
  await assert.rejects(
    observePonsOutcome(source(curveState(),{reorgAfterRead:true}),launch,128n),
    /PONS_OUTCOME_REORG_DURING_READ/
  );
});

test('verifier rejects forged FDV even when attacker recomputes the digest', async () => {
  const receipt=await observePonsOutcome(source(curveState()),launch,129n);
  const forged:PonsOutcomeObservation={
    ...receipt,
    estimatedFdvQuoteRaw:(receipt.estimatedFdvQuoteRaw ?? 0n)+1n
  };
  forged.evidenceDigest=await sha256Hex(core(forged));
  await assert.rejects(
    verifyPonsOutcomeObservation(forged),
    /PONS_OUTCOME_RECEIPT_INVALID/
  );
});

test('invalid reserve inputs never produce an estimated FDV', async () => {
  assert.throws(()=>estimateFdvQuoteRaw(0n,1n,1n),/PONS_OUTCOME_FDV_INPUT_INVALID/);
  assert.throws(()=>estimateFdvQuoteRaw(1n,0n,1n),/PONS_OUTCOME_FDV_INPUT_INVALID/);

  const receipt=await observePonsOutcome(
    source(curveState({tokenReserve:0n})),
    launch,
    130n
  );
  assert.equal(receipt.estimatedFdvQuoteRaw,null);
  assert.equal(receipt.status,'PARTIAL');
  assert.ok(receipt.missing.includes('CURVE_RESERVES'));
});
