/**
 * Offline-invocable positive-event proof. Unmounted: no provider construction,
 * WebSocket, case publication, or Telegram transport.
 *
 * Exactly six authorized JSON-RPC reads, all six pre-reserved atomically in
 * the existing BudgetLedger before the first network-facing callback.
 * Source chain ID / factory code are an independent admission prerequisite.
 */
import { decodeEventLog, getAddress, toEventSelector, toHex, type Hex, type RpcTransactionReceipt } from 'viem';
import { deriveEventId, deriveLaunchId } from '../core/identity.js';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { PONS_V2_FACTORY, ROBINHOOD_CHAIN_ID } from '../pons/chain.js';
import { ponsTokenLaunchedEvent } from '../pons/ponsAbi.js';
import { forwardReceiptRoot } from './forwardReceiptRoot.js';
import { PONS_TOKEN_LAUNCHED_TOPIC, type StoredHint, type TripwireSql } from './persistentTripwireWatch.js';
import type { BudgetLedger } from './budget.js';

export const PERSISTENT_TRIPWIRE_PROOF_SCHEMA = [
 'CREATE TABLE IF NOT EXISTS persistent_tripwire_proofs_v1 (',
 'generation TEXT NOT NULL, event_key TEXT NOT NULL, launch_id TEXT NOT NULL,',
 'proof_digest TEXT NOT NULL, proof_json TEXT NOT NULL, verified_at_ms INTEGER NOT NULL,',
 'PRIMARY KEY(generation,event_key), UNIQUE(generation,launch_id),',
 'FOREIGN KEY(generation) REFERENCES persistent_tripwire_sessions_v1(generation))'
].join(' ');

export interface TripwireProofWire {
 request(method: string, params: unknown[]): Promise<unknown>;
}
export interface TripwireProofResult {
 schemaVersion: 'binrat.tripwire-positive-proof/1';
 generation: string; eventKey: string; launchId: string; eventId: string;
 chainId: 4663; source: 'PONS_V2'; factory: string; deployer: string;
 token: string; curve: string; txHash: string; blockNumber: string;
 blockHash: string; logIndex: number; receiptsRoot: string; verifiedAtMs: number;
}
export interface TripwireProofPort {
 db: TripwireSql; ledger: Pick<BudgetLedger,'reserveTripwireProof'>;
 job: string; grantId: string; deadline: number; generation: string;
 wire: TripwireProofWire; now?: () => number;
}
const H32=/^0x[0-9a-f]{64}$/;
const Q=/^0x(?:0|[1-9a-f][0-9a-f]*)$/;
const MAX_TX=128, MAX_LOGS=1024, MAX_MATCHES=20;
const topic=toEventSelector(ponsTokenLaunchedEvent).toLowerCase();
const fail=(value:unknown,code='TRIPWIRE_CANONICAL_PROOF_INVALID'):asserts value => {
 if(!value)throw Error(code);
};
function qty(v:unknown):bigint {
 if(typeof v!=='string'||!Q.test(v))throw Error('TRIPWIRE_QUANTITY_INVALID');
 return BigInt(v);
}
function h32(v:unknown):string {
 if(typeof v!=='string'||!H32.test(v.toLowerCase())) throw Error('TRIPWIRE_HASH_INVALID');
 return v.toLowerCase();
}
function record(v:unknown):Record<string,unknown> {
 if(!v || typeof v!=='object' || Array.isArray(v))throw Error('TRIPWIRE_RPC_SHAPE_INVALID');
 return v as Record<string,unknown>;
}
function transact<T>(db:TripwireSql,task:()=>T):T {
 db.exec('BEGIN IMMEDIATE');
 try{const result=task();db.exec('COMMIT');return result;}
 catch(error){db.exec('ROLLBACK');throw error;}
}
interface Header {
 number:bigint;hash:string;receiptsRoot:string;transactions:string[];
}
function header(v:unknown):Header {
 const b=record(v),n=qty(b.number),hash=h32(b.hash),root=h32(b.receiptsRoot);
 if(!Array.isArray(b.transactions)||b.transactions.length>MAX_TX)throw Error('TRIPWIRE_TX_LIMIT');
 const transactions=b.transactions.map(h32);
 if(new Set(transactions).size!==transactions.length)throw Error('TRIPWIRE_TX_DUPLICATE');
 return {number:n,hash,receiptsRoot:root,transactions};
}
function sameHeader(a:Header,b:Header):boolean {
 return a.number===b.number&&a.hash===b.hash&&a.receiptsRoot===b.receiptsRoot&&
  canonicalJson(a.transactions)===canonicalJson(b.transactions);
}
interface NormalLog {
 blockNumber:bigint;blockHash:string;transactionHash:string;transactionIndex:number;
 logIndex:number;address:string;topics:string[];data:string;removed:boolean;
}
function normalLog(value:unknown):NormalLog {
 const l=record(value),n=qty(l.blockNumber),i=qty(l.transactionIndex),index=qty(l.logIndex);
 if(i>BigInt(Number.MAX_SAFE_INTEGER)||index>BigInt(Number.MAX_SAFE_INTEGER)||
   typeof l.address!=='string'||!/^0x[0-9a-f]{40}$/i.test(l.address)||
   !Array.isArray(l.topics)||l.topics.length>4||
   !l.topics.every(x=>typeof x==='string'&&H32.test(x.toLowerCase()))||
   typeof l.data!=='string'||!/^0x(?:[0-9a-f]{2})*$/i.test(l.data)||
   (l.removed!==undefined&&l.removed!==false))throw Error('TRIPWIRE_LOG_INVALID');
 return {blockNumber:n,blockHash:h32(l.blockHash),transactionHash:h32(l.transactionHash),
   transactionIndex:Number(i),logIndex:Number(index),address:l.address.toLowerCase(),
   topics:l.topics.map((x:string)=>x.toLowerCase()),data:l.data.toLowerCase(),removed:false};
}
function logIdentity(l:NormalLog):string {
 return canonicalJson([l.blockNumber.toString(),l.blockHash,l.transactionHash,
  l.transactionIndex,l.logIndex,l.address,l.topics,l.data]);
}
function isMatch(l:NormalLog,deployer:string):boolean {
 return l.address===PONS_V2_FACTORY&&l.topics.length===4&&l.topics[0]===topic&&
   l.topics[3]==='0x'+deployer.slice(2).padStart(64,'0');
}
function requireFlag(value:unknown,code:string):void {if(!value)throw Error(code);}

/** Called only by a pinned-source, exclusive-writer owner pilot.
 * No untrusted hint, unsigned caller-provided evidence, or admission flag
 * is enough to produce a Case/Telegram notification. */
export async function proveQueuedTripwireHint(o:TripwireProofPort):Promise<TripwireProofResult|null> {
 const now=o.now??Date.now,begin=now();
 requireFlag(topic===PONS_TOKEN_LAUNCHED_TOPIC,'TRIPWIRE_EVENT_SELECTOR_DRIFT');
 requireFlag(Number.isSafeInteger(begin)&&begin>=0,'TRIPWIRE_CLOCK_INVALID');
 o.db.exec(PERSISTENT_TRIPWIRE_PROOF_SCHEMA);
 let selected:{hint:StoredHint;deployer:string;stops:number;start:number}|null=null;
 transact(o.db,()=>{
   const session=o.db.prepare('SELECT * FROM persistent_tripwire_sessions_v1 WHERE generation=?')
     .get(o.generation) as {state:string;owner_id:string;deployer:string;stops_at_ms:number;start_block:number}|undefined;
   const watch=o.db.prepare('SELECT state,owner_id,deployer,start_block FROM pons_tripwire_watches WHERE generation=?')
     .get(o.generation) as {state:string;owner_id:string;deployer:string;start_block:number}|undefined;
   if(!session||session.state!=='CONNECTED'||now()>=session.stops_at_ms||
      !watch||watch.state!=='ACTIVE'||watch.owner_id!==session.owner_id||
      watch.deployer!==session.deployer||watch.start_block!==session.start_block)
      throw Error('TRIPWIRE_WATCH_NOT_AUTHORIZED');
   const hint=o.db.prepare("SELECT * FROM persistent_tripwire_hints_v1 WHERE generation=? AND state='PENDING' ORDER BY block_number,log_index LIMIT 1")
     .get(o.generation) as StoredHint|undefined;
   if(!hint)return;
   if(hint.block_number<=session.start_block)throw Error('TRIPWIRE_HISTORICAL_HINT');
   const changed=o.db.prepare("UPDATE persistent_tripwire_hints_v1 SET state='VERIFYING' WHERE generation=? AND event_key=? AND state='PENDING'")
     .run(o.generation,hint.event_key).changes;
   if(Number(changed)!==1)throw Error('TRIPWIRE_CLAIM_LOST');
   selected={hint,deployer:session.deployer,stops:session.stops_at_ms,start:session.start_block};
 });
 if(!selected)return null;
 const scope=selected as {hint:StoredHint;deployer:string;stops:number;start:number};
 const hint=scope.hint;
 try {
   // The grant must fit the 60s parent job and session lifetime. All six
   // shared request slots and 400 modeled CU are permanently spent up front.
   o.ledger.reserveTripwireProof(o.job,o.grantId,Math.min(o.deadline,scope.stops));
   let calls=0;
   async function read(method:string,params:unknown[]):Promise<unknown> {
     calls++;
     if(calls>6||now()>=scope.stops||now()>=o.deadline)throw Error('TRIPWIRE_PROOF_TIMEOUT');
     return o.wire.request(method,params);
   }
   const latest=header(await read('eth_getBlockByNumber',['latest',false]));
   const finalized=header(await read('eth_getBlockByNumber',['finalized',false]));
   const candidate=BigInt(hint.block_number);
   requireFlag(candidate>BigInt(scope.start)&&
     latest.number>=candidate+2n&&finalized.number>=candidate,'TRIPWIRE_FINALITY_UNAVAILABLE');
   const at=header(await read('eth_getBlockByNumber',[toHex(candidate),false]));
   requireFlag(at.number===candidate&&at.hash===hint.block_hash,'TRIPWIRE_BLOCK_REORG');
   const exact={address:PONS_V2_FACTORY,topics:[topic,null,null,'0x'+scope.deployer.slice(2).padStart(64,'0')],
     fromBlock:toHex(candidate),toBlock:toHex(candidate)};
   const rawLogs=await read('eth_getLogs',[exact]);
   requireFlag(Array.isArray(rawLogs)&&rawLogs.length<=MAX_MATCHES,'TRIPWIRE_LOG_RESPONSE_INVALID');
   const fetched=(rawLogs as unknown[]).map(normalLog);
   for(const l of fetched)requireFlag(l.blockNumber===candidate&&l.blockHash===at.hash&&isMatch(l,scope.deployer),
     'TRIPWIRE_FILTER_DRIFT');
   const rawReceipts=await read('eth_getBlockReceipts',[toHex(candidate)]);
   requireFlag(Array.isArray(rawReceipts)&&rawReceipts.length===at.transactions.length&&rawReceipts.length<=MAX_TX,
     'TRIPWIRE_RECEIPTS_UNAVAILABLE');
   const receipts=rawReceipts as RpcTransactionReceipt[];
   requireFlag(forwardReceiptRoot(receipts)===at.receiptsRoot,'TRIPWIRE_RECEIPTS_ROOT_INVALID');
   const all:NormalLog[]=[];
   for(let i=0;i<receipts.length;i++){
     const receipt=record(receipts[i]);
     requireFlag(qty(receipt.transactionIndex)===BigInt(i)&&
       h32(receipt.transactionHash)===at.transactions[i]&&
       h32(receipt.blockHash)===at.hash&&qty(receipt.blockNumber)===candidate,
       'TRIPWIRE_RECEIPT_BINDING_INVALID');
     requireFlag(Array.isArray(receipt.logs),'TRIPWIRE_RECEIPT_LOGS_UNAVAILABLE');
     for(const raw of receipt.logs as unknown[]){
       const log=normalLog(raw);
       requireFlag(log.blockNumber===candidate&&log.blockHash===at.hash&&
         log.transactionHash===at.transactions[i]&&log.transactionIndex===i&&log.logIndex===all.length,
         'TRIPWIRE_RECEIPT_LOG_ORDER_INVALID');
       all.push(log);
       requireFlag(all.length<=MAX_LOGS,'TRIPWIRE_RECEIPT_LOG_LIMIT');
     }
   }
   const fromReceipts=all.filter(l=>isMatch(l,scope.deployer));
   requireFlag(fromReceipts.length<=MAX_MATCHES&&
     canonicalJson(fromReceipts.map(logIdentity).sort())===canonicalJson(fetched.map(logIdentity).sort()),
     'TRIPWIRE_LOG_SET_MISMATCH');
   const matching=fromReceipts.filter(l=>l.transactionHash===hint.tx_hash&&l.logIndex===hint.log_index);
   requireFlag(matching.length===1&&matching[0].blockHash===hint.block_hash,
     'TRIPWIRE_HINT_NOT_CANONICAL');
   const stable=header(await read('eth_getBlockByNumber',[toHex(candidate),false]));
   requireFlag(sameHeader(at,stable),'TRIPWIRE_BLOCK_REORG');
   const event=decodeEventLog({abi:[ponsTokenLaunchedEvent],
      data:matching[0].data as Hex,topics:matching[0].topics as [Hex,...Hex[]],strict:true});
   const args=event.args;
   requireFlag(args.deployer?.toLowerCase()===scope.deployer,'TRIPWIRE_DEPLOYER_MISMATCH');
   const launchId=await deriveLaunchId({chainId:ROBINHOOD_CHAIN_ID,launcher:PONS_V2_FACTORY,
      txHash:hint.tx_hash as Hex,token:getAddress(args.token).toLowerCase() as Hex,source:'PONS_V2'});
   const eventId=await deriveEventId({chainId:ROBINHOOD_CHAIN_ID,launcher:PONS_V2_FACTORY,
      txHash:hint.tx_hash as Hex,logIndex:hint.log_index,source:'PONS_V2'});
   const material:TripwireProofResult={schemaVersion:'binrat.tripwire-positive-proof/1',
      generation:o.generation,eventKey:hint.event_key,launchId,eventId,
      chainId:4663,source:'PONS_V2',factory:PONS_V2_FACTORY,deployer:scope.deployer,
      token:args.token.toLowerCase(),curve:args.curve.toLowerCase(),txHash:hint.tx_hash,
      blockNumber:String(hint.block_number),blockHash:hint.block_hash,
      logIndex:hint.log_index,receiptsRoot:at.receiptsRoot,verifiedAtMs:now()};
   const json=canonicalJson(material),digest=await sha256Hex(material);
   transact(o.db,()=>{
     const watch=o.db.prepare('SELECT owner_id,deployer,start_block,state FROM pons_tripwire_watches WHERE generation=?')
       .get(o.generation) as {owner_id:string;deployer:string;start_block:number;state:string}|undefined;
     const session=o.db.prepare('SELECT owner_id,deployer,start_block,stops_at_ms,state FROM persistent_tripwire_sessions_v1 WHERE generation=?')
       .get(o.generation) as {owner_id:string;deployer:string;start_block:number;stops_at_ms:number;state:string}|undefined;
     const current=o.db.prepare('SELECT state,block_hash,tx_hash,log_index FROM persistent_tripwire_hints_v1 WHERE generation=? AND event_key=?')
       .get(o.generation,hint.event_key) as {state:string;block_hash:string;tx_hash:string;log_index:number}|undefined;
     if(!watch||!session||watch.state!=='ACTIVE'||session.state!=='CONNECTED'||
       watch.owner_id!==session.owner_id||watch.deployer!==session.deployer||
       watch.start_block!==session.start_block||now()>=session.stops_at_ms||
       current?.state!=='VERIFYING'||current.block_hash!==hint.block_hash||
       current.tx_hash!==hint.tx_hash||current.log_index!==hint.log_index)
       throw Error('TRIPWIRE_PROOF_ADMISSION_CHANGED');
     o.db.prepare('INSERT INTO persistent_tripwire_proofs_v1 VALUES(?,?,?,?,?,?)')
       .run(o.generation,hint.event_key,launchId,digest,json,material.verifiedAtMs);
     if(Number(o.db.prepare("UPDATE persistent_tripwire_hints_v1 SET state='PROVEN' WHERE generation=? AND event_key=? AND state='VERIFYING'")
       .run(o.generation,hint.event_key).changes)!==1)throw Error('TRIPWIRE_PROOF_CAS_LOST');
   });
   return material;
 }catch{
   // No auto-retry: an ambiguous/failed attempt remains an explicit unknown.
   transact(o.db,()=>{o.db.prepare("UPDATE persistent_tripwire_hints_v1 SET state='UNKNOWN' WHERE generation=? AND event_key=? AND state='VERIFYING'")
     .run(o.generation,hint.event_key);});
   throw Error('TRIPWIRE_PROOF_UNVERIFIED');
 }
}
