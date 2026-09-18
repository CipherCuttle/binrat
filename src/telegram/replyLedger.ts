import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import type { RatAnswerPlan } from './voice.js';

export interface TelegramReplyReceiptInput {
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

interface ReplyRow {
  update_id: number;
  plan_digest: string;
  reply_digest: string;
}

export class TelegramReplyLedger {
  private readonly db: Database.Database;

  constructor(path: string) {
    const resolved = resolve(path);
    mkdirSync(dirname(resolved), { recursive: true });
    this.db = new Database(resolved);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS telegram_reply_receipts (
        update_id INTEGER PRIMARY KEY,
        chat_id INTEGER NOT NULL,
        intent TEXT NOT NULL,
        renderer_version TEXT NOT NULL,
        voice_variant INTEGER NOT NULL,
        plan_digest TEXT NOT NULL,
        reply_digest TEXT NOT NULL,
        answer_plan_json TEXT NOT NULL,
        receipt_ids_json TEXT NOT NULL,
        telegram_message_id INTEGER,
        recorded_at_ms INTEGER NOT NULL
      );
    `);
  }

  has(updateId: number): boolean {
    if (!Number.isSafeInteger(updateId) || updateId < 0) return false;
    return Boolean(
      this.db.prepare('SELECT 1 FROM telegram_reply_receipts WHERE update_id = ?').get(updateId)
    );
  }

  record(input: TelegramReplyReceiptInput): 'INSERTED' | 'DUPLICATE' {
    if (!Number.isSafeInteger(input.updateId) || input.updateId < 0) throw new Error('TELEGRAM_REPLY_UPDATE_ID_INVALID');
    if (!Number.isSafeInteger(input.chatId)) throw new Error('TELEGRAM_REPLY_CHAT_ID_INVALID');
    if (!/^[0-9a-f]{64}$/.test(input.planDigest) || !/^[0-9a-f]{64}$/.test(input.replyDigest)) {
      throw new Error('TELEGRAM_REPLY_DIGEST_INVALID');
    }

    const existing = this.db.prepare(
      'SELECT update_id, plan_digest, reply_digest FROM telegram_reply_receipts WHERE update_id = ?'
    ).get(input.updateId) as ReplyRow | undefined;

    if (existing) {
      if (existing.plan_digest === input.planDigest && existing.reply_digest === input.replyDigest) return 'DUPLICATE';
      throw new Error('TELEGRAM_REPLY_LEDGER_CONFLICT');
    }

    this.db.prepare(`
      INSERT INTO telegram_reply_receipts (
        update_id, chat_id, intent, renderer_version, voice_variant,
        plan_digest, reply_digest, answer_plan_json, receipt_ids_json,
        telegram_message_id, recorded_at_ms
      ) VALUES (
        @updateId, @chatId, @intent, @rendererVersion, @voiceVariant,
        @planDigest, @replyDigest, @answerPlanJson, @receiptIdsJson,
        @telegramMessageId, @recordedAtMs
      )
    `).run({
      updateId: input.updateId,
      chatId: input.chatId,
      intent: input.intent,
      rendererVersion: input.rendererVersion,
      voiceVariant: input.voiceVariant,
      planDigest: input.planDigest,
      replyDigest: input.replyDigest,
      answerPlanJson: JSON.stringify(input.answerPlan),
      receiptIdsJson: JSON.stringify(input.receiptIds),
      telegramMessageId: input.telegramMessageId,
      recordedAtMs: Date.now()
    });

    return 'INSERTED';
  }

  close(): void {
    this.db.close();
  }
}
