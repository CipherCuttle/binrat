import type { D1DatabaseLike } from '../cloudflare/d1Types.js';
import { D1Store } from '../cloudflare/d1Store.js';
import { D1RuntimeStateStore } from '../cloudflare/runtimeState.js';
import { buildProvenanceFact } from '../intelligence/provenance.js';
import { canonicalJson } from '../evidence/canonical.js';
import { makeReceipt, type Entity, type EvidenceRef, type Receipt } from './model.js';

export async function authoritativeCheckpoint(db: D1DatabaseLike, now: number, chainId = 5042): Promise<bigint> {
  const state = await new D1RuntimeStateStore(db, chainId).get();
  const checkpoint = await new D1Store(db, chainId).getCheckpoint();
  if (!state?.sourceVerified || !state.liveCaughtUp || state.lastSyncError || !checkpoint ||
      state.updatedAtMs > now || now - state.updatedAtMs > 180_000 ||
      state.targetBlock === null || checkpoint.blockNumber < state.targetBlock) {
    throw new Error('INDEX_UNAVAILABLE');
  }
  // Runtime target is the bounded verified snapshot. The durable checkpoint may
  // legitimately advance beyond it between reads; never treat that as unhealthy
  // and never expose evidence newer than the verified runtime target.
  return state.targetBlock;
}

export async function evidenceForLaunch(db: D1DatabaseLike, id: string, checkpoint: bigint, chainId = 5042): Promise<EvidenceRef> {
  const launch = await new D1Store(db, chainId).getLaunch(id);
  if (!launch || launch.chainId !== chainId || launch.blockNumber > checkpoint) {
    throw new Error('EVIDENCE_UNAVAILABLE');
  }
  const fact = await buildProvenanceFact(launch);
  const stored = await db.prepare('SELECT payload_json,evidence_digest FROM provenance_facts WHERE chain_id=? AND fact_id=? AND launch_id=?')
    .bind(chainId, fact.factId, id).first<{ payload_json: string; evidence_digest: string }>();
  if (!stored || stored.evidence_digest !== fact.evidenceDigest || stored.payload_json !== canonicalJson(fact)) {
    throw new Error('EVIDENCE_UNAVAILABLE');
  }
  return {
    launchId: id, observationId: launch.eventId, blockNumber: launch.blockNumber.toString(),
    blockHash: launch.blockHash, txHash: launch.txHash, logIndex: launch.logIndex,
    creator: launch.creator, token: launch.token, factId: fact.factId,
    evidenceDigest: fact.evidenceDigest, ingestedAtMs: launch.observedAtMs
  };
}

export async function saveCase(db: D1DatabaseLike, receipt: Receipt): Promise<Receipt> {
  const result = await db.prepare(`INSERT OR IGNORE INTO rat_v1_cases
    (case_id,share_id,chain_id,subject_type,subject_id,receipt_json,created_at_ms) VALUES (?,?,?,?,?,?,?)`)
    .bind(receipt.caseId, receipt.shareId, receipt.chainId, receipt.subject.entityType,
      receipt.subject.entityId, JSON.stringify(receipt), receipt.createdAt).run();
  if (!result.success) throw new Error('CASE_WRITE_FAILED');
  const row = await db.prepare('SELECT receipt_json FROM rat_v1_cases WHERE case_id=?').bind(receipt.caseId)
    .first<{ receipt_json: string }>();
  if (!row) throw new Error('CASE_WRITE_FAILED');
  return JSON.parse(row.receipt_json) as Receipt;
}

export async function dig(db: D1DatabaseLike, subject: Entity, now: number): Promise<Receipt> {
  if (subject.chainId !== 5042 && subject.chainId !== 4663) throw new Error('UNSUPPORTED_CHAIN');
  if (subject.entityType === 'WALLET') throw new Error('UNSUPPORTED_ENTITY');
  const tip = await authoritativeCheckpoint(db, now, subject.chainId);
  const column = subject.entityType === 'CREATOR' ? 'creator' : subject.entityType === 'TOKEN' ? 'token' : 'launch_id';
  const rows = await db.prepare(`SELECT launch_id FROM launches WHERE chain_id=? AND ${column}=?
    AND CAST(block_number AS INTEGER)<=? ORDER BY CAST(block_number AS INTEGER) DESC,log_index DESC,launch_id LIMIT 5`)
    .bind(subject.chainId, subject.entityId, Number(tip)).all<{ launch_id: string }>();
  if (!rows.success || !rows.results?.length) throw new Error('EVIDENCE_UNAVAILABLE');
  const refs: EvidenceRef[] = [];
  for (const row of rows.results) refs.push(await evidenceForLaunch(db, row.launch_id, tip, subject.chainId));
  return saveCase(db, await makeReceipt(subject, refs, tip.toString(), now));
}

export async function why(db: D1DatabaseLike, caseId: string, now: number): Promise<Receipt> {
  if (!/^[0-9a-f]{64}$/.test(caseId)) throw new Error('RECEIPT_UNAVAILABLE');
  const row = await db.prepare('SELECT receipt_json FROM rat_v1_cases WHERE case_id=?').bind(caseId)
    .first<{ receipt_json: string }>();
  if (!row) throw new Error('RECEIPT_UNAVAILABLE');
  const receipt = JSON.parse(row.receipt_json) as Receipt;
  if ((receipt.chainId !== 5042 && receipt.chainId !== 4663) || !Array.isArray(receipt.evidenceRefs) ||
      !receipt.evidenceRefs.length || receipt.evidenceRefs.length > 5) throw new Error('RECEIPT_UNAVAILABLE');
  const tip = await authoritativeCheckpoint(db, now, receipt.chainId);
  for (const ref of receipt.evidenceRefs) {
    const current = await evidenceForLaunch(db, ref.launchId, tip, receipt.chainId);
    if (canonicalJson(current) !== canonicalJson(ref)) throw new Error('RECEIPT_UNAVAILABLE');
  }
  const rebuilt = await makeReceipt(receipt.subject, receipt.evidenceRefs,
    receipt.coverage.asOfBlock, receipt.createdAt, receipt.claim, receipt.discovery);
  if (canonicalJson(rebuilt) !== canonicalJson(receipt) || receipt.caseId !== caseId) {
    throw new Error('RECEIPT_UNAVAILABLE');
  }
  return rebuilt;
}
