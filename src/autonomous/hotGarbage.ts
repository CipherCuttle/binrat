import type { D1DatabaseLike } from '../cloudflare/d1Types.js';
import { authoritativeCheckpoint, evidenceForLaunch } from './evidence.js';
import { RATS_RECENT_BLOCK_WINDOW } from './rats.js';

export const HOT_GARBAGE_RULE_VERSION = 'HOT_GARBAGE_PONS_RECURRENCE_V1' as const;
const MAX_HOT_CANDIDATES = 8;
const MAX_PREVIOUS_LAUNCHES = 3;

export interface HotGarbageLaunch {
  launchId: string;
  token: string;
  symbol: string;
  name: string;
  blockNumber: string;
}

export interface HotGarbageCandidate {
  rankPosition: number;
  deployer: string;
  recurrenceCount: number;
  latestLaunch: HotGarbageLaunch;
  previousLaunches: HotGarbageLaunch[];
  memory: {
    rememberedPriorLaunches: number;
    outcomeReceipts: number;
  };
}

export interface HotGarbageSnapshot {
  chainId: 4663;
  sourceCheckpoint: string;
  coverage: 'PARTIAL';
  ruleVersion: typeof HOT_GARBAGE_RULE_VERSION;
  candidates: HotGarbageCandidate[];
}

interface CandidateRow {
  creator: string;
  recurrence_count: number;
  latest_block: string;
}

interface CandidateLaunchRow {
  launch_id: string;
  token: string;
  symbol: string;
  name: string;
  block_number: string;
}

interface MemoryRow {
  launch_id: string;
  receipts: number;
}

/**
 * Read-only Mini App attention projection.
 *
 * This intentionally does not persist discovery snapshots or case receipts.
 * Passive app opening must never create evidence state. A case is created only
 * after an explicit DIG/RECEIPTS action.
 */
export async function readHotGarbage(
  db: D1DatabaseLike,
  now: number,
  requestedLimit = 5
): Promise<HotGarbageSnapshot> {
  const chainId = 4663;
  const tip = await authoritativeCheckpoint(db, now, chainId);
  const limit = Math.max(1, Math.min(MAX_HOT_CANDIDATES, requestedLimit));

  const rows = await db.prepare(`SELECT l.creator, COUNT(DISTINCT l.launch_id) AS recurrence_count,
      MAX(CAST(l.block_number AS INTEGER)) AS latest_block
    FROM launches l
    JOIN provenance_facts f ON f.launch_id=l.launch_id AND f.chain_id=l.chain_id
    WHERE l.chain_id=? AND l.source='PONS_V2' AND CAST(l.block_number AS INTEGER)<=?
    GROUP BY l.creator
    HAVING COUNT(DISTINCT l.launch_id)>=2
      AND MAX(CAST(l.block_number AS INTEGER))>=?
    ORDER BY latest_block DESC, recurrence_count DESC, l.creator ASC
    LIMIT ?`)
    .bind(
      chainId,
      Number(tip),
      Number(tip > RATS_RECENT_BLOCK_WINDOW ? tip - RATS_RECENT_BLOCK_WINDOW : 0n),
      limit
    )
    .all<CandidateRow>();
  if (!rows.success) throw new Error('HOT_GARBAGE_UNAVAILABLE');

  const candidates: HotGarbageCandidate[] = [];
  for (const row of rows.results ?? []) {
    const recurrenceCount = Number(row.recurrence_count);
    if (
      !/^0x[0-9a-f]{40}$/.test(row.creator) ||
      !Number.isSafeInteger(recurrenceCount) ||
      recurrenceCount < 2 ||
      !/^\d+$/.test(String(row.latest_block))
    ) {
      continue;
    }

    const launches = await db.prepare(`SELECT launch_id,token,symbol,name,block_number
      FROM launches
      WHERE chain_id=? AND source='PONS_V2' AND creator=? AND CAST(block_number AS INTEGER)<=?
      ORDER BY CAST(block_number AS INTEGER) DESC,log_index DESC,launch_id DESC
      LIMIT ?`)
      .bind(chainId, row.creator, Number(tip), 1 + MAX_PREVIOUS_LAUNCHES)
      .all<CandidateLaunchRow>();
    if (!launches.success || (launches.results?.length ?? 0) < 2) continue;

    const retained: HotGarbageLaunch[] = [];
    let invalid = false;
    for (const item of launches.results ?? []) {
      if (
        !/^[0-9a-f]{64}$/.test(item.launch_id) ||
        !/^0x[0-9a-f]{40}$/.test(item.token) ||
        !/^\d+$/.test(item.block_number) ||
        typeof item.symbol !== 'string' ||
        typeof item.name !== 'string'
      ) {
        invalid = true;
        break;
      }
      try {
        const evidence = await evidenceForLaunch(db, item.launch_id, tip, chainId);
        if (evidence.creator !== row.creator || evidence.blockNumber !== item.block_number) {
          invalid = true;
          break;
        }
      } catch {
        invalid = true;
        break;
      }
      retained.push({
        launchId: item.launch_id,
        token: item.token,
        symbol: item.symbol,
        name: item.name,
        blockNumber: item.block_number
      });
    }
    if (invalid || retained.length < 2) continue;

    const latestLaunch = retained[0]!;
    const previousLaunches = retained.slice(1);
    const placeholders = previousLaunches.map(() => '?').join(',');
    let rememberedPriorLaunches = 0;
    let outcomeReceipts = 0;
    if (placeholders) {
      const memory = await db.prepare(`SELECT launch_id,COUNT(*) AS receipts
        FROM pons_outcome_receipts
        WHERE chain_id=? AND launch_id IN (${placeholders})
        GROUP BY launch_id`)
        .bind(chainId, ...previousLaunches.map(item => item.launchId))
        .all<MemoryRow>();
      if (!memory.success) throw new Error('HOT_GARBAGE_MEMORY_UNAVAILABLE');
      for (const item of memory.results ?? []) {
        const receipts = Number(item.receipts);
        if (!/^[0-9a-f]{64}$/.test(item.launch_id) || !Number.isSafeInteger(receipts) || receipts < 1) {
          throw new Error('HOT_GARBAGE_MEMORY_UNAVAILABLE');
        }
        rememberedPriorLaunches += 1;
        outcomeReceipts += receipts;
      }
    }

    candidates.push({
      rankPosition: candidates.length + 1,
      deployer: row.creator,
      recurrenceCount,
      latestLaunch,
      previousLaunches,
      memory: { rememberedPriorLaunches, outcomeReceipts }
    });
  }

  return {
    chainId,
    sourceCheckpoint: tip.toString(),
    coverage: 'PARTIAL',
    ruleVersion: HOT_GARBAGE_RULE_VERSION,
    candidates
  };
}
