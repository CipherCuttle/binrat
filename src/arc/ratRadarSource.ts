import {
  createPublicClient,
  http,
  parseAbi,
  parseAbiItem,
  type Address,
  type PublicClient
} from 'viem';
import type { Hex, LaunchObserved } from '../core/types.js';
import { deriveRatRadarSwapReceipt, type RatRadarSwapReceipt } from '../ratRadar/activity.js';
import { ARC_CHAIN_ID, arcMainnet } from './chain.js';

const poolAbi = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)'
]);
const swapEvent = parseAbiItem(
  'event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)'
);

export interface RatRadarSource {
  assertAuthority(blockNumber: bigint, expectedBlockHash: Hex): Promise<void>;
  catchUp(
    launch: LaunchObserved,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<RatRadarSwapReceipt[]>;
}

export class ArcRatRadarSource implements RatRadarSource {
  private readonly client: PublicClient;
  private chainAssertion: Promise<void> | null = null;

  constructor(options: { rpcUrl?: string; client?: PublicClient } = {}) {
    const rpcUrl = options.rpcUrl ?? process.env.ARC_RPC_URL;
    if (!options.client && !rpcUrl) throw new Error('ARC_RPC_URL is required');
    this.client = options.client ?? createPublicClient({
      chain: arcMainnet(rpcUrl!),
      transport: http(rpcUrl)
    });
  }

  async assertAuthority(blockNumber: bigint, expectedBlockHash: Hex): Promise<void> {
    await this.assertChain();
    const block = await this.client.getBlock({ blockNumber });
    if (!block.hash) throw new Error(`RAT_RADAR_BLOCK_HASH_MISSING:${blockNumber}`);
    if (block.hash.toLowerCase() !== expectedBlockHash.toLowerCase()) {
      throw new Error(`RAT_RADAR_CHECKPOINT_REORG:${blockNumber}`);
    }
  }

  async catchUp(
    launch: LaunchObserved,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<RatRadarSwapReceipt[]> {
    if (launch.chainId !== ARC_CHAIN_ID) {
      throw new Error(`RAT_RADAR_LAUNCH_CHAIN_MISMATCH:${launch.launchId}`);
    }
    if (fromBlock < launch.blockNumber) {
      throw new Error(`RAT_RADAR_CURSOR_BEFORE_LAUNCH:${launch.launchId}`);
    }
    if (toBlock < fromBlock) return [];
    await this.assertChain();

    const pool = launch.pool as Address;
    const [token0Raw, token1Raw] = await Promise.all([
      this.client.readContract({
        address: pool,
        abi: poolAbi,
        functionName: 'token0',
        blockNumber: toBlock
      }),
      this.client.readContract({
        address: pool,
        abi: poolAbi,
        functionName: 'token1',
        blockNumber: toBlock
      })
    ]);
    const token0 = token0Raw.toLowerCase() as Hex;
    const token1 = token1Raw.toLowerCase() as Hex;
    if (launch.token !== token0 && launch.token !== token1) {
      throw new Error(`RAT_RADAR_TOKEN_NOT_IN_POOL:${launch.launchId}`);
    }

    const logs = await this.client.getLogs({
      address: pool,
      event: swapEvent,
      fromBlock,
      toBlock,
      strict: true
    });

    const receipts: RatRadarSwapReceipt[] = [];
    for (const log of logs) {
      if (
        log.blockNumber === null ||
        log.blockHash === null ||
        log.transactionHash === null ||
        log.logIndex === null
      ) throw new Error('RAT_RADAR_INCOMPLETE_SWAP_LOG');

      const args = log.args as Partial<{
        sender: Address;
        recipient: Address;
        amount0: bigint;
        amount1: bigint;
        sqrtPriceX96: bigint;
        liquidity: bigint;
        tick: number;
      }>;
      if (
        typeof args.sender !== 'string' ||
        typeof args.recipient !== 'string' ||
        typeof args.amount0 !== 'bigint' ||
        typeof args.amount1 !== 'bigint' ||
        typeof args.sqrtPriceX96 !== 'bigint' ||
        typeof args.liquidity !== 'bigint' ||
        typeof args.tick !== 'number'
      ) throw new Error(`RAT_RADAR_MALFORMED_SWAP_LOG:${log.transactionHash}`);

      receipts.push(await deriveRatRadarSwapReceipt({
        chainId: ARC_CHAIN_ID,
        launchId: launch.launchId,
        pool: launch.pool,
        token: launch.token,
        token0,
        token1,
        blockNumber: log.blockNumber,
        blockHash: log.blockHash as Hex,
        txHash: log.transactionHash as Hex,
        logIndex: log.logIndex,
        sender: args.sender.toLowerCase() as Hex,
        recipient: args.recipient.toLowerCase() as Hex,
        amount0: args.amount0,
        amount1: args.amount1,
        sqrtPriceX96: args.sqrtPriceX96,
        liquidity: args.liquidity,
        tick: args.tick
      }));
    }
    return receipts.sort(compareReceipts);
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

function compareReceipts(a: RatRadarSwapReceipt, b: RatRadarSwapReceipt): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  if (a.logIndex !== b.logIndex) return a.logIndex - b.logIndex;
  return a.activityId.localeCompare(b.activityId);
}
