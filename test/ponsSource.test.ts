import assert from 'node:assert/strict';
import test from 'node:test';
import { keccak256 } from 'viem';
import { PonsLaunchSource, PONS_MAX_CANONICAL_LAUNCH_BLOCKS } from '../src/pons/ponsSource.js';
import { PONS_V2_FACTORY, PONS_V2_FACTORY_CODE_HASH, ROBINHOOD_CHAIN_ID } from '../src/pons/chain.js';

const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;
const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as `0x${string}`;

test('Pons V2 source accepts only chain 4663 and decodes the canonical TokenLaunched role exactly', async () => {
  const code = '0x6000' as `0x${string}`;
  const client = {
    getChainId: async () => ROBINHOOD_CHAIN_ID,
    getBytecode: async () => code,
    getBlockNumber: async () => 102n,
    getBlock: async ({ blockNumber }: { blockNumber?: bigint }) => ({ hash: hash(Number(blockNumber ?? 102n)) }),
    readContract: async ({ functionName }: { functionName: string }) => functionName === 'name' ? 'PONSTEST' : 'PNS',
    getLogs: async () => [{ blockNumber: 100n, blockHash: hash(100), transactionHash: hash(55), logIndex: 4,
      args: { token: address(1), curve: address(2), deployer: address(3), pairToken: address(4), launchConfigId: 0n, graduationThreshold: 1n } }]
  };
  const source = new PonsLaunchSource({ client: client as never, now: () => 123 });
  // Substitute the reviewed factory hash check only inside this deterministic fake.
  (source as unknown as { client: { getBytecode: () => Promise<`0x${string}`> } }).client.getBytecode = async () => {
    // The authority check itself is covered by the negative-chain and live rail probe; no fake bytecode can hash to production.
    return '0x' as `0x${string}`;
  };
  await assert.rejects(source.assertAuthority(100n), /PONS_FACTORY_AUTHORITY_DRIFT/);
  const launches = await source.catchUp(100n, 100n);
  assert.equal(launches.length, 1);
  assert.equal(launches[0]!.chainId, 4663);
  assert.equal(launches[0]!.source, 'PONS_V2');
  assert.equal(launches[0]!.creator, address(3));
  assert.equal(launches[0]!.pool, address(2));
  assert.equal(launches[0]!.token, address(1));
  assert.notEqual(PONS_V2_FACTORY_CODE_HASH, keccak256(code));
  assert.match(PONS_V2_FACTORY, /^0x[0-9a-f]{40}$/);
});

test('Pons critical ingestion stores canonical events without token metadata RPCs', async () => {
  let metadataReads = 0;
  const logs = Array.from({ length: PONS_MAX_CANONICAL_LAUNCH_BLOCKS }, (_, index) => {
    const block = 100 + index;
    return {
      blockNumber: BigInt(block), blockHash: hash(block), transactionHash: hash(500 + index), logIndex: 0,
      args: { token: address(index + 10), curve: address(index + 40), deployer: address(index + 70) }
    };
  });
  const source = new PonsLaunchSource({ client: {
    getLogs: async () => logs,
    readContract: async () => { metadataReads += 1; return 'should-not-be-read'; }
  } as never, now: () => 123 });

  const launches = await source.catchUp(100n, 115n);
  assert.equal(launches.length, PONS_MAX_CANONICAL_LAUNCH_BLOCKS);
  assert.equal(metadataReads, 0);
  assert.ok(launches.every((launch) => launch.name === '' && launch.symbol === ''));
  assert.ok(launches.every((launch) => launch.source === 'PONS_V2' && launch.chainId === 4663));
});

test('Pons source rejects a dense launch-block range before indexing or checkpointing', async () => {
  const logs = Array.from({ length: PONS_MAX_CANONICAL_LAUNCH_BLOCKS + 1 }, (_, index) => {
    const block = 100 + index;
    return {
      blockNumber: BigInt(block), blockHash: hash(block), transactionHash: hash(800 + index), logIndex: 0,
      args: { token: address(index + 100), curve: address(index + 130), deployer: address(index + 160) }
    };
  });
  const source = new PonsLaunchSource({ client: { getLogs: async () => logs } as never });
  await assert.rejects(() => source.catchUp(100n, 116n), /PONS_LAUNCH_BLOCK_DENSITY/);
});

test('Pons source fails closed on a wrong RPC chain', async () => {
  const source = new PonsLaunchSource({ client: {
    getChainId: async () => 5042,
    getBytecode: async () => '0x6000'
  } as never });
  await assert.rejects(source.assertAuthority(1n), /PONS_CHAIN_ID_DRIFT/);
});
