/**
 * Durable, default-unmounted intake for an exact Pons deployer subscription.
 * This component makes NO provider requests and grants NO Case/Telegram authority.
 * A hint is untrusted until a separately budgeted canonical verifier admits it.
 */
export const PERSISTENT_TRIPWIRE_SCHEMA = `
CREATE TABLE IF NOT EXISTS persistent_tripwire_sessions_v1 (
 generation TEXT PRIMARY KEY, owner_id TEXT NOT NULL, deployer TEXT NOT NULL,
 start_block INTEGER NOT NULL, started_at_ms INTEGER NOT NULL, stops_at_ms INTEGER NOT NULL,
 subscription_id TEXT NOT NULL, event_topic TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('CONNECTED','UNKNOWN','STOPPED')),
 coverage TEXT NOT NULL DEFAULT 'UNKNOWN_COVERAGE' CHECK(coverage='UNKNOWN_COVERAGE')
);
CREATE TABLE IF NOT EXISTS persistent_tripwire_hints_v1 (
 generation TEXT NOT NULL REFERENCES persistent_tripwire_sessions_v1(generation),
 event_key TEXT NOT NULL, block_number INTEGER NOT NULL, block_hash TEXT NOT NULL,
 tx_hash TEXT NOT NULL, log_index INTEGER NOT NULL, received_at_ms INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('PENDING','VERIFYING','UNKNOWN','CONFLICT')),
 PRIMARY KEY(generation,event_key)
);
CREATE INDEX IF NOT EXISTS persistent_tripwire_hint_queue_v1
 ON persistent_tripwire_hints_v1(generation,state,block_number,log_index);
`;

export interface TripwireSql {
 exec(sql: string): unknown;
 prepare(sql: string): {
   get(...params: any[]): any;
   all(...params: any[]): any[];
   run(...params: any[]): { changes: number | bigint };
 };
}
export type IntakeResult = 'QUEUED'|'DUPLICATE'|'HISTORICAL_IGNORED'|'REORG_UNKNOWN'|'CONFLICT_UNKNOWN'|'OVERFLOW_UNKNOWN';
export type StoredHint = {
 generation: string; event_key: string; block_number: number; block_hash: string;
 tx_hash: string; log_index: number; received_at_ms: number; state: string;
};
const HEX32 = /^0x[0-9a-f]{64}$/;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const QTY = /^0x(?:0|[1-9a-f][0-9a-f]*)$/;
const PONS_FACTORY = '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';
const MAX_FRAME_BYTES = 8192;
const MAX_PERSISTED_HINTS = 128;
const ONE_DAY_MS = 86_400_000;
const isRecord = (v: unknown): v is Record<string, unknown> =>
 v !== null && typeof v === 'object' && !Array.isArray(v);
const validTime = (v: number): boolean => Number.isSafeInteger(v) && v >= 0;
function blockQuantity(raw: unknown): number {
 if (typeof raw !== 'string' || !QTY.test(raw)) throw new Error('TRIPWIRE_HINT_INVALID');
 const value = BigInt(raw);
 if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('TRIPWIRE_HINT_INVALID');
 return Number(value);
}
function transaction<T>(db: TripwireSql, fn: () => T): T {
 db.exec('BEGIN IMMEDIATE');
 try {
   const value = fn();
   db.exec('COMMIT');
   return value;
 } catch (error) {
   db.exec('ROLLBACK');
   throw error;
 }
}
type Session = {
 generation: string; owner_id: string; deployer: string; start_block: number;
 stops_at_ms: number; subscription_id: string; event_topic: string; state: string;
};
export class PersistentTripwireWatch {
 constructor(private readonly db: TripwireSql, private readonly now: () => number = Date.now) {}

 /** Explicit setup only, after the parent owner Watch has been authenticated and saved. */
 arm(input: { generation: string; ownerId: string; deployer: string; startBlock: number;
   stopsAtMs: number; subscriptionId: string; eventTopic: string; approved: boolean }): void {
   const now = this.now();
   if (input.approved !== true || !validTime(now) || !validTime(input.stopsAtMs) ||
     input.stopsAtMs <= now || input.stopsAtMs - now > ONE_DAY_MS ||
     !/^[0-9a-f-]{36}$/.test(input.generation) || !/^telegram:[1-9][0-9]*$/.test(input.ownerId) ||
     !ADDRESS.test(input.deployer) || !Number.isSafeInteger(input.startBlock) || input.startBlock < 0 ||
     typeof input.subscriptionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.subscriptionId) ||
     !HEX32.test(input.eventTopic)) throw new Error('TRIPWIRE_GRANT_INVALID');
   transaction(this.db, () => {
     const watch = this.db.prepare(`SELECT owner_id,deployer,start_block,state,created_at_ms FROM pons_tripwire_watches
       WHERE generation=?`).get(input.generation) as {
       owner_id: string; deployer: string; start_block: number; state: string; created_at_ms: number;
     } | undefined;
     if (!watch || watch.owner_id !== input.ownerId || watch.deployer !== input.deployer ||
       watch.start_block !== input.startBlock || watch.state !== 'ACTIVE' ||
       !validTime(watch.created_at_ms) || watch.created_at_ms > now) throw new Error('TRIPWIRE_OWNER_CONSENT_INVALID');
     const changed = this.db.prepare(`INSERT OR IGNORE INTO persistent_tripwire_sessions_v1
       (generation,owner_id,deployer,start_block,started_at_ms,stops_at_ms,subscription_id,event_topic,state)
       VALUES (?,?,?,?,?,?,?,?,'CONNECTED')`).run(input.generation,input.ownerId,input.deployer,
       input.startBlock,now,input.stopsAtMs,input.subscriptionId,input.eventTopic).changes;
     if (Number(changed) !== 1) throw new Error('TRIPWIRE_SESSION_ALREADY_EXISTS');
   });
 }

 /** Call only after obtaining the process's exclusive writer lock. Restart never implies connection. */
 recoverAfterRestart(exclusiveWriter: boolean): void {
   if (exclusiveWriter !== true) throw new Error('TRIPWIRE_WRITER_LOCK_REQUIRED');
   transaction(this.db, () => {
     this.db.prepare("UPDATE persistent_tripwire_sessions_v1 SET state='UNKNOWN' WHERE state='CONNECTED'").run();
     this.db.prepare("UPDATE persistent_tripwire_hints_v1 SET state='UNKNOWN' WHERE state='VERIFYING'").run();
   });
 }
 close(generation: string, terminal = false): void {
   transaction(this.db, () => {
     this.db.prepare(`UPDATE persistent_tripwire_sessions_v1 SET state=? WHERE generation=? AND state!='STOPPED'`)
       .run(terminal ? 'STOPPED' : 'UNKNOWN',generation);
   });
 }

 /** WebSocket eth_subscription frame. Invalid or ambiguous messages NEVER create positive evidence. */
 ingest(generation: string, frame: unknown): IntakeResult {
   const now = this.now();
   if (!validTime(now) || !isRecord(frame) || Buffer.byteLength(JSON.stringify(frame)) > MAX_FRAME_BYTES ||
     frame.jsonrpc !== '2.0' || frame.method !== 'eth_subscription' || !isRecord(frame.params)) {
     throw new Error('TRIPWIRE_HINT_INVALID');
   }
   const params = frame.params;
   if (!isRecord(params.result) || typeof params.subscription !== 'string') throw new Error('TRIPWIRE_HINT_INVALID');
   const log = params.result;
   if (typeof log.address !== 'string' || log.address.toLowerCase() !== PONS_FACTORY ||
     !Array.isArray(log.topics) || log.topics.length !== 4 ||
     log.topics.some(x => typeof x !== 'string' || !HEX32.test(x.toLowerCase())) ||
     typeof log.blockHash !== 'string' || !HEX32.test(log.blockHash.toLowerCase()) ||
     typeof log.transactionHash !== 'string' || !HEX32.test(log.transactionHash.toLowerCase()) ||
     typeof log.data !== 'string' || !/^0x(?:[0-9a-f]{2})*$/i.test(log.data) ||
     log.data.length > 1026 || (log.removed !== true && log.removed !== false)) {
     throw new Error('TRIPWIRE_HINT_INVALID');
   }
   const block = blockQuantity(log.blockNumber), index = blockQuantity(log.logIndex);
   return transaction(this.db, () => {
     const session = this.db.prepare('SELECT * FROM persistent_tripwire_sessions_v1 WHERE generation=?')
       .get(generation) as Session | undefined;
     const watch = this.db.prepare('SELECT state,owner_id,deployer FROM pons_tripwire_watches WHERE generation=?')
       .get(generation) as {state:string;owner_id:string;deployer:string} | undefined;
     if (!session || session.state !== 'CONNECTED' || now >= session.stops_at_ms ||
       params.subscription !== session.subscription_id || !watch || watch.state !== 'ACTIVE' ||
       watch.owner_id !== session.owner_id || watch.deployer !== session.deployer) {
       throw new Error('TRIPWIRE_SESSION_INACTIVE');
     }
     if ((log.topics[0] as string).toLowerCase() !== session.event_topic ||
       (log.topics[3] as string).toLowerCase() !== `0x${session.deployer.slice(2).padStart(64,'0')}`) {
       throw new Error('TRIPWIRE_HINT_SCOPE_INVALID');
     }
     if (block <= session.start_block) return 'HISTORICAL_IGNORED';
     const tx = (log.transactionHash as string).toLowerCase(), hash = (log.blockHash as string).toLowerCase();
     const key = `${tx}:${index}`;
     const old = this.db.prepare('SELECT block_number,block_hash,tx_hash,log_index FROM persistent_tripwire_hints_v1 WHERE generation=? AND event_key=?')
       .get(generation,key) as {block_number:number;block_hash:string;tx_hash:string;log_index:number} | undefined;
     if (log.removed === true || (old && (old.block_number !== block || old.block_hash !== hash))) {
       this.db.prepare("UPDATE persistent_tripwire_sessions_v1 SET state='UNKNOWN' WHERE generation=?").run(generation);
       this.db.prepare("UPDATE persistent_tripwire_hints_v1 SET state='CONFLICT' WHERE generation=? AND event_key=?")
         .run(generation,key);
       return log.removed === true ? 'REORG_UNKNOWN' : 'CONFLICT_UNKNOWN';
     }
     if (old) return 'DUPLICATE';
     const count = this.db.prepare('SELECT count(*) AS n FROM persistent_tripwire_hints_v1 WHERE generation=?')
       .get(generation) as {n:number};
     if (count.n >= MAX_PERSISTED_HINTS) {
       this.db.prepare("UPDATE persistent_tripwire_sessions_v1 SET state='UNKNOWN' WHERE generation=?").run(generation);
       return 'OVERFLOW_UNKNOWN';
     }
     this.db.prepare(`INSERT INTO persistent_tripwire_hints_v1
       (generation,event_key,block_number,block_hash,tx_hash,log_index,received_at_ms,state)
       VALUES (?,?,?,?,?,?,?,'PENDING')`).run(generation,key,block,hash,tx,index,now);
     return 'QUEUED';
   });
 }
 /** Hints are *not* evidence, Case eligibility, or authorization to send alerts. */
 pending(generation: string): StoredHint[] {
   const session = this.db.prepare('SELECT state,stops_at_ms FROM persistent_tripwire_sessions_v1 WHERE generation=?')
     .get(generation) as {state:string;stops_at_ms:number}|undefined;
   const owner = this.db.prepare('SELECT state FROM pons_tripwire_watches WHERE generation=?')
     .get(generation) as {state:string}|undefined;
   if (!session || session.state !== 'CONNECTED' || this.now() >= session.stops_at_ms || owner?.state !== 'ACTIVE') return [];
   return this.db.prepare(`SELECT * FROM persistent_tripwire_hints_v1
     WHERE generation=? AND state='PENDING' ORDER BY block_number,log_index LIMIT 20`).all(generation) as StoredHint[];
 }
 status(generation: string): {state: string; coverage: string; hints: number} | null {
   const row = this.db.prepare('SELECT state,coverage FROM persistent_tripwire_sessions_v1 WHERE generation=?')
     .get(generation) as {state:string;coverage:string}|undefined;
   if (!row) return null;
   const count = this.db.prepare('SELECT count(*) AS n FROM persistent_tripwire_hints_v1 WHERE generation=?')
     .get(generation) as {n:number};
   return { ...row, hints: count.n };
 }
}
