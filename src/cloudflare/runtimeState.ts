import type { D1DatabaseLike } from './d1Types.js';

export interface D1RuntimeState {
  chainId: number;
  sourceVerified: boolean;
  observationReady: boolean;
  historyBackfillComplete: boolean;
  historyBackfillTargetBlock: bigint | null;
  lastSyncError: string | null;
  lastHistoryError: string | null;
  lastObservationError: string | null;
  updatedAtMs: number;
}

export class D1RuntimeStateStore {
  constructor(
    private readonly db: D1DatabaseLike,
    private readonly chainId: number
  ) {}

  async get(): Promise<D1RuntimeState | null> {
    const row = await this.db.prepare(
      'SELECT * FROM binrat_runtime_state WHERE chain_id = ? LIMIT 1'
    ).bind(this.chainId).first<RuntimeRow>();
    if (!row) return null;
    return {
      chainId: row.chain_id,
      sourceVerified: row.source_verified === 1,
      observationReady: row.observation_ready === 1,
      historyBackfillComplete: row.history_backfill_complete === 1,
      historyBackfillTargetBlock: row.history_backfill_target_block === null
        ? null
        : BigInt(row.history_backfill_target_block),
      lastSyncError: row.last_sync_error,
      lastHistoryError: row.last_history_error,
      lastObservationError: row.last_observation_error,
      updatedAtMs: row.updated_at_ms
    };
  }

  async put(state: Omit<D1RuntimeState, 'chainId'>): Promise<void> {
    if (!Number.isSafeInteger(state.updatedAtMs) || state.updatedAtMs < 0) {
      throw new Error('D1_RUNTIME_UPDATED_AT_INVALID');
    }
    const result = await this.db.prepare(`
      INSERT INTO binrat_runtime_state (
        chain_id,source_verified,observation_ready,history_backfill_complete,
        history_backfill_target_block,last_sync_error,last_history_error,
        last_observation_error,updated_at_ms
      ) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(chain_id) DO UPDATE SET
        source_verified=excluded.source_verified,
        observation_ready=excluded.observation_ready,
        history_backfill_complete=excluded.history_backfill_complete,
        history_backfill_target_block=excluded.history_backfill_target_block,
        last_sync_error=excluded.last_sync_error,
        last_history_error=excluded.last_history_error,
        last_observation_error=excluded.last_observation_error,
        updated_at_ms=excluded.updated_at_ms
    `).bind(
      this.chainId,
      state.sourceVerified ? 1 : 0,
      state.observationReady ? 1 : 0,
      state.historyBackfillComplete ? 1 : 0,
      state.historyBackfillTargetBlock?.toString() ?? null,
      state.lastSyncError,
      state.lastHistoryError,
      state.lastObservationError,
      state.updatedAtMs
    ).run();
    if (!result.success) throw new Error('D1_RUNTIME_STATE_WRITE_FAILED');
  }
}

interface RuntimeRow {
  chain_id: number;
  source_verified: number;
  observation_ready: number;
  history_backfill_complete: number;
  history_backfill_target_block: string | null;
  last_sync_error: string | null;
  last_history_error: string | null;
  last_observation_error: string | null;
  updated_at_ms: number;
}
