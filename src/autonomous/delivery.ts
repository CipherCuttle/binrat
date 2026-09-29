import type { D1DatabaseLike } from '../cloudflare/d1Types.js';
import { D1RuntimeStateStore } from '../cloudflare/runtimeState.js';
import { authoritativeCheckpoint, evidenceForLaunch, saveCase, why } from './evidence.js';
import { attentionDecision, makeReceipt, renderReceipt, type Receipt } from './model.js';
import type { WatchSource } from './source.js';
import type { WatchRow } from './watches.js';

interface Candidate extends WatchRow { launch_id: string }
interface Outbox {
  delivery_id: string; case_id: string; user_id: number; chat_id: number;
  launch_id: string; block_hash: string; watch_generation: string; watch_start_block: number;
}

export async function enqueueFindings(db: D1DatabaseLike, now: number): Promise<number> {
  const pons = await new D1RuntimeStateStore(db, 4663).get();
  const chainId = pons ? 4663 : 5042;
  const tip = await authoritativeCheckpoint(db, now, chainId);
  const candidates = await db.prepare(`SELECT w.*,l.launch_id FROM rat_v1_watches w
    JOIN launches l ON l.chain_id=w.chain_id AND l.creator=w.entity_id
    WHERE w.enabled=1 AND w.chain_id=? AND w.entity_type='CREATOR'
    AND CAST(l.block_number AS INTEGER)>w.start_block AND CAST(l.block_number AS INTEGER)<=?
    AND l.observed_at_ms>w.created_at_ms
    AND NOT EXISTS(SELECT 1 FROM rat_v1_outbox o WHERE o.user_id=w.user_id AND o.chat_id=w.chat_id
      AND o.chain_id=l.chain_id AND o.observation_id=l.event_id)
    ORDER BY CAST(l.block_number AS INTEGER),l.log_index,w.user_id LIMIT 50`)
    .bind(chainId, Number(tip)).all<Candidate>();
  if (!candidates.success) throw new Error('ATTENTION_READ_FAILED');
  const shared = new Map<string, Receipt>();
  let enqueued = 0;
  for (const candidate of candidates.results ?? []) {
    let receipt = shared.get(candidate.launch_id);
    if (!receipt) {
      let ref;
      try { ref = await evidenceForLaunch(db,candidate.launch_id,tip,chainId); }
      catch { continue; } // Missing source evidence never creates a claim.
      receipt = await saveCase(db,await makeReceipt(
        { chainId,entityType:'CREATOR',entityId:ref.creator },[ref],ref.blockNumber,now,'CREATOR_LAUNCH_OBSERVED'));
      shared.set(candidate.launch_id,receipt);
    }
    if (attentionDecision(true,true) !== 'ALERT') continue;
    const ref = receipt.evidenceRefs[0]!;
    const result = await db.prepare(`INSERT OR IGNORE INTO rat_v1_outbox
      (delivery_id,observation_id,finding_id,case_id,chain_id,launch_id,block_hash,user_id,chat_id,
       watch_generation,watch_start_block,watch_created_at_ms,attention,reason,state,created_at_ms)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,'ALERT','EXPLICIT_FUTURE_CREATOR_RECURRENCE','PENDING',?
      WHERE EXISTS(SELECT 1 FROM rat_v1_watches WHERE generation=? AND enabled=1)
      AND EXISTS(SELECT 1 FROM launches WHERE launch_id=? AND chain_id=? AND block_hash=?)`)
      .bind(crypto.randomUUID(),ref.observationId,receipt.findingId,receipt.caseId,chainId,ref.launchId,ref.blockHash,
        candidate.user_id,candidate.chat_id,candidate.generation,candidate.start_block,candidate.created_at_ms,now,
        candidate.generation,ref.launchId,chainId,ref.blockHash).run();
    if (!result.success) throw new Error('OUTBOX_WRITE_FAILED');
    enqueued += Number(result.meta?.changes ?? 0);
  }
  return enqueued;
}

export async function deliverFindings(
  db: D1DatabaseLike, source: WatchSource, token: string, externalFetch: typeof fetch, now: () => number
): Promise<number> {
  const pendingChain = await db.prepare(`SELECT chain_id FROM rat_v1_outbox WHERE state='PENDING'
    ORDER BY created_at_ms,delivery_id LIMIT 1`).first<{ chain_id: number }>();
  if (!pendingChain) return 0;
  const chainId = pendingChain.chain_id;
  const tip = await authoritativeCheckpoint(db,now(),chainId);
  const checkpoint = await db.prepare('SELECT block_hash FROM chain_checkpoints WHERE chain_id=?').bind(chainId)
    .first<{ block_hash: string }>();
  if (!checkpoint || (await source.point(tip)).hash !== checkpoint.block_hash) throw new Error('SOURCE_REORG');
  const pending = await db.prepare(`SELECT * FROM rat_v1_outbox WHERE state='PENDING' AND chain_id=?
    ORDER BY created_at_ms,delivery_id LIMIT 5`).bind(chainId).all<Outbox>();
  if (!pending.success) throw new Error('OUTBOX_READ_FAILED');
  // Shared block reads within the cycle, not one chain-history scan per user.
  const points = new Map<string,{hash:string;timestampMs:number}>();
  const canonicalPoint = async (block: bigint): Promise<{hash:string;timestampMs:number}> => {
    const key = block.toString();
    if (!points.has(key)) points.set(key,await source.point(block));
    return points.get(key)!;
  };
  let sent = 0;
  for (const item of pending.results ?? []) {
    const watch = await db.prepare('SELECT * FROM rat_v1_watches WHERE generation=? AND enabled=1')
      .bind(item.watch_generation).first<WatchRow>();
    if (!watch) { await cancel(db,item.delivery_id); continue; }
    if ((await canonicalPoint(BigInt(watch.start_block))).hash !== watch.start_hash) {
      await db.batch([
        db.prepare('UPDATE rat_v1_watches SET enabled=0 WHERE generation=?').bind(watch.generation),
        db.prepare("UPDATE rat_v1_outbox SET state='CANCELLED' WHERE watch_generation=? AND state='PENDING'")
          .bind(watch.generation)
      ]);
      continue;
    }
    let receipt: Receipt;
    try { receipt = await why(db,item.case_id,now()); }
    catch { await cancel(db,item.delivery_id); continue; }
    const ref = receipt.evidenceRefs[0]!;
    const eventPoint = await canonicalPoint(BigInt(ref.blockNumber));
    // A recently stale head can still be behind an event that predates opt-in.
    // Ingestion time cannot prove recency; verify source block time too.
    if (eventPoint.hash !== ref.blockHash || !Number.isSafeInteger(eventPoint.timestampMs) ||
        eventPoint.timestampMs <= watch.created_at_ms || eventPoint.timestampMs > now()+15_000) {
      await cancel(db,item.delivery_id); continue;
    }
    const text = renderReceipt(receipt,'ALERT');
    if (text.length > 4096) throw new Error('ALERT_TOO_LONG');
    // Linearization point: both replays and concurrent consumers lose this CAS.
    // Once claimed we never auto-resend, including crash-after-send-before-SENT.
    const claim = await db.prepare(`UPDATE rat_v1_outbox SET state='SENDING',attempt_count=attempt_count+1,last_attempt_ms=?,event_timestamp_ms=?
      WHERE delivery_id=? AND state='PENDING' AND attempt_count=0
      AND EXISTS(SELECT 1 FROM rat_v1_watches w WHERE w.generation=rat_v1_outbox.watch_generation AND w.enabled=1
        AND w.user_id=rat_v1_outbox.user_id AND w.chat_id=rat_v1_outbox.chat_id AND w.chain_id=rat_v1_outbox.chain_id)
      AND EXISTS(SELECT 1 FROM launches l JOIN provenance_facts f ON f.launch_id=l.launch_id AND f.chain_id=l.chain_id
        WHERE l.launch_id=rat_v1_outbox.launch_id AND l.chain_id=rat_v1_outbox.chain_id
        AND l.block_hash=rat_v1_outbox.block_hash AND f.evidence_digest=?)`)
      .bind(now(),eventPoint.timestampMs,item.delivery_id,ref.evidenceDigest).run();
    if (!claim.success) throw new Error('OUTBOX_CLAIM_FAILED');
    if (claim.meta?.changes !== 1) continue;
    let telegramId: number | null = null;
    let state: 'SENT' | 'UNKNOWN' | 'FAILED' = 'UNKNOWN';
    try {
      const response = await externalFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(8000),
        body:JSON.stringify({chat_id:item.chat_id,text,disable_web_page_preview:true})
      });
      const result = await response.json() as { ok?: boolean; result?: { message_id?: number } };
      if (response.ok && result.ok === true && Number.isSafeInteger(result.result?.message_id)) {
        telegramId = result.result!.message_id!; state = 'SENT';
      } else if (response.status >= 400 && response.status < 500 && result.ok === false) state = 'FAILED';
    } catch { /* Network/parse ambiguity is durable and is never retried automatically. */ }
    const complete = await db.prepare(`UPDATE rat_v1_outbox SET state=?,telegram_message_id=?
      WHERE delivery_id=? AND state='SENDING'`).bind(state,telegramId,item.delivery_id).run();
    if (!complete.success) throw new Error('OUTBOX_RECEIPT_WRITE_FAILED');
    if (state === 'SENT') sent += 1;
  }
  return sent;
}

async function cancel(db: D1DatabaseLike, id: string): Promise<void> {
  const result = await db.prepare("UPDATE rat_v1_outbox SET state='CANCELLED' WHERE delivery_id=? AND state='PENDING'").bind(id).run();
  if (!result.success) throw new Error('OUTBOX_CANCEL_FAILED');
}
