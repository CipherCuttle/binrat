import {
  createPublicClient,
  http,
  type Address,
  type Hash,
  type PublicClient
} from 'viem';
import { deriveEventId, deriveLaunchId } from '../core/identity.js';
import type { Hex, LaunchObserved } from '../core/types.js';
import { ARC_CHAIN_ID, ARCPAD_LAUNCHER, arcMainnet } from './chain.js';
import { tokenCreatedEvent } from './arcpadAbi.js';

export interface ArcPadLaunchSourceOptions {
  rpcUrl?: string;
  launcher?: Hex;
  client?: PublicClient;
  now?: () => number;
}

export class ArcPadLaunchSource {
  readonly launcher: Hex;
  private readonly client: PublicClient;
  private readonly now: () => number;

  constructor(options: ArcPadLaunchSourceOptions = {}) {
    const rpcUrl = options.rpcUrl ?? process.env.ARC_RPC_URL;
    if (!options.client && !rpcUrl) throw new Error('ARC_RPC_URL is required');
    this.launcher = (options.launcher ?? ARCPAD_LAUNCHER).toLowerCase() as Hex;
    this.client = options.client ?? createPublicClient({ chain: arcMainnet(rpcUrl!), transport: http(rpcUrl) });
    this.now = options.now ?? Date.now;
  }

  async getHeadBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber();
  }

  async getBlockHash(blockNumber: bigint): Promise<Hex> {
    const block = await this.client.getBlock({ blockNumber });
    if (!block.hash) throw new Error(`ARCPAD_BLOCK_HASH_MISSING:${blockNumber}`);
    return block.hash;
  }

  async assertAuthority(blockNumber: bigint): Promise<void> {
    const chainId = await this.client.getChainId();
    if (chainId !== ARC_CHAIN_ID) throw new Error(`ARC_CHAIN_ID_DRIFT:expected=${ARC_CHAIN_ID}:actual=${chainId}`);
    if (this.launcher.toLowerCase() !== ARCPAD_LAUNCHER.toLowerCase()) {
      throw new Error(`ARCPAD_LAUNCHER_DRIFT:expected=${ARCPAD_LAUNCHER}:actual=${this.launcher}`);
    }
    // Historical authority is established by canonical block hashes plus logs from the frozen launcher address.
    // Code existence is a current source-identity sanity check; pinning it to an old block adds an unnecessary
    // archive-state dependency and can stall historical backfill even when historical blocks/logs are available.
    const code = await this.client.getBytecode({ address: this.launcher as Address });
    if (!code || code === '0x') throw new Error(`ARCPAD_LAUNCHER_CODE_MISSING:block=${blockNumber}`);
  }

  async catchUp(fromBlock: bigint, toBlock: bigint): Promise<LaunchObserved[]> {
    if (toBlock < fromBlock) return [];
    const logs = await this.client.getLogs({
      address: this.launcher as Address,
      event: tokenCreatedEvent,
      fromBlock,
      toBlock,
      strict: true
    });

    const launches: LaunchObserved[] = [];
    for (const log of logs) {
      if (log.blockNumber === null || log.blockHash === null || log.transactionHash === null || log.logIndex === null) {
        throw new Error('ARCPAD_INCOMPLETE_TOKEN_CREATED_LOG');
      }
      const args = log.args as Partial<{
        token: Address;
        creator: Address;
        name: string;
        symbol: string;
        pool: Address;
        imageURI: string;
        website: string;
        twitter: string;
        telegram: string;
      }>;
      if (
        typeof args.token !== 'string' || typeof args.creator !== 'string' || typeof args.pool !== 'string' ||
        typeof args.name !== 'string' || typeof args.symbol !== 'string' || typeof args.imageURI !== 'string' ||
        typeof args.website !== 'string' || typeof args.twitter !== 'string' || typeof args.telegram !== 'string'
      ) {
        throw new Error(`ARCPAD_MALFORMED_TOKEN_CREATED_LOG:${log.transactionHash}`);
      }
      const [launchId, eventId] = await Promise.all([
        deriveLaunchId({ chainId: ARC_CHAIN_ID, launcher: this.launcher, txHash: log.transactionHash as Hex, token: args.token as Hex }),
        deriveEventId({ chainId: ARC_CHAIN_ID, launcher: this.launcher, txHash: log.transactionHash as Hex, logIndex: log.logIndex })
      ]);
      launches.push({
        chainId: ARC_CHAIN_ID,
        blockNumber: log.blockNumber,
        blockHash: log.blockHash as Hash,
        observedAtMs: this.now(),
        launchId,
        eventId,
        source: 'ARCPAD',
        launcher: this.launcher,
        txHash: log.transactionHash as Hex,
        logIndex: log.logIndex,
        token: args.token.toLowerCase() as Hex,
        creator: args.creator.toLowerCase() as Hex,
        pool: args.pool.toLowerCase() as Hex,
        name: args.name,
        symbol: args.symbol,
        imageUri: args.imageURI,
        website: args.website,
        twitter: args.twitter,
        telegram: args.telegram
      });
    }
    return launches.sort(compareLaunches);
  }
}

function compareLaunches(a: LaunchObserved, b: LaunchObserved): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  if (a.logIndex !== b.logIndex) return a.logIndex - b.logIndex;
  return a.launchId.localeCompare(b.launchId);
}
