import type { ChainCheckpoint, Hex, LaunchObserved } from './types.js';
import type { ProvenanceEdge, ProvenanceFact } from '../intelligence/provenance.js';

export interface LaunchSource {
  getHeadBlockNumber(): Promise<bigint>;
  getBlockHash(blockNumber: bigint): Promise<Hex>;
  assertAuthority(blockNumber: bigint): Promise<void>;
  catchUp(fromBlock: bigint, toBlock: bigint): Promise<LaunchObserved[]>;
}

export interface LaunchStore {
  putLaunch(launch: LaunchObserved): Promise<'INSERTED' | 'DUPLICATE'>;
  getLaunch(launchId: string): Promise<LaunchObserved | null>;
  getLaunchByToken(token: Hex): Promise<LaunchObserved | null>;
  listLaunchesMissingProvenance(): Promise<LaunchObserved[]>;
  putProvenanceFact(fact: ProvenanceFact): Promise<'INSERTED' | 'DUPLICATE'>;
  listProvenanceFacts(): Promise<ProvenanceFact[]>;
  replaceProvenanceEdges(edges: ProvenanceEdge[]): Promise<void>;
  listProvenanceEdges(): Promise<ProvenanceEdge[]>;
  getCheckpoint(): Promise<ChainCheckpoint | null>;
  commitCheckpoint(checkpoint: Omit<ChainCheckpoint, 'chainId'>): Promise<void>;
  rewindFromBlock(blockNumber: bigint): Promise<void>;
  close(): void;
}
