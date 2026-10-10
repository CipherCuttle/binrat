/** Pons owner pilot. Separate storage and policy; never enables Arc Watch. */
import type { WatchSource } from '../autonomous/source.js';
import { assertPrincipal } from '../autonomous/entitlements.js';
import { canonicalJson } from '../evidence/canonical.js';
import { deriveEventId, deriveLaunchId, launchAuthorityJson } from '../core/identity.js';
import type { LaunchObserved } from '../core/types.js';
import { buildProvenanceFact, type ProvenanceFact } from '../intelligence/provenance.js';
import { PONS_V2_FACTORY, ROBINHOOD_CHAIN_ID } from '../pons/chain.js';
import { sendCard, TelegramUiError } from '../telegram/ui/client.js';
import { TELEGRAM_UI_RENDERER_VERSION } from '../telegram/ui/types.js';
import { D1Store } from './d1Store.js';
import type { D1DatabaseLike } from './d1Types.js';
import { readPublicSnapshot } from './publicSnapshot.js';
import { D1RuntimeStateStore, verifiedRuntimeTarget } from './runtimeState.js';

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
export interface PonsTripwireCycleDeps { now:()=>number;ownerId?:string;deliver?:(notification:PonsTripwireNotification)=>Promise<number> }

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
export async function createPonsTripwireWatch(db:D1DatabaseLike,source:WatchSource,input:{
  ownerId:string;chatId:number;launchId:string;nowMs:number;
  mutationFence?:{leaseName:string;ownerToken:string;now:()=>number}
}):Promise<PonsTripwireWatch> {
  validateOwner(input.ownerId);validateChat(input.chatId);validateTime(input.nowMs);
  // Reuse tested private Telegram principal scope; a browser can never choose
  // another chat for the authenticated owner through this adapter.
  assertPrincipal({userId:Number(input.ownerId.slice('telegram:'.length)),chatId:input.chatId});
  const fence=input.mutationFence;
  if(fence&&(!/^[A-Za-z0-9:_-]{1,200}$/.test(fence.leaseName)||
      !/^[A-Za-z0-9:_-]{1,200}$/.test(fence.ownerToken)||typeof fence.now!=='function')) {
    throw new Error('PONS_TRIPWIRE_MUTATION_FENCE_INVALID');
  }
  const tip=await freshSnapshot(db,input.nowMs);
  const {launch}=await validatePonsTripwireEvidence(db,input.launchId,tip.block);
  const [head,checkpoint,event]=await Promise.all([sourceHead(source,input.nowMs,tip.block),
    source.point(tip.block),source.point(launch.blockNumber)]);
  validatePoint(checkpoint,input.nowMs);validatePoint(event,input.nowMs);
  if(checkpoint.hash!==tip.hash||event.hash!==launch.blockHash) throw new Error('PONS_TRIPWIRE_SOURCE_REORG');
  // Fresh latest canonical head, not lagging confirmed index, is the opt-in fence.
  const generation=crypto.randomUUID();
  const fenceNow=fence?.now()??0;
  validateTime(fenceNow);
  const result=await db.prepare(`INSERT INTO pons_tripwire_watches
    (owner_id,chat_id,deployer,generation,source_launch_id,start_block,start_hash,created_at_ms,state,
     cursor_block,cursor_log_index,cursor_launch_id,next_allowed_ms)
    SELECT ?,?,?,?,?,?,?,?,'ACTIVE',?,-1,'',0
    WHERE ((SELECT COUNT(*) FROM (SELECT 1 FROM pons_tripwire_watches LIMIT 5))<5
      OR EXISTS(SELECT 1 FROM pons_tripwire_watches WHERE owner_id=? AND deployer=?))
      AND (?=0 OR EXISTS(SELECT 1 FROM binrat_sync_leases WHERE lease_name=? AND owner_token=? AND lease_until_ms>?))
    ON CONFLICT(owner_id,deployer) DO UPDATE SET chat_id=excluded.chat_id,generation=excluded.generation,
      source_launch_id=excluded.source_launch_id,start_block=excluded.start_block,start_hash=excluded.start_hash,
      created_at_ms=excluded.created_at_ms,state='ACTIVE',cursor_block=excluded.cursor_block,
      cursor_log_index=-1,cursor_launch_id='',next_allowed_ms=pons_tripwire_watches.next_allowed_ms
    WHERE pons_tripwire_watches.state!='ACTIVE'`)
    .bind(input.ownerId,input.chatId,launch.creator,generation,launch.launchId,Number(head.block),head.hash,
      input.nowMs,Number(head.block),input.ownerId,launch.creator,fence?1:0,
      fence?.leaseName??'',fence?.ownerToken??'',fenceNow).run();
  if(!result.success) throw new Error('PONS_TRIPWIRE_WATCH_WRITE_FAILED');
  const watches=await listPonsTripwireWatches(db,input.ownerId);
  const watch=watches.find(item=>item.deployer===launch.creator);
  if(!watch) throw new Error(fence?'PONS_TRIPWIRE_BUSY':'PONS_TRIPWIRE_WATCH_LIMIT');
  if(watch.state!=='ACTIVE') throw new Error('PONS_TRIPWIRE_BUSY');
  return watch;
}
export async function listPonsTripwireWatches(db:D1DatabaseLike,ownerId:string):Promise<PonsTripwireWatch[]> {
  validateOwner(ownerId);
  const result=await db.prepare(`SELECT w.*,(SELECT o.state FROM pons_tripwire_outbox o
    WHERE o.watch_generation=w.generation ORDER BY o.created_at_ms DESC,o.delivery_id DESC LIMIT 1) AS latest_state
    FROM pons_tripwire_watches w WHERE owner_id=? ORDER BY created_at_ms,deployer LIMIT 5`)
    .bind(ownerId).all<WatchRow&{latest_state:string|null}>();
  if(!result.success) throw new Error('PONS_TRIPWIRE_WATCH_READ_FAILED');
  return (result.results??[]).map(row=>({generation:row.generation,deployer:row.deployer,
    sourceCaseUrl:caseUrl(row.source_launch_id),startBlock:String(row.start_block),startHash:row.start_hash,
    createdAtMs:row.created_at_ms,state:row.state,latestNotificationState:row.latest_state}));
}
export async function cancelPonsTripwireWatch(db:D1DatabaseLike,ownerId:string,generation:string,nowMs:number):Promise<boolean> {
  validateOwner(ownerId);validateTime(nowMs);
  if(!/^[0-9a-f-]{36}$/.test(generation)) throw new Error('PONS_TRIPWIRE_WATCH_INVALID');
  const result=await db.batch([
    db.prepare("UPDATE pons_tripwire_watches SET state='CANCELLED' WHERE owner_id=? AND generation=? AND state!='CANCELLED'")
      .bind(ownerId,generation),
    db.prepare("UPDATE pons_tripwire_outbox SET state='CANCELLED' WHERE owner_id=? AND watch_generation=? AND state='PENDING'")
      .bind(ownerId,generation)
  ]);
  if(result.some(item=>!item.success)) throw new Error('PONS_TRIPWIRE_CANCEL_FAILED');
  return Number(result[0]?.meta?.changes??0)===1;
}

export async function runPonsTripwireCycle(db:D1DatabaseLike,source:WatchSource,deps:PonsTripwireCycleDeps):Promise<{
  examined:number;enqueued:number;sent:number
}> {
  if(deps.ownerId!==undefined) validateOwner(deps.ownerId);
  const ownerId=deps.ownerId??null,ownerChat=ownerId===null?null:Number(ownerId.slice(9));
  const start=deps.now(),tip=await freshSnapshot(db,start);
  await sourceHead(source,start,tip.block);
  const points=new Map<string,{hash:string;timestampMs:number}>();
  const point=async(block:bigint)=>{
    const key=block.toString();if(points.has(key)) return points.get(key)!;
    if(deps.now()-start>PONS_TRIPWIRE_LIMITS.workMs) throw new Error('PONS_TRIPWIRE_WORK_LIMIT');
    const loaded=await source.point(block);validatePoint(loaded,deps.now());points.set(key,loaded);return loaded;
  };
  if((await point(tip.block)).hash!==tip.hash) throw new Error('PONS_TRIPWIRE_SOURCE_REORG');
  // Crash recovery never retries a possibly delivered Telegram message.
  await checked(db.prepare("UPDATE pons_tripwire_outbox SET state='UNKNOWN' WHERE state='SENDING'").run());
  const active=await db.prepare("SELECT * FROM pons_tripwire_watches WHERE state='ACTIVE' AND (? IS NULL OR (owner_id=? AND chat_id=?)) ORDER BY created_at_ms,deployer LIMIT 5")
    .bind(ownerId,ownerId,ownerChat)
    .all<WatchRow>();
  if(!active.success) throw new Error('PONS_TRIPWIRE_WATCH_READ_FAILED');
  let examined=0,enqueued=0,sent=0;
  for(const watch of active.results??[]) {
    if(examined>=PONS_TRIPWIRE_LIMITS.candidates||enqueued>=PONS_TRIPWIRE_LIMITS.pending||
        deps.now()-start>PONS_TRIPWIRE_LIMITS.workMs) break;
    if((await point(BigInt(watch.start_block))).hash!==watch.start_hash) {
      await db.batch([db.prepare("UPDATE pons_tripwire_watches SET state='REORG' WHERE generation=? AND state='ACTIVE'").bind(watch.generation),
        db.prepare("UPDATE pons_tripwire_outbox SET state='CANCELLED' WHERE watch_generation=? AND state='PENDING'").bind(watch.generation)]);
      continue;
    }
    const candidates=await db.prepare(`SELECT launch_id,block_number,log_index FROM launches
      INDEXED BY idx_launches_chain_source_creator_block_numeric
      WHERE chain_id=4663 AND source='PONS_V2' AND creator=? AND CAST(block_number AS INTEGER)>=?
        AND CAST(block_number AS INTEGER)>? AND CAST(block_number AS INTEGER)<=?
        AND (CAST(block_number AS INTEGER)>? OR log_index>? OR (log_index=? AND launch_id>?))
      ORDER BY CAST(block_number AS INTEGER),log_index,launch_id LIMIT ?`)
      .bind(watch.deployer,watch.cursor_block,watch.start_block,Number(tip.block),watch.cursor_block,
        watch.cursor_log_index,watch.cursor_log_index,watch.cursor_launch_id,PONS_TRIPWIRE_LIMITS.candidates-examined)
      .all<{launch_id:string;block_number:string;log_index:number}>();
    if(!candidates.success) throw new Error('PONS_TRIPWIRE_CANDIDATE_READ_FAILED');
    for(const candidate of candidates.results??[]) {
      if(enqueued>=PONS_TRIPWIRE_LIMITS.pending||deps.now()-start>PONS_TRIPWIRE_LIMITS.workMs) break;
      examined++;
      let evidence;
      try {evidence=await validatePonsTripwireEvidence(db,candidate.launch_id,tip.block);}
      catch {await advance(db,watch,candidate);continue;}
      const {launch,fact,authorityJson,factJson}=evidence;
      const event=await point(launch.blockNumber);
      if(launch.creator!==watch.deployer||event.hash!==launch.blockHash||event.timestampMs<=watch.created_at_ms) {
        await advance(db,watch,candidate);continue;
      }
      const result=await db.prepare(`INSERT OR IGNORE INTO pons_tripwire_outbox
        (delivery_id,watch_generation,owner_id,chat_id,deployer,launch_id,event_id,block_number,block_hash,
         evidence_digest,launch_authority_json,fact_payload_json,event_timestamp_ms,state,attempt_count,created_at_ms)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING',0,?
        WHERE EXISTS(SELECT 1 FROM pons_tripwire_watches WHERE generation=? AND state='ACTIVE')
          AND (SELECT COUNT(*) FROM (SELECT 1 FROM pons_tripwire_outbox WHERE state='PENDING' LIMIT 5))<5`)
        .bind(`pons:${watch.generation}:${launch.launchId}`,watch.generation,watch.owner_id,watch.chat_id,
          watch.deployer,launch.launchId,launch.eventId,Number(launch.blockNumber),launch.blockHash,
          fact.evidenceDigest,authorityJson,factJson,event.timestampMs,deps.now(),watch.generation).run();
      if(!result.success) throw new Error('PONS_TRIPWIRE_OUTBOX_WRITE_FAILED');
      // Full outbox defers the candidate; duplicate identities may advance safely.
      if(result.meta?.changes===1) {enqueued++;await advance(db,watch,candidate);}
      else {
        const existing=await db.prepare('SELECT 1 AS present FROM pons_tripwire_outbox WHERE owner_id=? AND event_id=? LIMIT 1')
          .bind(watch.owner_id,launch.eventId).first<{present:number}>();
        if(existing) await advance(db,watch,candidate);else break;
      }
    }
  }
  if(!deps.deliver) return {examined,enqueued,sent};
  const pending=await db.prepare("SELECT * FROM pons_tripwire_outbox WHERE state='PENDING' AND (? IS NULL OR (owner_id=? AND chat_id=?)) ORDER BY created_at_ms,delivery_id LIMIT 5")
    .bind(ownerId,ownerId,ownerChat)
    .all<PendingRow>();
  if(!pending.success) throw new Error('PONS_TRIPWIRE_OUTBOX_READ_FAILED');
  if((pending.results??[]).length) {
    // Refresh the canonical tip after preparation; cached pre-enqueue evidence
    // alone must not authorize transport following an observed chain rewind.
    points.delete(tip.block.toString());
    if((await point(tip.block)).hash!==tip.hash) throw new Error('PONS_TRIPWIRE_SOURCE_REORG');
  }
  for(const item of pending.results??[]) {
    if(deps.now()-start>PONS_TRIPWIRE_LIMITS.workMs) break;
    const watch=await db.prepare("SELECT * FROM pons_tripwire_watches WHERE generation=? AND owner_id=? AND state='ACTIVE' LIMIT 1")
      .bind(item.watch_generation,item.owner_id).first<WatchRow>();
    if(!watch) {await cancelDelivery(db,item.delivery_id);continue;}
    const currentTip=await freshSnapshot(db,deps.now());
    if(currentTip.block!==tip.block||currentTip.hash!==tip.hash) throw new Error('PONS_TRIPWIRE_PUBLICATION_CHANGED');
    if((await point(BigInt(watch.start_block))).hash!==watch.start_hash) {await cancelDelivery(db,item.delivery_id);continue;}
    let evidence;
    try {evidence=await validatePonsTripwireEvidence(db,item.launch_id,tip.block);}
    catch {await cancelDelivery(db,item.delivery_id);continue;}
    const event=await point(evidence.launch.blockNumber);
    if(evidence.launch.creator!==watch.deployer||evidence.launch.blockNumber<=BigInt(watch.start_block)||
        evidence.launch.blockHash!==item.block_hash||evidence.fact.evidenceDigest!==item.evidence_digest||
        evidence.authorityJson!==item.launch_authority_json||evidence.factJson!==item.fact_payload_json||
        event.hash!==item.block_hash||event.timestampMs<=watch.created_at_ms) {
      await cancelDelivery(db,item.delivery_id);continue;
    }
    const now=deps.now(),day=Math.floor(now/86_400_000);
    if(now<watch.next_allowed_ms) continue;
    // Reuses the V1 CAS and invariant batch pattern: quota reservations and
    // SENDING are atomic. Ambiguous attempts still spend the durable allowance.
    try {
      const results=await db.batch([
        db.prepare(`UPDATE pons_tripwire_outbox SET state='SENDING',attempt_count=1,last_attempt_ms=?
          WHERE delivery_id=? AND state='PENDING' AND attempt_count=0
            AND EXISTS(SELECT 1 FROM pons_tripwire_watches w WHERE w.generation=watch_generation
              AND w.owner_id=pons_tripwire_outbox.owner_id AND w.chat_id=pons_tripwire_outbox.chat_id
              AND w.state='ACTIVE' AND w.next_allowed_ms<=?)
            AND EXISTS(SELECT 1 FROM launches l JOIN provenance_facts f ON f.launch_id=l.launch_id
              WHERE l.launch_id=pons_tripwire_outbox.launch_id AND l.chain_id=4663 AND l.source='PONS_V2'
              AND l.creator=pons_tripwire_outbox.deployer AND l.block_hash=pons_tripwire_outbox.block_hash
              AND l.authority_json=pons_tripwire_outbox.launch_authority_json AND f.chain_id=4663
              AND f.creator=l.creator AND f.observed_block=l.block_number AND f.observed_block_hash=l.block_hash
              AND f.log_index=l.log_index AND f.source_event_id=l.event_id
              AND f.evidence_digest=pons_tripwire_outbox.evidence_digest AND f.payload_json=pons_tripwire_outbox.fact_payload_json)`)
          .bind(now,item.delivery_id,now),guard(db),
        budget(db,day,'global'),guard(db),budget(db,day,`owner:${item.owner_id}`),guard(db),
        db.prepare("UPDATE pons_tripwire_watches SET next_allowed_ms=? WHERE generation=? AND state='ACTIVE'")
          .bind(now+PONS_TRIPWIRE_LIMITS.watchIntervalMs,item.watch_generation),guard(db)
      ]);
      if(results.some(result=>!result.success)) throw new Error('PONS_TRIPWIRE_CLAIM_FAILED');
    } catch {continue;} // A concurrent claimant/cancellation/quota wins; no transport.
    const notification=notificationFor(item);
    let state='UNKNOWN',messageId:number|null=null;
    try {
      const delivered=await deps.deliver(notification);
      if(Number.isSafeInteger(delivered)&&delivered>0) {state='SENT';messageId=delivered;sent++;}
    } catch(error) {if(error instanceof TelegramUiError&&error.code==='REJECTED') state='FAILED';}
    await checked(db.prepare("UPDATE pons_tripwire_outbox SET state=?,telegram_message_id=? WHERE delivery_id=? AND state='SENDING'")
      .bind(state,messageId,item.delivery_id).run());
  }
  return {examined,enqueued,sent};
}
function notificationFor(item:PendingRow):PonsTripwireNotification {
  const url=caseUrl(item.launch_id);
  return {chatId:item.chat_id,launchId:item.launch_id,deployer:item.deployer,evidenceDigest:item.evidence_digest,caseUrl:url,
    text:['Your watched Pons deployer launched again.',`Exact Pons-reported deployer: ${item.deployer}`,
      `New canonical launch: ${item.launch_id}`,`Block: ${item.block_number}`,`Block hash: ${item.block_hash}`,
      `Evidence digest: ${item.evidence_digest}`,`Open the Case: ${url}`,
      'Same reported address does not prove the same person. This is an observation, not a buy call.'].join('\n')};
}
/** Existing Telegram text-card client, one attempt, no media fallback. */
export function ponsTripwireTelegramTransport(token:string,externalFetch:typeof fetch) {
  return (notification:PonsTripwireNotification)=>sendCard(token,notification.chatId,'https://binrat.tech',{
    rendererVersion:TELEGRAM_UI_RENDERER_VERSION,view:'ALERT',media:'alert',caption:notification.text,
    keyboard:[[{text:'Open the Case',url:notification.caseUrl}]]
  },false,externalFetch);
}
const caseUrl=(id:string)=>`https://binrat.tech/bag/${id}`;
const guard=(db:D1DatabaseLike)=>db.prepare('INSERT INTO binrat_invariant_guard(must_be_zero) SELECT 1 WHERE changes()!=1');
const budget=(db:D1DatabaseLike,day:number,principal:string)=>db.prepare(`INSERT INTO pons_tripwire_daily_budget(day_utc,principal,attempts)
  VALUES (?,?,1) ON CONFLICT(day_utc,principal) DO UPDATE SET attempts=attempts+1 WHERE attempts<5`).bind(day,principal);
async function advance(db:D1DatabaseLike,watch:WatchRow,candidate:{block_number:string;log_index:number;launch_id:string}) {
  await checked(db.prepare(`UPDATE pons_tripwire_watches SET cursor_block=?,cursor_log_index=?,cursor_launch_id=?
    WHERE generation=? AND state='ACTIVE'`).bind(Number(candidate.block_number),candidate.log_index,candidate.launch_id,watch.generation).run());
}
async function cancelDelivery(db:D1DatabaseLike,id:string) {
  await checked(db.prepare("UPDATE pons_tripwire_outbox SET state='CANCELLED' WHERE delivery_id=? AND state='PENDING'").bind(id).run());
}
async function checked(promise:Promise<{success:boolean}>) {if(!(await promise).success) throw new Error('PONS_TRIPWIRE_D1_WRITE_FAILED');}
function validateOwner(value:string) {if(!/^telegram:[1-9][0-9]{0,15}$/.test(value)||!Number.isSafeInteger(Number(value.slice(9)))) throw new Error('PONS_TRIPWIRE_OWNER_INVALID');}
function validateChat(value:number) {if(!Number.isSafeInteger(value)||value<=0) throw new Error('PONS_TRIPWIRE_CHAT_INVALID');}
function validateTime(value:number) {if(!Number.isSafeInteger(value)||value<0) throw new Error('PONS_TRIPWIRE_TIME_INVALID');}
