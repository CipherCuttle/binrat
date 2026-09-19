import { canonicalJson } from '../evidence/canonical.js';
import { normalizeLaunchHex, sameLaunchAuthority } from '../core/identity.js';
import type { ChainCheckpoint, Hex, LaunchObserved } from '../core/types.js';
import type { LaunchStore } from '../core/ports.js';
import type { ProvenanceEdge, ProvenanceFact } from '../intelligence/provenance.js';
import type { ObservationStore } from '../observations/store.js';
import type { LaunchObservationReceipt } from '../observations/types.js';
import type { HistoricalBackfillStore } from '../indexer/syncHistoricalLaunches.js';
import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from './d1Types.js';

export class D1Store implements LaunchStore, ObservationStore, HistoricalBackfillStore {
  constructor(
    private readonly db: D1DatabaseLike,
    private readonly chainId: number
  ) {}

  close(): void {}

  async putLaunch(value: LaunchObserved): Promise<'INSERTED' | 'DUPLICATE'> {
    const launch = this.normalizeLaunch(value);
    const payload = canonicalJson(launch);
    const result = await this.db.prepare(INSERT_LAUNCH_SQL).bind(...launchParams(launch, payload)).run();
    if (changes(result) === 1) return 'INSERTED';
    await this.assertLaunchIdentity(launch, payload);
    return 'DUPLICATE';
  }

  async getLaunch(launchId: string): Promise<LaunchObserved | null> {
    const row = await this.db.prepare('SELECT * FROM launches WHERE launch_id = ? LIMIT 1')
      .bind(launchId).first<LaunchRow>();
    return row ? fromLaunchRow(row) : null;
  }

  async getLaunchByToken(token: Hex): Promise<LaunchObserved | null> {
    const row = await this.db.prepare('SELECT * FROM launches WHERE chain_id = ? AND token = ? LIMIT 1')
      .bind(this.chainId, token.toLowerCase()).first<LaunchRow>();
    return row ? fromLaunchRow(row) : null;
  }

  async listLaunches(): Promise<LaunchObserved[]> {
    const rows = await all<LaunchRow>(this.db.prepare(`
      SELECT * FROM launches WHERE chain_id = ?
      ORDER BY CAST(block_number AS INTEGER), log_index, launch_id
    `).bind(this.chainId));
    return rows.map(fromLaunchRow);
  }

  async listLaunchesMissingProvenance(): Promise<LaunchObserved[]> {
    const rows = await all<LaunchRow>(this.db.prepare(`
      SELECT l.* FROM launches l
      LEFT JOIN provenance_facts p ON p.launch_id = l.launch_id
      WHERE l.chain_id = ? AND p.launch_id IS NULL
      ORDER BY CAST(l.block_number AS INTEGER), l.log_index, l.launch_id
    `).bind(this.chainId));
    return rows.map(fromLaunchRow);
  }

  async putProvenanceFact(fact: ProvenanceFact): Promise<'INSERTED' | 'DUPLICATE'> {
    this.assertChain(fact.chainId, `PROVENANCE_CHAIN_MISMATCH:${fact.factId}`);
    const payload = canonicalJson(fact);
    const result = await this.db.prepare(INSERT_FACT_SQL).bind(
      fact.factId, fact.chainId, fact.launchId, fact.creator.toLowerCase(), fact.observedBlock.toString(),
      fact.observedBlockHash.toLowerCase(), fact.logIndex, fact.sourceEventId, fact.evidenceDigest, payload
    ).run();
    if (changes(result) === 1) return 'INSERTED';
    const existing = await this.db.prepare(`
      SELECT fact_id,evidence_digest,payload_json
      FROM provenance_facts
      WHERE fact_id = ? OR launch_id = ?
      LIMIT 1
    `).bind(fact.factId, fact.launchId).first<FactIdentityRow>();
    if (
      !existing ||
      existing.fact_id !== fact.factId ||
      existing.evidence_digest !== fact.evidenceDigest ||
      existing.payload_json !== payload
    ) throw new Error(`PROVENANCE_FACT_IDENTITY_CONFLICT:${fact.factId}`);
    return 'DUPLICATE';
  }

  async listProvenanceFacts(): Promise<ProvenanceFact[]> {
    const rows = await all<{ payload_json: string }>(this.db.prepare(`
      SELECT payload_json FROM provenance_facts
      WHERE chain_id = ?
      ORDER BY CAST(observed_block AS INTEGER), log_index, fact_id
    `).bind(this.chainId));
    return rows.map((row) => reviveFact(row.payload_json));
  }

  async replaceProvenanceEdges(edges: ProvenanceEdge[]): Promise<void> {
    const statements: D1PreparedStatementLike[] = [
      this.db.prepare('DELETE FROM provenance_edges WHERE chain_id = ?').bind(this.chainId)
    ];
    for (const edge of edges) {
      if (edge.chainId !== this.chainId) continue;
      statements.push(this.edgeInsert(edge));
    }
    await requireBatchSuccess(this.db.batch(statements));
  }

  async listProvenanceEdges(): Promise<ProvenanceEdge[]> {
    const rows = await all<{ payload_json: string }>(this.db.prepare(`
      SELECT payload_json FROM provenance_edges
      WHERE chain_id = ?
      ORDER BY CAST(observed_block AS INTEGER), edge_id
    `).bind(this.chainId));
    return rows.map((row) => reviveEdge(row.payload_json));
  }

  async putObservation(receipt: LaunchObservationReceipt): Promise<'INSERTED' | 'DUPLICATE'> {
    this.assertChain(receipt.chainId, `OBSERVATION_CHAIN_MISMATCH:${receipt.observationId}`);
    const payload = canonicalJson(receipt);
    const result = await this.db.prepare(INSERT_OBSERVATION_SQL).bind(
      receipt.observationId, receipt.observationVersion, receipt.chainId, receipt.launchId,
      receipt.horizonMs, receipt.observedBlock.toString(), receipt.observedBlockHash.toLowerCase(),
      receipt.observedTimestampMs, receipt.evidenceDigest, payload
    ).run();
    if (changes(result) === 1) return 'INSERTED';
    const existing = await this.db.prepare(`
      SELECT observation_id,evidence_digest,payload_json
      FROM launch_observations
      WHERE observation_id = ?
         OR (launch_id = ? AND horizon_ms = ? AND observation_version = ?)
      LIMIT 1
    `).bind(
      receipt.observationId, receipt.launchId, receipt.horizonMs, receipt.observationVersion
    ).first<ObservationIdentityRow>();
    if (
      !existing ||
      existing.observation_id !== receipt.observationId ||
      existing.evidence_digest !== receipt.evidenceDigest ||
      existing.payload_json !== payload
    ) throw new Error(`OBSERVATION_IDENTITY_CONFLICT:${receipt.observationId}`);
    return 'DUPLICATE';
  }

  async listObservationsForLaunch(launchId: string): Promise<LaunchObservationReceipt[]> {
    const rows = await all<{ payload_json: string }>(this.db.prepare(`
      SELECT payload_json
      FROM launch_observations
      WHERE chain_id = ? AND launch_id = ?
      ORDER BY horizon_ms, observation_version, observation_id
    `).bind(this.chainId, launchId));
    return rows.map((row) => reviveObservation(row.payload_json));
  }

  async getHistoricalBackfillNextBlock(): Promise<bigint | null> {
    const row = await this.db.prepare(
      'SELECT next_block FROM launch_history_backfill_state WHERE chain_id = ?'
    ).bind(this.chainId).first<{ next_block: string }>();
    return row ? BigInt(row.next_block) : null;
  }

  async setHistoricalBackfillNextBlock(nextBlock: bigint): Promise<void> {
    if (nextBlock < 0n) throw new Error('HISTORY_CURSOR_INVALID');
    await requireSuccess(this.db.prepare(`
      INSERT INTO launch_history_backfill_state (chain_id,next_block)
      VALUES (?,?)
      ON CONFLICT(chain_id) DO UPDATE SET next_block=excluded.next_block
    `).bind(this.chainId, nextBlock.toString()).run());
  }

  async commitHistoricalBackfillBatch(
    launches: readonly LaunchObserved[],
    facts: readonly ProvenanceFact[],
    edges: readonly ProvenanceEdge[],
    nextBlock: bigint
  ): Promise<{ inserted: number; duplicates: number }> {
    if (nextBlock < 0n) throw new Error('HISTORY_CURSOR_INVALID');
    if (facts.length !== launches.length) throw new Error('HISTORY_BATCH_FACT_COUNT_MISMATCH');

    const statements: D1PreparedStatementLike[] = [];
    const launchInsertIndexes: number[] = [];

    for (const value of launches) {
      const launch = this.normalizeLaunch(value);
      const payload = canonicalJson(launch);
      launchInsertIndexes.push(statements.length);
      statements.push(this.db.prepare(INSERT_LAUNCH_SQL).bind(...launchParams(launch, payload)));
      statements.push(this.launchGuard(launch, payload));
    }

    for (const fact of facts) {
      this.assertChain(fact.chainId, `PROVENANCE_CHAIN_MISMATCH:${fact.factId}`);
      const payload = canonicalJson(fact);
      statements.push(this.db.prepare(INSERT_FACT_SQL).bind(
        fact.factId, fact.chainId, fact.launchId, fact.creator.toLowerCase(), fact.observedBlock.toString(),
        fact.observedBlockHash.toLowerCase(), fact.logIndex, fact.sourceEventId, fact.evidenceDigest, payload
      ));
      statements.push(this.factGuard(fact, payload));
    }

    statements.push(this.db.prepare('DELETE FROM provenance_edges WHERE chain_id = ?').bind(this.chainId));
    for (const edge of edges) {
      this.assertChain(edge.chainId, `PROVENANCE_CHAIN_MISMATCH:${edge.edgeId}`);
      statements.push(this.edgeInsert(edge));
    }
    statements.push(this.db.prepare(`
      INSERT INTO launch_history_backfill_state (chain_id,next_block)
      VALUES (?,?)
      ON CONFLICT(chain_id) DO UPDATE SET next_block=excluded.next_block
    `).bind(this.chainId, nextBlock.toString()));

    const results = await requireBatchSuccess(this.db.batch(statements));
    const inserted = launchInsertIndexes.reduce((sum, index) => sum + (changes(results[index]!) === 1 ? 1 : 0), 0);
    return { inserted, duplicates: launches.length - inserted };
  }

  async readPublicProjectionState(): Promise<{
    checkpoint: ChainCheckpoint;
    launches: LaunchObserved[];
    facts: ProvenanceFact[];
  } | null> {
    const checkpoint = await this.getCheckpoint();
    if (!checkpoint) return null;
    const launchRows = await all<LaunchRow>(this.db.prepare(`
      SELECT * FROM launches
      WHERE chain_id = ? AND CAST(block_number AS INTEGER) <= CAST(? AS INTEGER)
      ORDER BY CAST(block_number AS INTEGER), log_index, launch_id
    `).bind(this.chainId, checkpoint.blockNumber.toString()));
    const factRows = await all<{ payload_json: string }>(this.db.prepare(`
      SELECT payload_json FROM provenance_facts
      WHERE chain_id = ? AND CAST(observed_block AS INTEGER) <= CAST(? AS INTEGER)
      ORDER BY CAST(observed_block AS INTEGER), log_index, fact_id
    `).bind(this.chainId, checkpoint.blockNumber.toString()));
    return {
      checkpoint,
      launches: launchRows.map(fromLaunchRow),
      facts: factRows.map((row) => reviveFact(row.payload_json))
    };
  }

  async getCheckpoint(): Promise<ChainCheckpoint | null> {
    const row = await this.db.prepare(
      'SELECT * FROM chain_checkpoints WHERE chain_id = ? LIMIT 1'
    ).bind(this.chainId).first<CheckpointRow>();
    if (!row) return null;
    return {
      chainId: row.chain_id,
      blockNumber: BigInt(row.block_number),
      blockHash: row.block_hash,
      guardBlockNumber: row.guard_block_number === null ? null : BigInt(row.guard_block_number),
      guardBlockHash: row.guard_block_hash
    };
  }

  async commitCheckpoint(checkpoint: Omit<ChainCheckpoint, 'chainId'>): Promise<void> {
    await requireSuccess(this.db.prepare(`
      INSERT INTO chain_checkpoints (chain_id,block_number,block_hash,guard_block_number,guard_block_hash)
      VALUES (?,?,?,?,?)
      ON CONFLICT(chain_id) DO UPDATE SET
        block_number=excluded.block_number,
        block_hash=excluded.block_hash,
        guard_block_number=excluded.guard_block_number,
        guard_block_hash=excluded.guard_block_hash
    `).bind(
      this.chainId, checkpoint.blockNumber.toString(), checkpoint.blockHash.toLowerCase(),
      checkpoint.guardBlockNumber?.toString() ?? null, checkpoint.guardBlockHash?.toLowerCase() ?? null
    ).run());
  }

  async rewindFromBlock(blockNumber: bigint): Promise<void> {
    const statements = [
      this.db.prepare('DELETE FROM provenance_edges WHERE chain_id = ?').bind(this.chainId),
      this.db.prepare(`
        DELETE FROM rat_watch_alerts
        WHERE state = 'PENDING'
          AND launch_id IN (
            SELECT launch_id FROM launches
            WHERE chain_id = ? AND CAST(block_number AS INTEGER) >= CAST(? AS INTEGER)
          )
      `).bind(this.chainId, blockNumber.toString()),
      this.db.prepare(`
        DELETE FROM launch_observations
        WHERE chain_id = ? AND CAST(observed_block AS INTEGER) >= CAST(? AS INTEGER)
      `).bind(this.chainId, blockNumber.toString()),
      this.db.prepare(`
        DELETE FROM launches
        WHERE chain_id = ? AND CAST(block_number AS INTEGER) >= CAST(? AS INTEGER)
      `).bind(this.chainId, blockNumber.toString()),
      this.db.prepare(`
        DELETE FROM launch_history_backfill_state
        WHERE chain_id = ? AND CAST(next_block AS INTEGER) > CAST(? AS INTEGER)
      `).bind(this.chainId, blockNumber.toString()),
      this.db.prepare(`
        DELETE FROM chain_checkpoints
        WHERE chain_id = ? AND CAST(block_number AS INTEGER) >= CAST(? AS INTEGER)
      `).bind(this.chainId, blockNumber.toString())
    ];
    await requireBatchSuccess(this.db.batch(statements));
  }

  private normalizeLaunch(value: LaunchObserved): LaunchObserved {
    this.assertChain(value.chainId, `LAUNCH_CHAIN_MISMATCH:${value.launchId}`);
    return normalizeLaunchHex(value);
  }

  private assertChain(actual: number, error: string): void {
    if (actual !== this.chainId) throw new Error(error);
  }

  private async assertLaunchIdentity(launch: LaunchObserved, payload: string): Promise<void> {
    const row = await this.db.prepare(`
      SELECT * FROM launches
      WHERE launch_id = ?
         OR (chain_id = ? AND tx_hash = ? AND token = ?)
         OR (chain_id = ? AND token = ?)
      LIMIT 1
    `).bind(
      launch.launchId, launch.chainId, launch.txHash, launch.token, launch.chainId, launch.token
    ).first<LaunchRow>();
    if (!row || row.authority_json !== payload || !sameLaunchAuthority(fromLaunchRow(row), launch)) {
      throw new Error(`LAUNCH_IDENTITY_CONFLICT:${launch.launchId}`);
    }
  }

  private launchGuard(launch: LaunchObserved, payload: string): D1PreparedStatementLike {
    return this.db.prepare(`
      INSERT INTO binrat_invariant_guard (must_be_zero)
      SELECT 1
      FROM launches
      WHERE (
        launch_id = ?
        OR (chain_id = ? AND tx_hash = ? AND token = ?)
        OR (chain_id = ? AND token = ?)
      )
      AND authority_json <> ?
      LIMIT 1
    `).bind(
      launch.launchId, launch.chainId, launch.txHash, launch.token,
      launch.chainId, launch.token, payload
    );
  }

  private factGuard(fact: ProvenanceFact, payload: string): D1PreparedStatementLike {
    return this.db.prepare(`
      INSERT INTO binrat_invariant_guard (must_be_zero)
      SELECT 1
      FROM provenance_facts
      WHERE (fact_id = ? OR launch_id = ?)
        AND (fact_id <> ? OR evidence_digest <> ? OR payload_json <> ?)
      LIMIT 1
    `).bind(fact.factId, fact.launchId, fact.factId, fact.evidenceDigest, payload);
  }

  private edgeInsert(edge: ProvenanceEdge): D1PreparedStatementLike {
    return this.db.prepare(`
      INSERT INTO provenance_edges (
        edge_id,chain_id,kind,from_id,to_id,evidence_class,observed_block,observed_block_hash,
        source_fact_ids_json,derivation_version,evidence_digest,payload_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      edge.edgeId, edge.chainId, edge.kind, edge.from, edge.to, edge.evidenceClass,
      edge.observedBlock.toString(), edge.observedBlockHash.toLowerCase(), canonicalJson(edge.sourceFactIds),
      edge.derivationVersion, edge.evidenceDigest, canonicalJson(edge)
    );
  }
}

const INSERT_LAUNCH_SQL = `
  INSERT OR IGNORE INTO launches (
    launch_id,event_id,chain_id,block_number,block_hash,source,launcher,tx_hash,log_index,
    token,creator,pool,name,symbol,image_uri,website,twitter,telegram,observed_at_ms,authority_json
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const INSERT_FACT_SQL = `
  INSERT OR IGNORE INTO provenance_facts (
    fact_id,chain_id,launch_id,creator,observed_block,observed_block_hash,log_index,
    source_event_id,evidence_digest,payload_json
  ) VALUES (?,?,?,?,?,?,?,?,?,?)
`;

const INSERT_OBSERVATION_SQL = `
  INSERT OR IGNORE INTO launch_observations (
    observation_id,observation_version,chain_id,launch_id,horizon_ms,observed_block,
    observed_block_hash,observed_timestamp_ms,evidence_digest,payload_json
  ) VALUES (?,?,?,?,?,?,?,?,?,?)
`;

function launchParams(launch: LaunchObserved, payload: string): unknown[] {
  return [
    launch.launchId, launch.eventId, launch.chainId, launch.blockNumber.toString(), launch.blockHash,
    launch.source, launch.launcher, launch.txHash, launch.logIndex, launch.token, launch.creator, launch.pool,
    launch.name, launch.symbol, launch.imageUri, launch.website, launch.twitter, launch.telegram,
    launch.observedAtMs, payload
  ];
}

async function all<T>(statement: D1PreparedStatementLike): Promise<T[]> {
  const result = await statement.all<T>();
  if (!result.success) throw new Error('D1_QUERY_FAILED');
  return result.results ?? [];
}

function changes(result: D1ResultLike): number {
  return Number(result.meta?.changes ?? 0);
}

async function requireSuccess(promise: Promise<D1ResultLike>): Promise<D1ResultLike> {
  const result = await promise;
  if (!result.success) throw new Error('D1_WRITE_FAILED');
  return result;
}

async function requireBatchSuccess(promise: Promise<D1ResultLike[]>): Promise<D1ResultLike[]> {
  const results = await promise;
  if (results.some((result) => !result.success)) throw new Error('D1_BATCH_FAILED');
  return results;
}

interface LaunchRow {
  launch_id: string;
  event_id: string;
  chain_id: number;
  block_number: string;
  block_hash: Hex;
  source: 'ARCPAD';
  launcher: Hex;
  tx_hash: Hex;
  log_index: number;
  token: Hex;
  creator: Hex;
  pool: Hex;
  name: string;
  symbol: string;
  image_uri: string;
  website: string;
  twitter: string;
  telegram: string;
  observed_at_ms: number;
  authority_json: string;
}

interface CheckpointRow {
  chain_id: number;
  block_number: string;
  block_hash: Hex;
  guard_block_number: string | null;
  guard_block_hash: Hex | null;
}

interface FactIdentityRow {
  fact_id: string;
  evidence_digest: string;
  payload_json: string;
}

interface ObservationIdentityRow {
  observation_id: string;
  evidence_digest: string;
  payload_json: string;
}

function fromLaunchRow(row: LaunchRow): LaunchObserved {
  return {
    launchId: row.launch_id,
    eventId: row.event_id,
    chainId: row.chain_id,
    blockNumber: BigInt(row.block_number),
    blockHash: row.block_hash,
    source: row.source,
    launcher: row.launcher,
    txHash: row.tx_hash,
    logIndex: row.log_index,
    token: row.token,
    creator: row.creator,
    pool: row.pool,
    name: row.name,
    symbol: row.symbol,
    imageUri: row.image_uri,
    website: row.website,
    twitter: row.twitter,
    telegram: row.telegram,
    observedAtMs: row.observed_at_ms
  };
}

function reviveFact(payload: string): ProvenanceFact {
  const raw = JSON.parse(payload) as Omit<ProvenanceFact, 'observedBlock'> & { observedBlock: string };
  return { ...raw, observedBlock: BigInt(raw.observedBlock) };
}

function reviveEdge(payload: string): ProvenanceEdge {
  const raw = JSON.parse(payload) as Omit<ProvenanceEdge, 'observedBlock'> & { observedBlock: string };
  return { ...raw, observedBlock: BigInt(raw.observedBlock) };
}

function reviveObservation(payload: string): LaunchObservationReceipt {
  const raw = JSON.parse(payload) as Omit<LaunchObservationReceipt, 'observedBlock' | 'facts'> & {
    observedBlock: string;
    facts: {
      poolCodePresent?: boolean;
      poolActiveLiquidity?: string;
      poolSqrtPriceX96?: string;
      poolTick?: number;
      creatorTokenBalance?: string;
      tokenTotalSupply?: string;
      tokenDecimals?: number;
    };
  };
  const facts: LaunchObservationReceipt['facts'] = {};
  if (raw.facts.poolCodePresent !== undefined) facts.poolCodePresent = raw.facts.poolCodePresent;
  if (raw.facts.poolActiveLiquidity !== undefined) facts.poolActiveLiquidity = BigInt(raw.facts.poolActiveLiquidity);
  if (raw.facts.poolSqrtPriceX96 !== undefined) facts.poolSqrtPriceX96 = BigInt(raw.facts.poolSqrtPriceX96);
  if (raw.facts.poolTick !== undefined) facts.poolTick = raw.facts.poolTick;
  if (raw.facts.creatorTokenBalance !== undefined) facts.creatorTokenBalance = BigInt(raw.facts.creatorTokenBalance);
  if (raw.facts.tokenTotalSupply !== undefined) facts.tokenTotalSupply = BigInt(raw.facts.tokenTotalSupply);
  if (raw.facts.tokenDecimals !== undefined) facts.tokenDecimals = raw.facts.tokenDecimals;
  return {
    ...raw,
    observedBlock: BigInt(raw.observedBlock),
    facts
  };
}
