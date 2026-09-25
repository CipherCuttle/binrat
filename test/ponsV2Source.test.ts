import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeEventLog, encodeAbiParameters, encodeEventTopics, getAddress, keccak256, type Address, type PublicClient } from 'viem';
import { deriveEventId } from '../src/core/identity.js';
import {
  PONS_CHAIN_ID, PONS_V2_FACTORY, PonsV2LaunchSource, ponsTokenLaunchedEvent,
  serializePonsLaunch
} from '../src/pons/source.js';

const address = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as Address;
const hash = (c: string) => ('0x' + c.repeat(64)) as `0x${string}`;
const code = '0x6001' as const;
const codeHash = keccak256(code);
const sourceArgs = {
  token: address(10), curve: address(11), deployer: address(12),
  pairToken: address(0), launchConfigId: 0n, graduationThreshold: 500n
};
const eventLog = {
  address: PONS_V2_FACTORY, blockNumber: 100n, blockHash: hash('a'),
  transactionHash: hash('1'), logIndex: 3,
  args: sourceArgs
};
function fakeClient(changes: {
  chainId?: number; bytecode?: string; logs?: unknown[]; blockHash?: string;
  flipReorg?: boolean; getLogsError?: Error
} = {}): PublicClient {
  let scans = 0;
  const client = {
    async getChainId() { return changes.chainId ?? PONS_CHAIN_ID; },
    async getBlockNumber() { return 200n; },
    async getBytecode() { return changes.bytecode ?? code; },
    async getBlock({ blockNumber }: { blockNumber: bigint }) {
      if (blockNumber === 100n && changes.flipReorg && scans++ > 1) return { hash: hash('f') };
      return { hash: changes.blockHash ?? (blockNumber === 100n ? hash('a') : hash('b')) };
    },
    async getLogs() {
      if (changes.getLogsError) throw changes.getLogsError;
      return changes.logs ?? [eventLog];
    }
  };
  return client as unknown as PublicClient;
}

test('pinned upstream ABI decodes factory launch roles exactly (no invented creator fee recipient)', () => {
  const topics = encodeEventTopics({
    abi: [ponsTokenLaunchedEvent], eventName: 'TokenLaunched',
    args: { token: sourceArgs.token, curve: sourceArgs.curve, deployer: sourceArgs.deployer }
  });
  const data = encodeAbiParameters([
    { type: 'address', name: 'pairToken' }, { type: 'uint256', name: 'launchConfigId' },
    { type: 'uint256', name: 'graduationThreshold' }
  ], [sourceArgs.pairToken, sourceArgs.launchConfigId, sourceArgs.graduationThreshold]);
  const exactTopics = topics.filter((topic): topic is `0x${string}` => typeof topic === 'string') as [`0x${string}`, ...`0x${string}`[]];
  const decoded = decodeEventLog({ abi: [ponsTokenLaunchedEvent], topics: exactTopics, data });
  assert.deepEqual(decoded.args, { ...sourceArgs,
    token: getAddress(sourceArgs.token), curve: getAddress(sourceArgs.curve),
    deployer: getAddress(sourceArgs.deployer), pairToken: getAddress(sourceArgs.pairToken)
  });
  assert.equal('creatorFeeRecipient' in decoded.args, false);
});

test('source returns separately-namespaced 4663 immutable event with block hash and role caveats', async () => {
  const source = new PonsV2LaunchSource({ client: fakeClient(), expectedFactoryCodeHash: codeHash });
  const [record] = await source.catchUp(100n, 101n);
  assert.ok(record);
  assert.equal(record.chainId, 4663);
  assert.equal(record.originalDeployer, address(12));
  assert.equal(record.creatorFeeRecipientAtLaunch, null);
  assert.equal(record.creatorFeeRecipientEvidence, 'NOT_IN_LAUNCH_EVENT');
  assert.equal(record.phaseAtLaunch, 'NOT_GRADUATED');
  assert.equal(record.blockHash, hash('a'));
  assert.notEqual(record.eventId, await deriveEventId({
    chainId: 5042, launcher: PONS_V2_FACTORY,
    txHash: eventLog.transactionHash, logIndex: 3
  }));
  assert.equal(serializePonsLaunch(record).graduationThreshold, '500');
  assert.deepEqual(await source.catchUp(100n, 101n), [record]);
});

test('source fails closed on wrong chain, code hash, historical code unavailable and window overflow', async () => {
  await assert.rejects(new PonsV2LaunchSource({
    client: fakeClient({chainId:5042}), expectedFactoryCodeHash: codeHash
  }).catchUp(100n,101n), /PONS_CHAIN_ID_DRIFT/);
  await assert.rejects(new PonsV2LaunchSource({
    client: fakeClient({bytecode:'0x6002'}), expectedFactoryCodeHash: codeHash
  }).catchUp(100n,101n), /PONS_FACTORY_CODE_HASH_DRIFT/);
  await assert.rejects(new PonsV2LaunchSource({
    client: fakeClient({bytecode:'0x'}), expectedFactoryCodeHash: codeHash
  }).catchUp(100n,101n), /PONS_HISTORICAL_FACTORY_CODE_MISSING/);
  const src = new PonsV2LaunchSource({client:fakeClient(),expectedFactoryCodeHash:codeHash});
  await assert.rejects(src.catchUp(100n, 600n), /PONS_INVALID_SCAN_WINDOW/);
  assert.throws(() => new PonsV2LaunchSource({
    client: fakeClient(), expectedFactoryCodeHash: hash('0'), factory: address(99)
  }), /PONS_UNAPPROVED_FACTORY/);
  assert.throws(() => new PonsV2LaunchSource({
    client: fakeClient(), expectedFactoryCodeHash: '0x1234'
  }), /PONS_FACTORY_CODE_PIN_REQUIRED/);
});

test('wrong emitter and conflicting log identity cannot poison Pons evidence', async () => {
  const src = new PonsV2LaunchSource({
    client:fakeClient({logs:[{...eventLog,address:address(12)}]}),
    expectedFactoryCodeHash:codeHash
  });
  await assert.rejects(src.catchUp(100n,101n), /PONS_MALFORMED_LAUNCH_LOG/);
  const bad = {...eventLog, args:{...sourceArgs,curve:address(888)}};
  const conflict=new PonsV2LaunchSource({
    client:fakeClient({logs:[eventLog,bad]}), expectedFactoryCodeHash:codeHash
  });
  await assert.rejects(conflict.catchUp(100n,101n), /PONS_EVENT_IDENTITY_CONFLICT/);
});

test('RPC errors, mismatched receipt hash and mid-scan reorg never return a partial successful batch', async () => {
  const cases = [
    {client:fakeClient({getLogsError:new Error('RPC_429')}), error:/RPC_429/},
    {client:fakeClient({blockHash:hash('e')}), error:/PONS_NONCANONICAL_LAUNCH_LOG/},
    {client:fakeClient({flipReorg:true}), error:/PONS_SCAN_REORG/}
  ];
  for (const c of cases) {
    const src = new PonsV2LaunchSource({client:c.client,expectedFactoryCodeHash:codeHash});
    await assert.rejects(src.catchUp(100n,101n),c.error);
  }
});

test('identical replay duplicate dedups without cross-chain aliasing', async () => {
  const src = new PonsV2LaunchSource({
    client:fakeClient({logs:[eventLog,eventLog]}),expectedFactoryCodeHash:codeHash
  });
  const batch=await src.catchUp(100n,101n);
  assert.equal(batch.length,1);
});
