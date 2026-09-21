import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicClient } from 'viem';
import { ArcPadLaunchSource } from '../src/arc/arcpadSource.js';
import { ARC_CHAIN_ID } from '../src/arc/chain.js';

test('ArcPad authority checks current launcher code instead of historical state', async () => {
  const seen: Array<{ blockNumber?: bigint }> = [];
  const client = {
    async getChainId() { return ARC_CHAIN_ID; },
    async getBytecode(args: { blockNumber?: bigint }) {
      seen.push(args);
      return '0x6001';
    }
  } as unknown as PublicClient;

  const source = new ArcPadLaunchSource({ client });
  await source.assertAuthority(19_015_290n);

  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.blockNumber, undefined);
});
