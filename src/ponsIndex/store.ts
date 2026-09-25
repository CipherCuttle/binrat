/** Isolated, append-only Pons D1 read model. Checkpoints advance atomically with facts. */
import {PONS_PREVIEW_AUTHORITY as A} from '../ponsPreview/snapshot.js';
import type {D1DatabaseLike} from '../cloudflare/d1Types.js';
import {digest,PONS_MAX_FACTS_PER_CYCLE,validateIndexedFact,type IndexedPonsLaunch} from './model.js';
const hex64=/^0x[0-9a-f]{64}$/i, sha=/^[0-9a-f]{64}$/;
export type PonsCheckpoint={
 fromBlock:number;nextBlock:number;lastBlock:number;lastHash:string;
 status:'READY'|'REORG_HALT';updatedAtMs:number;version:number;
};
type CpRow={chain_id:number;authority_id:string;from_block:number;next_block:number;
 last_block:number;last_hash:string;status:'READY'|'REORG_HALT';updated_at_ms:number;version:number};
type FactRow={fact_id:string;payload_json:string;prior_count?:number};
function numberBlock(n:bigint):number{
 const v=Number(n);if(!Number.isSafeInteger(v)||n<A.fromBlock-1n)throw Error('PONS_BLOCK_INVALID');
 return v;
}
function validMs(n:number){if(!Number.isSafeInteger(n)||n<0)throw Error('PONS_CLOCK_INVALID');}
function checkHash(value:string){if(!hex64.test(value))throw Error('PONS_HASH_INVALID');}
export class PonsD1Store {
 constructor(private readonly db:D1DatabaseLike){}
 async checkpoint():Promise<PonsCheckpoint|null>{
  const r=await this.db.prepare('SELECT * FROM pons_checkpoints WHERE chain_id=4663').first<CpRow>();
  if(!r)return null;
  if(r.chain_id!==4663||r.authority_id!==A.authorityId||!hex64.test(r.last_hash)||
   !Number.isSafeInteger(r.next_block)||r.next_block!==r.last_block+1||
   !['READY','REORG_HALT'].includes(r.status))throw Error('PONS_CHECKPOINT_CORRUPT');
  return {fromBlock:r.from_block,nextBlock:r.next_block,lastBlock:r.last_block,
   lastHash:r.last_hash,status:r.status,updatedAtMs:r.updated_at_ms,version:r.version};
 }
 /** Explicit window bootstrap, never silently backfill gaps or claim complete history. */
 async initialize(fromBlock:bigint,precedingBlockHash:string,nowMs:number):Promise<PonsCheckpoint>{
  const from=numberBlock(fromBlock);checkHash(precedingBlockHash);validMs(nowMs);
  const prior=await this.checkpoint();
  if(prior){if(prior.fromBlock!==from||prior.lastHash!==precedingBlockHash.toLowerCase()||
   prior.nextBlock!==from)throw Error('PONS_ALREADY_INITIALIZED');return prior;}
  await this.db.prepare('INSERT OR IGNORE INTO pons_checkpoints (chain_id,authority_id,from_block,next_block,last_block,last_hash,status,updated_at_ms,version) VALUES (4663,?,?,?,?,?,?,?,0)')
   .bind(A.authorityId,from,from,from-1,precedingBlockHash.toLowerCase(),'READY',nowMs).run();
  const current=await this.checkpoint();
  if(!current||current.fromBlock!==from||current.nextBlock!==from||
   current.lastHash!==precedingBlockHash.toLowerCase())throw Error('PONS_BOOTSTRAP_RACE');
  return current;
 }
 async appendRange(input:{expected:PonsCheckpoint;from:bigint;through:bigint;
  throughHash:string;facts:readonly IndexedPonsLaunch[];nowMs:number}):Promise<void>{
  validMs(input.nowMs);checkHash(input.throughHash);
  const from=numberBlock(input.from),through=numberBlock(input.through);
  if(from!==input.expected.nextBlock||through<from||through-from>=64||
   input.expected.status!=='READY'||input.facts.length>PONS_MAX_FACTS_PER_CYCLE)
    throw Error('PONS_RANGE_OR_BUDGET_INVALID');
  const events=new Set<string>(), facts=new Set<string>();
  for(const fact of input.facts){
   validateIndexedFact(fact);
   const block=Number(fact.blockNumber),key=fact.txHash.toLowerCase()+':'+fact.logIndex;
   if(block<from||block>through||events.has(key)||facts.has(fact.factId))
    throw Error('PONS_RANGE_FACT_INVALID');
   events.add(key);facts.add(fact.factId);
   // INSERT OR IGNORE can only suppress exact replays, not conceal conflicting evidence.
   const exists=await this.db.prepare('SELECT payload_json FROM pons_launch_facts WHERE fact_id=? OR (chain_id=4663 AND tx_hash=? AND log_index=? AND block_hash=?) LIMIT 1')
     .bind(fact.factId,fact.txHash.toLowerCase(),fact.logIndex,fact.blockHash.toLowerCase())
     .first<{payload_json:string}>();
   if(exists && digest(JSON.parse(exists.payload_json))!==digest(fact))
    throw Error('PONS_FACT_COLLISION');
  }
  const guard=this.db.prepare("INSERT INTO pons_invariant_guard(must_be_zero) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM pons_checkpoints WHERE chain_id=4663 AND next_block=? AND last_hash=? AND version=? AND status='READY')")
   .bind(from,input.expected.lastHash,input.expected.version);
  const entries=input.facts.map(f=>this.db.prepare(
   'INSERT OR IGNORE INTO pons_launch_facts (fact_id,chain_id,authority_id,launch_id,event_id,block_number,block_hash,tx_hash,log_index,token,deployer,payload_json) VALUES (?,4663,?,?,?,?,?,?,?,?,?,?)'
  ).bind(f.factId,A.authorityId,f.id,f.eventId,Number(f.blockNumber),f.blockHash.toLowerCase(),
   f.txHash.toLowerCase(),f.logIndex,f.token.toLowerCase(),f.deployer.toLowerCase(),JSON.stringify(f)));
  const update=this.db.prepare("UPDATE pons_checkpoints SET next_block=?,last_block=?,last_hash=?,updated_at_ms=?,version=version+1 WHERE chain_id=4663 AND next_block=? AND version=? AND status='READY'")
   .bind(through+1,through,input.throughHash.toLowerCase(),input.nowMs,from,input.expected.version);
  const receiptId=digest({kind:'PONS_RANGE_RECEIPT_V1',chainId:4663,from,through,
   throughHash:input.throughHash.toLowerCase(),factIds:input.facts.map(f=>f.factId).sort()});
  const receipt=this.db.prepare('INSERT INTO pons_range_receipts (receipt_id,chain_id,from_block,through_block,through_hash,fact_count,captured_at_ms) VALUES (?,4663,?,?,?,?,?)')
   .bind(receiptId,from,through,input.throughHash.toLowerCase(),input.facts.length,input.nowMs);
  const results=await this.db.batch([guard,...entries,update,receipt]);
  if(results.some(r=>!r.success)||results[entries.length+1]?.meta?.changes!==1)
   throw Error('PONS_BATCH_COMMIT_FAILED');
 }
 /** A >12-confirmation reorg freezes public projections. Never mutate historical facts. */
 async haltForReorg(expected:PonsCheckpoint,observedHash:string,nowMs:number):Promise<void>{
  checkHash(observedHash);validMs(nowMs);
  if(observedHash.toLowerCase()===expected.lastHash)throw Error('PONS_REORG_NOT_OBSERVED');
  const alertId=digest({kind:'PONS_REORG_ALERT_V1',chainId:4663,block:expected.lastBlock,
    expectedHash:expected.lastHash,observedHash:observedHash.toLowerCase()});
  await this.db.batch([
   this.db.prepare("INSERT INTO pons_invariant_guard(must_be_zero) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM pons_checkpoints WHERE chain_id=4663 AND next_block=? AND last_hash=? AND version=? AND status='READY')")
     .bind(expected.nextBlock,expected.lastHash,expected.version),
   this.db.prepare('INSERT OR IGNORE INTO pons_reorg_alerts(alert_id,chain_id,checkpoint_block,expected_hash,observed_hash,detected_at_ms) VALUES (?,4663,?,?,?,?)')
    .bind(alertId,expected.lastBlock,expected.lastHash,observedHash.toLowerCase(),nowMs),
   this.db.prepare("UPDATE pons_checkpoints SET status='REORG_HALT',updated_at_ms=?,version=version+1 WHERE chain_id=4663 AND version=?")
    .bind(nowMs,expected.version)
  ]);
 }
 async list(limit:number):Promise<IndexedPonsLaunch[]>{
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error('PONS_PAGE_LIMIT');
  const cp=await this.checkpoint();
  if(!cp||cp.status!=='READY')throw Error('PONS_NOT_READY');
  const rows=await this.db.prepare(
   'SELECT payload_json,(SELECT COUNT(*) FROM pons_launch_facts older WHERE older.chain_id=4663 AND older.deployer=recent.deployer AND (older.block_number<recent.block_number OR (older.block_number=recent.block_number AND older.log_index<recent.log_index))) AS prior_count FROM pons_launch_facts recent WHERE chain_id=4663 AND block_number<=? ORDER BY block_number DESC,log_index DESC LIMIT ?'
  ).bind(cp.lastBlock,limit).all<FactRow>();
  const verify=await this.checkpoint();
  if(!verify||verify.version!==cp.version||verify.status!=='READY')throw Error('PONS_READ_CHECKPOINT_CHANGED');
  return (rows.results??[]).map(r=>{
   const fact=JSON.parse(r.payload_json) as IndexedPonsLaunch;validateIndexedFact(fact);
   return {...fact,previousFromSameDeployerWithinWindow:r.prior_count??0};
  });
 }
 async launch(launchId:string):Promise<IndexedPonsLaunch|null>{
  if(!sha.test(launchId))throw Error('PONS_LAUNCH_ID_INVALID');
  const cp=await this.checkpoint();if(!cp||cp.status!=='READY')throw Error('PONS_NOT_READY');
  const row=await this.db.prepare('SELECT payload_json FROM pons_launch_facts WHERE chain_id=4663 AND launch_id=? AND block_number<=? ORDER BY block_number DESC LIMIT 1')
   .bind(launchId,cp.lastBlock).first<FactRow>();
  const verify=await this.checkpoint();
  if(!verify||verify.version!==cp.version||verify.status!=='READY')throw Error('PONS_READ_CHECKPOINT_CHANGED');
  if(!row)return null;
  const fact=JSON.parse(row.payload_json) as IndexedPonsLaunch;validateIndexedFact(fact);return fact;
 }
 async byDeployer(deployer:string,limit=20):Promise<IndexedPonsLaunch[]>{
  if(!/^0x[0-9a-f]{40}$/i.test(deployer)||!Number.isSafeInteger(limit)||limit<1||limit>50)
   throw Error('PONS_CREATOR_QUERY_INVALID');
  const cp=await this.checkpoint();if(!cp||cp.status!=='READY')throw Error('PONS_NOT_READY');
  const rows=await this.db.prepare('SELECT payload_json FROM pons_launch_facts WHERE chain_id=4663 AND deployer=? AND block_number<=? ORDER BY block_number DESC,log_index DESC LIMIT ?')
   .bind(deployer.toLowerCase(),cp.lastBlock,limit).all<FactRow>();
  const verify=await this.checkpoint();
  if(!verify||verify.version!==cp.version||verify.status!=='READY')throw Error('PONS_READ_CHECKPOINT_CHANGED');
  return (rows.results??[]).map(r=>{const f=JSON.parse(r.payload_json) as IndexedPonsLaunch;
   validateIndexedFact(f);return f;});
 }
 async factCount():Promise<number>{
  const r=await this.db.prepare('SELECT COUNT(*) AS n FROM pons_launch_facts WHERE chain_id=4663')
   .first<{n:number}>();return r?.n??0;
 }
}
