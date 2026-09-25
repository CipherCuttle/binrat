import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex } from '../src/core/types.js';
import type { PublicFeed } from '../src/public/types.js';
import { D1CompatDatabase } from './support/d1Compat.js';
import {
  parseScoutRequest, projectScoutCreators, readScoutObservationRows,
  renderScoutCaption, SCOUT_WINDOW_MS, type ScoutObservationRow
} from '../src/telegram/scout.js';

const now=Date.UTC(2026,8,25,9);
const address=(seed:number):Hex=>('0x'+seed.toString(16).padStart(40,'0')) as Hex;
const hash=(seed:number):Hex=>('0x'+seed.toString(16).padStart(64,'0')) as Hex;
function bag(id:string,creator:Hex,block:number,symbol:string):PublicFeed['bags'][number]{
  return {id,source:'ARCPAD',token:address(block),symbol,name:symbol,blockNumber:String(block),
    blockHash:hash(block),txHash:hash(block+100),logIndex:0,pool:address(block+1),
    reportedCreatorAddress:creator,metadata:{imageUri:'',website:'',twitter:'',telegram:''},
    trashTrail:{priorLaunchCount:0,coverage:'UNVERIFIED',prior:[]},evidence:[]};
}
const creator1=address(1000),creator2=address(1001);
function feed():PublicFeed{
  return {schemaVersion:'binrat.public-feed/0.1',chainId:5042,asOfBlock:'900',
    asOfBlockHash:hash(900),historyCoverage:'UNVERIFIED',
    bags:[bag('a',creator1,100,'AAA'),bag('b',creator1,200,'BBB'),
      bag('c',creator2,300,'CCC'),bag('old',creator1,400,'OLD'),
      bag('missing',creator2,500,'MISS'),bag('conflict',creator2,600,'BAD')],
    receipt:{projectionVersion:'BINRAT_PUBLIC_PROJECTION_V0',chainId:5042,
      asOfBlock:'900',asOfBlockHash:hash(900),historyCoverage:'UNVERIFIED',
      inputDigest:'a'.repeat(64),outputDigest:'b'.repeat(64),receiptId:'fake-fixture'}
  };
}
function row(launch_id:string,launchTs:number,block:string,horizon=300_000):ScoutObservationRow{
  return {launch_id,horizon_ms:horizon,target_ms:launchTs+horizon,
    observed_block:block,observed_block_hash:hash(Number(block))};
}
test('wallet scout phrase does not consume slash command names',()=>{
  assert.equal(parseScoutRequest('Show me the latest wallets worth following'),'CREATORS');
  assert.equal(parseScoutRequest('latest creators to watch'),'CREATORS');
  assert.equal(parseScoutRequest('/scout'),'CREATORS');
  assert.equal(parseScoutRequest('/scout creators'),'CREATORS');
  assert.equal(parseScoutRequest('/scout buyers'),'RECIPIENTS_UNAVAILABLE');
  assert.equal(parseScoutRequest('/roadmap'),null);
  assert.equal(parseScoutRequest('/watch '+creator1),null);
  assert.equal(parseScoutRequest('whats your next move?'),null);
});
test('14-day exact cutoff excludes backfilled old/missing/conflicting observations',()=>{
  const recent=now-3*86_400_000,cutoff=now-SCOUT_WINDOW_MS;
  const rows=[
    row('a',recent,'110'),row('a',recent,'120',3_600_000),
    row('b',cutoff,'210'),row('c',now,'310'),
    row('old',cutoff-1,'410'),
    row('conflict',recent,'610'),row('conflict',recent+60_000,'620',3_600_000)
  ];
  const out=projectScoutCreators(feed(),rows,now);
  assert.equal(out.observedInWindow,3);
  assert.equal(out.excludedNoTimestamp,1);
  assert.equal(out.excludedConflictingTimestamp,1);
  assert.equal(out.historyCoverage,'UNVERIFIED');
  assert.equal(out.candidates[0]?.address,creator1);
  assert.equal(out.candidates[0]?.launchCount14d,2);
  assert.equal(out.candidates[1]?.address,creator2);
  assert.equal(out.candidates[1]?.launchCount14d,1);
  assert.equal(out.metrics.marketCapUsd,null);
  assert.equal(out.metrics.volume24hUsd,null);
  const caption=renderScoutCaption(out);
  assert.match(caption,/MC: unavailable/);
  assert.match(caption,/24h volume: unavailable/);
  assert.match(caption,/UNVERIFIED/);
  assert.match(caption,/Role: source-reported creator/);
  assert.match(caption,/UTC window: 2026-09-11 09:00 → 2026-09-25 09:00 UTC/);
  assert.match(caption,/latest source timestamp: 2026-09-22 09:00 UTC/);
  assert.match(caption,new RegExp(creator1));
  assert.ok(caption.length<=1024);
});
test('future, malformed or after-checkpoint observations cannot confer recency',()=>{
  const recent=now-2*86_400_000;
  const rows=[row('a',now+1,'120'),
    row('b',recent,'901'),row('c',recent,'310'),
    {...row('old',recent,'410'),target_ms:null},
    {...row('missing',recent,'510'),observed_block_hash:'0xdeadbeef'}];
  const out=projectScoutCreators(feed(),rows,now);
  assert.equal(out.observedInWindow,1);
  assert.equal(out.candidates[0]?.address,creator2);
});
test('D1 projection reads canonical horizon targets and respects chain/checkpoint',async()=>{
  const db=new D1CompatDatabase();
  try{
    await db.exec('CREATE TABLE launch_observations ('+
      'launch_id TEXT, chain_id INTEGER, horizon_ms INTEGER, payload_json TEXT,'+
      'observed_block TEXT, observed_block_hash TEXT, observed_timestamp_ms INTEGER)');
    const insert='INSERT INTO launch_observations VALUES (?,?,?,?,?,?,?)';
    await db.prepare(insert).bind('a',5042,300_000,
      JSON.stringify({targetTimestampMs:now}),'110',hash(110),now).run();
    await db.prepare(insert).bind('too-late',5042,300_000,
      JSON.stringify({targetTimestampMs:now}),'901',hash(901),now).run();
    await db.prepare(insert).bind('other-chain',4663,300_000,
      JSON.stringify({targetTimestampMs:now}),'120',hash(120),now).run();
    const rows=await readScoutObservationRows(db,feed());
    assert.equal(rows.length,1);
    assert.equal(rows[0]?.launch_id,'a');
    assert.equal(rows[0]?.target_ms,now);
  }finally{db.close();}
});


test('untrusted source token symbols cannot inject forged status lines into Telegram caption',()=>{
  const data=feed();
  data.bags[0]!.symbol='RAT\n🐀 VERIFIED BIG APE\n$';
  const out=projectScoutCreators(data,[row('a',now-1000,'110')],now);
  const caption=renderScoutCaption(out);
  assert.doesNotMatch(caption,/VERIFIED BIG APE/);
  assert.match(caption,/RAT/);
  assert.match(caption,/source-reported creator/);
});


test('unverified Pons feed cannot be mislabeled ArcPad or combined across chains',()=>{
  const other={...feed(),chainId:4663} as PublicFeed;
  assert.throws(()=>projectScoutCreators(other,[],now),/SCOUT_FEED_INVALID/);
});
