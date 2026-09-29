import type { D1DatabaseLike } from '../../cloudflare/d1Types.js';

export const DIG_PROMPT_TTL_MS = 5 * 60_000;

export interface DigPrompt {
  chatId: number;
  userId: number;
  sourceUpdateId: number;
  cardMessageId: number;
  promptMessageId: number;
  createdAtMs: number;
  expiresAtMs: number;
}

function validId(value: number): boolean { return Number.isSafeInteger(value) && value > 0; }
function validatePrincipal(chatId:number,userId:number): void {
  if (!validId(chatId) || !validId(userId) || chatId !== userId) throw new Error('DIG_PROMPT_PRINCIPAL_INVALID');
}
function validateTime(nowMs:number): void { if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('DIG_PROMPT_TIME_INVALID'); }

/**
 * One row per private Telegram principal. This intentionally stores no candidate
 * text. A successful Telegram send followed by a failed write has no usable
 * prompt receipt: callers must terminally record the update and never retry it.
 */
export async function replaceDigPrompt(db:D1DatabaseLike, prompt:Omit<DigPrompt,'expiresAtMs'>, ttlMs=DIG_PROMPT_TTL_MS):Promise<void> {
  validatePrincipal(prompt.chatId,prompt.userId); validateTime(prompt.createdAtMs);
  if (!validId(prompt.cardMessageId) || !validId(prompt.promptMessageId) || !Number.isSafeInteger(prompt.sourceUpdateId) || prompt.sourceUpdateId < 0 || !Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 15 * 60_000) throw new Error('DIG_PROMPT_INVALID');
  const result=await db.prepare(`INSERT INTO rat_ui_prompts
    (chat_id,user_id,action,source_update_id,card_message_id,prompt_message_id,created_at_ms,expires_at_ms)
    VALUES (?,?,'DIG',?,?,?,?,?)
    ON CONFLICT(chat_id,user_id) DO UPDATE SET action='DIG',card_message_id=excluded.card_message_id,
      source_update_id=excluded.source_update_id,prompt_message_id=excluded.prompt_message_id,created_at_ms=excluded.created_at_ms,expires_at_ms=excluded.expires_at_ms`)
    .bind(prompt.chatId,prompt.userId,prompt.sourceUpdateId,prompt.cardMessageId,prompt.promptMessageId,prompt.createdAtMs,prompt.createdAtMs+ttlMs).run();
  if (!result.success) throw new Error('DIG_PROMPT_WRITE_FAILED');
}

/** Loads and physically removes an expired prompt; expired records never execute. */
export async function loadActiveDigPrompt(db:D1DatabaseLike, chatId:number,userId:number,nowMs:number):Promise<DigPrompt|null> {
  validatePrincipal(chatId,userId); validateTime(nowMs);
  await db.prepare('DELETE FROM rat_ui_prompts WHERE chat_id=? AND user_id=? AND expires_at_ms<=?').bind(chatId,userId,nowMs).run();
  const row=await db.prepare(`SELECT chat_id,user_id,source_update_id,card_message_id,prompt_message_id,created_at_ms,expires_at_ms
    FROM rat_ui_prompts WHERE chat_id=? AND user_id=? AND action='DIG' AND expires_at_ms>?`).bind(chatId,userId,nowMs).first<PromptRow>();
  return row ? fromRow(row) : null;
}

/** SQLite DELETE ... RETURNING is the execution fence: exactly one reply wins. */
export async function consumeExactDigPrompt(db:D1DatabaseLike,chatId:number,userId:number,promptMessageId:number,nowMs:number):Promise<DigPrompt|null> {
  validatePrincipal(chatId,userId); validateTime(nowMs); if (!validId(promptMessageId)) return null;
  await db.prepare('DELETE FROM rat_ui_prompts WHERE chat_id=? AND user_id=? AND expires_at_ms<=?').bind(chatId,userId,nowMs).run();
  const row=await db.prepare(`DELETE FROM rat_ui_prompts
    WHERE chat_id=? AND user_id=? AND action='DIG' AND prompt_message_id=? AND expires_at_ms>?
    RETURNING chat_id,user_id,source_update_id,card_message_id,prompt_message_id,created_at_ms,expires_at_ms`)
    .bind(chatId,userId,promptMessageId,nowMs).first<PromptRow>();
  return row ? fromRow(row) : null;
}

interface PromptRow { chat_id:number; user_id:number; source_update_id:number; card_message_id:number; prompt_message_id:number; created_at_ms:number; expires_at_ms:number }
function fromRow(row:PromptRow):DigPrompt { return {chatId:row.chat_id,userId:row.user_id,sourceUpdateId:row.source_update_id,cardMessageId:row.card_message_id,promptMessageId:row.prompt_message_id,createdAtMs:row.created_at_ms,expiresAtMs:row.expires_at_ms}; }
