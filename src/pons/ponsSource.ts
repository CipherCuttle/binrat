import { createPublicClient, getAddress, http, keccak256, type Address, type PublicClient } from 'viem';
import { deriveEventId, deriveLaunchId } from '../core/identity.js';
import type { Hex, LaunchObserved } from '../core/types.js';
import { PONS_V2_FACTORY, PONS_V2_FACTORY_CODE_HASH, ROBINHOOD_CHAIN_ID, robinhoodMainnet } from './chain.js';
import { ponsTokenLaunchedEvent } from './ponsAbi.js';

/**
 * A Pons launch batch is allowed to touch no more than this many distinct
 * canonical log blocks.  `syncLaunches` narrows a dense requested range before
 * it writes or checkpoints anything, keeping Worker RPC work bounded.
 */
export const PONS_MAX_CANONICAL_LAUNCH_BLOCKS = 128;

export interface PonsLaunchSourceOptions {
  rpcUrl?: string;
  client?: PublicClient;
  now?: () => number;
  maxCanonicalLaunchBlocks?: number;
}

type PonsBootstrapOperation = 'PONS_GET_HEAD' | 'PONS_GET_CHAIN_ID' | 'PONS_GET_FACTORY_CODE';

async function ponsBootstrapOperation<T>(
  operation: PonsBootstrapOperation,
  run: () => Promise<T>
): Promise<T> {
  console.error(JSON.stringify({ event: 'PONS_BOOTSTRAP_OPERATION', operation, status: 'START' }));
  try {
    const result = await run();
    console.error(JSON.stringify({ event: 'PONS_BOOTSTRAP_OPERATION', operation, status: 'PASS' }));
    return result;
  } catch (error) {
    console.error(JSON.stringify({ event: 'PONS_BOOTSTRAP_OPERATION', operation, status: 'FAIL' }));
    throw new Error(`${operation}_FAILED`, { cause: error });
  }
}

export class PonsLaunchSource {
  readonly factory = PONS_V2_FACTORY;
  private readonly client: PublicClient;
  private readonly now: () => number;
  private readonly maxCanonicalLaunchBlocks: number;
  private authorityVerified = false;

  constructor(options: PonsLaunchSourceOptions = {}) {
    if (!options.client && !options.rpcUrl) throw new Error('ROBINHOOD_RPC_URL_REQUIRED');
    this.client = options.client ?? createPublicClient({
      chain: robinhoodMainnet(options.rpcUrl!), transport: http(options.rpcUrl!, { timeout: 8_000, retryCount: 0 })
    });
    this.now = options.now ?? Date.now;
    this.maxCanonicalLaunchBlocks = options.maxCanonicalLaunchBlocks ?? PONS_MAX_CANONICAL_LAUNCH_BLOCKS;
    if (!Number.isSafeInteger(this.maxCanonicalLaunchBlocks) || this.maxCanonicalLaunchBlocks < 1 || this.maxCanonicalLaunchBlocks > 256) {
      throw new Error('PONS_CANONICAL_LAUNCH_BLOCK_LIMIT_INVALID');
    }
  }

  async getHeadBlockNumber(): Promise<bigint> {
    return ponsBootstrapOperation('PONS_GET_HEAD', () => this.client.getBlockNumber());
  }
  async getBlockHash(blockNumber: bigint): Promise<Hex> {
    const block = await this.client.getBlock({ blockNumber });
    if (!block.hash) throw new Error(`PONS_BLOCK_HASH_MISSING:${blockNumber}`);
    return block.hash as Hex;
  }
  async assertAuthority(_blockNumber: bigint): Promise<void> {
    // The factory address and its deployed code are immutable authority facts
    // for this invocation. Reusing this verified result preserves the checks
    // while avoiding repeated identical RPC subrequests inside one sync.
    if (this.authorityVerified) return;
    const chainId = await ponsBootstrapOperation(
      'PONS_GET_CHAIN_ID',
      () => this.client.getChainId()
    );
    if (chainId !== ROBINHOOD_CHAIN_ID) throw new Error('PONS_CHAIN_ID_DRIFT');
    const code = await ponsBootstrapOperation(
      'PONS_GET_FACTORY_CODE',
      () => this.client.getBytecode({ address: this.factory as Address })
    );
    if (!code || keccak256(code) !== PONS_V2_FACTORY_CODE_HASH) throw new Error('PONS_FACTORY_AUTHORITY_DRIFT');
    this.authorityVerified = true;
  }
  async catchUp(fromBlock: bigint, toBlock: bigint): Promise<LaunchObserved[]> {
    if (toBlock < fromBlock) return [];
    const logs = await this.client.getLogs({ address: this.factory as Address, event: ponsTokenLaunchedEvent, fromBlock, toBlock, strict: true });
    if (logs.some((log) => log.blockNumber === null)) throw new Error('PONS_INCOMPLETE_TOKEN_LAUNCHED_LOG');
    const canonicalLogBlocks = new Set(logs.map((log) => log.blockNumber!.toString()));
    if (canonicalLogBlocks.size > this.maxCanonicalLaunchBlocks) {
      throw new Error('PONS_LAUNCH_BLOCK_DENSITY');
    }
    const launches: LaunchObserved[] = [];
    for (const log of logs) {
      if (log.blockNumber === null || log.blockHash === null || log.transactionHash === null || log.logIndex === null) throw new Error('PONS_INCOMPLETE_TOKEN_LAUNCHED_LOG');
      const token = log.args.token, curve = log.args.curve, deployer = log.args.deployer;
      if (!token || !curve || !deployer) throw new Error('PONS_MALFORMED_TOKEN_LAUNCHED_LOG');
      // Name and symbol are non-authoritative enrichment. Keep the critical
      // transaction to canonical event facts only; empty metadata is honest.
      const [launchId, eventId] = await Promise.all([
        deriveLaunchId({ chainId: ROBINHOOD_CHAIN_ID, launcher: this.factory, txHash: log.transactionHash as Hex, token: token as Hex, source: 'PONS_V2' }),
        deriveEventId({ chainId: ROBINHOOD_CHAIN_ID, launcher: this.factory, txHash: log.transactionHash as Hex, logIndex: log.logIndex, source: 'PONS_V2' })
      ]);
      launches.push({ chainId: ROBINHOOD_CHAIN_ID, blockNumber: log.blockNumber, blockHash: log.blockHash as Hex, observedAtMs: this.now(), launchId, eventId,
        source: 'PONS_V2', launcher: this.factory, txHash: log.transactionHash as Hex, logIndex: log.logIndex,
        token: getAddress(token).toLowerCase() as Hex, creator: getAddress(deployer).toLowerCase() as Hex, pool: getAddress(curve).toLowerCase() as Hex,
        name: '', symbol: '', imageUri: '', website: '', twitter: '', telegram: '' });
    }
    return launches.sort((a,b) => a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1);
  }
}
