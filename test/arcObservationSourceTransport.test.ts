import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicClient } from 'viem';
import { ArcObservationSource } from '../src/arc/observationSource.js';

test('Arc observation source validates chain once per instance but re-reads block evidence', async () => {
  let chainIdCalls = 0;
  let blockCalls = 0;

  const client = {
    async getChainId() {
      chainIdCalls += 1;
      return 5042;
    },
    async getBlockNumber() {
      return 100n;
    },
    async getBlock({ blockNumber }: { blockNumber: bigint }) {
      blockCalls += 1;
      return {
        number: blockNumber,
        hash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
        timestamp: blockNumber
      };
    }
  } as unknown as PublicClient;

  const source = new ArcObservationSource({ client });

  assert.equal(await source.getHeadBlockNumber(), 100n);
  const first = await source.getBlockPoint(42n);
  const second = await source.getBlockPoint(42n);

  assert.equal(first.blockNumber, 42n);
  assert.equal(second.blockNumber, 42n);
  assert.equal(chainIdCalls, 1);
  assert.equal(blockCalls, 2);
});
