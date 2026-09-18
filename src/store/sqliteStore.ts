import Database from 'better-sqlite3';
import { canonicalJson } from '../evidence/canonical.js';
import { normalizeLaunchHex, sameLaunchAuthority } from '../core/identity.js';
import type { ChainCheckpoint, Hex, LaunchObserved } from '../core/types.js';
import type { LaunchStore } from '../core/ports.js';
import type { ProvenanceEdge, ProvenanceFact } from '../intelligence/provenance.js';
import type { LaunchObservationReceipt } from '../observations/types.js';
import { SCHEMA_SQL } from './schema.js';

export class SqliteStore implements LaunchStore {
  private readonly db: Database.Database;

  constructor(path: string, private readonly chainId: number) {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA_SQL);
  }

  close(): void { this.db.close(); }

  async putLaunch(value: LaunchObserved): Promise<'INSERTED' | 'DUPLICATE'> {
    if (value.chainId !== this.chainId) throw new Error(`LAUNCH_CHAIN_MISMATCH:${value.launchId}`);
    const launch = normalizeLaunchHex(value);
    const result = this.db.prepare(`
      INSERT OR IGNORE INTO launches (
        launch_id,event_id,chain_id,block_number,block_hash,source,launcher,tx_hash,log_index,
        token,creator,pool,name,symbol,image_uri,website,twitter,telegram,observed_at_ms
      ) VALUES (
        @launchId,@eventId,@chainId,@blockNumber,@blockHash,@source,@launcher,@txHash,@logIndex,
        @token,@creator,@pool,@name,@symbol,@imageUri,@website,@twitter,@telegram,@observedAtMs
      )
    `).run({ ...launch, blockNumber: launch.blockNumber.toString() });
    if (result.changes === 1) return 'INSERTED';

    const row = this.db.prepare(`
      SELECT * FROM launches
      WHERE launch_id = ? OR (chain_id = ? AND tx_hash = ? AND token = ?) OR (chain_id = ? AND token = ?)
      LIMIT 1
    `).get(launch.launchId, launch.chainId, launch.txHash, launch.token, launch.chainId, launch.token) as LaunchRow | undefined;
    if (!row || !sameLaunchAuthority(fromLaunchRow(row), launch)) {
      throw new Error(`LAUNCH_IDENTITY_CONFLICT:${launch.launchId}`);
    }
    return 'DUPLICATE';
  }

  async getLaunch(launchId: string): Promise<LaunchObserved | null> {
    const row = this.db.prepare('SELECT * FROM launches WHERE launch_id = ?').get(launchId) as LaunchRow | undefined;
    return row ? fromLaunchRow(row) : null;
  }

  async getLaunchByToken(token: Hex): Promise<LaunchObserved | null> {
    const row = this.db.prepare('SELECT * FROM launches WHERE chain_id = ? AND token = ?').get(this.chainId, token.toLowerCase()) as LaunchRow | undefined;
    return row ? fromLaunchRow(row) : null;
  }

  async listLaunches(): Promise<LaunchObserved[]> {
    const rows = this.db.prepare(`
      SELECT * FROM launches WHERE chain_id = ?
      ORDER BY CAST(block_number AS INTEGER), log_index, launch_id
    `).all(this.chainId) as LaunchRow[];
    return rows.map(fromLaunchRow);
  }

  async listLaunchesMissingProvenance(): Promise<LaunchObserved[]> {
    const rows = this.db.prepare(`
      SELECT l.* FROM launches l
      LEFT JOIN provenance_facts p ON p.launch_id = l.launch_id
      WHERE l.chain_id = ? AND p.launch_id IS NULL
      ORDER BY CAST(l.block_number AS INTEGER), l.log_index, l.launch_id
    `).all(this.chainId) as LaunchRow[];
    return rows.map(fromLaunchRow);
  }

  async putProvenanceFact(fact: ProvenanceFact): Promise<'INSERTED' | 'DUPLICATE'> {
    if (fact.chainId !== this.chainId) throw new Error(`PROVENANCE_CHAIN_MISMATCH:${fact.factId}`);
    const payload = canonicalJson(fact);
    const result = this.db.prepare(`
      INSERT OR IGNORE INTO provenance_facts (
        fact_id,chain_id,launch_id,creator,observed_block,observed_block_hash,log_index,source_event_id,evidence_digest,payload_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      fact.factId, fact.chainId, fact.launchId, fact.creator.toLowerCase(), fact.observedBlock.toString(),
      fact.observedBlockHash.toLowerCase(), fact.logIndex, fact.sourceEventId, fact.evidenceDigest, payload
    );
    if (result.changes === 1) return 'INSERTED';
    const existing = this.db.prepare('SELECT fact_id,evidence_digest,payload_json FROM provenance_facts WHERE fact_id = ? OR launch_id = ? LIMIT 1')
      .get(fact.factId, fact.launchId) as { fact_id: string; evidence_digest: string; payload_json: string } | undefined;
    if (!existing || existing.fact_id !== fact.factId || existing.evidence_digest !== fact.evidenceDigest || existing.payload_json !== payload) {
      throw new Error(`PROVENANCE_FACT_IDENTITY_CONFLICT:${fact.factId}`);
    }
    return 'DUPLICATE';
  }

  async listProvenanceFacts(): Promise<ProvenanceFact[]> {
    const rows = this.db.prepare(`SELECT payload_json FROM provenance_facts WHERE chain_id = ? ORDER BY CAST(observed_block AS INTEGER),log_index,fact_id`)
      .all(this.chainId) as Array<{ payload_json: string }>;
    return rows.map((row) => reviveFact(row.payload_json));
  }

  async replaceProvenanceEdges(edges: ProvenanceEdge[]): Promise<void> {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM provenance_edges WHERE chain_id = ?').run(this.chainId);
      const insert = this.db.prepare(`
        INSERT INTO provenance_edges (
          edge_id,chain_id,kind,from_id,to_id,evidence_class,observed_block,observed_block_hash,
          source_fact_ids_json,derivation_version,evidence_digest,payload_json
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      for (const edge of edges) {
        if (edge.chainId !== this.chainId) continue;
        insert.run(
          edge.edgeId, edge.chainId, edge.kind, edge.from, edge.to, edge.evidenceClass,
          edge.observedBlock.toString(), edge.observedBlockHash.toLowerCase(), canonicalJson(edge.sourceFactIds),
          edge.derivationVersion, edge.evidenceDigest, canonicalJson(edge)
        );
      }
    });
    tx();
  }

  async listProvenanceEdges(): Promise<ProvenanceEdge[]> {
    const rows = this.db.prepare(`SELECT payload_json FROM provenance_edges WHERE chain_id = ? ORDER BY CAST(observed_block AS INTEGER),edge_id`)
      .all(this.chainId) as Array<{ payload_json: string }>;
    return rows.map((row) => reviveEdge(row.payload_json));
  }

  async putObservation(receipt: LaunchObservationReceipt): Promise<'INSERTED' | 'DUPLICATE'> {
    if (receipt.chainId !== this.chainId) throw new Error(`OBSERVATION_CHAIN_MISMATCH:${receipt.observationId}`);
    const payload = canonicalJson(receipt);
    const result = this.db.prepare(`
      INSERT OR IGNORE INTO launch_observations (
        observation_id,observation_version,chain_id,launch_id,horizon_ms,observed_block,
        observed_block_hash,observed_timestamp_ms,evidence_digest,payload_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      receipt.observationId, receipt.observationVersion, receipt.chainId, receipt.launchId,
      receipt.horizonMs, receipt.observedBlock.toString(), receipt.observedBlockHash.toLowerCase(),
      receipt.observedTimestampMs, receipt.evidenceDigest, payload
    );
    if (result.changes === 1) return 'INSERTED';

    const existing = this.db.prepare(`
      SELECT observation_id,evidence_digest,payload_json
      FROM launch_observations
      WHERE observation_id = ?
         OR (launch_id = ? AND horizon_ms = ? AND observation_version = ?)
      LIMIT 1
    `).get(
      receipt.observationId, receipt.launchId, receipt.horizonMs, receipt.observationVersion
    ) as { observation_id: string; evidence_digest: string; payload_json: string } | undefined;
    if (
      !existing ||
      existing.observation_id !== receipt.observationId ||
      existing.evidence_digest !== receipt.evidenceDigest ||
      existing.payload_json !== payload
    ) {
      throw new Error(`OBSERVATION_IDENTITY_CONFLICT:${receipt.observationId}`);
    }
    return 'DUPLICATE';
  }

  async listObservationsForLaunch(launchId: string): Promise<LaunchObservationReceipt[]> {
    const rows = this.db.prepare(`
      SELECT payload_json
      FROM launch_observations
      WHERE chain_id = ? AND launch_id = ?
      ORDER BY horizon_ms, observation_version, observation_id
    `).all(this.chainId, launchId) as Array<{ payload_json: string }>;
    return rows.map((row) => reviveObservation(row.payload_json));
  }

  async getCheckpoint(): Promise<ChainCheckpoint | null> {
    const row = this.db.prepare('SELECT * FROM chain_checkpoints WHERE chain_id = ?').get(this.chainId) as CheckpointRow | undefined;
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
    this.db.prepare(`
      INSERT INTO chain_checkpoints (chain_id,block_number,block_hash,guard_block_number,guard_block_hash)
      VALUES (?,?,?,?,?)
      ON CONFLICT(chain_id) DO UPDATE SET
        block_number=excluded.block_number,
        block_hash=excluded.block_hash,
        guard_block_number=excluded.guard_block_number,
        guard_block_hash=excluded.guard_block_hash
    `).run(
      this.chainId, checkpoint.blockNumber.toString(), checkpoint.blockHash.toLowerCase(),
      checkpoint.guardBlockNumber?.toString() ?? null, checkpoint.guardBlockHash?.toLowerCase() ?? null
    );
  }

  async rewindFromBlock(blockNumber: bigint): Promise<void> {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM provenance_edges WHERE chain_id = ?').run(this.chainId);
      this.db.prepare('DELETE FROM launch_observations WHERE chain_id = ? AND CAST(observed_block AS INTEGER) >= CAST(? AS INTEGER)')
        .run(this.chainId, blockNumber.toString());
      this.db.prepare('DELETE FROM launches WHERE chain_id = ? AND CAST(block_number AS INTEGER) >= CAST(? AS INTEGER)')
        .run(this.chainId, blockNumber.toString());
      const checkpoint = this.db.prepare('SELECT block_number FROM chain_checkpoints WHERE chain_id = ?').get(this.chainId) as { block_number: string } | undefined;
      if (checkpoint && BigInt(checkpoint.block_number) >= blockNumber) {
        this.db.prepare('DELETE FROM chain_checkpoints WHERE chain_id = ?').run(this.chainId);
      }
    });
    tx();
  }
}

interface LaunchRow {
  launch_id: string; event_id: string; chain_id: number; block_number: string; block_hash: Hex; source: 'ARCPAD';
  launcher: Hex; tx_hash: Hex; log_index: number; token: Hex; creator: Hex; pool: Hex; name: string; symbol: string;
  image_uri: string; website: string; twitter: string; telegram: string; observed_at_ms: number;
}
interface CheckpointRow {
  chain_id: number; block_number: string; block_hash: Hex; guard_block_number: string | null; guard_block_hash: Hex | null;
}

function fromLaunchRow(row: LaunchRow): LaunchObserved {
  return {
    launchId: row.launch_id, eventId: row.event_id, chainId: row.chain_id, blockNumber: BigInt(row.block_number),
    blockHash: row.block_hash, source: row.source, launcher: row.launcher, txHash: row.tx_hash, logIndex: row.log_index,
    token: row.token, creator: row.creator, pool: row.pool, name: row.name, symbol: row.symbol, imageUri: row.image_uri,
    website: row.website, twitter: row.twitter, telegram: row.telegram, observedAtMs: row.observed_at_ms
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
