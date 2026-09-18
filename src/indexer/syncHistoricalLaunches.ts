import type { Hex, LaunchObserved } from '../core/types.js';
import type { LaunchSource, LaunchStore } from '../core/ports.js';
import { buildProvenanceFact, projectProvenanceEdges, type ProvenanceEdge, type ProvenanceFact } from '../intelligence/provenance.js';

export interface HistoricalBackfillStore extends LaunchStore {
  getHistoricalBackfillNextBlock(): Promise<bigint | null>;
  commitHistoricalBackfillBatch(
    launches: readonly LaunchObserved[],
    facts: readonly ProvenanceFact[],
    edges: readonly ProvenanceEdge[],
    nextBlock: bigint
  ): Promise<{ inserted: number; duplicates: number }>;
}

export interface HistoricalBackfillOptions {
  startBlock: bigint;
  endBlock: bigint;
  maxBatchBlocks: bigint;
}

export interface HistoricalBackfillReport {
  requestedStartBlock: bigint;
  requestedEndBlock: bigint;
  scannedStartBlock: bigint | null;
  scannedEndBlock: bigint | null;
  nextBlock: bigint;
  inserted: number;
  duplicates: number;
  complete: boolean;
}

export async function syncHistoricalLaunches(
  source: LaunchSource,
  store: HistoricalBackfillStore,
  options: HistoricalBackfillOptions
): Promise<HistoricalBackfillReport> {
  validateOptions(options);
  const persisted = await store.getHistoricalBackfillNextBlock();
  const nextBlock = persisted ?? options.startBlock;
  if (nextBlock < options.startBlock) {
    throw new Error(`HISTORY_CURSOR_BEFORE_START:cursor=${nextBlock}:start=${options.startBlock}`);
  }
  if (nextBlock > options.endBlock) {
    return {
      requestedStartBlock: options.startBlock,
      requestedEndBlock: options.endBlock,
      scannedStartBlock: null,
      scannedEndBlock: null,
      nextBlock,
      inserted: 0,
      duplicates: 0,
      complete: true
    };
  }

  const toBlock = minBigInt(options.endBlock, nextBlock + options.maxBatchBlocks - 1n);
  await source.assertAuthority(nextBlock);
  await source.assertAuthority(toBlock);

  const boundaryHashBefore = await source.getBlockHash(toBlock);
  const launches = await source.catchUp(nextBlock, toBlock);
  await assertLaunchBlocksStillCanonical(source, launches);
  const boundaryHashAfterRead = await source.getBlockHash(toBlock);
  if (!sameHex(boundaryHashBefore, boundaryHashAfterRead)) {
    throw new Error(`HISTORY_REORG_DURING_READ:block=${toBlock}`);
  }

  const facts = await Promise.all(launches.map((launch) => buildProvenanceFact(launch)));
  const boundaryHashBeforeWrite = await source.getBlockHash(toBlock);
  if (!sameHex(boundaryHashBefore, boundaryHashBeforeWrite)) {
    throw new Error(`HISTORY_REORG_BEFORE_WRITE:block=${toBlock}`);
  }

  const existingFacts = await store.listProvenanceFacts();
  const mergedFacts = new Map(existingFacts.map((fact) => [fact.factId, fact] as const));
  for (const fact of facts) mergedFacts.set(fact.factId, fact);
  const edges = await projectProvenanceEdges([...mergedFacts.values()]);

  const followingBlock = toBlock + 1n;
  const committed = await store.commitHistoricalBackfillBatch(launches, facts, edges, followingBlock);

  return {
    requestedStartBlock: options.startBlock,
    requestedEndBlock: options.endBlock,
    scannedStartBlock: nextBlock,
    scannedEndBlock: toBlock,
    nextBlock: followingBlock,
    inserted: committed.inserted,
    duplicates: committed.duplicates,
    complete: followingBlock > options.endBlock
  };
}

async function assertLaunchBlocksStillCanonical(source: LaunchSource, launches: LaunchObserved[]): Promise<void> {
  const hashes = new Map<bigint, Hex>();
  for (const launch of launches) {
    let canonical = hashes.get(launch.blockNumber);
    if (!canonical) {
      canonical = await source.getBlockHash(launch.blockNumber);
      hashes.set(launch.blockNumber, canonical);
    }
    if (!sameHex(canonical, launch.blockHash)) {
      throw new Error(`HISTORY_LAUNCH_REORG:block=${launch.blockNumber}`);
    }
  }
}

function validateOptions(options: HistoricalBackfillOptions): void {
  if (options.startBlock < 0n) throw new Error('history startBlock must be >= 0');
  if (options.endBlock < options.startBlock) throw new Error('history endBlock must be >= startBlock');
  if (options.maxBatchBlocks < 1n) throw new Error('history maxBatchBlocks must be >= 1');
}

function sameHex(a: Hex, b: Hex): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
