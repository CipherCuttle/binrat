import type { LaunchObserved, Hex } from '../core/types.js';
import { canonicalJson } from '../evidence/canonical.js';
import { buildProvenanceFact } from '../intelligence/provenance.js';
import { projectPublicFeed } from '../public/project.js';
import type { PublicFeed } from '../public/types.js';
import type { D1DatabaseLike } from './d1Types.js';
import { D1Store } from './d1Store.js';
import { readPublicSnapshot } from './publicSnapshot.js';

// Existing Case projection, bounded to this deployer's latest twenty launches
// through the requested launch. No RPC, fabricated facts or complete-history claim.
export async function readPublicCaseFeed(db: D1DatabaseLike, id: string): Promise<PublicFeed | null> {
  if (!/^[0-9a-f]{64}$/.test(id)) throw new Error('BAG_ID_INVALID');
  const snapshot = await readPublicSnapshot(db);
  if (!snapshot) return null;
  const target = await new D1Store(db, 4663).getLaunch(id);
  if (!target || target.chainId !== 4663 || target.source !== 'PONS_V2' || target.blockNumber > BigInt(snapshot.checkpointBlock)) return null;
  const rows = await db.prepare(`SELECT l.authority_json,l.observed_at_ms,
      f.fact_id,f.payload_json,f.evidence_digest
    FROM launches l JOIN provenance_facts f ON f.launch_id=l.launch_id AND f.chain_id=l.chain_id
    WHERE l.chain_id=4663 AND l.source='PONS_V2' AND l.creator=?
      AND (CAST(l.block_number AS INTEGER)<CAST(? AS INTEGER)
        OR (l.block_number=? AND (l.log_index<? OR (l.log_index=? AND l.launch_id<=?))))
    ORDER BY CAST(l.block_number AS INTEGER) DESC,l.log_index DESC,l.launch_id DESC LIMIT 20`)
    .bind(target.creator,target.blockNumber.toString(),target.blockNumber.toString(),target.logIndex,target.logIndex,id)
    .all<{authority_json:string;observed_at_ms:number;fact_id:string;payload_json:string;evidence_digest:string}>();
  if (!rows.success) throw new Error('PUBLIC_CASE_UNAVAILABLE');
  const launches: LaunchObserved[] = [];
  const facts = [];
  for (const row of rows.results ?? []) {
    const raw = JSON.parse(row.authority_json) as Record<string, unknown>;
    const launch = { ...raw, blockNumber: BigInt(String(raw.blockNumber)), observedAtMs: row.observed_at_ms } as unknown as LaunchObserved;
    if (launch.chainId !== 4663 || launch.source !== 'PONS_V2' || launch.creator !== target.creator ||
        launch.blockNumber > BigInt(snapshot.checkpointBlock)) throw new Error('PUBLIC_CASE_BINDING_INVALID');
    const fact = await buildProvenanceFact(launch);
    if (row.fact_id !== fact.factId || row.evidence_digest !== fact.evidenceDigest || row.payload_json !== canonicalJson(fact)) {
      throw new Error('PUBLIC_CASE_PROVENANCE_INVALID');
    }
    launches.push(launch); facts.push(fact);
  }
  const included = launches.find(launch => launch.launchId === id);
  if (!included || canonicalJson(included) !== canonicalJson(target)) throw new Error('PUBLIC_CASE_TARGET_INVALID');
  return projectPublicFeed({ chainId: 4663, asOfBlock: BigInt(snapshot.checkpointBlock),
    asOfBlockHash: snapshot.checkpointBlockHash as Hex, launches, facts });
}
