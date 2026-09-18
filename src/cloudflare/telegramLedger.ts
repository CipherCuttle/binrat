import type { RatAnswerPlan } from '../telegram/voice.js';
import type { D1DatabaseLike, D1ResultLike } from './d1Types.js';

export type TelegramUpdateClaim = 'CLAIMED' | 'BUSY' | 'SEEN';
export type TelegramTerminalState = 'REPLIED' | 'IGNORED' | 'RATE_LIMITED';

export interface D1TelegramReplyInput {
  updateId: number;
  chatId: number;
  intent: string;
  rendererVersion: string;
  voiceVariant: number;
  planDigest: string;
  replyDigest: string;
  answerPlan: RatAnswerPlan;
  receiptIds: string[];
  telegramMessageId: number | null;
}

export interface D1TelegramUpdateRow {
  updateId: number;
  state: 'CLAIMED' | TelegramTerminalState;
  planDigest: string | null;
  replyDigest: string | null;
  answerPlanJson: string | null;
  telegramMessageId: number | null;
}

export class D1TelegramLedger {
  constructor(private readonly db: D1DatabaseLike) {}

  async claim(updateId: number, nowMs: number, leaseMs = 60_000): Promise<TelegramUpdateClaim> {
    validateUpdateId(updateId);
    validateNow(nowMs);
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 600_000) {
      throw new Error('TELEGRAM_CLAIM_LEASE_INVALID');
    }

    const results = await this.db.batch([
      this.db.prepare(`
        DELETE FROM telegram_update_receipts
        WHERE update_id = ?
          AND state = 'CLAIMED'
          AND claim_expires_at_ms IS NOT NULL
          AND claim_expires_at_ms < ?
      `).bind(updateId, nowMs),
      this.db.prepare(`
        INSERT OR IGNORE INTO telegram_update_receipts (
          update_id,state,claim_expires_at_ms,created_at_ms,updated_at_ms
        ) VALUES (?, 'CLAIMED', ?, ?, ?)
      `).bind(updateId, nowMs + leaseMs, nowMs, nowMs)
    ]);

    if (results.some((result) => !result.success)) throw new Error('TELEGRAM_CLAIM_FAILED');
    if (changes(results[1]!) === 1) return 'CLAIMED';

    const existing = await this.get(updateId);
    if (!existing) throw new Error('TELEGRAM_CLAIM_STATE_MISSING');
    return existing.state === 'CLAIMED' ? 'BUSY' : 'SEEN';
  }

  async release(updateId: number): Promise<void> {
    validateUpdateId(updateId);
    const result = await this.db.prepare(
      "DELETE FROM telegram_update_receipts WHERE update_id = ? AND state = 'CLAIMED'"
    ).bind(updateId).run();
    if (!result.success) throw new Error('TELEGRAM_CLAIM_RELEASE_FAILED');
  }

  async completeIgnored(
    updateId: number,
    state: Exclude<TelegramTerminalState, 'REPLIED'>,
    nowMs: number
  ): Promise<void> {
    validateUpdateId(updateId);
    validateNow(nowMs);
    const result = await this.db.prepare(`
      UPDATE telegram_update_receipts
      SET state = ?, claim_expires_at_ms = NULL, updated_at_ms = ?
      WHERE update_id = ? AND state = 'CLAIMED'
    `).bind(state, nowMs, updateId).run();
    if (!result.success) throw new Error('TELEGRAM_TERMINAL_WRITE_FAILED');
    if (changes(result) === 1) return;
    const existing = await this.get(updateId);
    if (existing?.state === state) return;
    throw new Error('TELEGRAM_TERMINAL_STATE_CONFLICT');
  }

  async completeReply(input: D1TelegramReplyInput, nowMs: number): Promise<'INSERTED' | 'DUPLICATE'> {
    validateUpdateId(input.updateId);
    validateNow(nowMs);
    if (!Number.isSafeInteger(input.chatId)) throw new Error('TELEGRAM_REPLY_CHAT_ID_INVALID');
    if (!/^[0-9a-f]{64}$/.test(input.planDigest) || !/^[0-9a-f]{64}$/.test(input.replyDigest)) {
      throw new Error('TELEGRAM_REPLY_DIGEST_INVALID');
    }

    const result = await this.db.prepare(`
      UPDATE telegram_update_receipts
      SET state = 'REPLIED',
          claim_expires_at_ms = NULL,
          chat_id = ?,
          intent = ?,
          renderer_version = ?,
          voice_variant = ?,
          plan_digest = ?,
          reply_digest = ?,
          answer_plan_json = ?,
          receipt_ids_json = ?,
          telegram_message_id = ?,
          updated_at_ms = ?
      WHERE update_id = ? AND state = 'CLAIMED'
    `).bind(
      input.chatId,
      input.intent,
      input.rendererVersion,
      input.voiceVariant,
      input.planDigest,
      input.replyDigest,
      JSON.stringify(input.answerPlan),
      JSON.stringify(input.receiptIds),
      input.telegramMessageId,
      nowMs,
      input.updateId
    ).run();

    if (!result.success) throw new Error('TELEGRAM_REPLY_LEDGER_WRITE_FAILED');
    if (changes(result) === 1) return 'INSERTED';

    const existing = await this.get(input.updateId);
    if (
      existing?.state === 'REPLIED' &&
      existing.planDigest === input.planDigest &&
      existing.replyDigest === input.replyDigest
    ) return 'DUPLICATE';
    throw new Error('TELEGRAM_REPLY_LEDGER_CONFLICT');
  }

  async allowChat(
    chatId: number,
    limit: number,
    windowMs: number,
    nowMs: number
  ): Promise<boolean> {
    if (!Number.isSafeInteger(chatId)) return false;
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('INVALID_RATE_LIMIT');
    if (!Number.isSafeInteger(windowMs) || windowMs < 1) throw new Error('INVALID_RATE_WINDOW');
    validateNow(nowMs);

    const result = await this.db.prepare(`
      INSERT INTO telegram_rate_windows (chat_id,started_at_ms,count)
      VALUES (?,?,1)
      ON CONFLICT(chat_id) DO UPDATE SET
        started_at_ms = CASE
          WHEN excluded.started_at_ms < telegram_rate_windows.started_at_ms
            OR excluded.started_at_ms - telegram_rate_windows.started_at_ms >= ?
          THEN excluded.started_at_ms
          ELSE telegram_rate_windows.started_at_ms
        END,
        count = CASE
          WHEN excluded.started_at_ms < telegram_rate_windows.started_at_ms
            OR excluded.started_at_ms - telegram_rate_windows.started_at_ms >= ?
          THEN 1
          ELSE telegram_rate_windows.count + 1
        END
      WHERE excluded.started_at_ms < telegram_rate_windows.started_at_ms
         OR excluded.started_at_ms - telegram_rate_windows.started_at_ms >= ?
         OR telegram_rate_windows.count < ?
    `).bind(chatId, nowMs, windowMs, windowMs, windowMs, limit).run();

    if (!result.success) throw new Error('TELEGRAM_RATE_GATE_FAILED');
    return changes(result) === 1;
  }

  async get(updateId: number): Promise<D1TelegramUpdateRow | null> {
    validateUpdateId(updateId);
    const row = await this.db.prepare(`
      SELECT update_id,state,plan_digest,reply_digest,answer_plan_json,telegram_message_id
      FROM telegram_update_receipts
      WHERE update_id = ?
      LIMIT 1
    `).bind(updateId).first<ReceiptRow>();
    if (!row) return null;
    return {
      updateId: row.update_id,
      state: row.state,
      planDigest: row.plan_digest,
      replyDigest: row.reply_digest,
      answerPlanJson: row.answer_plan_json,
      telegramMessageId: row.telegram_message_id
    };
  }
}

interface ReceiptRow {
  update_id: number;
  state: D1TelegramUpdateRow['state'];
  plan_digest: string | null;
  reply_digest: string | null;
  answer_plan_json: string | null;
  telegram_message_id: number | null;
}

function changes(result: D1ResultLike): number {
  return Number(result.meta?.changes ?? 0);
}

function validateUpdateId(updateId: number): void {
  if (!Number.isSafeInteger(updateId) || updateId < 0) throw new Error('INVALID_UPDATE_ID');
}

function validateNow(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('TELEGRAM_TIME_INVALID');
}
