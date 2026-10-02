import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { buildPonsCurveOutcomeCapabilityReceipt, NATIVE_QUOTE } from '../src/pons/outcomeCapability.js';
import { buildPonsOutcomeObservationReceipt } from '../src/pons/outcomeReceipts.js';
import { buildPonsReplaySnapshot } from '../src/pons/replayLab.js';
import {
  buildPonsReplayExportBundle,
  buildPonsReplayReceipt,
  collectEvidenceRefs,
  verifyPonsReplayReceipt,
  verifyPonsReplaySnapshotDigest
} from '../src/pons/replayReceipt.js';
import { buildPonsTokenIdentityReceipt } from '../src/pons/tokenIdentity.js';

const DEPLOYER='0x0000000000000000000000000000000000000042' as Hex;
const addr=(n:number)=>('0x'+n.toString(16).padStart(40,'0')) as Hex;
const hash=(n:number)=>('0x'+n.toString(16).padStart(64,'0')) as Hex;

function launch():LaunchObserved {
  return {
    launchId:'a'.repeat(64),eventId:'a'.repeat(64),chainId:4663,blockNumber:100n,blockHash:hash(100),
    observedAtMs:1_000_000,source:'PONS_V2',launcher:addr(999),txHash:hash(1000),logIndex:0,
    token:addr(1),creator:DEPLOYER,pool:addr(2),name:'',symbol:'',imageUri:'',website:'',twitter:'',telegram:''
  };
}

async function richSnapshot(){
  const value=launch();
  const provenance=await buildProvenanceFact(value);
  const identity=await buildPonsTokenIdentityReceipt({
    launch:{launchId:value.launchId,token:value.token},
    observedBlock:140n,observedBlockHash:hash(140),name:'Replay Token',symbol:'RPLY',decimals:18
  });
  const capability=await buildPonsCurveOutcomeCapabilityReceipt({
    launch:{launchId:value.launchId,token:value.token,curve:value.pool},
    observedBlock:160n,observedBlockHash:hash(160),observedTimestampMs:1_400_000,
    pairToken:NATIVE_QUOTE,quoteDecimals:18,totalSupply:10n**18n,graduated:false,
    quoteReserve:2n*10n**18n,tokenReserve:10n**18n
  });
  const observation=await buildPonsOutcomeObservationReceipt({
    launch:{launchId:value.launchId,token:value.token,curve:value.pool},
    horizonMs:300_000,targetTimestampMs:1_300_000,capability
  });
  return buildPonsReplaySnapshot({
    targetLaunchId:value.launchId,
    asOf:{blockNumber:200n,blockHash:hash(200),timestampMs:2_000_000},
    target:{
      launch:value,
      launchTimestampMs:1_000_000,
      provenanceFact:provenance,
      tokenIdentity:identity,
      observations:[observation]
    },
    previous:[]
  });
}

test('Replay receipt deterministically binds snapshot and nested evidence',async()=>{
  const snapshot=await richSnapshot();
  const one=await buildPonsReplayReceipt(snapshot);
  const two=await buildPonsReplayReceipt(snapshot);

  assert.deepEqual(one,two);
  assert.match(one.receiptId,/^binrat-pons-replay:[0-9a-f]{64}$/);
  assert.equal(one.snapshotDigest,snapshot.outputDigest);
  assert.equal(one.asOfBlock,'200');
  assert.equal(one.asOfBlockHash,hash(200));
  assert.deepEqual(one.evidenceRefs.map((item)=>item.kind),[
    'OUTCOME','PROVENANCE','TOKEN_IDENTITY'
  ]);
  assert.equal(one.evidenceRefs.length,3);
  await verifyPonsReplayReceipt(snapshot,one);
  await verifyPonsReplaySnapshotDigest(snapshot);
});

test('Replay export bundle survives JSON round-trip and remains verifiable',async()=>{
  const snapshot=await richSnapshot();
  const bundle=await buildPonsReplayExportBundle(snapshot);
  const encoded=JSON.stringify(bundle);
  const parsed=JSON.parse(encoded) as typeof bundle;

  assert.deepEqual(parsed,bundle);
  await verifyPonsReplayReceipt(parsed.snapshot,parsed.receipt);
});

test('Replay receipt rejects snapshot tampering even when receipt is unchanged',async()=>{
  const snapshot=await richSnapshot();
  const receipt=await buildPonsReplayReceipt(snapshot);
  const tampered={
    ...snapshot,
    targetLaunch:{
      ...snapshot.targetLaunch!,
      tokenIdentity:{
        ...snapshot.targetLaunch!.tokenIdentity!,
        symbol:'FAKE'
      }
    }
  };
  await assert.rejects(
    verifyPonsReplayReceipt(tampered,receipt),
    /PONS_REPLAY_SNAPSHOT_DIGEST_INVALID/
  );
});

test('Replay receipt rejects nested receipt tampering and forged receipt ids',async()=>{
  const snapshot=await richSnapshot();
  const receipt=await buildPonsReplayReceipt(snapshot);

  await assert.rejects(
    verifyPonsReplayReceipt(snapshot,{
      ...receipt,
      evidenceRefs:receipt.evidenceRefs.map((item,index)=>index===0
        ? {...item,evidenceDigest:'0'.repeat(64)}
        : item)
    }),
    /PONS_REPLAY_RECEIPT_INVALID/
  );

  await assert.rejects(
    verifyPonsReplayReceipt(snapshot,{
      ...receipt,
      receiptId:'binrat-pons-replay:'+'0'.repeat(64)
    }),
    /PONS_REPLAY_RECEIPT_INVALID/
  );
});

test('Replay receipt supports launch-only snapshots without inventing evidence refs',async()=>{
  const value=launch();
  const snapshot=await buildPonsReplaySnapshot({
    targetLaunchId:value.launchId,
    asOf:{blockNumber:100n,blockHash:hash(100),timestampMs:1_000_000},
    target:{
      launch:value,
      launchTimestampMs:1_000_000,
      provenanceFact:null,
      tokenIdentity:null,
      observations:[]
    },
    previous:[]
  });
  const receipt=await buildPonsReplayReceipt(snapshot);

  assert.deepEqual(collectEvidenceRefs(snapshot),[]);
  assert.deepEqual(receipt.evidenceRefs,[]);
  await verifyPonsReplayReceipt(snapshot,receipt);
});
