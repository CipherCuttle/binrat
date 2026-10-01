import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NATIVE_QUOTE,
  buildPonsCurveOutcomeCapabilityReceipt,
  RpcPonsCurveOutcomeSource,
  readPonsCurveOutcomeCapability,
  verifyPonsCurveOutcomeCapabilityReceipt,
  type PonsCurveOutcomeSource,
  type PonsOutcomeLaunch
} from '../src/pons/outcomeCapability.js';
import { canonicalJson } from '../src/evidence/canonical.js';
import { hash } from './support/autonomousFixture.js';

const launch:PonsOutcomeLaunch={
  launchId:'a'.repeat(64),
  token:'0x'+'1'.repeat(40) as `0x${string}`,
  curve:'0x'+'2'.repeat(40) as `0x${string}`
};

function source(state:Parameters<typeof buildPonsCurveOutcomeCapabilityReceipt>[0]):PonsCurveOutcomeSource {
  return {
    async assertAuthority() {},
    async readStateAt(requested,blockNumber) {
      assert.deepEqual(requested,launch);
      assert.equal(blockNumber,state.observedBlock);
      return state;
    }
  };
}

function curveState(overrides:Partial<Parameters<typeof buildPonsCurveOutcomeCapabilityReceipt>[0]>={}) {
  return {
    launch,
    observedBlock:123n,
    observedBlockHash:hash(123),
    observedTimestampMs:1_700_000_000_000,
    pairToken:NATIVE_QUOTE,
    quoteDecimals:18,
    totalSupply:1_000_000n*10n**18n,
    graduated:false,
    quoteReserve:10n*10n**18n,
    tokenReserve:500_000n*10n**18n,
    ...overrides
  };
}

test('pre-graduation capability derives quote-denominated estimated FDV from same-block reserves and supply', async () => {
  const receipt=await buildPonsCurveOutcomeCapabilityReceipt(curveState());
  assert.equal(receipt.phase,'CURVE');
  assert.equal(receipt.status,'COMPLETE');
  assert.deepEqual(receipt.missing,[]);
  // 10 ETH quote reserve / 500k token reserve * 1m observed supply = 20 ETH FDV.
  assert.equal(receipt.estimatedFdvQuoteRaw,20n*10n**18n);
  assert.equal(receipt.quoteDecimals,18);
  await assert.doesNotReject(verifyPonsCurveOutcomeCapabilityReceipt(receipt));
});

test('estimated FDV follows burn-adjusted totalSupply observed at the same block', async () => {
  const original=await buildPonsCurveOutcomeCapabilityReceipt(curveState());
  const burned=await buildPonsCurveOutcomeCapabilityReceipt(curveState({
    totalSupply:750_000n*10n**18n
  }));
  assert.equal(original.estimatedFdvQuoteRaw,20n*10n**18n);
  assert.equal(burned.estimatedFdvQuoteRaw,15n*10n**18n);
});

test('graduated curves never reuse stale curve reserves as a valuation', async () => {
  const receipt=await buildPonsCurveOutcomeCapabilityReceipt(curveState({
    graduated:true,
    quoteReserve:null,
    tokenReserve:null
  }));
  assert.equal(receipt.phase,'GRADUATED');
  assert.equal(receipt.status,'PARTIAL');
  assert.equal(receipt.estimatedFdvQuoteRaw,null);
  assert.deepEqual(receipt.missing,['V4_POOL_STATE']);
});

test('unusable curve reserve state fails partial instead of inventing a price', async () => {
  const receipt=await buildPonsCurveOutcomeCapabilityReceipt(curveState({tokenReserve:0n}));
  assert.equal(receipt.phase,'CURVE');
  assert.equal(receipt.status,'PARTIAL');
  assert.equal(receipt.estimatedFdvQuoteRaw,null);
  assert.deepEqual(receipt.missing,['USABLE_CURVE_RESERVES']);
});

test('outcome capability receipts are deterministic and tamper-evident', async () => {
  const first=await buildPonsCurveOutcomeCapabilityReceipt(curveState());
  const second=await buildPonsCurveOutcomeCapabilityReceipt(curveState());
  assert.equal(canonicalJson(first),canonicalJson(second));
  await assert.rejects(
    verifyPonsCurveOutcomeCapabilityReceipt({...first,estimatedFdvQuoteRaw:999n}),
    /PONS_OUTCOME_RECEIPT_INVALID/
  );
});

test('read capability preserves the requested historical block boundary', async () => {
  const state=curveState();
  const receipt=await readPonsCurveOutcomeCapability(source(state),launch,123n);
  assert.equal(receipt.observedBlock,123n);
  assert.equal(receipt.observedBlockHash,hash(123));
  assert.equal(receipt.status,'COMPLETE');
});


test('RPC source fails closed if the observed block hash changes during same-block state reads', async () => {
  let blockReads=0;
  const mockClient={
    async getBlock() {
      blockReads+=1;
      return {
        hash:blockReads===1 ? hash(123) : hash(124),
        timestamp:1_700_000_000n
      };
    },
    async readContract({functionName}:{functionName:string}) {
      if (functionName==='getLaunchedToken') {
        return {
          token:launch.token,
          curve:launch.curve,
          deployer:'0x'+'3'.repeat(40),
          creatorFeeRecipient:'0x'+'4'.repeat(40),
          pairToken:NATIVE_QUOTE,
          graduationThreshold:0n,
          poolFee:0,
          tickSpacing:0,
          creatorTaxBps:0,
          buybackEnabled:false,
          phase:0,
          sweptQuote:0n,
          sweptTokens:0n,
          sweptAt:0n,
          exists:true
        };
      }
      if (functionName==='token') return launch.token;
      if (functionName==='pairToken') return NATIVE_QUOTE;
      if (functionName==='graduated') return false;
      if (functionName==='totalSupply') return 1_000_000n*10n**18n;
      if (functionName==='getReserves') return [10n*10n**18n,500_000n*10n**18n] as const;
      throw new Error('UNEXPECTED_READ');
    }
  };
  const rpcSource=new RpcPonsCurveOutcomeSource({client:mockClient as never});
  Object.assign(rpcSource,{authorityVerified:true});
  await assert.rejects(
    rpcSource.readStateAt(launch,123n),
    /PONS_OUTCOME_BLOCK_REORG_DURING_READ/
  );
});
