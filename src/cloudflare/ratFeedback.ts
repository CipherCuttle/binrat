import type { D1DatabaseLike } from './d1Types.js';

const RETENTION_MS = 90 * 86_400_000;
const USER_DAILY_LIMIT = 3;
const GLOBAL_DAILY_LIMIT = 100;

export type RatFeedbackKind = 'BUG' | 'IDEA' | 'GENERAL';
export type RatFeedbackCommand =
  | { action: 'HELP' }
  | { action: 'DELETE' }
  | { action: 'SUBMIT'; kind: RatFeedbackKind; body: string };

export interface RatFeedbackReceipt {
  updateId: number;
  kind: RatFeedbackKind;
  state: 'SAVED' | 'ALREADY_SAVED' | 'USER_LIMIT' | 'GLOBAL_LIMIT';
}

const MIN_BODY_CHARS = 5;
const MAX_BODY_CHARS = 1200;

/** Intentionally opt-in: every stored user message must start with /feedback. */
export function parseRatFeedback(text: string): RatFeedbackCommand | null {
  const match = text.trim().match(/^\/feedback(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  let body = (match[1] ?? '').trim();
  if (!body || /^(?:help|privacy)$/i.test(body)) return { action: 'HELP' };
  if (/^(?:delete|forget|remove)$/i.test(body)) return { action: 'DELETE' };
  let kind: RatFeedbackKind = 'GENERAL';
  const category = body.match(/^(bug|idea|general)\s*[: -]\s*(.*)$/is);
  if (category) {
    kind = category[1]!.toUpperCase() as RatFeedbackKind;
    body = category[2]!.trim();
  }
  return { action: 'SUBMIT', kind, body };
}

export function validateRatFeedbackBody(body: string): 'OK' | 'TOO_SHORT' | 'TOO_LONG' | 'SENSITIVE' {
  if (body.length < MIN_BODY_CHARS) return 'TOO_SHORT';
  if (body.length > MAX_BODY_CHARS) return 'TOO_LONG';
  // Prevent the most common accidental credential disclosure; still show a privacy warning.
  if (/0x[0-9a-fA-F]{64}\b|(?:mnemonic|seed phrase|private key|password)\s*[:=]/i.test(body)) {
    return 'SENSITIVE';
  }
  return 'OK';
}

function validIds(updateId: number, chatId: number, userId: number): boolean {
  return Number.isSafeInteger(updateId) && updateId >= 0 &&
    Number.isSafeInteger(chatId) && Number.isSafeInteger(userId) && userId > 0;
}

/** D1 reservations are atomic under simultaneous submissions. No raw user text in logs. */
async function reserve(
  db: D1DatabaseLike, day: number, principal: string, limit: number
): Promise<boolean> {
  const result = await db.prepare(
    'INSERT INTO rat_feedback_budget(day_utc,principal,attempts) VALUES (?,?,1) ' +
    'ON CONFLICT(day_utc,principal) DO UPDATE SET attempts=rat_feedback_budget.attempts+1 ' +
    'WHERE rat_feedback_budget.attempts < ?'
  ).bind(day, principal, limit).run();
  if (!result.success) throw new Error('RAT_FEEDBACK_RATE_STORE_UNAVAILABLE');
  return result.meta?.changes === 1;
}

export async function saveRatFeedback(
  db: D1DatabaseLike,
  updateId: number, chatId: number, userId: number,
  kind: RatFeedbackKind, body: string, nowMs: number
): Promise<RatFeedbackReceipt> {
  if (!validIds(updateId, chatId, userId) || !Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error('RAT_FEEDBACK_ID_INVALID');
  }
  if (validateRatFeedbackBody(body) !== 'OK') throw new Error('RAT_FEEDBACK_BODY_INVALID');
  if (!['BUG', 'IDEA', 'GENERAL'].includes(kind)) throw new Error('RAT_FEEDBACK_KIND_INVALID');

  const existing = await db.prepare(
    'SELECT update_id,chat_id,user_id,kind FROM rat_feedback WHERE update_id=? LIMIT 1'
  ).bind(updateId).first<{ update_id: number; chat_id: number; user_id: number; kind: RatFeedbackKind }>();
  if (existing) {
    if (existing.user_id !== userId || existing.chat_id !== chatId) {
      throw new Error('RAT_FEEDBACK_UPDATE_CONFLICT');
    }
    return { updateId, kind: existing.kind, state: 'ALREADY_SAVED' };
  }

  const day = Math.floor(nowMs / 86_400_000);
  // Rejected per-user spam cannot consume the global pool.
  if (!(await reserve(db, day, 'USER:' + userId, USER_DAILY_LIMIT))) {
    return { updateId, kind, state: 'USER_LIMIT' };
  }
  if (!(await reserve(db, day, 'GLOBAL', GLOBAL_DAILY_LIMIT))) {
    return { updateId, kind, state: 'GLOBAL_LIMIT' };
  }
  const inserted = await db.prepare(
    'INSERT OR IGNORE INTO rat_feedback (update_id,chat_id,user_id,kind,body,created_at_ms) ' +
    'VALUES (?,?,?,?,?,?)'
  ).bind(updateId, chatId, userId, kind, body, nowMs).run();
  if (!inserted.success) throw new Error('RAT_FEEDBACK_WRITE_FAILED');
  if (inserted.meta?.changes !== 1) {
    const duplicate = await db.prepare(
      'SELECT user_id,chat_id FROM rat_feedback WHERE update_id=?'
    ).bind(updateId).first<{ user_id: number; chat_id: number }>();
    if (duplicate?.user_id === userId && duplicate.chat_id === chatId) {
      return { updateId, kind, state: 'ALREADY_SAVED' };
    }
    throw new Error('RAT_FEEDBACK_WRITE_CONFLICT');
  }
  return { updateId, kind, state: 'SAVED' };
}

/** Deletion is scoped to the sender's identity, never the entire Telegram group. */
export async function deleteRatFeedback(db: D1DatabaseLike, userId: number): Promise<number> {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('RAT_FEEDBACK_USER_INVALID');
  const result = await db.batch([
    db.prepare('DELETE FROM rat_feedback WHERE user_id=?').bind(userId),
    db.prepare('DELETE FROM rat_feedback_budget WHERE principal=?').bind('USER:' + userId)
  ]);
  if (result.some(item => !item.success)) throw new Error('RAT_FEEDBACK_DELETE_FAILED');
  return Number(result[0]?.meta?.changes ?? 0);
}

export async function pruneRatFeedback(db: D1DatabaseLike, nowMs: number): Promise<void> {
  if (!Number.isSafeInteger(nowMs) || nowMs < RETENTION_MS) return;
  const cutoffDay = Math.floor(nowMs / 86_400_000) - 2;
  const results = await db.batch([
    db.prepare('DELETE FROM rat_feedback WHERE created_at_ms < ?').bind(nowMs - RETENTION_MS),
    db.prepare('DELETE FROM rat_feedback_budget WHERE day_utc < ?').bind(cutoffDay)
  ]);
  if (results.some(item => !item.success)) throw new Error('RAT_FEEDBACK_PRUNE_FAILED');
}
