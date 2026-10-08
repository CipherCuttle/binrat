import assert from 'node:assert/strict';
import test from 'node:test';
import { LimitExceededRpcError, RpcRequestError } from 'viem';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { publicStatus, readPublicSnapshot } from '../src/cloudflare/publicSnapshot.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { handleSyncQueueBatch, runCloudflarePonsSyncCycle, syncErrorCode } from '../src/cloudflare/syncQueue.js';
import type { LaunchSource } from '../src/core/ports.js';
import type { Hex } from '../src/core/types.js';
import { PONS_V2_START_BLOCK, ROBINHOOD_CHAIN_ID } from '../src/pons/chain.js';
import { PonsLaunchSource } from '../src/pons/ponsSource.js';
import { D1CompatDatabase } from './support/d1Compat.js';

// Reproduce the pinned viem error chain from HTTP 200 / JSON-RPC -32005.
function providerLimit(): LimitExceededRpcError {
  return new LimitExceededRpcError(new RpcRequestError({
    body: { method: 'eth_getLogs', params: [] },
    error: { code: -32005, message: 'the network is busy, please try again in a moment' },
    url: 'https://user:private-token@rpc.example/private-path'
  }));
}

test('JSON-RPC limit errors retain their safe class without overriding authority failures', () => {
  const error = providerLimit();
  assert.equal(syncErrorCode(error), 'SYNC_RPC_LIMIT_EXCEEDED');
  assert.equal(syncErrorCode(new Error('PONS_FACTORY_AUTHORITY_DRIFT', { cause: error })), 'PONS_FACTORY_AUTHORITY_DRIFT');
  for (const code of [-32004, '-32005', 'private-token']) {
    const unknown = Object.assign(new Error('private-token'), { name: 'UnknownProviderError', code });
    assert.equal(syncErrorCode(unknown), 'SYNC_UNKNOWN_ERROR');
  }
});

test('Pons bootstrap keeps the operation label and classifies its RPC limit cause', async (t) => {
  t.mock.method(console, 'error', () => {});
  const source = new PonsLaunchSource({ client: {
    getBlockNumber: async () => { throw providerLimit(); }
  } as never });
  await assert.rejects(source.getHeadBlockNumber(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'PONS_GET_HEAD_FAILED');
    assert.equal(syncErrorCode(error), 'SYNC_RPC_LIMIT_EXCEEDED');
    return true;
  });
});

test('RPC rejection retries without advancing the checkpoint or refreshing the published snapshot', async (t) => {
  const logs: string[] = [];
  t.mock.method(console, 'error', (line: string) => { logs.push(line); });
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, ROBINHOOD_CHAIN_ID);
  let head = PONS_V2_START_BLOCK + 1_002n;
  const source: LaunchSource = {
    getHeadBlockNumber: async () => head,
    getBlockHash: async (block) => `0x${block.toString(16).padStart(64, '0')}` as Hex,
    assertAuthority: async () => {},
    catchUp: async () => []
  };
  try {
    assert.deepEqual(await runCloudflarePonsSyncCycle(
      { DB: db },
      { kind: 'PONS_SYNC_CYCLE', cycleId: 'initial-verified', enqueuedAtMs: 1_000 },
      { now: () => 1_000, ponsLaunchSource: source }
    ), { status: 'SUCCESS', liveCaughtUp: true });
    const checkpoint = await store.getCheckpoint();
    const snapshot = await readPublicSnapshot(db);
    assert.ok(checkpoint);
    assert.ok(snapshot);

    head += 1n;
    source.catchUp = async () => { throw providerLimit(); };
    const retries: Array<{ delaySeconds?: number } | undefined> = [];
    let acked = false;
    await handleSyncQueueBatch({ messages: [{
      body: { kind: 'PONS_SYNC_CYCLE', cycleId: 'rpc-limit', enqueuedAtMs: 61_000 },
      ack() { acked = true; },
      retry(options) { retries.push(options); }
    }] }, { DB: db }, { now: () => 61_000, ponsLaunchSource: source });

    assert.equal(acked, false);
    assert.deepEqual(retries, [{ delaySeconds: 30 }]);
    assert.deepEqual(await store.getCheckpoint(), checkpoint);
    assert.deepEqual(await readPublicSnapshot(db), snapshot);
    const runtime = await new D1RuntimeStateStore(db, ROBINHOOD_CHAIN_ID).get();
    assert.equal(runtime?.sourceVerified, false);
    assert.equal(runtime?.liveCaughtUp, false);
    assert.equal(runtime?.lastSyncError, 'SYNC_RPC_LIMIT_EXCEEDED');
    assert.equal((await publicStatus(db, 61_000, 180_000)).state, 'STALE_VERIFIED');
    const failure = logs.map((line) => JSON.parse(line)).find((entry) => entry.event === 'SYNC_FAILURE');
    assert.deepEqual(failure, {
      event: 'SYNC_FAILURE', cycleId: 'rpc-limit', phase: 'LIVE_SYNC',
      code: 'SYNC_RPC_LIMIT_EXCEEDED', errorName: 'LIMIT_EXCEEDED_RPC_ERROR',
      httpStatus: null, causeCode: 'RPC_LIMIT_EXCEEDED'
    });
    assert.doesNotMatch(logs.join('\n'), /private-token|private-path|rpc\.example|network is busy/);
  } finally {
    store.close();
    db.close();
  }
});
