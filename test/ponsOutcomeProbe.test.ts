import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson } from '../src/evidence/canonical.js';
import {
  derivePonsCurveFdvRaw,
  probePonsOutcomeAtBlock,
  verifyPonsOutcomeProbeReceipt,
  type PonsOutcomeLaunchRef,
  type PonsOutcomeProbeSource,
  type PonsCurveState
} from '../src/pons/outcomeProbe.js';
import { addr, hash } from './support/autonomousFixture.js';

const launch:PonsOutcomeLaunchRef={
  launchId:'a'.repeat(64),
  token:addr(100),
  curve:addr(200)
};

function source(
  state:Partial<PonsCurveState>={},
  options:{reorg?:boolean}={}
):PonsOutcomeProbeSource {
  let reads=0;
  const value:PonsCurveState={
    curveToken:launch.token,
    pairToken:addr(0),
    graduated:false,
    quoteReserve:1_000n,
    tokenReserve:500n,
    tokenDecimals:18,
    quoteDecimals:18,
    totalSupply:10_000n,
    ...state
  };
  return {
    async assertAuthority() {},
    async getBlockPoint(blockNumber) {
      reads+=1;
      return {
        blockNumber,
        blockHash:options.reorg && reads>1 ? hash(Number(blockNumber)+1) : hash(Number(blockNumber)),
        timestampMs:1_790_640_000_000
      };
    },
    async readCurveState() { return value; }
  };
}

test('reserve-ratio FDV math is exact in raw quote units and floors only at presentation boundary', () => {
  assert.deepEqual(
    derivePonsCurveFdvRaw({quoteReserve:1_000n,tokenReserve:500n,totalSupply:10_000n}),
    {numerator:10_000_000n,denominator:500n,floorRaw:20_000n}
  );
  assert.deepEqual(
    derivePonsCurveFdvRaw({quoteReserve:3n,tokenReserve:2n,totalSupply:5n}),
    {numerator:15n,denominator:2n,floorRaw:7n}
  );
  assert.throws(()=>derivePonsCurveFdvRaw({quoteReserve:0n,tokenReserve:1n,totalSupply:1n}),/CURVE_UNPRICEABLE/);
  assert.throws(()=>derivePonsCurveFdvRaw({quoteReserve:1n,tokenReserve:0n,totalSupply:1n}),/CURVE_UNPRICEABLE/);
});

test('curve outcome probe is deterministic, canonical and tamper-evident', async () => {
  const first=await probePonsOutcomeAtBlock(source(),launch,123n);
  const second=await probePonsOutcomeAtBlock(source(),launch,123n);
  assert.equal(canonicalJson(first),canonicalJson(second));
  assert.equal(first.phase,'CURVE');
  assert.equal(first.estimatedFdvQuoteRawFloor,20_000n);
  assert.equal(first.quoteDecimals,18);
  await assert.doesNotReject(verifyPonsOutcomeProbeReceipt(first));
  await assert.rejects(
    verifyPonsOutcomeProbeReceipt({...first,estimatedFdvQuoteRawFloor:20_001n}),
    /VALUATION_INVALID/
  );
});

test('graduated curve receipt omits valuation instead of extrapolating drained curve reserves', async () => {
  const receipt=await probePonsOutcomeAtBlock(
    source({graduated:true,quoteReserve:0n,tokenReserve:0n}),
    launch,
    150n
  );
  assert.equal(receipt.phase,'GRADUATED');
  assert.equal(receipt.estimatedFdvQuoteRawFloor,undefined);
  assert.equal(receipt.estimatedFdvQuoteNumerator,undefined);
  await assert.doesNotReject(verifyPonsOutcomeProbeReceipt(receipt));
});

test('outcome probe fails closed on a reorg during historical reads', async () => {
  await assert.rejects(
    probePonsOutcomeAtBlock(source({}, {reorg:true}),launch,123n),
    /PONS_OUTCOME_REORG_DURING_READ/
  );
});

test('outcome probe rejects a curve whose on-chain token does not match the launch receipt', async () => {
  await assert.rejects(
    probePonsOutcomeAtBlock(source({curveToken:addr(999)}),launch,123n),
    /PONS_OUTCOME_CURVE_TOKEN_MISMATCH/
  );
});

test('observed totalSupply is part of the valuation receipt, so burns change later FDV observations', async () => {
  const earlier=await probePonsOutcomeAtBlock(source({totalSupply:10_000n}),launch,123n);
  const later=await probePonsOutcomeAtBlock(source({totalSupply:8_000n}),launch,124n);
  assert.equal(earlier.estimatedFdvQuoteRawFloor,20_000n);
  assert.equal(later.estimatedFdvQuoteRawFloor,16_000n);
  assert.notEqual(earlier.evidenceDigest,later.evidenceDigest);
});
