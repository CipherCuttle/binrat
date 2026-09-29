// EXPLICIT SYNTHETIC FIXTURE. Never imported by production code; no live RPC or Telegram.
import { D1CompatDatabase } from './d1Compat.js';
import { D1_SCHEMA_SQL } from '../../src/cloudflare/d1Schema.js';
import { D1Store } from '../../src/cloudflare/d1Store.js';
import { D1RuntimeStateStore } from '../../src/cloudflare/runtimeState.js';
import { handleWorkerRequest } from '../../src/cloudflare/worker.js';
import { handleSyncQueueBatch } from '../../src/cloudflare/syncQueue.js';
import { deriveEventId, deriveLaunchId } from '../../src/core/identity.js';
import { buildProvenanceFact } from '../../src/intelligence/provenance.js';
import { ARCPAD_LAUNCHER } from '../../src/arc/chain.js';
import type { Hex, LaunchObserved } from '../../src/core/types.js';
import type { WatchSource } from '../../src/autonomous/source.js';

export const addr = (n: number): Hex => `0x${n.toString(16).padStart(40,'0')}`;
export const hash = (n: number): Hex => `0x${n.toString(16).padStart(64,'0')}`;
export const CREATOR = addr(42);
export const PRINCIPAL = {userId:77,chatId:77};

export async function autonomousFixture() {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db,5042);
  let now = 1_790_640_000_000;
  let head = 102;
  let update = 100;
  const sent: Array<{chat_id:number;text:string}> = [];
  const transcript: string[] = ['SYNTHETIC LOCAL FIXTURE — not a production claim.'];
  const replacedHashes = new Map<number,string>();
  const blockTimes = new Map<number,number>();
  const source: WatchSource = {
    async head() { return {chainId:5042,block:BigInt(head),hash:hash(head),timestampMs:now}; },
    async point(block) { return {hash:replacedHashes.get(Number(block)) ?? hash(Number(block)),
      timestampMs:blockTimes.get(Number(block)) ?? now-10000}; }
  };
  const env = {DB:db,BINRAT_AUTONOMOUS_RAT_ENABLED:'true',TELEGRAM_BOT_TOKEN:'fixture:token',
    TELEGRAM_WEBHOOK_SECRET:'fixture-secret',TELEGRAM_REPLIES_ENABLED:'true',TELEGRAM_MAX_MESSAGES_PER_MINUTE:'10000'};
  const fakeFetch: typeof fetch = async (url,init) => {
    if (!String(url).startsWith('https://api.telegram.org/botfixture:token/sendMessage')) throw new Error('FIXTURE_NETWORK_FORBIDDEN');
    const body = JSON.parse(String(init?.body)) as {chat_id:number;text:string};
    sent.push(body); transcript.push(`BINRAT → ${body.chat_id}\n${body.text}`);
    return Response.json({ok:true,result:{message_id:sent.length}});
  };
  const checkpoint = async (block:number) => {
    head = Math.max(head,block+2);
    await store.commitCheckpoint({blockNumber:BigInt(block),blockHash:hash(block),guardBlockNumber:null,guardBlockHash:null});
    await new D1RuntimeStateStore(db,5042).put({sourceVerified:true,liveCaughtUp:true,headBlock:BigInt(head),targetBlock:BigInt(block),
      observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:null,lastHistoryError:null,
      lastObservationError:null,updatedAtMs:now});
  };
  const launch = async (block:number, creator=CREATOR, chainId=5042, observedAtMs=now): Promise<LaunchObserved> => {
    blockTimes.set(block,now);
    const token=addr(block+1000),txHash=hash(block+10000),launcher=ARCPAD_LAUNCHER;
    const value: LaunchObserved = {chainId,blockNumber:BigInt(block),blockHash:hash(block),observedAtMs,
      launchId:await deriveLaunchId({chainId,launcher,txHash,token}),
      eventId:await deriveEventId({chainId,launcher,txHash,logIndex:0}),source:'ARCPAD',launcher,txHash,logIndex:0,
      token,creator,pool:addr(block+2000),name:'SYNTHETIC FIXTURE',symbol:'FIXTURE',imageUri:'',website:'',twitter:'',telegram:''};
    const chainStore = new D1Store(db,chainId);
    await chainStore.putLaunch(value); await chainStore.putProvenanceFact(await buildProvenanceFact(value));
    return value;
  };
  const send = async (text:string, options: {updateId?:number;userId?:number;chatId?:number;type?:string;secret?:string}={}) => {
    const userId=options.userId ?? 77,chatId=options.chatId ?? userId;
    transcript.push(`USER ${userId} → ${text}`);
    return handleWorkerRequest(new Request('https://fixture.invalid/telegram/webhook',{
      method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':options.secret ?? 'fixture-secret'},
      body:JSON.stringify({update_id:options.updateId ?? update++,message:{message_id:1,chat:{id:chatId,type:options.type ?? 'private'},from:{id:userId},text}})
    }),env,{now:()=>now,externalFetch:fakeFetch,watchSource:source});
  };
  const cycle = async (fetchImpl=fakeFetch) => {
    let ack=0,retry=0;
    await handleSyncQueueBatch({messages:[{body:{kind:'RAT_WATCH_CYCLE',cycleId:crypto.randomUUID(),enqueuedAtMs:now},
      ack(){ack++;},retry(){retry++;}}]},env,{now:()=>now,externalFetch:fetchImpl,watchSource:source});
    return {ack,retry};
  };
  await checkpoint(100);
  const initial = await launch(100,CREATOR,5042,now-10000);
  return {db,store,env,source,sent,transcript,replacedHashes,blockTimes,checkpoint,launch,send,cycle,fakeFetch,initial,
    now:()=>now,advance:(ms=1000)=>{now+=ms;},setHead:(n:number)=>{head=n;}};
}

export async function runAutonomousDemo() {
  const f=await autonomousFixture();
  await f.send(`/dig ${CREATOR}`);
  await f.send(`/watch ${CREATOR}`);
  f.advance();
  const future=await f.launch(105); await f.checkpoint(105);
  f.transcript.push('FIXTURE EVENT: new canonical launch at block 105, after watch boundary 102.');
  await f.cycle();
  const outbox=await f.db.prepare('SELECT case_id FROM rat_v1_outbox').first<{case_id:string}>();
  if(!outbox) throw new Error('DEMO_OUTBOX_MISSING');
  await f.send(`/why ${outbox.case_id}`);
  await f.cycle();
  await f.send(`/unwatch ${CREATOR}`);
  f.advance(); await f.launch(110); await f.checkpoint(110); await f.cycle();
  f.transcript.push('REPLAY: no additional alert. UNWATCH: block 110 emitted no alert.');
  return {f,future,caseId:outbox.case_id};
}
