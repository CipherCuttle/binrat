import type { D1DatabaseLike } from '../cloudflare/d1Types.js';
import { assertPrincipal, type Capacity, type Principal } from './entitlements.js';
import { entityKey, type Entity } from './model.js';
import { authoritativeCheckpoint, dig } from './evidence.js';
import type { WatchSource } from './source.js';

export interface WatchRow {
  user_id: number; chat_id: number; chain_id: number; entity_type: 'CREATOR'; entity_id: string;
  generation: string; enabled: number; start_block: number; start_hash: string;
  created_at_ms: number; last_update_id: number; policy: 'CREATOR_RECURRENCE_V1';
}

export async function commandReplay(db: D1DatabaseLike, p: Principal, updateId: number): Promise<string | null> {
  assertPrincipal(p);
  if (!Number.isSafeInteger(updateId) || updateId < 0) throw new Error('INVALID_UPDATE_ID');
  const row = await db.prepare('SELECT user_id,chat_id,reply FROM rat_v1_commands WHERE update_id=?')
    .bind(updateId).first<{ user_id: number; chat_id: number; reply: string }>();
  if (row && (row.user_id !== p.userId || row.chat_id !== p.chatId)) throw new Error('COMMAND_AUTHORITY_MISMATCH');
  return row?.reply ?? null;
}

export async function reserveDig(db: D1DatabaseLike, p: Principal, updateId: number, now: number, capacity: Readonly<Capacity>): Promise<boolean> {
  assertPrincipal(p);
  const day = Math.floor(now / 86_400_000);
  const result = await db.prepare(`INSERT OR IGNORE INTO rat_v1_dig_requests (update_id,user_id,day_utc)
    SELECT ?,?,? WHERE (SELECT COUNT(*) FROM rat_v1_dig_requests WHERE day_utc=? AND user_id=?)<?
    AND (SELECT COUNT(*) FROM rat_v1_dig_requests WHERE day_utc=?)<?`)
    .bind(updateId, p.userId, day, day, p.userId, capacity.digsPerDay, day, capacity.globalDigsPerDay).run();
  if (!result.success) throw new Error('QUOTA_UNAVAILABLE');
  const row = await db.prepare('SELECT user_id,day_utc FROM rat_v1_dig_requests WHERE update_id=?')
    .bind(updateId).first<{ user_id: number; day_utc: number }>();
  return row?.user_id === p.userId && row.day_utc === day;
}

export async function listWatches(db: D1DatabaseLike, p: Principal): Promise<WatchRow[]> {
  assertPrincipal(p);
  const result = await db.prepare(`SELECT * FROM rat_v1_watches WHERE user_id=? AND chat_id=? AND enabled=1
    ORDER BY chain_id,entity_id LIMIT 25`).bind(p.userId, p.chatId).all<WatchRow>();
  if (!result.success) throw new Error('WATCH_UNAVAILABLE');
  return result.results ?? [];
}

export async function mutateWatch(
  db: D1DatabaseLike, p: Principal, updateId: number, target: Entity,
  action: 'WATCH' | 'UNWATCH', capacity: Readonly<Capacity>, now: number, source: WatchSource
): Promise<string> {
  const replay = await commandReplay(db, p, updateId);
  if (replay !== null) return replay;
  // Explicit historical targets remain reconstructible; bare/default targets are 4663.
  if (target.chainId !== 4663 && target.chainId !== 5042) throw new Error('UNSUPPORTED_CHAIN');
  if (target.entityType !== 'CREATOR') throw new Error('WATCH_CREATOR_ONLY');
  const old = await db.prepare(`SELECT * FROM rat_v1_watches WHERE user_id=? AND chat_id=?
    AND chain_id=? AND entity_type=? AND entity_id=?`)
    .bind(p.userId, p.chatId, target.chainId, target.entityType, target.entityId).first<WatchRow>();
  let start = old?.start_block ?? 0;
  let hash = old?.start_hash ?? '';
  // An already enabled identical watch is a state no-op.  It is still recorded
  // against this update id (so stale updates remain ordered), but crucially it
  // must not reserve research, re-read evidence, call RPC, or move its boundary.
  if (action === 'WATCH' && old?.enabled === 1) {
    const results = await db.batch([
      db.prepare(`UPDATE rat_v1_watches SET last_update_id=?
        WHERE user_id=? AND chat_id=? AND chain_id=? AND entity_type=? AND entity_id=?
          AND enabled=1 AND last_update_id<?`)
        .bind(updateId,p.userId,p.chatId,target.chainId,target.entityType,target.entityId,updateId),
      db.prepare(`INSERT OR IGNORE INTO rat_v1_commands(update_id,user_id,chat_id,reply,created_at_ms)
        SELECT ?,?,?,CASE WHEN (SELECT last_update_id FROM rat_v1_watches WHERE user_id=? AND chat_id=?
          AND chain_id=? AND entity_type=? AND entity_id=?)>? THEN
          '🐀 superseded by a newer watch command; no change.'
        ELSE '🐀 already watching ${entityKey(target)}. Existing watch boundary preserved.' END,?`)
        .bind(updateId,p.userId,p.chatId,p.userId,p.chatId,target.chainId,target.entityType,target.entityId,updateId,now)
    ]);
    if (results.some(r => !r.success)) throw new Error('WATCH_WRITE_FAILED');
    const reply = await commandReplay(db,p,updateId);
    if (reply === null) throw new Error('WATCH_WRITE_FAILED');
    return reply;
  }
  if (action === 'WATCH') {
    // WATCH performs an investigation and a bounded RPC read, so it shares the
    // neutral research budget. Unwatch and receipt access never consume it.
    if (!await reserveDig(db,p,updateId,now,capacity)) throw new Error('CAPACITY_REACHED');
    // Canonical creator evidence is mandatory. This bounded shared-index read never scans RPC history.
    await dig(db, target, now);
    const tip = await authoritativeCheckpoint(db, now, target.chainId);
    const head = await source.head().catch(() => { throw new Error('SOURCE_UNAVAILABLE'); });
    if (head.chainId !== target.chainId || head.block < tip || head.block > BigInt(Number.MAX_SAFE_INTEGER) ||
        !/^0x[0-9a-f]{64}$/.test(head.hash) || !Number.isSafeInteger(head.timestampMs) ||
        head.timestampMs > now + 15_000 || now - head.timestampMs > 60_000) throw new Error('SOURCE_UNAVAILABLE');
    start = Number(head.block); hash = head.hash;
  }
  const enabled = action === 'WATCH' ? 1 : 0;
  const generation = crypto.randomUUID();
  // Every mutation and its replay receipt commit together. Tombstones order out-of-order
  // Telegram updates too, including an unwatch arriving before the original watch commits.
  const results = await db.batch([
    db.prepare(`INSERT INTO rat_v1_watches
      (user_id,chat_id,chain_id,entity_type,entity_id,generation,enabled,start_block,start_hash,created_at_ms,last_update_id,policy)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,'CREATOR_RECURRENCE_V1'
      WHERE NOT EXISTS(SELECT 1 FROM rat_v1_commands WHERE update_id=?)
      AND (?=0 OR EXISTS(SELECT 1 FROM rat_v1_watches WHERE user_id=? AND chat_id=? AND chain_id=?
        AND entity_type=? AND entity_id=? AND enabled=1)
        OR (SELECT COUNT(*) FROM rat_v1_watches WHERE user_id=? AND enabled=1)<?)
      ON CONFLICT(user_id,chat_id,chain_id,entity_type,entity_id) DO UPDATE SET
        enabled=excluded.enabled,last_update_id=excluded.last_update_id,
        generation=CASE WHEN rat_v1_watches.enabled=1 AND excluded.enabled=1 THEN rat_v1_watches.generation ELSE excluded.generation END,
        start_block=CASE WHEN rat_v1_watches.enabled=1 THEN rat_v1_watches.start_block ELSE excluded.start_block END,
        start_hash=CASE WHEN rat_v1_watches.enabled=1 THEN rat_v1_watches.start_hash ELSE excluded.start_hash END,
        created_at_ms=CASE WHEN rat_v1_watches.enabled=1 THEN rat_v1_watches.created_at_ms ELSE excluded.created_at_ms END
      WHERE excluded.last_update_id>rat_v1_watches.last_update_id`)
      .bind(p.userId,p.chatId,target.chainId,target.entityType,target.entityId,generation,enabled,start,hash,now,updateId,
        updateId,enabled,p.userId,p.chatId,target.chainId,target.entityType,target.entityId,p.userId,capacity.watchLimit),
    db.prepare(`UPDATE rat_v1_outbox SET state='CANCELLED' WHERE user_id=? AND chat_id=? AND state='PENDING'
      AND NOT EXISTS(SELECT 1 FROM rat_v1_watches w WHERE w.generation=rat_v1_outbox.watch_generation AND w.enabled=1)`)
      .bind(p.userId,p.chatId),
    db.prepare(`INSERT OR IGNORE INTO rat_v1_commands(update_id,user_id,chat_id,reply,created_at_ms)
      SELECT ?,?,?,CASE
        WHEN EXISTS(SELECT 1 FROM rat_v1_watches WHERE user_id=? AND chat_id=? AND chain_id=? AND entity_type=? AND entity_id=? AND last_update_id>?)
          THEN '🐀 superseded by a newer watch command; no change.'
        WHEN ?=0 THEN ?
        WHEN EXISTS(SELECT 1 FROM rat_v1_watches WHERE user_id=? AND chat_id=? AND chain_id=? AND entity_type=? AND entity_id=? AND enabled=1)
          THEN ?
        ELSE '🐀 watch limit reached (FREE: 25). No watch added.' END,?`)
      .bind(updateId,p.userId,p.chatId,p.userId,p.chatId,target.chainId,target.entityType,target.entityId,updateId,
        enabled,`🐀 stopped watching ${entityKey(target)}. Pending notifications suppressed.`,
        p.userId,p.chatId,target.chainId,target.entityType,target.entityId,
        `🐀 watch armed.\n${entityKey(target)}\nFuture launches only, after block ${start}. Existing watches keep their original boundary.\nSame address != same human identity.`,now)
  ]);
  if (results.some(r => !r.success)) throw new Error('WATCH_WRITE_FAILED');
  const reply = await commandReplay(db,p,updateId);
  if (reply === null) throw new Error('WATCH_WRITE_FAILED');
  return reply;
}
