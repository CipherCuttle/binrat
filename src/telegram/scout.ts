import type { D1DatabaseLike } from '../cloudflare/d1Types.js';
import type { PublicBag, PublicFeed } from '../public/types.js';

export const SCOUT_SCHEMA_VERSION = 'binrat.telegram-scout/0.1' as const;
export const SCOUT_WINDOW_MS = 14 * 86_400_000;
const ALLOWED_HORIZONS = new Set([300_000, 3_600_000, 86_400_000]);
const MAX_OBSERVATIONS = 6_000;
const MAX_CANDIDATES = 3;

export interface ScoutObservationRow {
  launch_id: string;
  horizon_ms: number;
  target_ms: number | null;
  observed_block: string;
  observed_block_hash: string;
}
export interface ScoutCreator {
  role: 'ARCPAD_REPORTED_CREATOR';
  address: string;
  launchCount14d: number;
  latestLaunchTimestampMs: number;
  launches: Array<{ id: string; symbol: string; token: string; blockNumber: string }>;
}
export interface ScoutProjection {
  schemaVersion: typeof SCOUT_SCHEMA_VERSION;
  chainId: number;
  source: 'ARCPAD';
  role: 'ARCPAD_REPORTED_CREATOR';
  asOfBlock: string;
  historyCoverage: PublicFeed['historyCoverage'];
  windowStartMs: number;
  windowEndMs: number;
  observedInWindow: number;
  excludedNoTimestamp: number;
  excludedConflictingTimestamp: number;
  candidates: ScoutCreator[];
  metrics: {
    marketCapUsd: null;
    volume24hUsd: null;
    reason: 'NO_VERIFIED_USD_PRICE_OR_CIRCULATING_SUPPLY_OR_COMPLETE_SWAP_VOLUME';
  };
  recommendationBoundary: string;
}

/**
 * This query is intentionally indexed-evidence-only, never live RPC per DM.
 * Observed_at_ms on launches is INGESTION time, not block time. The signed
 * horizon targets in canonical observation payloads yield launch block time.
 */
export async function readScoutObservationRows(
  db: D1DatabaseLike, feed: PublicFeed
): Promise<ScoutObservationRow[]> {
  const tip = BigInt(feed.asOfBlock);
  if (tip < 0n || tip > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('SCOUT_CHECKPOINT_INVALID');
  const rows = await db.prepare(
    "SELECT launch_id, horizon_ms, json_extract(payload_json,'$.targetTimestampMs') AS target_ms," +
    ' observed_block, observed_block_hash FROM launch_observations ' +
    'WHERE chain_id=? AND CAST(observed_block AS INTEGER)<=? ' +
    'AND horizon_ms IN (300000,3600000,86400000) ' +
    'ORDER BY CAST(observed_block AS INTEGER) DESC, launch_id, horizon_ms LIMIT ?'
  ).bind(feed.chainId, Number(tip), MAX_OBSERVATIONS + 1).all<ScoutObservationRow>();
  if (!rows.success) throw new Error('SCOUT_EVIDENCE_READ_FAILED');
  if ((rows.results?.length ?? 0) > MAX_OBSERVATIONS) {
    throw new Error('SCOUT_INDEX_TOO_LARGE_NEEDS_SNAPSHOT');
  }
  return rows.results ?? [];
}

export function parseScoutRequest(text: string): 'CREATORS' | 'RECIPIENTS_UNAVAILABLE' | null {
  const cleaned = text.trim();
  if (!cleaned || cleaned.length > 500) return null;
  if (cleaned.startsWith('/')) {
    if (/^\/scout(?:@[a-z0-9_]+)?(?:\s+creators?)?$/i.test(cleaned)) return 'CREATORS';
    if (/^\/scout(?:@[a-z0-9_]+)?\s+(?:buyers?|recipients?|whales?)$/i.test(cleaned)) {
      return 'RECIPIENTS_UNAVAILABLE';
    }
    return null;
  }
  if (/\b(?:latest|recent|last|new)\b.{0,65}\b(?:wallets?|creators?|addresses?)\b/i.test(cleaned) &&
      /\b(?:show|find|list|follow|watch|track|interesting|worth)\b/i.test(cleaned)) {
    return 'CREATORS';
  }
  if (/\b(?:wallets?|creators?|addresses?)\b.{0,55}\b(?:worth following|to follow|to watch|to track)\b/i.test(cleaned)) {
    return 'CREATORS';
  }
  return null;
}

/** The projection sorts by OBSERVED CREATOR RECURRENCE, not profitability. */
export function projectScoutCreators(
  feed: PublicFeed, rows: readonly ScoutObservationRow[], nowMs: number
): ScoutProjection {
  if (!Number.isSafeInteger(nowMs) || nowMs < SCOUT_WINDOW_MS) throw new Error('SCOUT_NOW_INVALID');
  if (feed.schemaVersion !== 'binrat.public-feed/0.1' ||
      feed.chainId !== 5042 ||
      !/^\d+$/.test(feed.asOfBlock)) throw new Error('SCOUT_FEED_INVALID');
  const asOfBlock = BigInt(feed.asOfBlock);
  const cutoff = nowMs - SCOUT_WINDOW_MS;
  const launchById = new Map<string, PublicBag>();
  for (const bag of feed.bags) {
    if (bag.source !== 'ARCPAD' || BigInt(bag.blockNumber) > asOfBlock) continue;
    launchById.set(bag.id, bag);
  }

  const timeByLaunch = new Map<string, {timestampMs: number; conflict: boolean}>();
  for (const row of rows) {
    const bag = launchById.get(row.launch_id);
    if (!bag || !ALLOWED_HORIZONS.has(row.horizon_ms)) continue;
    let block: bigint;
    try { block = BigInt(row.observed_block); } catch { continue; }
    if (block < BigInt(bag.blockNumber) || block > asOfBlock) continue;
    if (!/^0x[0-9a-fA-F]{64}$/.test(row.observed_block_hash)) continue;
    const target = row.target_ms;
    if (!Number.isSafeInteger(target) || target === null || target < row.horizon_ms) continue;
    const timestampMs = target - row.horizon_ms;
    const previous = timeByLaunch.get(row.launch_id);
    if (!previous) timeByLaunch.set(row.launch_id, { timestampMs, conflict: false });
    else if (previous.timestampMs !== timestampMs) previous.conflict = true;
  }

  let excludedNoTimestamp = 0;
  let excludedConflictingTimestamp = 0;
  let observedInWindow = 0;
  const byCreator = new Map<string, {address:string;latest:number;bags:PublicBag[]}>();
  for (const bag of launchById.values()) {
    const time = timeByLaunch.get(bag.id);
    if (!time) { excludedNoTimestamp++; continue; }
    if (time.conflict) { excludedConflictingTimestamp++; continue; }
    if (time.timestampMs < cutoff || time.timestampMs > nowMs) continue;
    observedInWindow++;
    const address = bag.reportedCreatorAddress.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address)) continue;
    const record = byCreator.get(address) ?? { address, latest: 0, bags: [] };
    record.latest = Math.max(record.latest, time.timestampMs);
    record.bags.push(bag);
    byCreator.set(address, record);
  }
  const candidates: ScoutCreator[] = [...byCreator.values()]
    .sort((a,b) => b.bags.length-a.bags.length || b.latest-a.latest || a.address.localeCompare(b.address))
    .slice(0,MAX_CANDIDATES)
    .map(record => ({
      role: 'ARCPAD_REPORTED_CREATOR', address:record.address,
      launchCount14d:record.bags.length, latestLaunchTimestampMs:record.latest,
      launches:record.bags.sort((a,b)=>BigInt(b.blockNumber)>BigInt(a.blockNumber)?1:BigInt(b.blockNumber)<BigInt(a.blockNumber)?-1:0)
        .map(bag=>({id:bag.id,symbol:bag.symbol,token:bag.token,blockNumber:bag.blockNumber}))
    }));
  return {
    schemaVersion:SCOUT_SCHEMA_VERSION, chainId:feed.chainId, source:'ARCPAD',
    role:'ARCPAD_REPORTED_CREATOR', asOfBlock:feed.asOfBlock,
    historyCoverage:feed.historyCoverage, windowStartMs:cutoff, windowEndMs:nowMs,
    observedInWindow, excludedNoTimestamp, excludedConflictingTimestamp, candidates,
    metrics:{marketCapUsd:null,volume24hUsd:null,
      reason:'NO_VERIFIED_USD_PRICE_OR_CIRCULATING_SUPPLY_OR_COMPLETE_SWAP_VOLUME'},
    recommendationBoundary:'Observed exact-address recurrence, not a profitability or BUY/SELL recommendation.'
  };
}

export function renderScoutCaption(value: ScoutProjection): string {
  const days = 'LAST 14 DAYS';
  const intro = '🐀 ' + (value.candidates.length ? 'FOUND SOME TRACKS' : 'EMPTY PAWS') +
    '\n' + days + ' · ArcPad / Arc ' + value.chainId +
    '\nRole: source-reported creator (not proven trader)' +
    '\nsource checkpoint: #' + value.asOfBlock;
  const groups = value.candidates.map((row,i)=> {
    const symbols = row.launches.slice(0,2).map(x =>
      x.symbol.replace(/[^\p{L}\p{N}$_.-]/gu, '').slice(0,18) || '?'
    ).join(', ');
    const more = row.launches.length>2 ? ' (+'+(row.launches.length-2)+' more)' : '';
    return (i+1)+'. '+row.address+'\n   '+row.launchCount14d+
      ' indexed launches · '+symbols+more;
  });
  const footer = '\nMC: unavailable · 24h volume: unavailable (USD source not verified)' +
    '\nHistory: '+value.historyCoverage+
    ' · timestamps missing: '+value.excludedNoTimestamp+
    ' · conflicted: '+value.excludedConflictingTimestamp+
    '\nObserved activity only. No trade call. /watch 0x... for creator alerts.';
  const base = intro + (groups.length ? '\n\n'+groups.join('\n\n') : '\n\nNo source-timestamped creator launches in this window.') + '\n'+footer;
  if (base.length <= 1024) return base;
  // Keep full addresses when fitting a caption; drop lower-ranked cards, never truncate IDs.
  for (let n=groups.length-1;n>=0;n--) {
    const compact=intro+(n ? '\n\n'+groups.slice(0,n).join('\n\n') : '')+'\n'+footer;
    if (compact.length<=1024) return compact;
  }
  return (intro+'\n\nResults too long; open the source-backed Creator File for full receipts.').slice(0,1024);
}
