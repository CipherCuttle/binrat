import assert from 'node:assert/strict';
import test from 'node:test';
import { PonsStakeReader, PONS_STAKING_BEACON_SLOT, type PonsStakeReadInput } from '../src/holder/ponsStakeReader.js';
import { evaluateWorkingRatPolicy } from '../src/holder/workingRatPolicyBoundary.js';
import { PONS_LAUNCH_CHAIN_ID } from '../src/launchConfig/ponsPlan.js';
import { PONS_STAKING_BEACON_V1, PONS_STAKING_IMPLEMENTATION_V1 } from '../src/launchConfig/ponsPreflight.js';

const vault = '0x96e5c19717f5e681375b65771dd85628f700eb42' as const;
const wallet = '0x35df6256c2fa5c52ae5741a8d81e7047e20b0e6d' as const;
const blockHash = `0x${'ab'.repeat(32)}` as const;
const block = { number: 100n, hash: blockHash };
const input: PonsStakeReadInput = { vault, wallet, block };

function client(overrides: Record<string, unknown> = {}) {
  const overrideRead = overrides.readContract as ((args: { functionName: string }) => Promise<unknown>) | undefined;
  const beaconImplementation = overrides.beaconImplementation as string | undefined;
  const { beaconImplementation: _beaconImplementation, ...clientOverrides } = overrides;
  return {
    getChainId: async () => PONS_LAUNCH_CHAIN_ID,
    getBlock: async () => ({ number: block.number, hash: block.hash }),
    getBlockNumber: async () => 100n,
    getBytecode: async () => '0x6000',
    getStorageAt: async ({ address, slot }: { address: string; slot: string }) => address.toLowerCase() === vault.toLowerCase() && slot === PONS_STAKING_BEACON_SLOT
      ? `0x${'0'.repeat(24)}${PONS_STAKING_BEACON_V1.slice(2).toLowerCase()}`
      : '0x',
    ...clientOverrides,
    readContract: async (args: { address: string; functionName: string }) => {
      if (args.address.toLowerCase() === PONS_STAKING_BEACON_V1.toLowerCase() && args.functionName === 'implementation') return beaconImplementation ?? PONS_STAKING_IMPLEMENTATION_V1;
      if (overrideRead) return overrideRead(args);
      if (args.functionName === 'quoteAsset') return '0x0000000000000000000000000000000000000000';
      if (args.functionName === 'stakedOf') return 23n;
      return 100n;
    }
  } as never;
}

test('verifies positive and zero active stake at the same pinned block', async () => {
  const positive = await new PonsStakeReader({ client: client() }).read(input);
  assert.equal(positive.status, 'VERIFIED');
  assert.equal(positive.stakedRaw, '23');
  assert.equal(positive.quoteAsset, '0x0000000000000000000000000000000000000000');
  assert.equal(positive.blockNumber, '100');
  assert.equal(positive.blockHash, blockHash);
  assert.equal(positive.freshness, 'UNKNOWN');

  const zero = await new PonsStakeReader({ client: client({ readContract: async ({ functionName }: { functionName: string }) => functionName === 'quoteAsset' ? '0x0000000000000000000000000000000000000000' : functionName === 'stakedOf' ? 0n : 100n }) }).read(input);
  assert.equal(zero.status, 'VERIFIED');
  assert.equal(zero.stakedRaw, '0');
});

test('does not collapse RPC/interface failure into verified zero', async () => {
  const result = await new PonsStakeReader({ client: client({ readContract: async () => { throw new Error('rpc unavailable'); } }) }).read(input);
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.stakedRaw, null);
  assert.notEqual(result.stakedRaw, '0');
});

test('fails closed on wrong chain, missing code, wrong quote, malformed stake, and incoherent total', async () => {
  assert.equal((await new PonsStakeReader({ client: client({ getChainId: async () => 1 }) }).read(input)).status, 'CHAIN_MISMATCH');
  assert.equal((await new PonsStakeReader({ client: client({ getBytecode: async () => '0x' }) }).read(input)).status, 'AUTHORITY_MISMATCH');
  const wrongBeacon = await new PonsStakeReader({ client: client({ getStorageAt: async () => '0x' }) }).read(input);
  assert.equal(wrongBeacon.errorCode, 'PONS_STAKE_VAULT_BEACON_MISMATCH');
  const wrongImplementation = await new PonsStakeReader({ client: client({ beaconImplementation: wallet }) }).read(input);
  assert.equal(wrongImplementation.errorCode, 'PONS_STAKE_IMPLEMENTATION_MISMATCH');
  const wrongQuote = await new PonsStakeReader({ client: client({ readContract: async ({ functionName }: { functionName: string }) => functionName === 'quoteAsset' ? '0x0000000000000000000000000000000000000001' : 10n }) }).read(input);
  assert.equal(wrongQuote.errorCode, 'PONS_STAKE_QUOTE_ASSET_MISMATCH');
  const malformed = await new PonsStakeReader({ client: client({ readContract: async ({ functionName }: { functionName: string }) => functionName === 'quoteAsset' ? '0x0000000000000000000000000000000000000000' : functionName === 'stakedOf' ? 'not-a-uint' : 10n }) }).read(input);
  assert.equal(malformed.status, 'AUTHORITY_MISMATCH');
  assert.equal(malformed.stakedRaw, null);
  const incoherent = await new PonsStakeReader({ client: client({ readContract: async ({ functionName }: { functionName: string }) => functionName === 'quoteAsset' ? '0x0000000000000000000000000000000000000000' : functionName === 'stakedOf' ? 11n : 10n }) }).read(input);
  assert.equal(incoherent.errorCode, 'PONS_STAKE_TOTAL_INCOHERENT');
});

test('pinned block reorg and excessive block age are explicit stale outcomes', async () => {
  const reorg = await new PonsStakeReader({ client: client({ getBlock: async () => ({ number: 100n, hash: `0x${'cd'.repeat(32)}` }) }) }).read(input);
  assert.equal(reorg.status, 'STALE');
  assert.equal(reorg.stakedRaw, null);
  const old = await new PonsStakeReader({ client: client({ getBlockNumber: async () => 111n }), maxBlockAge: 10n }).read(input);
  assert.equal(old.status, 'STALE');
});

test('unresolved threshold never grants WORKING RAT, even for positive stake', async () => {
  const stake = await new PonsStakeReader({ client: client() }).read(input);
  assert.equal(evaluateWorkingRatPolicy(stake, null), 'NOT_CONFIGURED');
  assert.notEqual(evaluateWorkingRatPolicy(stake, null), 'QUALIFIED');
  assert.equal(evaluateWorkingRatPolicy(stake, 0n), 'NOT_CONFIGURED');
});

test('same read input and receipt produce deterministic evidence', async () => {
  const first = await new PonsStakeReader({ client: client() }).read(input);
  const second = await new PonsStakeReader({ client: client() }).read(input);
  assert.deepEqual(second, first);
});
