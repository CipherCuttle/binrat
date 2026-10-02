import { createPublicClient, http, keccak256, type Address, type PublicClient } from 'viem';
import type { Hex } from '../core/types.js';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { PONS_V2_FACTORY, PONS_V2_FACTORY_CODE_HASH, ROBINHOOD_CHAIN_ID, robinhoodMainnet } from './chain.js';
import { PONS_RPC_RETRY_COUNT, PONS_RPC_RETRY_DELAY_MS, PONS_RPC_TIMEOUT_MS } from './ponsSource.js';

export const PONS_PRELAUNCH_NATIVE_INBOUND_VERSION = 'BINRAT_PONS_PRELAUNCH_NATIVE_INBOUND_V1' as const;

export interface PonsFundingLaunch {
  launchId: string;
  deployer: Hex;
  blockNumber: bigint;
  blockHash: Hex;
}

export interface PonsFundingBlockPoint {
  blockNumber: bigint;
  blockHash: Hex;
  timestampMs: number;
}

export interface PonsExternalNativeInboundCandidate {
  from: Hex;
  to: Hex;
  txHash: Hex;
  blockNumber: bigint;
  valueWei: bigint;
}

export interface PonsCanonicalTransaction {
  hash: Hex;
  from: Hex;
  to: Hex | null;
  valueWei: bigint;
  blockNumber: bigint;
}

export interface PonsPrelaunchNativeInboundReceipt {
  fundingId: string;
  fundingVersion: typeof PONS_PRELAUNCH_NATIVE_INBOUND_VERSION;
  chainId: typeof ROBINHOOD_CHAIN_ID;
  launchId: string;
  deployer: Hex;
  launchBlock: bigint;
  launchBlockHash: Hex;
  sourceAddress: Hex;
  transferTxHash: Hex;
  transferBlock: bigint;
  transferBlockHash: Hex;
  transferTimestampMs: number;
  valueWei: bigint;
  evidenceDigest: string;
}

export interface PonsFundingSource {
  assertAuthority(): Promise<void>;
  getBlockPoint(blockNumber: bigint): Promise<PonsFundingBlockPoint>;
  getTransaction(txHash: Hex): Promise<PonsCanonicalTransaction>;
  findLatestExternalNativeInbound(
    deployer: Hex,
    throughBlockInclusive: bigint
  ): Promise<PonsExternalNativeInboundCandidate | null>;
}

export interface PonsFundingStore {
  listPending(limit:number, nowMs:number): Promise<PonsFundingLaunch[]>;
  put(receipt:PonsPrelaunchNativeInboundReceipt): Promise<'INSERTED'|'DUPLICATE'>;
  markNoMatch(launch:PonsFundingLaunch, checkedAtMs:number): Promise<'INSERTED'|'DUPLICATE'>;
  markRetry(launch:PonsFundingLaunch, code:string, retryAfterMs:number, nowMs:number): Promise<void>;
  countRemaining(): Promise<number>;
}

export interface PonsFundingSyncReport {
  attempted:number;
  inserted:number;
  duplicates:number;
  noMatch:number;
  failed:number;
  remaining:number;
}

export const PONS_FUNDING_FAILURE_RETRY_MS = 5 * 60_000;

export interface FundingSourceRecurrence {
  sourceAddress: Hex;
  distinctDeployers: number;
  distinctLaunches: number;
  launches: Array<{
    launchId: string;
    deployer: Hex;
    launchBlock: bigint;
    transferBlock: bigint;
    valueWei: bigint;
  }>;
}

interface AlchemyTransferResponse {
  jsonrpc?: string;
  id?: number;
  error?: { code?: number; message?: string };
  result?: {
    transfers?: Array<{
      blockNum?: string;
      hash?: string;
      from?: string;
      to?: string;
      category?: string;
      rawContract?: {
        value?: string | null;
        address?: string | null;
      };
    }>;
  };
}

export class AlchemyPonsFundingSource implements PonsFundingSource {
  private readonly client: PublicClient;
  private readonly rpcUrl: string;
  private readonly fetchImpl: typeof fetch;
  private authorityVerified = false;

  constructor(options: {
    rpcUrl: string;
    client?: PublicClient;
    fetchImpl?: typeof fetch;
  }) {
    if (!options.rpcUrl) throw new Error('ROBINHOOD_ARCHIVE_RPC_URL_REQUIRED');
    this.rpcUrl = options.rpcUrl;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.client = options.client ?? createPublicClient({
      chain: robinhoodMainnet(options.rpcUrl),
      transport: http(options.rpcUrl, {
        timeout: PONS_RPC_TIMEOUT_MS,
        retryCount: PONS_RPC_RETRY_COUNT,
        retryDelay: PONS_RPC_RETRY_DELAY_MS
      })
    });
  }

  async assertAuthority(): Promise<void> {
    if (this.authorityVerified) return;
    const chainId = await this.client.getChainId();
    if (chainId !== ROBINHOOD_CHAIN_ID) throw new Error('PONS_FUNDING_CHAIN_ID_DRIFT');
    const code = await this.client.getBytecode({ address: PONS_V2_FACTORY as Address });
    if (!code || keccak256(code) !== PONS_V2_FACTORY_CODE_HASH) {
      throw new Error('PONS_FUNDING_FACTORY_AUTHORITY_DRIFT');
    }
    this.authorityVerified = true;
  }

  async getBlockPoint(blockNumber: bigint): Promise<PonsFundingBlockPoint> {
    if (blockNumber < 0n) throw new Error('PONS_FUNDING_BLOCK_INVALID');
    const block = await this.client.getBlock({ blockNumber });
    if (!block.hash) throw new Error(`PONS_FUNDING_BLOCK_HASH_MISSING:${blockNumber}`);
    const timestampMs = Number(block.timestamp * 1000n);
    if (!Number.isSafeInteger(timestampMs) || timestampMs < 0) {
      throw new Error('PONS_FUNDING_BLOCK_TIMESTAMP_INVALID');
    }
    return {
      blockNumber,
      blockHash: block.hash.toLowerCase() as Hex,
      timestampMs
    };
  }

  async getTransaction(txHash: Hex): Promise<PonsCanonicalTransaction> {
    assertHash(txHash, 'PONS_FUNDING_TX_HASH_INVALID');
    const tx = await this.client.getTransaction({ hash: txHash });
    if (tx.blockNumber === null) throw new Error('PONS_FUNDING_TX_UNMINED');
    return {
      hash: tx.hash.toLowerCase() as Hex,
      from: tx.from.toLowerCase() as Hex,
      to: tx.to ? tx.to.toLowerCase() as Hex : null,
      valueWei: tx.value,
      blockNumber: tx.blockNumber
    };
  }

  async findLatestExternalNativeInbound(
    deployer: Hex,
    throughBlockInclusive: bigint
  ): Promise<PonsExternalNativeInboundCandidate | null> {
    assertAddress(deployer, 'PONS_FUNDING_DEPLOYER_INVALID');
    if (throughBlockInclusive < 0n) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PONS_RPC_TIMEOUT_MS);
    let response: Response;
    try {
      response = await this.fetchImpl(this.rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: '0x0',
            toBlock: `0x${throughBlockInclusive.toString(16)}`,
            toAddress: deployer,
            category: ['external'],
            excludeZeroValue: true,
            withMetadata: false,
            order: 'desc',
            maxCount: '0x5'
          }]
        })
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error('PONS_FUNDING_TRANSFERS_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`PONS_FUNDING_TRANSFERS_HTTP_${response.status}`);

    const payload = await response.json() as AlchemyTransferResponse;
    if (payload.error) throw new Error('PONS_FUNDING_TRANSFERS_RPC_ERROR');
    const transfer = payload.result?.transfers?.find(
      (item) => String(item.from ?? '').toLowerCase() !== deployer.toLowerCase()
    );
    if (!transfer) return null;

    const from = String(transfer.from ?? '').toLowerCase() as Hex;
    const to = String(transfer.to ?? '').toLowerCase() as Hex;
    const txHash = String(transfer.hash ?? '').toLowerCase() as Hex;
    const blockNumber = parseHexQuantity(transfer.blockNum, 'PONS_FUNDING_TRANSFER_BLOCK_INVALID');
    const rawValue = transfer.rawContract?.value;
    const valueWei = parseHexQuantity(rawValue, 'PONS_FUNDING_TRANSFER_VALUE_INVALID');

    assertAddress(from, 'PONS_FUNDING_SOURCE_INVALID');
    assertAddress(to, 'PONS_FUNDING_TRANSFER_TO_INVALID');
    assertHash(txHash, 'PONS_FUNDING_TX_HASH_INVALID');
    if (to !== deployer.toLowerCase()) throw new Error('PONS_FUNDING_TRANSFER_DEPLOYER_MISMATCH');
    if (transfer.category !== 'external') throw new Error('PONS_FUNDING_TRANSFER_CATEGORY_INVALID');
    if (transfer.rawContract?.address !== null && transfer.rawContract?.address !== undefined) {
      throw new Error('PONS_FUNDING_TRANSFER_NOT_NATIVE');
    }
    if (valueWei <= 0n) throw new Error('PONS_FUNDING_TRANSFER_VALUE_INVALID');
    if (blockNumber > throughBlockInclusive) throw new Error('PONS_FUNDING_TRANSFER_AFTER_BOUNDARY');

    return { from, to, txHash, blockNumber, valueWei };
  }
}

export async function readPonsPrelaunchNativeInbound(
  source: PonsFundingSource,
  launch: PonsFundingLaunch
): Promise<PonsPrelaunchNativeInboundReceipt | null> {
  validateLaunch(launch);
  if (launch.blockNumber === 0n) return null;

  await source.assertAuthority();
  const launchPoint = await source.getBlockPoint(launch.blockNumber);
  if (launchPoint.blockHash.toLowerCase() !== launch.blockHash.toLowerCase()) {
    throw new Error('PONS_FUNDING_LAUNCH_REORG');
  }

  const candidate = await source.findLatestExternalNativeInbound(
    launch.deployer.toLowerCase() as Hex,
    launch.blockNumber - 1n
  );
  if (!candidate) {
    const launchAgain = await source.getBlockPoint(launch.blockNumber);
    if (launchAgain.blockHash.toLowerCase() !== launchPoint.blockHash.toLowerCase()) {
      throw new Error('PONS_FUNDING_LAUNCH_REORG_DURING_READ');
    }
    return null;
  }

  const tx = await source.getTransaction(candidate.txHash);
  if (
    tx.hash.toLowerCase() !== candidate.txHash.toLowerCase() ||
    tx.from.toLowerCase() !== candidate.from.toLowerCase() ||
    tx.to?.toLowerCase() !== launch.deployer.toLowerCase() ||
    tx.valueWei !== candidate.valueWei ||
    tx.blockNumber !== candidate.blockNumber
  ) {
    throw new Error('PONS_FUNDING_TRANSFER_CANONICAL_MISMATCH');
  }
  if (tx.blockNumber >= launch.blockNumber) throw new Error('PONS_FUNDING_TRANSFER_NOT_PRELAUNCH');

  const transferPoint = await source.getBlockPoint(tx.blockNumber);
  const launchAgain = await source.getBlockPoint(launch.blockNumber);
  const transferAgain = await source.getBlockPoint(tx.blockNumber);
  if (launchAgain.blockHash.toLowerCase() !== launchPoint.blockHash.toLowerCase()) {
    throw new Error('PONS_FUNDING_LAUNCH_REORG_DURING_READ');
  }
  if (transferAgain.blockHash.toLowerCase() !== transferPoint.blockHash.toLowerCase()) {
    throw new Error('PONS_FUNDING_TRANSFER_REORG_DURING_READ');
  }

  return buildPonsPrelaunchNativeInboundReceipt({
    launch,
    sourceAddress: tx.from,
    transferTxHash: tx.hash,
    transferBlock: tx.blockNumber,
    transferBlockHash: transferPoint.blockHash,
    transferTimestampMs: transferPoint.timestampMs,
    valueWei: tx.valueWei
  });
}

export async function syncPonsFundingProvenance(
  source:PonsFundingSource,
  store:PonsFundingStore,
  options:{limit:number;nowMs:number;failureRetryMs?:number}
):Promise<PonsFundingSyncReport> {
  if (!Number.isSafeInteger(options.limit) || options.limit<1 || options.limit>12) {
    throw new Error('PONS_FUNDING_LIMIT_INVALID');
  }
  if (!Number.isSafeInteger(options.nowMs) || options.nowMs<0) {
    throw new Error('PONS_FUNDING_NOW_INVALID');
  }
  const failureRetryMs=options.failureRetryMs ?? PONS_FUNDING_FAILURE_RETRY_MS;
  if (!Number.isSafeInteger(failureRetryMs) || failureRetryMs<1_000 || failureRetryMs>86_400_000) {
    throw new Error('PONS_FUNDING_RETRY_MS_INVALID');
  }

  const launches=await store.listPending(options.limit,options.nowMs);
  if (launches.length===0) {
    return {attempted:0,inserted:0,duplicates:0,noMatch:0,failed:0,remaining:await store.countRemaining()};
  }
  await source.assertAuthority();
  let inserted=0,duplicates=0,noMatch=0,failed=0;
  for (const launch of launches) {
    let receipt:PonsPrelaunchNativeInboundReceipt|null;
    try {
      receipt=await readPonsPrelaunchNativeInbound(source,launch);
    } catch(error) {
      const code=fundingErrorCode(error);
      if (isFatalFundingEvidenceError(code)) throw error;
      await store.markRetry(launch,code,options.nowMs+failureRetryMs,options.nowMs);
      failed+=1;
      continue;
    }
    if (!receipt) {
      const result=await store.markNoMatch(launch,options.nowMs);
      if (result==='INSERTED') noMatch+=1;
      continue;
    }
    const result=await store.put(receipt);
    if (result==='INSERTED') inserted+=1;
    else duplicates+=1;
  }
  return {
    attempted:launches.length,
    inserted,
    duplicates,
    noMatch,
    failed,
    remaining:await store.countRemaining()
  };
}

export function fundingErrorCode(error:unknown):string {
  const raw=error instanceof Error ? error.message : String(error);
  const code=raw.split(':',1)[0]?.trim() || 'PONS_FUNDING_UNKNOWN';
  return /^[A-Z0-9_]{1,120}$/.test(code) ? code : 'PONS_FUNDING_UNKNOWN';
}

/** Provider transport errors are retryable; canonical evidence failures are never scan noise. */
export function isFatalFundingEvidenceError(code:string):boolean {
  return /(REORG|MISMATCH|CONFLICT|INVALID|DRIFT|UNMINED|NOT_PRELAUNCH|NOT_NATIVE|SOURCE_IS_DEPLOYER|AUTHORITY|HASH_MISSING|AFTER_BOUNDARY)/.test(code);
}

export async function buildPonsPrelaunchNativeInboundReceipt(input: {
  launch: PonsFundingLaunch;
  sourceAddress: Hex;
  transferTxHash: Hex;
  transferBlock: bigint;
  transferBlockHash: Hex;
  transferTimestampMs: number;
  valueWei: bigint;
}): Promise<PonsPrelaunchNativeInboundReceipt> {
  validateLaunch(input.launch);
  assertAddress(input.sourceAddress, 'PONS_FUNDING_SOURCE_INVALID');
  if (input.sourceAddress.toLowerCase()===input.launch.deployer.toLowerCase()) {
    throw new Error('PONS_FUNDING_SOURCE_IS_DEPLOYER');
  }
  assertHash(input.transferTxHash, 'PONS_FUNDING_TX_HASH_INVALID');
  assertHash(input.transferBlockHash, 'PONS_FUNDING_TRANSFER_BLOCK_HASH_INVALID');
  if (input.transferBlock < 0n || input.transferBlock >= input.launch.blockNumber) {
    throw new Error('PONS_FUNDING_TRANSFER_NOT_PRELAUNCH');
  }
  if (!Number.isSafeInteger(input.transferTimestampMs) || input.transferTimestampMs < 0) {
    throw new Error('PONS_FUNDING_TRANSFER_TIMESTAMP_INVALID');
  }
  if (input.valueWei <= 0n) throw new Error('PONS_FUNDING_TRANSFER_VALUE_INVALID');

  const sourceAddress = input.sourceAddress.toLowerCase() as Hex;
  const deployer = input.launch.deployer.toLowerCase() as Hex;
  const core: Omit<PonsPrelaunchNativeInboundReceipt, 'fundingId' | 'evidenceDigest'> = {
    fundingVersion: PONS_PRELAUNCH_NATIVE_INBOUND_VERSION,
    chainId: ROBINHOOD_CHAIN_ID,
    launchId: input.launch.launchId,
    deployer,
    launchBlock: input.launch.blockNumber,
    launchBlockHash: input.launch.blockHash.toLowerCase() as Hex,
    sourceAddress,
    transferTxHash: input.transferTxHash.toLowerCase() as Hex,
    transferBlock: input.transferBlock,
    transferBlockHash: input.transferBlockHash.toLowerCase() as Hex,
    transferTimestampMs: input.transferTimestampMs,
    valueWei: input.valueWei
  };

  return {
    fundingId: await sha256Hex({
      kind: PONS_PRELAUNCH_NATIVE_INBOUND_VERSION,
      chainId: ROBINHOOD_CHAIN_ID,
      launchId: input.launch.launchId
    }),
    ...core,
    evidenceDigest: await sha256Hex(core)
  };
}

export async function verifyPonsPrelaunchNativeInboundReceipt(
  receipt: PonsPrelaunchNativeInboundReceipt
): Promise<void> {
  if (
    receipt.fundingVersion !== PONS_PRELAUNCH_NATIVE_INBOUND_VERSION ||
    receipt.chainId !== ROBINHOOD_CHAIN_ID
  ) {
    throw new Error('PONS_FUNDING_VERSION_INVALID');
  }
  const rebuilt = await buildPonsPrelaunchNativeInboundReceipt({
    launch: {
      launchId: receipt.launchId,
      deployer: receipt.deployer,
      blockNumber: receipt.launchBlock,
      blockHash: receipt.launchBlockHash
    },
    sourceAddress: receipt.sourceAddress,
    transferTxHash: receipt.transferTxHash,
    transferBlock: receipt.transferBlock,
    transferBlockHash: receipt.transferBlockHash,
    transferTimestampMs: receipt.transferTimestampMs,
    valueWei: receipt.valueWei
  });
  if (canonicalJson(rebuilt) !== canonicalJson(receipt)) {
    throw new Error('PONS_FUNDING_RECEIPT_INVALID');
  }
}

export async function projectFundingSourceRecurrence(
  receipts: readonly PonsPrelaunchNativeInboundReceipt[]
): Promise<FundingSourceRecurrence[]> {
  const bySource = new Map<Hex, PonsPrelaunchNativeInboundReceipt[]>();
  for (const receipt of receipts) {
    await verifyPonsPrelaunchNativeInboundReceipt(receipt);
    const key = receipt.sourceAddress.toLowerCase() as Hex;
    const existing = bySource.get(key) ?? [];
    existing.push(receipt);
    bySource.set(key, existing);
  }

  const out: FundingSourceRecurrence[] = [];
  for (const [sourceAddress, rows] of bySource) {
    const deployers = new Set(rows.map((row) => row.deployer.toLowerCase()));
    const launches = new Map(rows.map((row) => [row.launchId, row] as const));
    if (deployers.size < 2 || launches.size < 2) continue;
    const ordered = [...launches.values()].sort((a, b) => {
      if (a.launchBlock === b.launchBlock) return a.launchId.localeCompare(b.launchId);
      return a.launchBlock < b.launchBlock ? -1 : 1;
    });
    out.push({
      sourceAddress,
      distinctDeployers: deployers.size,
      distinctLaunches: launches.size,
      launches: ordered.map((row) => ({
        launchId: row.launchId,
        deployer: row.deployer,
        launchBlock: row.launchBlock,
        transferBlock: row.transferBlock,
        valueWei: row.valueWei
      }))
    });
  }

  return out.sort((a, b) => {
    const aLast = a.launches[a.launches.length - 1]!;
    const bLast = b.launches[b.launches.length - 1]!;
    if (aLast.launchBlock === bLast.launchBlock) {
      return a.sourceAddress.localeCompare(b.sourceAddress);
    }
    return aLast.launchBlock > bLast.launchBlock ? -1 : 1;
  });
}

function validateLaunch(launch: PonsFundingLaunch): void {
  if (!/^[0-9a-f]{64}$/i.test(launch.launchId)) throw new Error('PONS_FUNDING_LAUNCH_ID_INVALID');
  assertAddress(launch.deployer, 'PONS_FUNDING_DEPLOYER_INVALID');
  if (launch.blockNumber < 0n) throw new Error('PONS_FUNDING_LAUNCH_BLOCK_INVALID');
  assertHash(launch.blockHash, 'PONS_FUNDING_LAUNCH_BLOCK_HASH_INVALID');
}

function assertAddress(value: string, error: string): void {
  if (!/^0x[0-9a-f]{40}$/i.test(value)) throw new Error(error);
}

function assertHash(value: string, error: string): void {
  if (!/^0x[0-9a-f]{64}$/i.test(value)) throw new Error(error);
}

function parseHexQuantity(value: string | null | undefined, error: string): bigint {
  if (typeof value !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(value)) {
    throw new Error(error);
  }
  try {
    return BigInt(value);
  } catch {
    throw new Error(error);
  }
}
