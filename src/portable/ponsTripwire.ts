/** Native SQLite bridge for PR #178 @216647d214a7df05d1eb48e99d8af27dc4262392.
 * No timer, RPC construction, real transport or default activation. */
import { randomUUID } from 'node:crypto';
import type { WatchSource } from '../autonomous/source.js';
import { assertPrincipal } from '../autonomous/entitlements.js';
import { canonicalJson } from '../evidence/canonical.js';
import { deriveEventId, deriveLaunchId, launchAuthorityJson } from '../core/identity.js';
import type { LaunchObserved } from '../core/types.js';
import { buildProvenanceFact, type ProvenanceFact } from '../intelligence/provenance.js';
import { PONS_V2_FACTORY, ROBINHOOD_CHAIN_ID } from '../pons/chain.js';
import { TelegramUiError } from '../telegram/ui/client.js';
import { verifyTelegramInitData, type VerifiedMiniAppPrincipal } from '../telegram/miniAppAuth.js';
import { D1Store } from '../cloudflare/d1Store.js';
import type { D1DatabaseLike } from '../cloudflare/d1Types.js';
import { readPublicSnapshot } from '../cloudflare/publicSnapshot.js';
import { D1RuntimeStateStore, verifiedRuntimeTarget } from '../cloudflare/runtimeState.js';
import { D1TelegramLedger } from '../cloudflare/telegramLedger.js';
import type { PortableDatabase } from './sqlite.js';
import { PORTABLE_PONS_TRIPWIRE_SCHEMA, PORTABLE_PONS_TRIPWIRE_SOURCE_TRIGGERS,
  PORTABLE_PONS_TRIPWIRE_QUARANTINE } from './ponsTripwireSchema.js';

export const PONS_TRIPWIRE_LIMITS = Object.freeze({ watches:5, candidates:20, pending:5,
  dailyNotifications:5, watchIntervalMs:600_000, freshnessMs:180_000, headAgeMs:60_000, workMs:30_000 });
const HASH=/^0x[0-9a-f]{64}$/;
const ID=/^[0-9a-f]{64}$/;
const ADDRESS=/^0x[0-9a-f]{40}$/;
export interface PonsTripwireWatch {
  generation:string; deployer:string; sourceCaseUrl:string; startBlock:string; startHash:string;
  createdAtMs:number; state:'ACTIVE'|'CANCELLED'|'REORG'; latestNotificationState:string|null;
}
interface WatchRow {
  owner_id:string;chat_id:number;deployer:string;generation:string;source_launch_id:string;
  start_block:number;start_hash:string;created_at_ms:number;state:PonsTripwireWatch['state'];
  cursor_block:number;cursor_log_index:number;cursor_launch_id:string;next_allowed_ms:number;
}
interface PendingRow {
  delivery_id:string;watch_generation:string;owner_id:string;chat_id:number;deployer:string;
  launch_id:string;event_id:string;block_number:number;block_hash:string;evidence_digest:string;
  launch_authority_json:string;fact_payload_json:string;created_at_ms:number;
}
export interface PonsTripwireNotification { chatId:number;text:string;caseUrl:string;launchId:string;deployer:string;evidenceDigest:string }


/** Reuses canonical identity/provenance builders; ingestion time proves no recency. */
export async function validatePonsTripwireEvidence(db:D1DatabaseLike,id:string,asOf:bigint):Promise<{
  launch:LaunchObserved;fact:ProvenanceFact;authorityJson:string;factJson:string
}> {
  if(!ID.test(id)) throw new Error('PONS_TRIPWIRE_CASE_INVALID');
  const launch=await new D1Store(db,ROBINHOOD_CHAIN_ID).getLaunch(id);
  if(!launch||launch.chainId!==ROBINHOOD_CHAIN_ID||launch.source!=='PONS_V2'||
      launch.launcher!==PONS_V2_FACTORY||launch.blockNumber<0n||launch.blockNumber>asOf||
      launch.blockNumber>BigInt(Number.MAX_SAFE_INTEGER)||!HASH.test(launch.blockHash)||
      !HASH.test(launch.txHash)||!ADDRESS.test(launch.creator)||!ADDRESS.test(launch.token)||
      !ADDRESS.test(launch.pool)||!Number.isSafeInteger(launch.logIndex)||launch.logIndex<0) {
    throw new Error('PONS_TRIPWIRE_EVIDENCE_INVALID');
  }
  const [launchId,eventId]=await Promise.all([deriveLaunchId(launch),deriveEventId(launch)]);
  if(launch.launchId!==launchId||launch.eventId!==eventId) throw new Error('PONS_TRIPWIRE_IDENTITY_INVALID');
  const authorityJson=launchAuthorityJson(launch);
  const authority=await db.prepare('SELECT authority_json FROM launches WHERE launch_id=? LIMIT 1')
    .bind(id).first<{authority_json:string}>();
  const fact=await buildProvenanceFact(launch),factJson=canonicalJson(fact);
  const stored=await db.prepare('SELECT fact_id,creator,observed_block,observed_block_hash,log_index,source_event_id,evidence_digest,payload_json FROM provenance_facts WHERE chain_id=? AND launch_id=? LIMIT 1')
    .bind(ROBINHOOD_CHAIN_ID,id).first<{fact_id:string;creator:string;observed_block:string;observed_block_hash:string;log_index:number;source_event_id:string;evidence_digest:string;payload_json:string}>();
  if(authority?.authority_json!==authorityJson||fact.kind!=='PONS_REPORTED_DEPLOYER'||
      !stored||stored.fact_id!==fact.factId||stored.creator!==fact.creator||
      stored.observed_block!==fact.observedBlock.toString()||stored.observed_block_hash!==fact.observedBlockHash||
      stored.log_index!==fact.logIndex||stored.source_event_id!==fact.sourceEventId||
      stored.evidence_digest!==fact.evidenceDigest||stored.payload_json!==factJson) {
    throw new Error('PONS_TRIPWIRE_PROVENANCE_INVALID');
  }
  return {launch,fact,authorityJson,factJson};
}

/** Stored identity-only read: stale indexing must never prevent cancellation. */
export async function readVerifiedPonsTripwireCase(db:D1DatabaseLike,launchId:string,nowMs:number) {
  validateTime(nowMs);
  const {launch,fact}=await validatePonsTripwireEvidence(db,launchId,BigInt(Number.MAX_SAFE_INTEGER));
  return {deployer:launch.creator,launchId:launch.launchId,evidenceDigest:fact.evidenceDigest,
    blockNumber:launch.blockNumber.toString(),blockHash:launch.blockHash};
}

async function freshSnapshot(db:D1DatabaseLike,now:number):Promise<{block:bigint;hash:string}> {
  validateTime(now);
  const [snapshot,state,checkpoint]=await Promise.all([readPublicSnapshot(db),
    new D1RuntimeStateStore(db,ROBINHOOD_CHAIN_ID).get(),new D1Store(db,ROBINHOOD_CHAIN_ID).getCheckpoint()]);
  const target=verifiedRuntimeTarget(state,checkpoint?.blockNumber??null,now,PONS_TRIPWIRE_LIMITS.freshnessMs);
  if(!snapshot||!state?.liveCaughtUp||target===null||BigInt(snapshot.checkpointBlock)!==target||
      now<snapshot.verifiedAtMs||now-snapshot.verifiedAtMs>PONS_TRIPWIRE_LIMITS.freshnessMs||
      !Number.isSafeInteger(Number(target))) throw new Error('PONS_TRIPWIRE_INDEX_STALE');
  if(checkpoint?.blockNumber===target&&checkpoint.blockHash!==snapshot.checkpointBlockHash) {
    throw new Error('PONS_TRIPWIRE_PUBLICATION_CONFLICT');
  }
  return {block:target,hash:snapshot.checkpointBlockHash};
}
function validatePoint(point:{hash:string;timestampMs:number},now:number):void {
  if(!HASH.test(point.hash)||!Number.isSafeInteger(point.timestampMs)||point.timestampMs<0||point.timestampMs>now+15_000) {
    throw new Error('PONS_TRIPWIRE_SOURCE_INVALID');
  }
}
async function sourceHead(source:WatchSource,now:number,tip:bigint) {
  const head=await source.head();validatePoint(head,now);
  if(head.chainId!==ROBINHOOD_CHAIN_ID||head.block<tip||head.block>BigInt(Number.MAX_SAFE_INTEGER)||
      now-head.timestampMs>PONS_TRIPWIRE_LIMITS.headAgeMs) throw new Error('PONS_TRIPWIRE_HEAD_STALE');
  return head;
}

export interface PortableTripwireOptions {
  enabled?: boolean;
  deliveryEnabled?: boolean;
  allowedUserId?: number;
  botToken?: string;
  source?: WatchSource;
  now?: () => number;
  caseOrigin?: string;
}
type Evidence = Awaited<ReturnType<typeof validatePonsTripwireEvidence>> & { stamp: string };
type Tip = { block: bigint; hash: string; stamp: string; validUntil: number };
type Outbox = PendingRow & { event_timestamp_ms: number; state: string; attempt_count: number };
export function portableTripwireCaseOrigin(value = 'https://binrat.tech'): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('PONS_TRIPWIRE_CASE_ORIGIN_INVALID'); }
  if (url.origin !== value || url.username || url.password ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('PONS_TRIPWIRE_CASE_ORIGIN_INVALID');
  }
  return value;
}
const caseUrl = (id: string, origin?: string) => `${origin ?? 'https://binrat.tech'}/bag/${id}`;
function validateTime(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('PONS_TRIPWIRE_TIME_INVALID');
}
function changed(changes: number) {
  if (changes !== 1) throw new Error('PONS_TRIPWIRE_CAS_LOST');
}

/** All awaits prepare evidence outside transactions. Each IMMEDIATE transaction
 * rereads the exact rows and checks the prepared authority before mutation.
 * A transaction callback is always synchronous; no SQLite lock crosses await. */
export class PortablePonsTripwire {
  private readonly principals = new WeakSet<VerifiedMiniAppPrincipal>();
  private readonly now: () => number;
  private readonly options: Readonly<PortableTripwireOptions>;
  private cycling = false;
  constructor(private readonly database: PortableDatabase, options: PortableTripwireOptions = {}) {
    this.options = Object.freeze({ ...options });
    this.now = options.now ?? Date.now;
    if (!options.enabled) return;
    this.options = Object.freeze({ ...options, caseOrigin: portableTripwireCaseOrigin(options.caseOrigin) });
    if (!Number.isSafeInteger(options.allowedUserId) || options.allowedUserId! <= 0 || !options.botToken || !options.source) {
      throw new Error('PONS_TRIPWIRE_OWNER_NOT_CONFIGURED');
    }
    this.atomic(() => {
      // Same identity invariant as the accepted collector, including before
      // that collector's first invocation on a pre-existing portable dataset.
      database.sql.exec('CREATE UNIQUE INDEX IF NOT EXISTS portable_launch_event_identity ON launches(chain_id,event_id)');
      database.sql.exec(PORTABLE_PONS_TRIPWIRE_SCHEMA + PORTABLE_PONS_TRIPWIRE_SOURCE_TRIGGERS);
      // Recovery is independent of source availability. A possibly sent message
      // becomes terminal UNKNOWN and will never be admitted again.
      database.sql.prepare("UPDATE pons_tripwire_outbox SET state='UNKNOWN' WHERE state='SENDING'").run();
    });
  }
  private enabled() {
    if (!this.options.enabled) throw new Error('PONS_TRIPWIRE_DISABLED');
  }
  private atomic<T>(operation: () => T): T {
    if (this.database.sql.inTransaction) throw new Error('PONS_TRIPWIRE_WRITER_BUSY');
    return this.database.sql.transaction(operation).immediate();
  }
  authorize(initData: string): VerifiedMiniAppPrincipal {
    this.enabled();
    const principal = verifyTelegramInitData(initData, this.options.botToken!, this.now(), 300);
    assertPrincipal(principal);
    if (principal.userId !== this.options.allowedUserId) throw new Error('OWNER_ONLY');
    Object.freeze(principal.user);
    Object.freeze(principal);
    this.principals.add(principal);
    return principal;
  }
  private owner(principal: VerifiedMiniAppPrincipal): string {
    this.enabled();
    validateTime(this.now());
    const seconds = Math.floor(this.now() / 1000);
    if (!this.principals.has(principal) || principal.userId !== this.options.allowedUserId ||
        principal.chatId !== principal.userId || seconds - principal.authDate > 300 || principal.authDate > seconds + 30) {
      throw new Error('MINI_APP_AUTH_INVALID');
    }
    return `telegram:${principal.userId}`;
  }
  private frame(): string {
    const sql = this.database.sql;
    return canonicalJson([
      sql.prepare('SELECT * FROM binrat_public_snapshots WHERE chain_id=4663').get(),
      sql.prepare('SELECT * FROM binrat_runtime_state WHERE chain_id=4663').get(),
      sql.prepare('SELECT * FROM chain_checkpoints WHERE chain_id=4663').get()
    ]);
  }
  private evidenceStamp(id: string): string {
    return canonicalJson([
      this.database.sql.prepare('SELECT * FROM launches WHERE launch_id=?').get(id),
      this.database.sql.prepare('SELECT * FROM provenance_facts WHERE launch_id=?').get(id)
    ]);
  }
  private async evidence(id: string, block: bigint): Promise<Evidence> {
    const stamp = this.evidenceStamp(id);
    const value = await validatePonsTripwireEvidence(this.database, id, block);
    if (stamp !== this.evidenceStamp(id)) throw new Error('PONS_TRIPWIRE_EVIDENCE_CHANGED');
    return { ...value, stamp };
  }
  private async tip(): Promise<Tip> {
    const stamp = this.frame(), now = this.now();
    const value = await freshSnapshot(this.database, now);
    const state = await new D1RuntimeStateStore(this.database, 4663).get();
    const snapshot = await readPublicSnapshot(this.database);
    if (stamp !== this.frame()) throw new Error('PONS_TRIPWIRE_PUBLICATION_CHANGED');
    return { ...value, stamp, validUntil: Math.min(state!.updatedAtMs, snapshot!.verifiedAtMs) + PONS_TRIPWIRE_LIMITS.freshnessMs };
  }
  private assertPrepared(tip: Tip, evidence?: Evidence) {
    validateTime(this.now());
    if (this.frame() !== tip.stamp || this.now() > tip.validUntil) throw new Error('PONS_TRIPWIRE_PUBLICATION_CHANGED');
    if (evidence && this.evidenceStamp(evidence.launch.launchId) !== evidence.stamp) throw new Error('PONS_TRIPWIRE_EVIDENCE_CHANGED');
  }
  private async point(block: bigint) {
    const value = await this.options.source!.point(block);
    validatePoint(value, this.now());
    return value;
  }
  private quarantine() {
    this.atomic(() => this.database.sql.exec(PORTABLE_PONS_TRIPWIRE_QUARANTINE));
  }
  private async canonical(tip: Tip) {
    await sourceHead(this.options.source!, this.now(), tip.block);
    if ((await this.point(tip.block)).hash !== tip.hash) {
      this.quarantine();
      throw new Error('PONS_TRIPWIRE_SOURCE_REORG');
    }
  }
  list(principal: VerifiedMiniAppPrincipal): PonsTripwireWatch[] {
    const owner = this.owner(principal);
    const rows = this.database.sql.prepare(`SELECT w.*,(SELECT state FROM pons_tripwire_outbox o
      WHERE o.watch_generation=w.generation ORDER BY created_at_ms DESC,delivery_id DESC LIMIT 1) latest_state
      FROM pons_tripwire_watches w WHERE owner_id=? ORDER BY created_at_ms,deployer LIMIT 5`).all(owner) as (WatchRow & { latest_state: string | null })[];
    return rows.map(w => ({ generation: w.generation, deployer: w.deployer, sourceCaseUrl: caseUrl(w.source_launch_id, this.options.caseOrigin),
      startBlock: String(w.start_block), startHash: w.start_hash, createdAtMs: w.created_at_ms,
      state: w.state, latestNotificationState: w.latest_state }));
  }
  async forCase(principal: VerifiedMiniAppPrincipal, id: string) {
    const watches = this.list(principal);
    const saved = watches.find(w => w.sourceCaseUrl === caseUrl(id, this.options.caseOrigin));
    if (saved) return saved; // Cancellation remains possible after a source reorg.
    const { launch } = await this.evidence(id, BigInt(Number.MAX_SAFE_INTEGER));
    return watches.find(w => w.deployer === launch.creator) ?? null;
  }
  async watch(principal: VerifiedMiniAppPrincipal, caseId: string, consent: boolean): Promise<PonsTripwireWatch> {
    const owner = this.owner(principal);
    if (consent !== true) throw new Error('PONS_TRIPWIRE_CONSENT_REQUIRED');
    const mutationStamp = () => canonicalJson(this.database.sql.prepare(
      'SELECT * FROM pons_tripwire_watches WHERE owner_id=? ORDER BY deployer').all(owner));
    const priorMutation = mutationStamp();
    if (!await new D1TelegramLedger(this.database).allowChat(principal.chatId, 4, 60_000, this.now())) {
      throw new Error('PONS_TRIPWIRE_RATE_LIMIT');
    }
    const tip = await this.tip(), evidence = await this.evidence(caseId, tip.block);
    const head = await sourceHead(this.options.source!, this.now(), tip.block);
    const [checkpoint, event, boundary] = await Promise.all([this.point(tip.block), this.point(evidence.launch.blockNumber), this.point(head.block)]);
    if (checkpoint.hash !== tip.hash || event.hash !== evidence.launch.blockHash || boundary.hash !== head.hash) {
      this.quarantine(); throw new Error('PONS_TRIPWIRE_SOURCE_REORG');
    }
    this.atomic(() => {
      this.owner(principal); this.assertPrepared(tip, evidence);
      // Replaces the D1 mutation lease/fence. A cancellation or newer request
      // wins over this prepared request; it cannot silently reopen a Watch.
      if (mutationStamp() !== priorMutation) throw new Error('PONS_TRIPWIRE_WRITER_BUSY');
      if (this.now() - head.timestampMs > PONS_TRIPWIRE_LIMITS.headAgeMs) throw new Error('PONS_TRIPWIRE_HEAD_STALE');
      const { launch } = evidence;
      this.database.sql.prepare(`INSERT INTO pons_tripwire_watches
        (owner_id,chat_id,deployer,generation,source_launch_id,start_block,start_hash,created_at_ms,state,
         cursor_block,cursor_log_index,cursor_launch_id,next_allowed_ms)
        VALUES (?,?,?,?,?,?,?,?,'ACTIVE',?,-1,'',0)
        ON CONFLICT(owner_id,deployer) DO UPDATE SET generation=excluded.generation,chat_id=excluded.chat_id,
          source_launch_id=excluded.source_launch_id,start_block=excluded.start_block,start_hash=excluded.start_hash,
          created_at_ms=excluded.created_at_ms,state='ACTIVE',cursor_block=excluded.cursor_block,cursor_log_index=-1,cursor_launch_id=''
        WHERE pons_tripwire_watches.state!='ACTIVE'`).run(owner, principal.chatId, launch.creator, randomUUID(),
          launch.launchId, Number(head.block), head.hash, this.now(), Number(head.block));
    });
    return this.list(principal).find(w => w.deployer === evidence.launch.creator)!;
  }
  cancel(principal: VerifiedMiniAppPrincipal, generation: string): boolean {
    const owner = this.owner(principal);
    if (!/^[0-9a-f-]{36}$/.test(generation)) throw new Error('PONS_TRIPWIRE_WATCH_INVALID');
    return this.atomic(() => {
      const result = this.database.sql.prepare("UPDATE pons_tripwire_watches SET state='CANCELLED' WHERE owner_id=? AND generation=? AND state!='CANCELLED'").run(owner, generation);
      this.database.sql.prepare("UPDATE pons_tripwire_outbox SET state='CANCELLED' WHERE owner_id=? AND watch_generation=? AND state='PENDING'").run(owner, generation);
      return result.changes === 1;
    });
  }
  private watchRow(generation: string): WatchRow | undefined {
    return this.database.sql.prepare("SELECT * FROM pons_tripwire_watches WHERE generation=? AND state='ACTIVE' AND owner_id=? AND chat_id=?")
      .get(generation, `telegram:${this.options.allowedUserId}`, this.options.allowedUserId!) as WatchRow | undefined;
  }
  private advance(w: WatchRow, launch: LaunchObserved) {
    changed(this.database.sql.prepare(`UPDATE pons_tripwire_watches SET cursor_block=?,cursor_log_index=?,cursor_launch_id=?
      WHERE generation=? AND state='ACTIVE' AND cursor_block=? AND cursor_log_index=? AND cursor_launch_id=?`)
      .run(Number(launch.blockNumber), launch.logIndex, launch.launchId, w.generation, w.cursor_block, w.cursor_log_index, w.cursor_launch_id).changes);
  }
  private sameWatch(w: WatchRow): boolean { return canonicalJson(this.watchRow(w.generation)) === canonicalJson(w); }
  private async watchAuthority(w: WatchRow, tip: Tip) {
    const original = await this.evidence(w.source_launch_id, tip.block);
    if (original.launch.creator !== w.deployer || (await this.point(original.launch.blockNumber)).hash !== original.launch.blockHash ||
        (await this.point(BigInt(w.start_block))).hash !== w.start_hash) {
      this.quarantine(); throw new Error('PONS_TRIPWIRE_SOURCE_REORG');
    }
    return original;
  }
  async cycle(deliver?: (notification: PonsTripwireNotification) => Promise<number>) {
    const result = { status: 'DISABLED', examined: 0, enqueued: 0, sent: 0 };
    if (!this.options.enabled) return result;
    if (this.cycling) throw new Error('PONS_TRIPWIRE_WRITER_BUSY');
    this.cycling = true;
    try {
      result.status = 'SUCCESS';
      const start = this.now(), tip = await this.tip();
      const withinBudget = () => this.now() - start <= PONS_TRIPWIRE_LIMITS.workMs;
      await this.canonical(tip);
      const watches = this.database.sql.prepare("SELECT generation FROM pons_tripwire_watches WHERE state='ACTIVE' AND owner_id=? AND chat_id=? ORDER BY created_at_ms,deployer LIMIT 5")
        .all(`telegram:${this.options.allowedUserId}`, this.options.allowedUserId!) as { generation: string }[];
      for (const { generation } of watches) {
        const w = this.watchRow(generation);
        if (!w || !withinBudget() || result.examined >= 20) break;
        let original: Evidence;
        try { original = await this.watchAuthority(w, tip); }
        catch (error) { this.quarantine(); throw error; }
        const candidates = this.database.sql.prepare(`SELECT launch_id FROM launches
          INDEXED BY idx_launches_chain_source_creator_block_numeric
          WHERE chain_id=4663 AND source='PONS_V2' AND creator=? AND launch_id!=?
            AND CAST(block_number AS INTEGER)>? AND CAST(block_number AS INTEGER)<=?
            AND (CAST(block_number AS INTEGER)>? OR (CAST(block_number AS INTEGER)=?
              AND (log_index>? OR (log_index=? AND launch_id>?))))
          ORDER BY CAST(block_number AS INTEGER),log_index,launch_id LIMIT ?`)
          .all(w.deployer, w.source_launch_id, w.start_block, Number(tip.block), w.cursor_block, w.cursor_block,
            w.cursor_log_index, w.cursor_log_index, w.cursor_launch_id, 20 - result.examined) as { launch_id: string }[];
        for (const candidate of candidates) {
          if (!withinBudget() || result.enqueued >= 5) break;
          const current = this.watchRow(generation);
          if (!current) break;
          result.examined++;
          let e: Evidence;
          try { e = await this.evidence(candidate.launch_id, tip.block); }
          catch (error) { this.quarantine(); throw error; } // Never skip invalid evidence.
          const event = await this.point(e.launch.blockNumber);
          if (event.hash !== e.launch.blockHash || e.launch.creator !== current.deployer) {
            this.quarantine(); throw new Error('PONS_TRIPWIRE_SOURCE_REORG');
          }
          const admitted = this.atomic(() => {
            this.assertPrepared(tip, e); this.assertPrepared(tip, original);
            if (!withinBudget()) return false;
            if (!this.sameWatch(current)) return false;
            if (event.timestampMs <= current.created_at_ms) { this.advance(current, e.launch); return true; }
            const existing = this.database.sql.prepare('SELECT * FROM pons_tripwire_outbox WHERE owner_id=? AND event_id=?')
              .get(current.owner_id, e.launch.eventId) as Outbox | undefined;
            if (existing) {
              if (!this.bound(existing, current, e, false)) throw new Error('PONS_TRIPWIRE_OUTBOX_CONFLICT');
              this.advance(current, e.launch); return true;
            }
            const full = this.database.sql.prepare("SELECT COUNT(*) n FROM (SELECT 1 FROM pons_tripwire_outbox WHERE state='PENDING' LIMIT 5)").get() as { n: number };
            if (full.n >= 5) return false;
            const l = e.launch;
            changed(this.database.sql.prepare(`INSERT INTO pons_tripwire_outbox
              (delivery_id,watch_generation,owner_id,chat_id,deployer,launch_id,event_id,block_number,block_hash,
               evidence_digest,launch_authority_json,fact_payload_json,event_timestamp_ms,state,attempt_count,created_at_ms)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING',0,?)`).run(`pons:${current.generation}:${l.launchId}`,
                current.generation, current.owner_id, current.chat_id, current.deployer, l.launchId, l.eventId, Number(l.blockNumber),
                l.blockHash, e.fact.evidenceDigest, e.authorityJson, e.factJson, event.timestampMs, this.now()).changes);
            this.advance(current, l); result.enqueued++; return true;
          });
          if (!admitted) break; // Saturation never moves the cursor.
        }
      }
      if (!deliver || !this.options.deliveryEnabled) return result;
      const pending = this.database.sql.prepare("SELECT * FROM pons_tripwire_outbox WHERE state='PENDING' AND owner_id=? AND chat_id=? ORDER BY created_at_ms,delivery_id LIMIT 5")
        .all(`telegram:${this.options.allowedUserId}`, this.options.allowedUserId!) as Outbox[];
      for (const item of pending) {
        if (!withinBudget()) break;
        const w = this.watchRow(item.watch_generation);
        if (!w) continue;
        await this.canonical(tip); // Uncached verification immediately before preparation/admission.
        let original: Evidence, e: Evidence;
        try { original = await this.watchAuthority(w, tip); e = await this.evidence(item.launch_id, tip.block); }
        catch (error) { this.quarantine(); throw error; }
        const event = await this.point(e.launch.blockNumber);
        if (!this.bound(item, w, e) || event.hash !== item.block_hash || event.timestampMs !== item.event_timestamp_ms || event.timestampMs <= w.created_at_ms) {
          this.quarantine(); throw new Error('PONS_TRIPWIRE_OUTBOX_CONFLICT');
        }
        const now = this.now();
        if (!withinBudget() || now < w.next_allowed_ms) continue;
        let claimed = false;
        try {
          claimed = this.atomic(() => {
            this.assertPrepared(tip, e); this.assertPrepared(tip, original);
            if (!this.sameWatch(w)) return false;
            const stored = this.database.sql.prepare('SELECT * FROM pons_tripwire_outbox WHERE delivery_id=?').get(item.delivery_id);
            if (canonicalJson(stored) !== canonicalJson(item)) return false;
            changed(this.database.sql.prepare("UPDATE pons_tripwire_outbox SET state='SENDING',attempt_count=1,last_attempt_ms=? WHERE delivery_id=? AND state='PENDING' AND attempt_count=0")
              .run(now, item.delivery_id).changes);
            for (const principal of ['global', `owner:${item.owner_id}`]) {
              changed(this.database.sql.prepare(`INSERT INTO pons_tripwire_daily_budget(day_utc,principal,attempts) VALUES (?,?,1)
                ON CONFLICT(day_utc,principal) DO UPDATE SET attempts=attempts+1 WHERE attempts<5`)
                .run(Math.floor(now / 86_400_000), principal).changes);
            }
            changed(this.database.sql.prepare("UPDATE pons_tripwire_watches SET next_allowed_ms=? WHERE generation=? AND state='ACTIVE'")
              .run(now + PONS_TRIPWIRE_LIMITS.watchIntervalMs, w.generation).changes);
            return true;
          });
        } catch (error) {
          if (error instanceof Error && error.message === 'PONS_TRIPWIRE_CAS_LOST') continue;
          throw error; // SQL faults roll back and remain visible; no transport.
        }
        if (!claimed) continue;
        // Cancellation after this committed admission can race the one transport
        // attempt. Its eventual receipt is retained, never reclassified as unsent.
        let state = 'UNKNOWN', messageId: number | null = null;
        try {
          const id = await deliver(notificationFor(item, this.options.caseOrigin));
          if (Number.isSafeInteger(id) && id > 0) { state = 'SENT'; messageId = id; }
        } catch (error) { if (error instanceof TelegramUiError && error.code === 'REJECTED') state = 'FAILED'; }
        changed(this.database.sql.prepare("UPDATE pons_tripwire_outbox SET state=?,telegram_message_id=? WHERE delivery_id=? AND state='SENDING'")
          .run(state, messageId, item.delivery_id).changes);
        if (state === 'SENT') result.sent++;
      }
      return result;
    } finally { this.cycling = false; }
  }
  private bound(item: Outbox, w: WatchRow, e: Evidence, generation = true) {
    const l = e.launch;
    return item.owner_id === w.owner_id && item.chat_id === w.chat_id && w.chat_id === Number(w.owner_id.slice(9)) &&
      (!generation || item.watch_generation === w.generation) && item.deployer === w.deployer && l.creator === w.deployer &&
      l.launchId !== w.source_launch_id && l.blockNumber > BigInt(w.start_block) && item.launch_id === l.launchId &&
      item.event_id === l.eventId && item.block_number === Number(l.blockNumber) && item.block_hash === l.blockHash &&
      item.evidence_digest === e.fact.evidenceDigest && item.launch_authority_json === e.authorityJson && item.fact_payload_json === e.factJson;
  }
}
function notificationFor(item: Outbox, origin?: string): PonsTripwireNotification {
  const url = caseUrl(item.launch_id, origin);
  return { chatId: item.chat_id, launchId: item.launch_id, deployer: item.deployer, evidenceDigest: item.evidence_digest, caseUrl: url,
    text: ['Your watched Pons deployer launched again.', `Exact Pons-reported deployer: ${item.deployer}`,
      `New canonical launch: ${item.launch_id}`, `Block: ${item.block_number}`, `Block hash: ${item.block_hash}`,
      `Evidence digest: ${item.evidence_digest}`, `Open the Case: ${url}`,
      'Same reported address does not prove the same person. This is an observation, not a buy call.'].join('\n') };
}
