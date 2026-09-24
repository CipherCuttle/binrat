import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BINRAT_PONS_TOKEN_CHAIN_ID,
  probePonsHolderCandidate,
  type PonsBalanceProbePort,
  type PonsCandidateAuthority
} from '../src/holder/ponsBalanceProbe.js';

const TOKEN = '0x0000000000000000000000000000000000000900';
const WALLET = '0x0000000000000000000000000000000000000123';
const NOW_MS = 1_800_000_000_000;
const HASH = `0x${'a'.repeat(64)}`;
const OTHER_HASH = `0x${'b'.repeat(64)}`;
const policy: PonsCandidateAuthority = {
  tokenChainId: BINRAT_PONS_TOKEN_CHAIN_ID,
  researchChainId: 5042,
  tokenAddress: TOKEN,
  minimumRawBalance: '1000',
  effectiveBlock: '100',
  policyId: 'binrat.pons-holder/v1',
  mode: 'READ_ONLY_CANDIDATE'
};

function fixture(changes: {
  chainId?: number;
  finalized?: bigint;
  balance?: bigint;
  hashAfterRead?: string;
  failRead?: boolean;
  timestamp?: bigint;
  chainAfterRead?: number;
} = {}) {
  let reads = 0;
  let blockHashReads = 0;
  let chainReads = 0;
  const port: PonsBalanceProbePort = {
    async getChainId() { chainReads += 1; return chainReads > 1 && changes.chainAfterRead ? changes.chainAfterRead : changes.chainId ?? 4663; },
    async getFinalizedBlock() { return { number: changes.finalized ?? 120n, hash: HASH, timestamp: changes.timestamp ?? 1_800_000_000n }; },
    async getBlockHash() {
      blockHashReads += 1;
      return blockHashReads > 1 && changes.hashAfterRead ? changes.hashAfterRead : HASH;
    },
    async balanceOf({ token, wallet, blockNumber }) {
      reads += 1;
      assert.equal(token, TOKEN);
      assert.equal(wallet, WALLET);
      assert.equal(blockNumber, changes.finalized ?? 120n);
      if (changes.failRead) throw new Error('RPC down');
      return changes.balance ?? 1500n;
    }
  };
  return { port, reads: () => reads, hashChecks: () => blockHashReads };
}

test('planning config remains incomplete: no token address, no network calls, no access', async () => {
  const f = fixture();
  const result = await probePonsHolderCandidate({ ...policy, tokenAddress: null }, WALLET, f.port, NOW_MS);
  assert.equal(result.status, 'TOKEN_AUTHORITY_NOT_CONFIGURED');
  assert.equal(result.accessTier, 'FREE');
  assert.equal(result.holderAccessGranted, false);
  assert.equal(f.reads(), 0);
  assert.equal(f.hashChecks(), 0);
});

test('test balance may meet threshold but never creates actual holder access', async () => {
  const f = fixture();
  const result = await probePonsHolderCandidate(policy, WALLET, f.port, NOW_MS);
  assert.equal(result.status, 'MEETS_CANDIDATE_THRESHOLD_NO_ACCESS');
  assert.equal(result.accessTier, 'FREE');
  assert.equal(result.holderAccessGranted, false);
  assert.equal(result.candidateThresholdMet, true);
  assert.deepEqual(result.checkpoint, { blockNumber: '120', blockHash: HASH });
  assert.equal(f.reads(), 1);
  assert.equal(f.hashChecks(), 2);
});

test('threshold miss is disclosed with pinned finalized checkpoint', async () => {
  const f = fixture({ balance: 999n });
  const result = await probePonsHolderCandidate(policy, WALLET, f.port, NOW_MS);
  assert.equal(result.status, 'BELOW_CANDIDATE_THRESHOLD');
  assert.equal(result.candidateThresholdMet, false);
  assert.equal(result.holderAccessGranted, false);
});

test('Arc RPC cannot issue even candidate eligibility for Robinhood token', async () => {
  const f = fixture({ chainId: 5042 });
  const result = await probePonsHolderCandidate(policy, WALLET, f.port, NOW_MS);
  assert.equal(result.status, 'PONS_RPC_CHAIN_MISMATCH');
  assert.equal(f.reads(), 0);
});

test('bad token, unsigned thresholds, invalid network and invalid policy fail before RPC', async () => {
  for (const candidate of [
    { ...policy, tokenAddress: 'not-an-address' },
    { ...policy, tokenAddress: '0x0000000000000000000000000000000000000000' },
    { ...policy, minimumRawBalance: '0' },
    { ...policy, minimumRawBalance: '-1' },
    { ...policy, tokenChainId: 5042 as 4663 },
    { ...policy, policyId: 'production-live-unreviewed' }
  ]) {
    const f = fixture();
    const result = await probePonsHolderCandidate(candidate, WALLET, f.port, NOW_MS);
    assert.equal(result.status, 'TOKEN_AUTHORITY_INVALID');
    assert.equal(f.reads(), 0);
  }
});

test('effective block not finalized returns no balance/privilege', async () => {
  const f = fixture({ finalized: 99n });
  const result = await probePonsHolderCandidate(policy, WALLET, f.port, NOW_MS);
  assert.equal(result.status, 'PONS_FINALIZED_BLOCK_BEFORE_EFFECTIVE_BLOCK');
  assert.equal(result.candidateThresholdMet, null);
  assert.equal(f.reads(), 0);
});

test('chain reorganization or inconsistent provider after balance read blocks result', async () => {
  const f = fixture({ hashAfterRead: OTHER_HASH });
  const result = await probePonsHolderCandidate(policy, WALLET, f.port, NOW_MS);
  assert.equal(result.status, 'PONS_REORG_OR_INCONSISTENT_RPC');
  assert.equal(result.holderAccessGranted, false);
  assert.equal(f.reads(), 1);
});

test('read errors fail closed and never fabricate balance', async () => {
  const f = fixture({ failRead: true });
  const result = await probePonsHolderCandidate(policy, WALLET, f.port, NOW_MS);
  assert.equal(result.status, 'PONS_BALANCE_READ_FAILED');
  assert.equal(result.accessTier, 'FREE');
  assert.equal(result.candidateThresholdMet, null);
});

test('zero/invalid wallet cannot trigger chain reads', async () => {
  for (const wallet of ['not-an-address', '0x0000000000000000000000000000000000000000']) {
    const f = fixture();
    const result = await probePonsHolderCandidate(policy, wallet, f.port, NOW_MS);
    assert.equal(result.status, 'TOKEN_AUTHORITY_INVALID');
    assert.equal(f.reads(), 0);
  }
});

test('stalled finalized RPC and timestamp in the future fail closed before balance read', async () => {
  for (const timestamp of [1_799_999_600n, 1_800_000_040n]) {
    const f = fixture({ timestamp });
    const result = await probePonsHolderCandidate(policy, WALLET, f.port, NOW_MS);
    assert.equal(result.status, 'PONS_FINALIZED_BLOCK_STALE_OR_FUTURE');
    assert.equal(result.holderAccessGranted, false);
    assert.equal(f.reads(), 0);
  }
});

test('provider changing chains after balance read cannot report candidate threshold hit', async () => {
  const f = fixture({ chainAfterRead: 5042 });
  const result = await probePonsHolderCandidate(policy, WALLET, f.port, NOW_MS);
  assert.equal(result.status, 'PONS_RPC_CHAIN_MISMATCH');
  assert.equal(result.holderAccessGranted, false);
  assert.equal(f.reads(), 1);
});
