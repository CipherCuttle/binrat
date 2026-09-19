import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicClient } from 'viem';
import { ArcRatRadarSource } from '../src/arc/ratRadarSource.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';

const CHAIN_ID = 5042;

test('Arc Rat Radar source decodes V3 Swap roles and derives launched-token flow', async () => {
  const launch = await makeLaunch();
  const token1 = address(99);
  const client = {
    async getChainId() { return CHAIN_ID; },
    async getBlock({ blockNumber }: { blockNumber: bigint }) {
      return { hash: hex64(Number(blockNumber)) };
    },
    async readContract({ functionName }: { functionName: string }) {
      if (functionName === 'token0') return launch.token;
      if (functionName === 'token1') return token1;
      throw new Error('unexpected read');
    },
    async getLogs() {
      return [{
        blockNumber: 105n,
        blockHash: hex64(105),
        transactionHash: hex64(1005),
        logIndex: 7,
        args: {
          sender: address(70),
          recipient: address(71),
          amount0: -500n,
          amount1: 250n,
          sqrtPriceX96: 1234n,
          liquidity: 5678n,
          tick: 9
        }
      }];
    }
  } as unknown as PublicClient;

  const source = new ArcRatRadarSource({ client });
  await source.assertAuthority(110n, hex64(110));
  const receipts = await source.catchUp(launch, 100n, 110n);

  assert.equal(receipts.length, 1);
  assert.equal(receipts[0]?.sender, address(70));
  assert.equal(receipts[0]?.recipient, address(71));
  assert.equal(receipts[0]?.tokenSide, 'TOKEN0');
  assert.equal(receipts[0]?.launchedTokenDelta, -500n);
  assert.equal(receipts[0]?.launchedTokenFlow, 'POOL_TO_RECIPIENT');
  assert.equal(receipts[0]?.blockNumber, 105n);
});


test('Arc Rat Radar source ignores same-block Swap logs at or before the ArcPad launch log index', async () => {
  const launch = await makeLaunch();
  const token1 = address(99);
  const client = {
    async getChainId() { return CHAIN_ID; },
    async readContract({ functionName }: { functionName: string }) {
      if (functionName === 'token0') return launch.token;
      if (functionName === 'token1') return token1;
      throw new Error('unexpected read');
    },
    async getLogs() {
      return [
        {
          blockNumber: launch.blockNumber,
          blockHash: launch.blockHash,
          transactionHash: hex64(800),
          logIndex: launch.logIndex - 1,
          args: {
            sender: address(80),
            recipient: address(81),
            amount0: -10n,
            amount1: 5n,
            sqrtPriceX96: 100n,
            liquidity: 200n,
            tick: 1
          }
        },
        {
          blockNumber: launch.blockNumber,
          blockHash: launch.blockHash,
          transactionHash: hex64(801),
          logIndex: launch.logIndex + 1,
          args: {
            sender: address(82),
            recipient: address(83),
            amount0: -20n,
            amount1: 10n,
            sqrtPriceX96: 101n,
            liquidity: 201n,
            tick: 2
          }
        }
      ];
    }
  } as unknown as PublicClient;

  const source = new ArcRatRadarSource({ client });
  const receipts = await source.catchUp(launch, launch.blockNumber, launch.blockNumber);

  assert.equal(receipts.length, 1);
  assert.equal(receipts[0]?.recipient, address(83));
  assert.equal(receipts[0]?.logIndex, launch.logIndex + 1);
});

test('Arc Rat Radar source rejects a pool whose token pair does not contain the launched token', async () => {
  const launch = await makeLaunch();
  const client = {
    async getChainId() { return CHAIN_ID; },
    async readContract({ functionName }: { functionName: string }) {
      if (functionName === 'token0') return address(90);
      if (functionName === 'token1') return address(91);
      throw new Error('unexpected read');
    },
    async getLogs() { return []; }
  } as unknown as PublicClient;

  const source = new ArcRatRadarSource({ client });
  await assert.rejects(
    () => source.catchUp(launch, launch.blockNumber, launch.blockNumber + 10n),
    /RAT_RADAR_TOKEN_NOT_IN_POOL/
  );
});

test('Arc Rat Radar authority fails closed on checkpoint hash drift', async () => {
  const client = {
    async getChainId() { return CHAIN_ID; },
    async getBlock() { return { hash: hex64(999) }; }
  } as unknown as PublicClient;

  const source = new ArcRatRadarSource({ client });
  await assert.rejects(
    () => source.assertAuthority(110n, hex64(110)),
    /RAT_RADAR_CHECKPOINT_REORG/
  );
});

async function makeLaunch(): Promise<LaunchObserved> {
  const launcher = address(1);
  const txHash = hex64(2);
  const token = address(3);
  return {
    launchId: await deriveLaunchId({ chainId: CHAIN_ID, launcher, txHash, token }),
    eventId: await deriveEventId({ chainId: CHAIN_ID, launcher, txHash, logIndex: 4 }),
    chainId: CHAIN_ID,
    blockNumber: 100n,
    blockHash: hex64(100),
    observedAtMs: 100_000,
    source: 'ARCPAD',
    launcher,
    txHash,
    logIndex: 4,
    token,
    creator: address(5),
    pool: address(6),
    name: 'Radar Source',
    symbol: 'RADAR',
    imageUri: '',
    website: '',
    twitter: '',
    telegram: ''
  };
}

function address(seed: number): Hex {
  return `0x${seed.toString(16).padStart(40, '0').slice(-40)}` as Hex;
}

function hex64(seed: number): Hex {
  return `0x${seed.toString(16).padStart(64, '0').slice(-64)}` as Hex;
}
