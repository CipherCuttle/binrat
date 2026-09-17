import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createPublicClient, http, type PublicClient } from 'viem';
import { ArcPadLaunchSource } from '../arc/arcpadSource.js';
import { ARCPAD_LAUNCHER, ARC_CHAIN_ID, arcMainnet } from '../arc/chain.js';
import type { Hex } from '../core/types.js';
import type { LaunchSource } from '../core/ports.js';
import { syncLaunches } from '../indexer/syncLaunches.js';
import { SqliteStore } from '../store/sqliteStore.js';
import { computeHotGarbageMetrics, decideHotGarbage, reconcileTokenSets } from './hotGarbageMetrics.js';

const START_RECEIPT_PATH = resolve(
  process.env.BINRAT_EXPERIMENT_START_RECEIPT ?? 'docs/experiments/hot-garbage-v0-start.json'
);
const RPC_URL = process.env.ARC_RPC_URL ?? 'https://rpc.arc-scan.org';
const ARCPAD_API = process.env.BINRAT_ARCPAD_API ?? 'https://arcpad.meme';
const BATCH_BLOCKS = BigInt(process.env.BINRAT_EXPERIMENT_BATCH_BLOCKS ?? '2000');
const CONFIRMATIONS = 2n;
const ALLOW_EARLY = process.env.BINRAT_EXPERIMENT_ALLOW_EARLY === '1';

interface StartReceipt {
  schemaVersion: string;
  startedAt: string;
  windowHours: number;
  chainId: number;
  launcher: Hex;
  startBlock: string;
  startBlockHash: Hex;
}

interface ArcPadCreation {
  token?: string;
  creator?: string;
  blockNumber?: string | number;
}

interface ArcPadTokensPage {
  creations?: ArcPadCreation[];
  nextAfter?: string | number | null;
  state?: string;
  servedAt?: number;
}

class RetryingLaunchSource implements LaunchSource {
  constructor(private readonly inner: LaunchSource) {}
  getHeadBlockNumber() { return retryTransient(() => this.inner.getHeadBlockNumber()); }
  getBlockHash(blockNumber: bigint) { return retryTransient(() => this.inner.getBlockHash(blockNumber)); }
  assertAuthority(blockNumber: bigint) { return retryTransient(() => this.inner.assertAuthority(blockNumber)); }
  catchUp(fromBlock: bigint, toBlock: bigint) { return retryTransient(() => this.inner.catchUp(fromBlock, toBlock)); }
}

class CappedLaunchSource implements LaunchSource {
  constructor(private readonly inner: LaunchSource, private readonly syntheticHead: bigint) {}
  async getHeadBlockNumber() { return this.syntheticHead; }
  getBlockHash(blockNumber: bigint) { return this.inner.getBlockHash(blockNumber); }
  assertAuthority(blockNumber: bigint) { return this.inner.assertAuthority(blockNumber); }
  catchUp(fromBlock: bigint, toBlock: bigint) { return this.inner.catchUp(fromBlock, toBlock); }
}

const start = JSON.parse(readFileSync(START_RECEIPT_PATH, 'utf8')) as StartReceipt;
validateStart(start);

const startedAtMs = Date.parse(start.startedAt);
const endAtMs = startedAtMs + start.windowHours * 60 * 60 * 1000;
if (!ALLOW_EARLY && Date.now() < endAtMs) {
  throw new Error(`EXPERIMENT_WINDOW_NOT_MATURE:endAt=${new Date(endAtMs).toISOString()}`);
}

const client = createPublicClient({
  chain: arcMainnet(RPC_URL),
  transport: http(RPC_URL, { timeout: 20_000, retryCount: 3, retryDelay: 750 })
});
const chainId = await retryTransient(() => client.getChainId());
if (chainId !== ARC_CHAIN_ID || chainId !== start.chainId) {
  throw new Error(`ARC_CHAIN_ID_DRIFT:expected=${start.chainId}:actual=${chainId}`);
}

const startBlock = BigInt(start.startBlock);
const canonicalStart = await retryTransient(() => client.getBlock({ blockNumber: startBlock }));
if (!canonicalStart.hash || canonicalStart.hash.toLowerCase() !== start.startBlockHash.toLowerCase()) {
  throw new Error(`EXPERIMENT_START_BLOCK_DRIFT:block=${startBlock}`);
}

const targetEndSeconds = BigInt(Math.floor(endAtMs / 1000));
const head = await retryTransient(() => client.getBlock({ blockTag: 'latest' }));
if (!head.hash) throw new Error('ARC_HEAD_HASH_MISSING');
if (head.timestamp < targetEndSeconds && !ALLOW_EARLY) {
  throw new Error(`EXPERIMENT_CHAIN_TIME_NOT_MATURE:headTimestamp=${head.timestamp}:target=${targetEndSeconds}`);
}

const searchTargetSeconds = ALLOW_EARLY && head.timestamp < targetEndSeconds ? head.timestamp : targetEndSeconds;
const endBlock = await findLastBlockAtOrBefore(client, startBlock, head.number, searchTargetSeconds);
const canonicalEnd = await retryTransient(() => client.getBlock({ blockNumber: endBlock }));
if (!canonicalEnd.hash) throw new Error(`EXPERIMENT_END_BLOCK_HASH_MISSING:block=${endBlock}`);

const dir = mkdtempSync(join(tmpdir(), 'binrat-hot-garbage-'));
const store = new SqliteStore(join(dir, 'window.sqlite'), ARC_CHAIN_ID);

try {
  const baseSource = new ArcPadLaunchSource({ client });
  const retrying = new RetryingLaunchSource(baseSource);
  const source = new CappedLaunchSource(retrying, endBlock + CONFIRMATIONS);
  const sync = await syncLaunches(source, store, {
    startBlock: startBlock + 1n,
    confirmations: CONFIRMATIONS,
    maxBatchBlocks: BATCH_BLOCKS,
    reorgLookbackBlocks: 32n,
    pollIntervalMs: 2_000
  });

  const launches = await store.listLaunches();
  if (launches.some((launch) => launch.blockNumber <= startBlock || launch.blockNumber > endBlock)) {
    throw new Error('EXPERIMENT_WINDOW_LEAK');
  }

  const apiSnapshot = await fetchArcPadWindow(startBlock, endBlock);
  const metrics = computeHotGarbageMetrics(launches);
  const reconciliation = reconcileTokenSets(
    launches.map((launch) => launch.token),
    apiSnapshot.tokens
  );
  const decision = decideHotGarbage(metrics.launchCount);

  const report = {
    schemaVersion: 'binrat.hot-garbage-72h.result.v0',
    finalizedAt: new Date().toISOString(),
    preregistration: {
      startedAt: start.startedAt,
      targetEndedAt: new Date(endAtMs).toISOString(),
      windowHours: start.windowHours,
      startBlock: startBlock.toString(),
      startBlockHash: start.startBlockHash.toLowerCase()
    },
    end: {
      blockNumber: endBlock.toString(),
      blockHash: canonicalEnd.hash.toLowerCase(),
      blockTimestamp: new Date(Number(canonicalEnd.timestamp) * 1000).toISOString(),
      observedHeadBlock: head.number.toString(),
      observedHeadHash: head.hash.toLowerCase()
    },
    reconstruction: {
      batchBlocks: BATCH_BLOCKS.toString(),
      sync,
      indexedLaunches: launches.length
    },
    metrics,
    reconciliation: {
      ...reconciliation,
      arcPadApiState: apiSnapshot.state,
      arcPadApiServedAt: apiSnapshot.servedAt,
      pagesRead: apiSnapshot.pagesRead
    },
    gates: {
      captureGatePercent: 99,
      captureGatePass: reconciliation.onchainCapturePercentAgainstApi >= 99 && reconciliation.apiCapturePercentAgainstOnchain >= 99,
      volumeDecision: decision
    },
    decision,
    claimBoundary: 'Creator repetition means repeated ArcPad TokenCreated events reporting the same creator address. It is not proof of human identity, EOA ownership, coordinated control, or ultimate deploying actor.'
  };

  process.stdout.write(`${JSON.stringify(report, bigintReplacer, 2)}\n`);
} finally {
  store.close();
  rmSync(dir, { recursive: true, force: true });
}

async function findLastBlockAtOrBefore(
  rpc: PublicClient,
  startBlock: bigint,
  headBlock: bigint,
  targetTimestamp: bigint
): Promise<bigint> {
  let low = startBlock;
  let high = headBlock;
  while (low < high) {
    const mid = (low + high + 1n) / 2n;
    const block = await retryTransient(() => rpc.getBlock({ blockNumber: mid }));
    if (block.timestamp <= targetTimestamp) low = mid;
    else high = mid - 1n;
  }
  return low;
}

async function fetchArcPadWindow(startBlock: bigint, endBlock: bigint): Promise<{
  tokens: Hex[];
  state: string | null;
  servedAt: number | null;
  pagesRead: number;
}> {
  const tokens: Hex[] = [];
  let after: string | number | null = null;
  let state: string | null = null;
  let servedAt: number | null = null;
  let pagesRead = 0;

  for (;;) {
    const url = new URL('/api/tokens', ARCPAD_API);
    url.searchParams.set('limit', '200');
    if (after !== null) url.searchParams.set('after', String(after));
    const page = await retryTransient(() => fetchJson<ArcPadTokensPage>(url));
    pagesRead += 1;
    if (pagesRead > 100) throw new Error('ARCPAD_API_PAGINATION_LIMIT_EXCEEDED');
    state = typeof page.state === 'string' ? page.state : state;
    servedAt = typeof page.servedAt === 'number' ? page.servedAt : servedAt;

    for (const creation of page.creations ?? []) {
      if (typeof creation.token !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(creation.token)) continue;
      const blockNumber = parseBlockNumber(creation.blockNumber);
      if (blockNumber !== null && blockNumber > startBlock && blockNumber <= endBlock) {
        tokens.push(creation.token.toLowerCase() as Hex);
      }
    }

    if (page.nextAfter === null || page.nextAfter === undefined || page.nextAfter === '') break;
    after = page.nextAfter;
  }

  return { tokens, state, servedAt, pagesRead };
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP_${response.status}:${url}`);
  return response.json() as Promise<T>;
}

async function retryTransient<T>(operation: () => Promise<T>, attempts = 6): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      last = error;
      if (!isTransient(error) || attempt === attempts) throw error;
      await sleep(Math.min(10_000, 500 * 2 ** (attempt - 1)));
    }
  }
  throw last;
}

function isTransient(error: unknown): boolean {
  const message = String(error).toLowerCase();
  return [
    '429', '502', '503', '504', 'rate limit', 'timeout', 'timed out', 'fetch failed',
    'econnreset', 'socket hang up', 'network', 'temporarily unavailable'
  ].some((fragment) => message.includes(fragment));
}

function validateStart(value: StartReceipt): void {
  if (value.schemaVersion !== 'binrat.hot-garbage-72h.prereg.v0') throw new Error('START_SCHEMA_UNSUPPORTED');
  if (value.chainId !== ARC_CHAIN_ID) throw new Error(`START_CHAIN_ID_INVALID:${value.chainId}`);
  if (value.launcher.toLowerCase() !== ARCPAD_LAUNCHER.toLowerCase()) throw new Error(`START_LAUNCHER_INVALID:${value.launcher}`);
  if (!Number.isFinite(value.windowHours) || value.windowHours <= 0) throw new Error('START_WINDOW_INVALID');
  if (!/^0x[0-9a-fA-F]{64}$/.test(value.startBlockHash)) throw new Error('START_BLOCK_HASH_INVALID');
  if (!/^0x[0-9a-fA-F]{40}$/.test(value.launcher)) throw new Error('START_LAUNCHER_FORMAT_INVALID');
  if (!/^\d+$/.test(value.startBlock)) throw new Error('START_BLOCK_INVALID');
  if (!Number.isFinite(Date.parse(value.startedAt))) throw new Error('START_TIME_INVALID');
}

function parseBlockNumber(value: string | number | undefined): bigint | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
