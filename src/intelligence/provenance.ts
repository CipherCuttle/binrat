import type { Hex, LaunchObserved } from '../core/types.js';
import { sha256Hex } from '../evidence/canonical.js';

export const PROVENANCE_DERIVATION_VERSION = 'BINRAT_PROVENANCE_V0' as const;

export type ProvenanceFactKind = 'ARCPAD_REPORTED_CREATOR';
export type ProvenanceEdgeKind = 'REPORTED_CREATOR' | 'PREVIOUS_LAUNCH';
export type EvidenceClass = 'DIRECT_ONCHAIN' | 'DERIVED_ONCHAIN';

export interface ProvenanceFact {
  factId: string;
  kind: ProvenanceFactKind;
  chainId: number;
  launchId: string;
  creator: Hex;
  observedBlock: bigint;
  observedBlockHash: Hex;
  logIndex: number;
  sourceEventId: string;
  evidenceDigest: string;
}

export interface ProvenanceEdge {
  edgeId: string;
  kind: ProvenanceEdgeKind;
  chainId: number;
  from: string;
  to: string;
  evidenceClass: EvidenceClass;
  observedBlock: bigint;
  observedBlockHash: Hex;
  sourceFactIds: string[];
  derivationVersion: typeof PROVENANCE_DERIVATION_VERSION;
  evidenceDigest: string;
}

export async function buildProvenanceFact(launch: LaunchObserved): Promise<ProvenanceFact> {
  const creator = launch.creator.toLowerCase() as Hex;
  const observedBlockHash = launch.blockHash.toLowerCase() as Hex;
  const factId = `binrat-fact:${launch.chainId}:${launch.launchId}`;
  const payload = {
    factId,
    kind: 'ARCPAD_REPORTED_CREATOR' as const,
    chainId: launch.chainId,
    launchId: launch.launchId,
    creator,
    observedBlock: launch.blockNumber,
    observedBlockHash,
    logIndex: launch.logIndex,
    sourceEventId: launch.eventId
  };
  return { ...payload, evidenceDigest: await sha256Hex(payload) };
}

export async function projectProvenanceEdges(facts: readonly ProvenanceFact[]): Promise<ProvenanceEdge[]> {
  const ordered = [...facts].sort(compareFacts);
  const previousByCreator = new Map<string, ProvenanceFact>();
  const edges: ProvenanceEdge[] = [];

  for (const fact of ordered) {
    const launchNode = launchNodeId(fact);
    const creatorNode = creatorAddressNodeId(fact.chainId, fact.creator);
    edges.push(await buildEdge({
      edgeId: `reported-creator:${fact.factId}`,
      kind: 'REPORTED_CREATOR',
      chainId: fact.chainId,
      from: launchNode,
      to: creatorNode,
      evidenceClass: 'DIRECT_ONCHAIN',
      observedBlock: fact.observedBlock,
      observedBlockHash: fact.observedBlockHash,
      sourceFactIds: [fact.factId]
    }));

    const creatorKey = `${fact.chainId}:${fact.creator.toLowerCase()}`;
    const previous = previousByCreator.get(creatorKey);
    if (previous) {
      edges.push(await buildEdge({
        edgeId: `previous-launch:${fact.factId}:${previous.factId}`,
        kind: 'PREVIOUS_LAUNCH',
        chainId: fact.chainId,
        from: launchNode,
        to: launchNodeId(previous),
        evidenceClass: 'DERIVED_ONCHAIN',
        observedBlock: fact.observedBlock,
        observedBlockHash: fact.observedBlockHash,
        sourceFactIds: [fact.factId, previous.factId]
      }));
    }
    previousByCreator.set(creatorKey, fact);
  }

  return edges.sort(compareEdges);
}

function launchNodeId(fact: Pick<ProvenanceFact, 'chainId' | 'launchId'>): string {
  return `launch:${fact.chainId}:${fact.launchId}`;
}

function creatorAddressNodeId(chainId: number, creator: Hex): string {
  return `address:${chainId}:${creator.toLowerCase()}`;
}

async function buildEdge(input: Omit<ProvenanceEdge, 'derivationVersion' | 'evidenceDigest'>): Promise<ProvenanceEdge> {
  const payload = { ...input, derivationVersion: PROVENANCE_DERIVATION_VERSION };
  return { ...payload, evidenceDigest: await sha256Hex(payload) };
}

function compareFacts(a: ProvenanceFact, b: ProvenanceFact): number {
  if (a.chainId !== b.chainId) return a.chainId - b.chainId;
  if (a.observedBlock !== b.observedBlock) return a.observedBlock < b.observedBlock ? -1 : 1;
  if (a.logIndex !== b.logIndex) return a.logIndex - b.logIndex;
  return a.factId.localeCompare(b.factId);
}

function compareEdges(a: ProvenanceEdge, b: ProvenanceEdge): number {
  if (a.chainId !== b.chainId) return a.chainId - b.chainId;
  if (a.observedBlock !== b.observedBlock) return a.observedBlock < b.observedBlock ? -1 : 1;
  return a.edgeId.localeCompare(b.edgeId);
}
