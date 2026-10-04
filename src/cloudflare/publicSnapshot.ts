import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import type { D1DatabaseLike } from './d1Types.js';
import { D1RuntimeStateStore, verifiedRuntimeTarget } from './runtimeState.js';

export const PUBLIC_SNAPSHOT_CHAIN_ID = 4663 as const;
export const PUBLIC_STATUS_SCHEMA = 'binrat.public-status/0.1' as const;
export const PUBLIC_LATEST_SCHEMA = 'binrat.latest-launches/0.1' as const;

export interface PublishedPublicSnapshot {
  schemaVersion: typeof PUBLIC_LATEST_SCHEMA;
  chainId: typeof PUBLIC_SNAPSHOT_CHAIN_ID;
  sourceCheckpoint: string;
  checkpointBlockHash: string;
  historyCoverage: 'PARTIAL';
  launches: unknown[];
  feedDigest: string;
}

export interface StoredPublicSnapshot {
  chainId: typeof PUBLIC_SNAPSHOT_CHAIN_ID;
  checkpointBlock: string;
  checkpointBlockHash: string;
  feedDigest: string;
  snapshot: PublishedPublicSnapshot;
  verifiedAtMs: number;
  publicationVersion: number;
}

interface SnapshotRow {
  chain_id: number;
  checkpoint_block: string;
  checkpoint_block_hash: string;
  feed_digest: string;
  snapshot_json: string;
  verified_at_ms: number;
  publication_version: number;
}

export async function buildPublicSnapshot(
  input: Omit<PublishedPublicSnapshot, 'feedDigest'>
): Promise<PublishedPublicSnapshot> {
  if (input.schemaVersion !== PUBLIC_LATEST_SCHEMA || input.chainId !== PUBLIC_SNAPSHOT_CHAIN_ID ||
      !/^(0|[1-9]\d*)$/.test(input.sourceCheckpoint) ||
      !/^0x[0-9a-f]{64}$/.test(input.checkpointBlockHash) ||
      input.historyCoverage !== 'PARTIAL' || !Array.isArray(input.launches) || input.launches.length > 20) {
    throw new Error('PUBLIC_SNAPSHOT_INPUT_INVALID');
  }
  const checkpoint=BigInt(input.sourceCheckpoint);
  for(const raw of input.launches) {
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new Error('PUBLIC_SNAPSHOT_LAUNCH_INVALID');
    const launch=raw as Record<string,unknown>;
    const metadata=launch.metadata as Record<string,unknown>|null;
    if(typeof launch.launchId!=='string'||! /^[0-9a-f]{64}$/.test(launch.launchId)||
       launch.factId!==`binrat-fact:${PUBLIC_SNAPSHOT_CHAIN_ID}:${launch.launchId}`||
       typeof launch.token!=='string'||!/^0x[0-9a-f]{40}$/.test(launch.token)||
       typeof launch.txHash!=='string'||!/^0x[0-9a-f]{64}$/.test(launch.txHash)||
       typeof launch.deployer!=='string'||!/^0x[0-9a-f]{40}$/.test(launch.deployer)||
       typeof launch.blockNumber!=='string'||! /^(0|[1-9]\d*)$/.test(launch.blockNumber)||
       BigInt(launch.blockNumber)>checkpoint||
       !Number.isSafeInteger(launch.priorLaunchCount)||Number(launch.priorLaunchCount)<0||
       !metadata||['imageUri','website','twitter','telegram'].some((key)=>typeof metadata[key]!=='string')) {
      throw new Error('PUBLIC_SNAPSHOT_LAUNCH_INVALID');
    }
  }
  const material = {
    schemaVersion: input.schemaVersion,
    chainId: input.chainId,
    sourceCheckpoint: input.sourceCheckpoint,
    checkpointBlockHash: input.checkpointBlockHash,
    historyCoverage: input.historyCoverage,
    launches: input.launches
  };
  return { ...material, feedDigest: await sha256Hex(material) };
}

export async function publishPublicSnapshot(
  db: D1DatabaseLike,
  snapshot: PublishedPublicSnapshot,
  verifiedAtMs: number
): Promise<void> {
  const validated = await buildPublicSnapshot({
    schemaVersion: snapshot.schemaVersion,
    chainId: snapshot.chainId,
    sourceCheckpoint: snapshot.sourceCheckpoint,
    checkpointBlockHash: snapshot.checkpointBlockHash,
    historyCoverage: snapshot.historyCoverage,
    launches: snapshot.launches
  });
  if (validated.feedDigest !== snapshot.feedDigest || !Number.isSafeInteger(verifiedAtMs) || verifiedAtMs < 0) {
    throw new Error('PUBLIC_SNAPSHOT_VALIDATION_FAILED');
  }
  const current = await db.prepare(
    'SELECT publication_version FROM binrat_public_snapshots WHERE chain_id=? LIMIT 1'
  ).bind(PUBLIC_SNAPSHOT_CHAIN_ID).first<{publication_version:number}>();
  const publicationVersion = (current?.publication_version ?? 0) + 1;
  const result = await db.prepare(`
    INSERT INTO binrat_public_snapshots (
      chain_id,checkpoint_block,checkpoint_block_hash,feed_digest,snapshot_json,verified_at_ms,publication_version
    ) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(chain_id) DO UPDATE SET
      checkpoint_block=excluded.checkpoint_block,
      checkpoint_block_hash=excluded.checkpoint_block_hash,
      feed_digest=excluded.feed_digest,
      snapshot_json=excluded.snapshot_json,
      verified_at_ms=excluded.verified_at_ms,
      publication_version=excluded.publication_version
  `).bind(
    snapshot.chainId,snapshot.sourceCheckpoint,snapshot.checkpointBlockHash,snapshot.feedDigest,
    canonicalJson(snapshot),verifiedAtMs,publicationVersion
  ).run();
  if (!result.success) throw new Error('PUBLIC_SNAPSHOT_PUBLICATION_FAILED');
}

export async function readPublicSnapshot(db: D1DatabaseLike): Promise<StoredPublicSnapshot | null> {
  const row = await db.prepare(`
    SELECT chain_id,checkpoint_block,checkpoint_block_hash,feed_digest,snapshot_json,verified_at_ms,publication_version
    FROM binrat_public_snapshots WHERE chain_id=? LIMIT 1
  `).bind(PUBLIC_SNAPSHOT_CHAIN_ID).first<SnapshotRow>();
  if (!row) return null;
  if (row.chain_id !== PUBLIC_SNAPSHOT_CHAIN_ID || !/^(0|[1-9]\d*)$/.test(row.checkpoint_block) ||
      !/^0x[0-9a-f]{64}$/.test(row.checkpoint_block_hash) || !/^[0-9a-f]{64}$/.test(row.feed_digest) ||
      !Number.isSafeInteger(row.verified_at_ms) || row.verified_at_ms < 0 ||
      !Number.isSafeInteger(row.publication_version) || row.publication_version < 1) {
    throw new Error('PUBLIC_SNAPSHOT_ROW_INVALID');
  }
  let snapshot: PublishedPublicSnapshot;
  try { snapshot = JSON.parse(row.snapshot_json) as PublishedPublicSnapshot; }
  catch { throw new Error('PUBLIC_SNAPSHOT_JSON_INVALID'); }
  const canonical = await buildPublicSnapshot({
    schemaVersion: snapshot.schemaVersion,
    chainId: snapshot.chainId,
    sourceCheckpoint: snapshot.sourceCheckpoint,
    checkpointBlockHash: snapshot.checkpointBlockHash,
    historyCoverage: snapshot.historyCoverage,
    launches: snapshot.launches
  });
  if (canonicalJson(snapshot) !== row.snapshot_json || canonical.feedDigest !== row.feed_digest ||
      snapshot.sourceCheckpoint !== row.checkpoint_block || snapshot.checkpointBlockHash !== row.checkpoint_block_hash) {
    throw new Error('PUBLIC_SNAPSHOT_DIGEST_INVALID');
  }
  return {
    chainId: PUBLIC_SNAPSHOT_CHAIN_ID,
    checkpointBlock: row.checkpoint_block,
    checkpointBlockHash: row.checkpoint_block_hash,
    feedDigest: row.feed_digest,
    snapshot,
    verifiedAtMs: row.verified_at_ms,
    publicationVersion: row.publication_version
  };
}

export async function publicStatus(
  db: D1DatabaseLike,
  nowMs: number,
  maxAgeMs: number
): Promise<Record<string, unknown>> {
  const [snapshot, runtime] = await Promise.all([
    readPublicSnapshot(db),
    new D1RuntimeStateStore(db, PUBLIC_SNAPSHOT_CHAIN_ID).get()
  ]);
  if (!snapshot) return {
    schemaVersion: PUBLIC_STATUS_SCHEMA,chainId: PUBLIC_SNAPSHOT_CHAIN_ID,state:'NO_VERIFIED_SNAPSHOT',
    checkpointBlock:null,checkpointBlockHash:null,feedDigest:null,verifiedAtMs:null,
    runtimeUpdatedAtMs:runtime?.updatedAtMs ?? null,lastSyncError:runtime?.lastSyncError ?? null
  };
  const checkpointBlock = BigInt(snapshot.checkpointBlock);
  const target = verifiedRuntimeTarget(runtime, checkpointBlock, nowMs, maxAgeMs);
  const fresh = target === checkpointBlock && Boolean(runtime?.liveCaughtUp);
  return {
    schemaVersion: PUBLIC_STATUS_SCHEMA,chainId: PUBLIC_SNAPSHOT_CHAIN_ID,
    state:fresh ? 'FRESH_VERIFIED' : 'STALE_VERIFIED',
    checkpointBlock:snapshot.checkpointBlock,checkpointBlockHash:snapshot.checkpointBlockHash,
    feedDigest:snapshot.feedDigest,verifiedAtMs:snapshot.verifiedAtMs,
    runtimeUpdatedAtMs:runtime?.updatedAtMs ?? null,lastSyncError:runtime?.lastSyncError ?? null
  };
}
