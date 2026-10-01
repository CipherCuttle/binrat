import assert from 'node:assert/strict';
import test from 'node:test';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { dig, why } from '../src/autonomous/evidence.js';
import { parseTarget } from '../src/autonomous/model.js';
import { discoverRats, RATS_RECENT_BLOCK_WINDOW, renderRats } from '../src/autonomous/rats.js';
import { createPublicShareReceipt, openPublicShareReceipt, renderOpenedReceipt, renderShareArtifact, telegramDeepLink } from '../src/autonomous/share.js';
import { FreeEntitlements, FREE_CAPACITY } from '../src/autonomous/entitlements.js';
import { listWatches } from '../src/autonomous/watches.js';
import { CREATOR, PRINCIPAL, addr, hash, autonomousFixture, runRatsShareDemo } from './support/autonomousFixture.js';

const count = async (db: Awaited<ReturnType<typeof autonomousFixture>>['db'], table: string) =>
  (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{n:number}>())!.n;

async function recurrentFixture() {
  const f = await autonomousFixture();
  await f.launch(99,CREATOR);
  const other = addr(7);
  await f.launch(98,other); await f.launch(97,other);
  return { f, other };
}

test('RATS snapshots are deterministic, chain-scoped, bounded and explain every retained candidate', async () => {
  const {f,other} = await recurrentFixture();
  try {
    await f.launch(96,CREATOR,4663); await f.launch(95,CREATOR,4663);
    const first = await discoverRats(f.db,f.now());
    const again = await discoverRats(f.db,f.now());
    assert.deepEqual(again,first);
    assert.equal(first.candidates.length,2);
    assert.equal(first.candidates[0]!.entity.entityId,CREATOR);
    assert.equal(first.candidates[0]!.recurrenceCount,4);
    assert.equal(first.candidates[0]!.latestLaunch.blockNumber,'100');
    assert.equal(first.candidates[0]!.latestLaunch.symbol,'FIXTURE');
    assert.deepEqual(first.candidates[0]!.previousLaunches?.map(item=>item.blockNumber),['99','96','95']);
    assert.equal(first.candidates[1]!.entity.entityId,other);
    assert.deepEqual(first.candidates[1]!.previousLaunches?.map(item=>item.blockNumber),['97']);
    assert.equal(first.candidates[1]!.recurrenceCount,2);
    assert.ok(first.candidates.every(candidate => candidate.entity.chainId===4663 && candidate.evidenceRefs.length>=2));
    assert.ok(first.candidates.every(candidate => candidate.reasons.every(reason => reason.evidenceRefs.length>0)));
    assert.equal(first.coverage.status,'PARTIAL');
    assert.match(renderRats(first),/Previous: \$FIXTURE/);
    assert.match(renderRats(first),/Newest repeat activity first/);
    assert.ok(renderRats(first).length<4096);
    assert.doesNotMatch(JSON.stringify(first),/profit|p.?&.?l|smart.money|score|whale|insider/i);
    const receipt=await why(f.db,first.candidates[0]!.caseId,f.now());
    assert.deepEqual(receipt.discovery?.reasons,first.candidates[0]!.reasons);
    assert.equal(await count(f.db,'rat_v11_pons_discovery_snapshots'),1);
  } finally { f.db.close(); }
});

test('RATS ranks the freshest repeat activity ahead of older high-volume deployers', async () => {
  const {f}=await recurrentFixture();
  const fresher=addr(8);
  try {
    await f.launch(101,fresher);
    await f.launch(102,fresher);
    await f.checkpoint(102);
    await f.launch(96,CREATOR);
    await f.launch(95,CREATOR);
    const snapshot=await discoverRats(f.db,f.now());
    assert.equal(snapshot.candidates[0]!.entity.entityId,fresher);
    assert.equal(snapshot.candidates[0]!.latestLaunch.blockNumber,'102');
    assert.equal(snapshot.candidates[0]!.recurrenceCount,2);
    const olderHeavy=snapshot.candidates.find(candidate=>candidate.entity.entityId===CREATOR);
    assert.equal(olderHeavy?.recurrenceCount,4);
    assert.equal(olderHeavy?.latestLaunch.blockNumber,'100');
  } finally { f.db.close(); }
});

test('RATS omits stale repeaters instead of padding the fresh list with old history', async () => {
  const f=await autonomousFixture();
  const stale=addr(9),fresh=addr(10);
  try {
    await f.launch(20,stale); await f.launch(30,stale);
    const tip=Number(RATS_RECENT_BLOCK_WINDOW)+100;
    await f.launch(tip-1,fresh); await f.launch(tip,fresh);
    await f.checkpoint(tip);
    const snapshot=await discoverRats(f.db,f.now());
    assert.ok(snapshot.candidates.some(candidate=>candidate.entity.entityId===fresh));
    assert.equal(snapshot.candidates.some(candidate=>candidate.entity.entityId===stale),false);
  } finally { f.db.close(); }
});

test('maximum RATS cards and five-receipt public recovery fit one Telegram message without omitting evidence', async () => {
  const f=await autonomousFixture();
  try {
    for (let i=1;i<=5;i++) {
      await f.launch(99-i*2,addr(100+i)); await f.launch(98-i*2,addr(100+i));
    }
    for (let block=80;block<85;block++) await f.launch(block,CREATOR);
    const snapshot=await discoverRats(f.db,f.now());
    assert.equal(snapshot.candidates.length,5);
    assert.ok(renderRats(snapshot).length<4096);
    const receipt=await createPublicShareReceipt(f.db,(await dig(f.db,parseTarget(CREATOR),f.now())).caseId,f.now());
    const opened=renderOpenedReceipt(receipt);
    assert.ok(opened.length<4096);
    assert.equal((opened.match(/source: /g) ?? []).length,5);
  } finally { f.db.close(); }
});

test('RATS accepts a durable checkpoint ahead of the verified runtime target and stays bounded to that target', async () => {
  const {f}=await recurrentFixture();
  try {
    await f.launch(101,CREATOR);
    await f.store.commitCheckpoint({blockNumber:101n,blockHash:hash(101),guardBlockNumber:null,guardBlockHash:null});
    const snapshot=await discoverRats(f.db,f.now());
    assert.equal(snapshot.sourceCheckpoint,'100');
    assert.ok(snapshot.candidates.every(candidate=>candidate.evidenceRefs.every(ref=>BigInt(ref.blockNumber)<=100n)));
  } finally { f.db.close(); }
});

test('RATS fails closed when the durable checkpoint is behind the verified runtime target', async () => {
  const {f}=await recurrentFixture();
  try {
    await new D1RuntimeStateStore(f.db,4663).put({sourceVerified:true,liveCaughtUp:true,headBlock:103n,targetBlock:101n,
      observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:null,lastHistoryError:null,lastObservationError:null,updatedAtMs:f.now()});
    await assert.rejects(discoverRats(f.db,f.now()),/INDEX_UNAVAILABLE/);
  } finally { f.db.close(); }
});

test('RATS uses the verified target when a newer sync has crossed it but the cached cycle bit still says not caught up', async () => {
  const {f}=await recurrentFixture();
  try {
    await new D1RuntimeStateStore(f.db,4663).put({sourceVerified:true,liveCaughtUp:false,headBlock:102n,targetBlock:100n,
      observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:null,lastHistoryError:null,lastObservationError:null,updatedAtMs:f.now()});
    const snapshot=await discoverRats(f.db,f.now());
    assert.equal(snapshot.sourceCheckpoint,'100');
    assert.ok(snapshot.candidates.every(candidate=>candidate.evidenceRefs.every(ref=>BigInt(ref.blockNumber)<=100n)));
  } finally { f.db.close(); }
});

test('RATS fails closed on unverified state and rejects malformed source evidence', async () => {
  const {f} = await recurrentFixture();
  try {
    await new D1RuntimeStateStore(f.db,4663).put({sourceVerified:false,liveCaughtUp:true,headBlock:102n,targetBlock:100n,
      observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:null,lastHistoryError:null,lastObservationError:null,updatedAtMs:f.now()});
    await assert.rejects(discoverRats(f.db,f.now()),/INDEX_UNAVAILABLE/);
  } finally { f.db.close(); }

  const malformed=await autonomousFixture();
  try {
    await malformed.launch(99,CREATOR);
    await malformed.db.prepare("UPDATE provenance_facts SET payload_json='{}' WHERE launch_id=?").bind(malformed.initial.launchId).run();
    const snapshot=await discoverRats(malformed.db,malformed.now());
    assert.equal(snapshot.candidates.length,0);
  } finally { malformed.db.close(); }
});

test('RATS uses the existing creator-only WATCH route and snapshot retention is bounded', async () => {
  const {f} = await recurrentFixture();
  try {
    const snapshot=await discoverRats(f.db,f.now());
    const candidate=snapshot.candidates[0]!;
    await f.send(`/watch 4663:CREATOR:${candidate.entity.entityId}`,{updateId:700});
    assert.equal((await listWatches(f.db,PRINCIPAL))[0]!.entity_id,candidate.entity.entityId);
    await f.send(`/watch 4663:TOKEN:${candidate.entity.entityId}`,{updateId:701});
    assert.match(f.sent.at(-1)!.text,/reported deployers only/);
    for(let i=0;i<205;i++) await f.db.prepare(`INSERT OR IGNORE INTO rat_v11_discovery_snapshots
      (discovery_id,chain_id,source_checkpoint,rule_version,coverage_status,snapshot_json,generated_at_ms,expires_at_ms)
      VALUES (?,?,?,?,?,?,?,?)`).bind(i.toString(16).padStart(64,'0'),4663,'100','RATS_PONS_DEPLOYER_RECURRENCE_V1','PARTIAL',JSON.stringify(snapshot),f.now()-i, f.now()+100000).run();
    await discoverRats(f.db,f.now());
    assert.ok(await count(f.db,'rat_v11_pons_discovery_snapshots')<=200);
  } finally { f.db.close(); }
});

test('DIG, RATS and future ALERT cases create opaque public receipts without cross-user state', async () => {
  const {f}=await recurrentFixture();
  try {
    const digReply=await f.send(`/dig ${CREATOR}`,{updateId:800}); assert.equal(digReply.status,200);
    const digCase=(f.sent.at(-1)!.text.match(/caseId: ([0-9a-f]{64})/) ?? [])[1]!;
    const rats=(await discoverRats(f.db,f.now())).candidates[0]!;
    await f.send(`/watch ${CREATOR}`,{updateId:801}); f.advance(); await f.launch(105); await f.checkpoint(105); await f.cycle();
    const alertCase=(await f.db.prepare("SELECT case_id FROM rat_v1_outbox WHERE state='SENT'").first<{case_id:string}>())!.case_id;
    for (const caseId of [digCase,rats.caseId,alertCase]) {
      const shared=await createPublicShareReceipt(f.db,caseId,f.now());
      assert.match(shared.receiptId,/^[0-9a-f]{32}$/);
      const json=JSON.stringify(shared);
      assert.doesNotMatch(json,/(?:user_id|chat_id|watch_generation|entitlement|conversation)/i);
      assert.equal((await openPublicShareReceipt(f.db,shared.receiptId,f.now())).caseId,caseId);
      const artifact=renderShareArtifact(shared);
      const link=telegramDeepLink(shared.receiptId);
      assert.match(link,new RegExp(`receipt_${shared.receiptId}$`));
      assert.match(artifact,/https:\/\/t\.me\/share\/url\?/);
      const parsed=new URL(artifact.match(/https:\/\/t\.me\/share\/url\?\S+/)![0]);
      assert.equal(parsed.searchParams.get('url'),link);
    }
    const publicReceipt=await createPublicShareReceipt(f.db,rats.caseId,f.now());
    await f.send(`/start receipt_${publicReceipt.receiptId}`,{userId:88,chatId:88,updateId:802});
    const opened=f.sent.at(-1)!.text;
    assert.match(opened,/SOMEBODY LEFT YOU A RECEIPT/); assert.doesNotMatch(opened,/private attention/i);
    assert.match(renderOpenedReceipt(publicReceipt),/WATCH: \/watch 4663:CREATOR/);
    const historicalReceipt={...publicReceipt,chainId:5042,finding:{...publicReceipt.finding,chainId:5042}};
    assert.match(renderOpenedReceipt(historicalReceipt),/WATCH unavailable for Arc 5042 historical receipts/);
    const historicalWatch=await f.send(`/watch 5042:CREATOR:${CREATOR}`,{userId:88,chatId:88,updateId:803});
    assert.equal(historicalWatch.status,200);
    assert.match(f.sent.at(-1)!.text,/Live watches are available only on Robinhood\/Pons 4663/);
    assert.equal((await listWatches(f.db,{userId:88,chatId:88})).length,0);
    await f.send(`/watch 4663:CREATOR:${CREATOR}`,{userId:88,chatId:88,updateId:804});
    assert.equal((await listWatches(f.db,PRINCIPAL)).length,1);
    assert.equal((await listWatches(f.db,{userId:88,chatId:88})).length,1);
    assert.deepEqual(await new FreeEntitlements().resolve({userId:88,chatId:88}),FREE_CAPACITY);
    const tokenCase=await dig(f.db,parseTarget(`4663:TOKEN:${f.initial.token}`),f.now());
    const tokenShare=await createPublicShareReceipt(f.db,tokenCase.caseId,f.now());
    assert.match(renderOpenedReceipt(tokenShare),/WATCH unavailable for this role/);
  } finally { f.db.close(); }
});

test('public receipt tampering, unknown/expired opening and repeated opens fail safely or remain idempotent', async () => {
  const {f}=await recurrentFixture();
  try {
    const candidate=(await discoverRats(f.db,f.now())).candidates[0]!;
    const shared=await createPublicShareReceipt(f.db,candidate.caseId,f.now());
    assert.deepEqual(await openPublicShareReceipt(f.db,shared.receiptId,f.now()),await openPublicShareReceipt(f.db,shared.receiptId,f.now()));
    await assert.rejects(openPublicShareReceipt(f.db,'f'.repeat(32),f.now()),/PUBLIC_RECEIPT_UNAVAILABLE/);
    const tampered=`${shared.receiptId[0]==='0' ? '1' : '0'}${shared.receiptId.slice(1)}`;
    await assert.rejects(openPublicShareReceipt(f.db,tampered,f.now()),/PUBLIC_RECEIPT_UNAVAILABLE/);
    await f.db.prepare('UPDATE rat_v11_pons_public_receipts SET expires_at_ms=? WHERE receipt_id=?').bind(f.now(),shared.receiptId).run();
    await assert.rejects(openPublicShareReceipt(f.db,shared.receiptId,f.now()),/PUBLIC_RECEIPT_UNAVAILABLE/);
    await f.db.prepare('UPDATE rat_v1_cases SET receipt_json=? WHERE case_id=?').bind(JSON.stringify({...await why(f.db,candidate.caseId,f.now()),userId:77}),candidate.caseId).run();
    await assert.rejects(createPublicShareReceipt(f.db,candidate.caseId,f.now()),/RECEIPT_UNAVAILABLE/);
  } finally { f.db.close(); }
});

test('deterministic RATS → WHY → WATCH → future ALERT → SHARE → recipient WHY/WATCH demo is isolated', async () => {
  const {f,deepLink}=await runRatsShareDemo();
  try {
    assert.match(deepLink,/^https:\/\/t\.me\/BinratBot\?start=receipt_[0-9a-f]{32}$/);
    assert.equal((await listWatches(f.db,PRINCIPAL)).length,1);
    assert.equal((await listWatches(f.db,{userId:88,chatId:88})).length,1);
    assert.equal(await count(f.db,'rat_v1_outbox'),1);
    assert.equal(await count(f.db,'rat_v1_outbox'),1); // repeated completion never enqueues another alert
    assert.ok(f.transcript.some(line=>line.includes('SOMEBODY LEFT YOU A RECEIPT')));
    if (process.env.BINRAT_PRINT_FIXTURE==='true') console.log(f.transcript.join('\n\n'));
  } finally { f.db.close(); }
});
