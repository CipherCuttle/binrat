import { createPublicClient, http, parseAbi, type Address, type PublicClient } from 'viem';
import type { Hex, LaunchObserved } from '../core/types.js';
import { ARC_CHAIN_ID, arcMainnet } from './chain.js';

const poolObservationAbi = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
  'function liquidity() view returns (uint128)'
]);

const tokenObservationAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)'
]);

export interface ObservationBlockPoint {
  blockNumber: bigint;
  blockHash: Hex;
  timestampMs: number;
}

export type CapabilityCheck<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface HistoricalCapabilityProbe {
  chainId: number;
  launchId: string;
  block: ObservationBlockPoint;
  checks: {
    poolCode: CapabilityCheck<{ present: boolean }>;
    poolSlot0: CapabilityCheck<{ sqrtPriceX96: bigint; tick: number }>;
    poolLiquidity: CapabilityCheck<{ activeLiquidity: bigint }>;
    creatorBalance: CapabilityCheck<{ balance: bigint }>;
    tokenSupply: CapabilityCheck<{ totalSupply: bigint; decimals: number }>;
  };
  historicalReconstructionSupported: boolean;
}

export class ArcObservationSource {
  private readonly client: PublicClient;
  // One source instance is scoped to one observation job. Reuse the verified
  // chain identity within that job while block hashes are still re-read.
  private chainAssertion: Promise<void> | null = null;

  constructor(options: { rpcUrl?: string; client?: PublicClient } = {}) {
    const rpcUrl = options.rpcUrl ?? process.env.ARC_RPC_URL;
    if (!options.client && !rpcUrl) throw new Error('ARC_RPC_URL is required');
    this.client = options.client ?? createPublicClient({ chain: arcMainnet(rpcUrl!), transport: http(rpcUrl) });
  }

  async getHeadBlockNumber(): Promise<bigint> {
    await this.assertChain();
    return this.client.getBlockNumber();
  }

  async getBlockPoint(blockNumber: bigint): Promise<ObservationBlockPoint> {
    await this.assertChain();
    const block = await this.client.getBlock({ blockNumber });
    if (!block.hash) throw new Error(`OBSERVATION_BLOCK_HASH_MISSING:${blockNumber}`);
    return {
      blockNumber,
      blockHash: block.hash as Hex,
      timestampMs: Number(block.timestamp) * 1000
    };
  }

  async readObservationFacts(launch: LaunchObserved, blockNumber: bigint) {
    if (launch.chainId !== ARC_CHAIN_ID) throw new Error(`OBSERVATION_LAUNCH_CHAIN_MISMATCH:${launch.launchId}`);
    await this.assertChain();
    const pool = launch.pool as Address;
    const token = launch.token as Address;
    const creator = launch.creator as Address;
    const facts: {
      poolCodePresent?: boolean;
      poolActiveLiquidity?: bigint;
      poolSqrtPriceX96?: bigint;
      poolTick?: number;
      creatorTokenBalance?: bigint;
      tokenTotalSupply?: bigint;
      tokenDecimals?: number;
    } = {};
    const missing: string[] = [];

    const poolCode = await check(async () => this.client.getBytecode({ address: pool, blockNumber }));
    if (poolCode.ok) {
      facts.poolCodePresent = Boolean(poolCode.value && poolCode.value !== '0x');
    } else {
      missing.push('POOL_CODE');
    }

    if (facts.poolCodePresent === true) {
      const slot0 = await check(async () => this.client.readContract({
        address: pool,
        abi: poolObservationAbi,
        functionName: 'slot0',
        blockNumber
      }));
      if (slot0.ok) {
        facts.poolSqrtPriceX96 = slot0.value[0];
        facts.poolTick = slot0.value[1];
      } else {
        missing.push('POOL_SLOT0');
      }

      const activeLiquidity = await check(async () => this.client.readContract({
        address: pool,
        abi: poolObservationAbi,
        functionName: 'liquidity',
        blockNumber
      }));
      if (activeLiquidity.ok) facts.poolActiveLiquidity = activeLiquidity.value;
      else missing.push('POOL_LIQUIDITY');
    } else {
      missing.push('POOL_SLOT0', 'POOL_LIQUIDITY');
    }

    const creatorBalance = await check(async () => this.client.readContract({
      address: token,
      abi: tokenObservationAbi,
      functionName: 'balanceOf',
      args: [creator],
      blockNumber
    }));
    if (creatorBalance.ok) facts.creatorTokenBalance = creatorBalance.value;
    else missing.push('CREATOR_BALANCE');

    const totalSupply = await check(async () => this.client.readContract({
      address: token,
      abi: tokenObservationAbi,
      functionName: 'totalSupply',
      blockNumber
    }));
    if (totalSupply.ok) facts.tokenTotalSupply = totalSupply.value;
    else missing.push('TOKEN_TOTAL_SUPPLY');

    const decimals = await check(async () => this.client.readContract({
      address: token,
      abi: tokenObservationAbi,
      functionName: 'decimals',
      blockNumber
    }));
    if (decimals.ok) facts.tokenDecimals = decimals.value;
    else missing.push('TOKEN_DECIMALS');

    return { facts, missing };
  }

  async probeHistoricalCapabilities(launch: LaunchObserved): Promise<HistoricalCapabilityProbe> {
    if (launch.chainId !== ARC_CHAIN_ID) throw new Error(`OBSERVATION_LAUNCH_CHAIN_MISMATCH:${launch.launchId}`);
    const block = await this.getBlockPoint(launch.blockNumber);
    if (block.blockHash.toLowerCase() !== launch.blockHash.toLowerCase()) {
      throw new Error(`OBSERVATION_LAUNCH_REORG:${launch.launchId}`);
    }

    const pool = launch.pool as Address;
    const token = launch.token as Address;
    const creator = launch.creator as Address;
    const blockNumber = launch.blockNumber;

    const poolCode = await check(async () => {
      const code = await this.client.getBytecode({ address: pool, blockNumber });
      return { present: Boolean(code && code !== '0x') };
    });
    const poolSlot0 = await check(async () => {
      const value = await this.client.readContract({
        address: pool,
        abi: poolObservationAbi,
        functionName: 'slot0',
        blockNumber
      });
      return { sqrtPriceX96: value[0], tick: value[1] };
    });
    const poolLiquidity = await check(async () => ({
      activeLiquidity: await this.client.readContract({
        address: pool,
        abi: poolObservationAbi,
        functionName: 'liquidity',
        blockNumber
      })
    }));
    const creatorBalance = await check(async () => ({
      balance: await this.client.readContract({
        address: token,
        abi: tokenObservationAbi,
        functionName: 'balanceOf',
        args: [creator],
        blockNumber
      })
    }));
    const tokenSupply = await check(async () => {
      const [totalSupply, decimals] = await Promise.all([
        this.client.readContract({
          address: token,
          abi: tokenObservationAbi,
          functionName: 'totalSupply',
          blockNumber
        }),
        this.client.readContract({
          address: token,
          abi: tokenObservationAbi,
          functionName: 'decimals',
          blockNumber
        })
      ]);
      return { totalSupply, decimals };
    });

    const checks = { poolCode, poolSlot0, poolLiquidity, creatorBalance, tokenSupply };
    return {
      chainId: ARC_CHAIN_ID,
      launchId: launch.launchId,
      block,
      checks,
      historicalReconstructionSupported:
        poolCode.ok && poolCode.value.present &&
        poolSlot0.ok &&
        poolLiquidity.ok &&
        creatorBalance.ok &&
        tokenSupply.ok
    };
  }

  private assertChain(): Promise<void> {
    if (!this.chainAssertion) {
      this.chainAssertion = this.client.getChainId().then((actual) => {
        if (actual !== ARC_CHAIN_ID) {
          throw new Error(`ARC_CHAIN_ID_DRIFT:expected=${ARC_CHAIN_ID}:actual=${actual}`);
        }
      });
    }
    return this.chainAssertion;
  }
}

async function check<T>(fn: () => Promise<T>): Promise<CapabilityCheck<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error: errorName(error) };
  }
}

function errorName(error: unknown): string {
  if (error instanceof Error && error.name) return error.name.slice(0, 120);
  return 'UNKNOWN_ERROR';
}
