import type { Hex, LaunchObserved } from '../core/types.js';
import { sha256Hex } from '../evidence/canonical.js';
import type { ProvenanceFact } from '../intelligence/provenance.js';
import {
  PUBLIC_FEED_SCHEMA_VERSION,
  PUBLIC_HISTORY_COVERAGE_V0,
  PUBLIC_PROJECTION_VERSION,
  type PublicBag,
  type PublicFeed,
  type PublicProjectionReceipt,
  type PublicTrashTrailItem
} from './types.js';

export interface PublicProjectionInput {
  chainId: number;
  asOfBlock: bigint;
  asOfBlockHash: Hex;
  launches: readonly LaunchObserved[];
  facts: readonly ProvenanceFact[];
}

export async function projectPublicFeed(input: PublicProjectionInput): Promise<PublicFeed> {
  const launches = [...input.launches].sort(compareLaunchesAscending);
  const facts = [...input.facts].sort(compareFactsAscending);

  validateInput(input, launches, facts);

  const factByLaunchId = new Map(facts.map((fact) => [fact.launchId, fact]));
  const launchesByCreator = new Map<string, LaunchObserved[]>();

  for (const launch of launches) {
    const key = creatorKey(launch.chainId, launch.creator);
    const bucket = launchesByCreator.get(key) ?? [];
    bucket.push(launch);
    launchesByCreator.set(key, bucket);
  }

  const bags: PublicBag[] = [];
  for (const launch of launches) {
    const fact = factByLaunchId.get(launch.launchId);
    if (!fact) throw new Error(`PUBLIC_PROVENANCE_MISSING:${launch.launchId}`);

    const priorLaunches = (launchesByCreator.get(creatorKey(launch.chainId, launch.creator)) ?? [])
      .filter((candidate) => compareLaunchOrder(candidate, launch) < 0);

    const prior = priorLaunches.map((candidate) => {
      const priorFact = factByLaunchId.get(candidate.launchId);
      if (!priorFact) throw new Error(`PUBLIC_PROVENANCE_MISSING:${candidate.launchId}`);
      return projectTrailItem(candidate, priorFact);
    });

    const evidence: PublicBag['evidence'] = [
      {
        state: 'OBSERVED',
        code: 'ARCPAD_REPORTED_CREATOR',
        text: 'ArcPad reported this address on the launch event.',
        sourceFactIds: [fact.factId]
      }
    ];

    if (prior.length > 0) {
      evidence.push({
        state: 'NOTED',
        code: 'REPORTED_CREATOR_PRIOR_LAUNCHES',
        text: `The same ArcPad-reported creator address appears on ${prior.length} earlier indexed launch${prior.length === 1 ? '' : 'es'} present in this projection input.`,
        sourceFactIds: [fact.factId, ...prior.map((item) => item.sourceFactId)]
      });
    } else {
      evidence.push({
        state: 'UNKNOWN',
        code: 'PRIOR_HISTORY_NOT_ESTABLISHED',
        text: 'No earlier matching launch is present in this projection input. PUBLIC_PROJECTION_V0 does not claim complete history coverage.',
        sourceFactIds: [fact.factId]
      });
    }

    evidence.push({
      state: 'UNKNOWN',
      code: 'OUTCOMES_NOT_PROJECTED_V0',
      text: 'Outcome, distribution, and sellability observations are not part of PUBLIC_PROJECTION_V0.',
      sourceFactIds: []
    });

    bags.push({
      id: launch.launchId,
      source: launch.source,
      token: launch.token.toLowerCase() as Hex,
      symbol: launch.symbol,
      name: launch.name,
      blockNumber: launch.blockNumber.toString(),
      blockHash: launch.blockHash.toLowerCase() as Hex,
      txHash: launch.txHash.toLowerCase() as Hex,
      logIndex: launch.logIndex,
      reportedCreatorAddress: launch.creator.toLowerCase() as Hex,
      pool: launch.pool.toLowerCase() as Hex,
      metadata: {
        imageUri: launch.imageUri,
        website: launch.website,
        twitter: launch.twitter,
        telegram: launch.telegram
      },
      trashTrail: {
        priorLaunchCount: prior.length,
        coverage: PUBLIC_HISTORY_COVERAGE_V0,
        prior
      },
      evidence
    });
  }

  bags.sort(compareBagsDescending);

  const inputMaterial = {
    projectionVersion: PUBLIC_PROJECTION_VERSION,
    chainId: input.chainId,
    asOfBlock: input.asOfBlock,
    asOfBlockHash: input.asOfBlockHash.toLowerCase(),
    historyCoverage: PUBLIC_HISTORY_COVERAGE_V0,
    launches: launches.map((launch) => ({
      launchId: launch.launchId,
      eventId: launch.eventId,
      blockNumber: launch.blockNumber,
      blockHash: launch.blockHash.toLowerCase(),
      txHash: launch.txHash.toLowerCase(),
      logIndex: launch.logIndex,
      token: launch.token.toLowerCase(),
      creator: launch.creator.toLowerCase(),
      pool: launch.pool.toLowerCase(),
      name: launch.name,
      symbol: launch.symbol,
      imageUri: launch.imageUri,
      website: launch.website,
      twitter: launch.twitter,
      telegram: launch.telegram
    })),
    facts: facts.map((fact) => ({ factId: fact.factId, evidenceDigest: fact.evidenceDigest }))
  };

  const outputMaterial = {
    schemaVersion: PUBLIC_FEED_SCHEMA_VERSION,
    chainId: input.chainId,
    asOfBlock: input.asOfBlock.toString(),
    asOfBlockHash: input.asOfBlockHash.toLowerCase(),
    historyCoverage: PUBLIC_HISTORY_COVERAGE_V0,
    bags
  };

  const inputDigest = await sha256Hex(inputMaterial);
  const outputDigest = await sha256Hex(outputMaterial);
  const receiptMaterial = {
    projectionVersion: PUBLIC_PROJECTION_VERSION,
    chainId: input.chainId,
    asOfBlock: input.asOfBlock,
    asOfBlockHash: input.asOfBlockHash.toLowerCase(),
    historyCoverage: PUBLIC_HISTORY_COVERAGE_V0,
    inputDigest,
    outputDigest
  };
  const receipt: PublicProjectionReceipt = {
    projectionVersion: PUBLIC_PROJECTION_VERSION,
    chainId: input.chainId,
    asOfBlock: input.asOfBlock.toString(),
    asOfBlockHash: input.asOfBlockHash.toLowerCase() as Hex,
    historyCoverage: PUBLIC_HISTORY_COVERAGE_V0,
    inputDigest,
    outputDigest,
    receiptId: `binrat-public:${await sha256Hex(receiptMaterial)}`
  };

  return { ...outputMaterial, asOfBlockHash: outputMaterial.asOfBlockHash as Hex, receipt };
}

function validateInput(input: PublicProjectionInput, launches: LaunchObserved[], facts: ProvenanceFact[]): void {
  if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0) throw new Error('PUBLIC_CHAIN_ID_INVALID');
  if (input.asOfBlock < 0n) throw new Error('PUBLIC_AS_OF_BLOCK_INVALID');
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.asOfBlockHash)) throw new Error('PUBLIC_AS_OF_BLOCK_HASH_INVALID');

  const factIds = new Set<string>();
  const factLaunchIds = new Set<string>();

  for (const launch of launches) {
    if (launch.chainId !== input.chainId) throw new Error(`PUBLIC_CHAIN_MISMATCH:${launch.launchId}`);
    if (launch.source !== 'ARCPAD') throw new Error(`PUBLIC_SOURCE_UNSUPPORTED:${launch.launchId}`);
    if (launch.blockNumber > input.asOfBlock) throw new Error(`PUBLIC_FUTURE_LAUNCH:${launch.launchId}`);
  }

  for (const fact of facts) {
    if (fact.chainId !== input.chainId) throw new Error(`PUBLIC_FACT_CHAIN_MISMATCH:${fact.factId}`);
    if (fact.observedBlock > input.asOfBlock) throw new Error(`PUBLIC_FUTURE_FACT:${fact.factId}`);
    if (factIds.has(fact.factId) || factLaunchIds.has(fact.launchId)) throw new Error(`PUBLIC_DUPLICATE_FACT:${fact.factId}`);
    factIds.add(fact.factId);
    factLaunchIds.add(fact.launchId);
  }

  const launchById = new Map(launches.map((launch) => [launch.launchId, launch]));
  for (const fact of facts) {
    const launch = launchById.get(fact.launchId);
    if (!launch) throw new Error(`PUBLIC_ORPHAN_FACT:${fact.factId}`);
    if (
      fact.creator.toLowerCase() !== launch.creator.toLowerCase() ||
      fact.observedBlock !== launch.blockNumber ||
      fact.observedBlockHash.toLowerCase() !== launch.blockHash.toLowerCase() ||
      fact.logIndex !== launch.logIndex ||
      fact.sourceEventId !== launch.eventId
    ) {
      throw new Error(`PUBLIC_FACT_AUTHORITY_MISMATCH:${fact.factId}`);
    }
  }
}

function projectTrailItem(launch: LaunchObserved, fact: ProvenanceFact): PublicTrashTrailItem {
  return {
    launchId: launch.launchId,
    token: launch.token.toLowerCase() as Hex,
    symbol: launch.symbol,
    name: launch.name,
    blockNumber: launch.blockNumber.toString(),
    blockHash: launch.blockHash.toLowerCase() as Hex,
    sourceFactId: fact.factId
  };
}

function creatorKey(chainId: number, creator: Hex): string {
  return `${chainId}:${creator.toLowerCase()}`;
}

function compareLaunchOrder(a: LaunchObserved, b: LaunchObserved): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  if (a.logIndex !== b.logIndex) return a.logIndex - b.logIndex;
  return a.launchId.localeCompare(b.launchId);
}

function compareLaunchesAscending(a: LaunchObserved, b: LaunchObserved): number {
  if (a.chainId !== b.chainId) return a.chainId - b.chainId;
  return compareLaunchOrder(a, b);
}

function compareFactsAscending(a: ProvenanceFact, b: ProvenanceFact): number {
  if (a.chainId !== b.chainId) return a.chainId - b.chainId;
  if (a.observedBlock !== b.observedBlock) return a.observedBlock < b.observedBlock ? -1 : 1;
  if (a.logIndex !== b.logIndex) return a.logIndex - b.logIndex;
  return a.factId.localeCompare(b.factId);
}

function compareBagsDescending(a: PublicBag, b: PublicBag): number {
  const aBlock = BigInt(a.blockNumber);
  const bBlock = BigInt(b.blockNumber);
  if (aBlock !== bBlock) return aBlock > bBlock ? -1 : 1;
  if (a.logIndex !== b.logIndex) return b.logIndex - a.logIndex;
  return b.id.localeCompare(a.id);
}
