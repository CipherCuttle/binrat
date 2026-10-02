import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import type { PonsReplayLaunchSnapshot, PonsReplaySnapshot } from './replayLab.js';

export const PONS_REPLAY_RECEIPT_VERSION='BINRAT_PONS_REPLAY_RECEIPT_V1' as const;

export type PonsReplayEvidenceKind='PROVENANCE'|'TOKEN_IDENTITY'|'OUTCOME';

export interface PonsReplayEvidenceRef {
  kind:PonsReplayEvidenceKind;
  launchId:string;
  evidenceId:string;
  evidenceDigest:string;
  observedBlock:string|null;
}

export interface PonsReplayReceipt {
  receiptVersion:typeof PONS_REPLAY_RECEIPT_VERSION;
  replayVersion:PonsReplaySnapshot['replayVersion'];
  chainId:PonsReplaySnapshot['chainId'];
  semantics:PonsReplaySnapshot['semantics'];
  targetLaunchId:string;
  asOfBlock:string;
  asOfBlockHash:string;
  snapshotDigest:string;
  evidenceRefs:PonsReplayEvidenceRef[];
  receiptId:string;
}

export interface PonsReplayExportBundle {
  snapshot:PonsReplaySnapshot;
  receipt:PonsReplayReceipt;
}

export async function buildPonsReplayReceipt(
  snapshot:PonsReplaySnapshot
):Promise<PonsReplayReceipt> {
  await verifyPonsReplaySnapshotDigest(snapshot);
  const evidenceRefs=collectEvidenceRefs(snapshot);
  const material:Omit<PonsReplayReceipt,'receiptId'>={
    receiptVersion:PONS_REPLAY_RECEIPT_VERSION,
    replayVersion:snapshot.replayVersion,
    chainId:snapshot.chainId,
    semantics:snapshot.semantics,
    targetLaunchId:snapshot.targetLaunchId,
    asOfBlock:snapshot.asOfBlock,
    asOfBlockHash:snapshot.asOfBlockHash.toLowerCase(),
    snapshotDigest:snapshot.outputDigest,
    evidenceRefs
  };
  return {
    ...material,
    receiptId:'binrat-pons-replay:'+await sha256Hex(material)
  };
}

export async function buildPonsReplayExportBundle(
  snapshot:PonsReplaySnapshot
):Promise<PonsReplayExportBundle> {
  return {snapshot,receipt:await buildPonsReplayReceipt(snapshot)};
}

export async function verifyPonsReplayReceipt(
  snapshot:PonsReplaySnapshot,
  receipt:PonsReplayReceipt
):Promise<void> {
  const rebuilt=await buildPonsReplayReceipt(snapshot);
  if(canonicalJson(rebuilt)!==canonicalJson(receipt)) {
    throw new Error('PONS_REPLAY_RECEIPT_INVALID');
  }
}

export async function verifyPonsReplaySnapshotDigest(
  snapshot:PonsReplaySnapshot
):Promise<void> {
  assertReplaySnapshotBoundary(snapshot);
  const {outputDigest,...core}=snapshot;
  if(!/^[0-9a-f]{64}$/i.test(outputDigest)) throw new Error('PONS_REPLAY_SNAPSHOT_DIGEST_INVALID');
  const expected=await sha256Hex(core);
  if(expected!==outputDigest) throw new Error('PONS_REPLAY_SNAPSHOT_DIGEST_INVALID');
}

export function collectEvidenceRefs(
  snapshot:PonsReplaySnapshot
):PonsReplayEvidenceRef[] {
  const refs:PonsReplayEvidenceRef[]=[];
  if(snapshot.targetLaunch) collectLaunchEvidence(snapshot.targetLaunch,refs);
  for(const launch of snapshot.previousLaunches) collectLaunchEvidence(launch,refs);

  refs.sort((a,b)=>
    a.kind.localeCompare(b.kind) ||
    a.launchId.localeCompare(b.launchId) ||
    a.evidenceId.localeCompare(b.evidenceId)
  );

  const seen=new Set<string>();
  for(const ref of refs) {
    if(!/^[0-9a-f]{64}$/i.test(ref.evidenceDigest)) {
      throw new Error('PONS_REPLAY_EVIDENCE_DIGEST_INVALID:'+ref.evidenceId);
    }
    const key=ref.kind+':'+ref.launchId+':'+ref.evidenceId;
    if(seen.has(key)) throw new Error('PONS_REPLAY_EVIDENCE_DUPLICATE:'+key);
    seen.add(key);
  }
  return refs;
}

function collectLaunchEvidence(
  launch:PonsReplayLaunchSnapshot,
  refs:PonsReplayEvidenceRef[]
):void {
  if(launch.provenance.state==='OBSERVED') {
    if(!launch.provenance.factId||!launch.provenance.evidenceDigest) {
      throw new Error('PONS_REPLAY_PROVENANCE_REF_INVALID:'+launch.launchId);
    }
    refs.push({
      kind:'PROVENANCE',
      launchId:launch.launchId,
      evidenceId:launch.provenance.factId,
      evidenceDigest:launch.provenance.evidenceDigest,
      observedBlock:launch.launchBlock
    });
  }

  if(launch.tokenIdentity) {
    refs.push({
      kind:'TOKEN_IDENTITY',
      launchId:launch.launchId,
      evidenceId:launch.tokenIdentity.identityId,
      evidenceDigest:launch.tokenIdentity.evidenceDigest,
      observedBlock:launch.tokenIdentity.observedBlock
    });
  }

  for(const observation of launch.observations) {
    if(!observation.observationId) continue;
    if(!observation.evidenceDigest||!observation.observedBlock) {
      throw new Error('PONS_REPLAY_OUTCOME_REF_INVALID:'+launch.launchId+':'+observation.horizonLabel);
    }
    refs.push({
      kind:'OUTCOME',
      launchId:launch.launchId,
      evidenceId:observation.observationId,
      evidenceDigest:observation.evidenceDigest,
      observedBlock:observation.observedBlock
    });
  }
}


function assertReplaySnapshotBoundary(snapshot:PonsReplaySnapshot):void {
  if(!/^(0|[1-9][0-9]*)$/.test(snapshot.asOfBlock)) {
    throw new Error('PONS_REPLAY_RECEIPT_AS_OF_BLOCK_INVALID');
  }
  if(!/^0x[0-9a-f]{64}$/i.test(snapshot.asOfBlockHash)) {
    throw new Error('PONS_REPLAY_RECEIPT_AS_OF_HASH_INVALID');
  }
  const asOf=BigInt(snapshot.asOfBlock);

  if(snapshot.targetLaunchKnown !== (snapshot.targetLaunch !== null)) {
    throw new Error('PONS_REPLAY_RECEIPT_TARGET_VISIBILITY_INVALID');
  }
  if(snapshot.targetLaunch && snapshot.targetLaunch.launchId!==snapshot.targetLaunchId) {
    throw new Error('PONS_REPLAY_RECEIPT_TARGET_ID_MISMATCH');
  }

  const launches=[
    ...(snapshot.targetLaunch?[snapshot.targetLaunch]:[]),
    ...snapshot.previousLaunches
  ];
  const targetDeployer=snapshot.targetLaunch?.deployer.toLowerCase()??null;

  for(const launch of launches) {
    if(BigInt(launch.launchBlock)>asOf) {
      throw new Error('PONS_REPLAY_RECEIPT_FUTURE_LAUNCH:'+launch.launchId);
    }
    if(targetDeployer && launch.deployer.toLowerCase()!==targetDeployer) {
      throw new Error('PONS_REPLAY_RECEIPT_DEPLOYER_SCOPE_DRIFT:'+launch.launchId);
    }
    if(launch.tokenIdentity && BigInt(launch.tokenIdentity.observedBlock)>asOf) {
      throw new Error('PONS_REPLAY_RECEIPT_FUTURE_IDENTITY:'+launch.launchId);
    }
    for(const observation of launch.observations) {
      if(observation.observedBlock!==null && BigInt(observation.observedBlock)>asOf) {
        throw new Error('PONS_REPLAY_RECEIPT_FUTURE_OUTCOME:'+launch.launchId+':'+observation.horizonLabel);
      }
      if((observation.observationId===null)!==(observation.evidenceDigest===null)) {
        throw new Error('PONS_REPLAY_RECEIPT_OUTCOME_REF_INCOMPLETE:'+launch.launchId+':'+observation.horizonLabel);
      }
    }
  }
}
