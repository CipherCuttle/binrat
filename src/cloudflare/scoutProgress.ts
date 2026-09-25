import type { D1DatabaseLike } from './d1Types.js';

const TTL_MS = 24 * 60 * 60_000;

export interface ScoutProgress {
  updateId: number;
  chatId: number;
  telegramMessageId: number;
}

/**
 * A Telegram photo send and its D1 receipt cannot be one atomic transaction.
 * Once recorded, retries edit the existing photo rather than sending another.
 */
export async function loadScoutProgress(
  db: D1DatabaseLike, updateId: number, chatId: number, nowMs: number
): Promise<ScoutProgress | null> {
  const row = await db.prepare(
    'SELECT update_id,chat_id,telegram_message_id FROM rat_scout_progress ' +
    'WHERE update_id=? AND chat_id=? AND expires_at_ms>?'
  ).bind(updateId,chatId,nowMs).first<{
    update_id:number;chat_id:number;telegram_message_id:number
  }>();
  return row ? {
    updateId:row.update_id,chatId:row.chat_id,
    telegramMessageId:row.telegram_message_id
  } : null;
}
export async function saveScoutProgress(
  db: D1DatabaseLike, updateId: number, chatId: number,
  messageId: number, nowMs: number
): Promise<void> {
  if (![updateId,chatId,messageId,nowMs].every(Number.isSafeInteger) ||
      updateId<0 || messageId<1 || nowMs<0) throw new Error('SCOUT_PROGRESS_INVALID');
  const result = await db.prepare(
    'INSERT OR IGNORE INTO rat_scout_progress ' +
    '(update_id,chat_id,telegram_message_id,created_at_ms,expires_at_ms) VALUES (?,?,?,?,?)'
  ).bind(updateId,chatId,messageId,nowMs,nowMs+TTL_MS).run();
  if (!result.success) throw new Error('SCOUT_PROGRESS_WRITE_FAILED');
  if (result.meta?.changes!==1) {
    const row=await loadScoutProgress(db,updateId,chatId,nowMs);
    if (!row || row.telegramMessageId!==messageId) throw new Error('SCOUT_PROGRESS_IDENTITY_CONFLICT');
  }
}
export async function deleteScoutProgress(db:D1DatabaseLike,updateId:number):Promise<void>{
  const result=await db.prepare('DELETE FROM rat_scout_progress WHERE update_id=?')
    .bind(updateId).run();
  if (!result.success) throw new Error('SCOUT_PROGRESS_DELETE_FAILED');
}
export async function pruneScoutProgress(db:D1DatabaseLike,nowMs:number):Promise<void>{
  const result=await db.prepare('DELETE FROM rat_scout_progress WHERE expires_at_ms<=?')
    .bind(nowMs).run();
  if (!result.success) throw new Error('SCOUT_PROGRESS_PRUNE_FAILED');
}
