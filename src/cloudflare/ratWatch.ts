import type { D1DatabaseLike, D1ResultLike } from './d1Types.js';

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const MAX_WATCHES_PER_CHAT = 25;

export interface RatWatchSubscription {
  chatId: number;
  creator: string;
  startBlock: bigint;
  createdAtMs: number;
}

export interface RatWatchPendingAlert {
  alertId: string;
  chatId: number;
  creator: string;
  launchId: string;
  blockNumber: bigint;
  symbol: string;
  name: string;
}

export class D1RatWatchStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async subscribe(
    chatId: number,
    creator: string,
    startBlock: bigint,
    nowMs: number
  ): Promise<'INSERTED' | 'DUPLICATE' | 'LIMIT_REACHED'> {
    validateChatId(chatId);
    const normalized = normalizeCreator(creator);
    validateBlock(startBlock);
    validateNow(nowMs);

    const existing = await this.db.prepare(`
      SELECT 1 AS present
      FROM rat_watch_subscriptions
      WHERE chat_id = ? AND creator = ?
      LIMIT 1
    `).bind(chatId, normalized).first<{ present: number }>();
    if (existing) return 'DUPLICATE';

    const count = await this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM rat_watch_subscriptions
      WHERE chat_id = ?
    `).bind(chatId).first<{ count: number }>();
    if (Number(count?.count ?? 0) >= MAX_WATCHES_PER_CHAT) return 'LIMIT_REACHED';

    const result = await this.db.prepare(`
      INSERT INTO rat_watch_subscriptions (chat_id,creator,start_block,created_at_ms)
      VALUES (?,?,?,?)
    `).bind(chatId, normalized, startBlock.toString(), nowMs).run();
    if (!result.success || changes(result) !== 1) throw new Error('RAT_WATCH_SUBSCRIBE_FAILED');
    return 'INSERTED';
  }

  async unsubscribe(chatId: number, creator: string): Promise<boolean> {
    validateChatId(chatId);
    const normalized = normalizeCreator(creator);
    const result = await this.db.prepare(`
      DELETE FROM rat_watch_subscriptions
      WHERE chat_id = ? AND creator = ?
    `).bind(chatId, normalized).run();
    if (!result.success) throw new Error('RAT_WATCH_UNSUBSCRIBE_FAILED');
    return changes(result) === 1;
  }

  async list(chatId: number): Promise<RatWatchSubscription[]> {
    validateChatId(chatId);
    const result = await this.db.prepare(`
      SELECT chat_id,creator,start_block,created_at_ms
      FROM rat_watch_subscriptions
      WHERE chat_id = ?
      ORDER BY created_at_ms, creator
    `).bind(chatId).all<{
      chat_id: number;
      creator: string;
      start_block: string;
      created_at_ms: number;
    }>();
    if (!result.success) throw new Error('RAT_WATCH_LIST_FAILED');
    return (result.results ?? []).map((row) => ({
      chatId: row.chat_id,
      creator: row.creator,
      startBlock: BigInt(row.start_block),
      createdAtMs: row.created_at_ms
    }));
  }

  async enqueueRecurrenceAlerts(chainId: number, nowMs: number): Promise<number> {
    if (!Number.isSafeInteger(chainId) || chainId < 1) throw new Error('RAT_WATCH_CHAIN_INVALID');
    validateNow(nowMs);
    const result = await this.db.prepare(`
      INSERT OR IGNORE INTO rat_watch_alerts (
        alert_id,chat_id,creator,launch_id,state,telegram_message_id,created_at_ms,updated_at_ms
      )
      SELECT
        'ratwatch:' || CAST(s.chat_id AS TEXT) || ':' || l.launch_id,
        s.chat_id,
        s.creator,
        l.launch_id,
        'PENDING',
        NULL,
        ?,
        ?
      FROM rat_watch_subscriptions s
      JOIN launches l
        ON l.chain_id = ?
       AND l.creator = s.creator
       AND CAST(l.block_number AS INTEGER) > CAST(s.start_block AS INTEGER)
      WHERE NOT EXISTS (
        SELECT 1
        FROM rat_watch_alerts a
        WHERE a.chat_id = s.chat_id
          AND a.launch_id = l.launch_id
      )
    `).bind(nowMs, nowMs, chainId).run();
    if (!result.success) throw new Error('RAT_WATCH_ALERT_ENQUEUE_FAILED');
    return changes(result);
  }

  async listPending(limit = 5): Promise<RatWatchPendingAlert[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('RAT_WATCH_PENDING_LIMIT_INVALID');
    }
    const result = await this.db.prepare(`
      SELECT
        a.alert_id,
        a.chat_id,
        a.creator,
        a.launch_id,
        l.block_number,
        l.symbol,
        l.name
      FROM rat_watch_alerts a
      JOIN launches l ON l.launch_id = a.launch_id
      WHERE a.state = 'PENDING'
      ORDER BY a.created_at_ms, a.alert_id
      LIMIT ?
    `).bind(limit).all<{
      alert_id: string;
      chat_id: number;
      creator: string;
      launch_id: string;
      block_number: string;
      symbol: string;
      name: string;
    }>();
    if (!result.success) throw new Error('RAT_WATCH_PENDING_READ_FAILED');
    return (result.results ?? []).map((row) => ({
      alertId: row.alert_id,
      chatId: row.chat_id,
      creator: row.creator,
      launchId: row.launch_id,
      blockNumber: BigInt(row.block_number),
      symbol: row.symbol,
      name: row.name
    }));
  }

  async completeSent(alertId: string, telegramMessageId: number | null, nowMs: number): Promise<void> {
    if (!/^ratwatch:-?\d+:[0-9a-f]{64}$/.test(alertId)) throw new Error('RAT_WATCH_ALERT_ID_INVALID');
    if (telegramMessageId !== null && !Number.isSafeInteger(telegramMessageId)) {
      throw new Error('RAT_WATCH_TELEGRAM_MESSAGE_ID_INVALID');
    }
    validateNow(nowMs);
    const result = await this.db.prepare(`
      UPDATE rat_watch_alerts
      SET state = 'SENT', telegram_message_id = ?, updated_at_ms = ?
      WHERE alert_id = ? AND state = 'PENDING'
    `).bind(telegramMessageId, nowMs, alertId).run();
    if (!result.success) throw new Error('RAT_WATCH_ALERT_COMPLETE_FAILED');
    if (changes(result) === 1) return;

    const existing = await this.db.prepare(`
      SELECT state,telegram_message_id
      FROM rat_watch_alerts
      WHERE alert_id = ?
      LIMIT 1
    `).bind(alertId).first<{ state: string; telegram_message_id: number | null }>();
    if (existing?.state === 'SENT' && existing.telegram_message_id === telegramMessageId) return;
    throw new Error('RAT_WATCH_ALERT_STATE_CONFLICT');
  }
}

export function ratWatchAlertText(alert: RatWatchPendingAlert): string {
  return [
    '🐀 watched address hit the bin again.',
    '',
    'same ArcPad-reported creator address:',
    alert.creator,
    '',
    `new launch: ${alert.symbol || '?'} — ${alert.name || 'unnamed'}`,
    `block: ${alert.blockNumber}`,
    `launch: ${alert.launchId}`,
    '',
    'same reported address != same human identity.',
    'receipt first. no buy call.'
  ].join('\n');
}

function normalizeCreator(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!ADDRESS_RE.test(normalized)) throw new Error('RAT_WATCH_CREATOR_INVALID');
  return normalized;
}

function validateChatId(value: number): void {
  if (!Number.isSafeInteger(value)) throw new Error('RAT_WATCH_CHAT_ID_INVALID');
}

function validateBlock(value: bigint): void {
  if (value < 0n) throw new Error('RAT_WATCH_BLOCK_INVALID');
}

function validateNow(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('RAT_WATCH_TIME_INVALID');
}

function changes(result: D1ResultLike): number {
  return Number(result.meta?.changes ?? 0);
}
