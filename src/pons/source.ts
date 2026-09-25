import { createPublicClient, defineChain, http, keccak256, parseAbiItem, type Address, type Hex, type PublicClient } from 'viem';
import { sha256Hex } from '../evidence/canonical.js';

export const PONS_CHAIN_ID = 4663;
export const PONS_V2_FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' as Address;
export const PONS_V2_SOURCE_VERSION = 'PONS_V2_FACTORY_EVENT_V1';
export const PONS_UPSTREAM_SOURCE_SHA = '162310fbd1217717e2f5e4cde794d6a11322b469';

// Matches PonsV2LaunchFactory.TokenLaunched in the pinned upstream source.
// The event does NOT expose creatorFeeRecipient or prove any human identity.
export const ponsTokenLaunchedEvent = parseAbiItem(
  'event TokenLaunched(address indexed token,address indexed curve,address indexed deployer,address pairToken,uint256 launchConfigId,uint256 graduationThreshold)'
);
export const ponsCurveBuyEvent = parseAbiItem(
  'event CurveBuy(address indexed buyer,address indexed recipient,uint256 quoteIn,uint256 tokensOut,uint256 fee,uint256 tax)'
);
export const ponsCurveSellEvent = parseAbiItem(
  'event CurveSell(address indexed seller,address indexed recipient,uint256 tokensIn,uint256 quoteOut,uint256 fee,uint256 tax)'
);
export const ponsLaunchSweptEvent = parseAbiItem(
  'event LaunchSwept(address indexed token,uint256 quoteOut,uint256 tokenOut)'
);
export const ponsPoolGraduatedEvent = parseAbiItem(
  'event PoolGraduated(address indexed token,uint256 positionId,uint256 tokenAmount,uint256 pairTokenAmount)'
);

export interface PonsV2LaunchEvent {
  schemaVersion: typeof PONS_V2_SOURCE_VERSION;
  chainId: typeof PONS_CHAIN_ID;
  factory: Address;
  launchId: string;
  eventId: string;
  blockNumber: bigint;
  blockHash: Hex;
  txHash: Hex;
  logIndex: number;
  token: Address;
  curve: Address;
  originalDeployer: Address;
  // This event cannot establish fee-recipient address, deployer's human identity,
  // graduation phase, V4 pool identity, or recipient of a subsequent trade.
  creatorFeeRecipientAtLaunch: null;
  creatorFeeRecipientEvidence: 'NOT_IN_LAUNCH_EVENT';
  pairToken: Address;
  launchConfigId: bigint;
  graduationThreshold: bigint;
  phaseAtLaunch: 'NOT_GRADUATED';
}

export interface PonsV2LaunchSourceOptions {
  client?: PublicClient;
  rpcUrl?: string;
  // Required: operator-confirmed keccak256 of the real factory bytecode at
  // the scanned block. No default: source-code SHA is NOT an onchain code pin.
  expectedFactoryCodeHash: Hex;
  factory?: Address;
  maxWindowBlocks?: bigint;
}

export class PonsV2LaunchSource {
  private readonly client: PublicClient;
  private readonly expectedCodeHash: Hex;
  private readonly factory: Address;
  private readonly maxWindow: bigint;

  constructor(options: PonsV2LaunchSourceOptions) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(options.expectedFactoryCodeHash)) {
      throw new Error('PONS_FACTORY_CODE_PIN_REQUIRED');
    }
    if (options.factory && options.factory.toLowerCase() !== PONS_V2_FACTORY.toLowerCase()) {
      throw new Error('PONS_UNAPPROVED_FACTORY');
    }
    this.expectedCodeHash = options.expectedFactoryCodeHash.toLowerCase() as Hex;
    this.factory = PONS_V2_FACTORY;
    this.maxWindow = options.maxWindowBlocks ?? 500n;
    if (this.maxWindow < 1n || this.maxWindow > 2_000n) throw new Error('PONS_WINDOW_UNBOUNDED');
    const rpc = options.rpcUrl ?? process.env.ROBINHOOD_RPC_URL;
    if (!options.client && !rpc) throw new Error('ROBINHOOD_RPC_URL_REQUIRED');
    this.client = options.client ?? createPublicClient({
      chain: defineChain({ id: PONS_CHAIN_ID, name: 'Robinhood Chain',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [rpc!] } } }),
      transport: http(rpc)
    });
  }

  async getHeadBlockNumber(): Promise<bigint> {
    if (await this.client.getChainId() !== PONS_CHAIN_ID) throw new Error('PONS_CHAIN_ID_DRIFT');
    return this.client.getBlockNumber();
  }

  async getBlockHash(blockNumber: bigint): Promise<Hex> {
    const block = await this.client.getBlock({ blockNumber });
    if (!block.hash || !/^0x[0-9a-fA-F]{64}$/.test(block.hash)) throw new Error('PONS_BLOCK_HASH_MISSING');
    return block.hash.toLowerCase() as Hex;
  }

  async assertAuthority(blockNumber: bigint): Promise<void> {
    if (await this.client.getChainId() !== PONS_CHAIN_ID) throw new Error('PONS_CHAIN_ID_DRIFT');
    // Deliberately archive-sensitive. A current bytecode check does not prove
    // the identity of a factory at a historical event block.
    const code = await this.client.getBytecode({ address: this.factory, blockNumber });
    if (!code || code === '0x') throw new Error('PONS_HISTORICAL_FACTORY_CODE_MISSING');
    if (keccak256(code).toLowerCase() !== this.expectedCodeHash) throw new Error('PONS_FACTORY_CODE_HASH_DRIFT');
  }

  async catchUp(fromBlock: bigint, toBlock: bigint): Promise<PonsV2LaunchEvent[]> {
    if (fromBlock < 0n || toBlock < fromBlock || toBlock - fromBlock >= this.maxWindow) {
      throw new Error('PONS_INVALID_SCAN_WINDOW');
    }
    await this.assertAuthority(fromBlock);
    await this.assertAuthority(toBlock);
    const fromHash = await this.getBlockHash(fromBlock);
    const toHash = await this.getBlockHash(toBlock);
    const logs = await this.client.getLogs({
      address: this.factory, event: ponsTokenLaunchedEvent, fromBlock, toBlock, strict: true
    });
    const verified = new Map<string, PonsV2LaunchEvent>();
    // A provider may return incompatible per-block answers even when range
    // endpoints remain identical. Remember every event block for a final fence.
    const touchedHashes = new Map<bigint, Hex>();
    for (const log of logs) {
      if (log.address.toLowerCase() !== this.factory.toLowerCase() ||
        log.blockNumber == null || log.blockHash == null || log.transactionHash == null ||
        log.logIndex == null || !Number.isSafeInteger(log.logIndex) || log.logIndex < 0) {
        throw new Error('PONS_MALFORMED_LAUNCH_LOG');
      }
      const { token, curve, deployer, pairToken, launchConfigId, graduationThreshold } = log.args;
      if (!token || !curve || !deployer || !pairToken ||
        launchConfigId === undefined || graduationThreshold === undefined ||
        token.toLowerCase() === curve.toLowerCase()) throw new Error('PONS_MALFORMED_LAUNCH_ARGS');
      if (log.blockNumber < fromBlock || log.blockNumber > toBlock) {
        throw new Error('PONS_NONCANONICAL_LAUNCH_LOG');
      }
      const recordedHash = log.blockHash.toLowerCase() as Hex;
      const earlier = touchedHashes.get(log.blockNumber);
      if (earlier && earlier !== recordedHash) throw new Error('PONS_LOG_BLOCK_HASH_CONFLICT');
      if (!earlier) {
        if ((await this.getBlockHash(log.blockNumber)) !== recordedHash) {
          throw new Error('PONS_NONCANONICAL_LAUNCH_LOG');
        }
        // Endpoint bytecode alone cannot establish the emitter's historical
        // authority on each interior block when historical RPCs disagree.
        await this.assertAuthority(log.blockNumber);
        touchedHashes.set(log.blockNumber, recordedHash);
      }
      const fields = {
        chainId: PONS_CHAIN_ID, factory: this.factory.toLowerCase(),
        txHash: log.transactionHash.toLowerCase(), logIndex: log.logIndex
      };
      const eventId = await sha256Hex({ kind: PONS_V2_SOURCE_VERSION, ...fields });
      const launchId = await sha256Hex({
        kind: 'BINRAT_PONS_V2_LAUNCH_V1', ...fields, token: token.toLowerCase()
      });
      const row: PonsV2LaunchEvent = {
        schemaVersion: PONS_V2_SOURCE_VERSION, chainId: PONS_CHAIN_ID, factory: this.factory,
        launchId, eventId, blockNumber: log.blockNumber,
        blockHash: log.blockHash.toLowerCase() as Hex,
        txHash: log.transactionHash.toLowerCase() as Hex, logIndex: log.logIndex,
        token: token.toLowerCase() as Address, curve: curve.toLowerCase() as Address,
        originalDeployer: deployer.toLowerCase() as Address,
        creatorFeeRecipientAtLaunch: null, creatorFeeRecipientEvidence: 'NOT_IN_LAUNCH_EVENT',
        pairToken: pairToken.toLowerCase() as Address,
        launchConfigId, graduationThreshold, phaseAtLaunch: 'NOT_GRADUATED'
      };
      const old = verified.get(eventId);
      if (old && JSON.stringify(serializePonsLaunch(old)) !== JSON.stringify(serializePonsLaunch(row))) {
        throw new Error('PONS_EVENT_IDENTITY_CONFLICT');
      }
      verified.set(eventId, row);
    }
    // A reorg / inconsistent RPC during eth_getLogs is a hard error. Range
    // endpoints are not sufficient: reread every touched interior block.
    if ((await this.getBlockHash(fromBlock)) !== fromHash ||
        (await this.getBlockHash(toBlock)) !== toHash) throw new Error('PONS_SCAN_REORG');
    for (const [block, expectedHash] of touchedHashes) {
      if ((await this.getBlockHash(block)) !== expectedHash) throw new Error('PONS_SCAN_REORG');
    }
    return [...verified.values()].sort((a, b) =>
      a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1);
  }
}

export function serializePonsLaunch(event: PonsV2LaunchEvent) {
  return { ...event,
    blockNumber: event.blockNumber.toString(),
    launchConfigId: event.launchConfigId.toString(),
    graduationThreshold: event.graduationThreshold.toString()
  };
}
