import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { buildPonsCurveOutcomeCapabilityReceipt, NATIVE_QUOTE } from '../src/pons/outcomeCapability.js';
import { buildPonsOutcomeObservationReceipt } from '../src/pons/outcomeReceipts.js';
import { buildPonsReplaySnapshot } from '../src/pons/replayLab.js';
import { buildPonsTokenIdentityReceipt } from '../src/pons/tokenIdentity.js';

const DEPLOYER='0x0000000000000000000000000000000000000042' as Hex;
const addr=(n:number)=>('0x'+n.toString(16).padStart(40,'0')) as Hex;
const hash=(n:number)=>('0x'+n.toString(16).padStart(64,'0')) as Hex;

function launch(id:string,block:number,token:number,curve:number):LaunchObserved {
  return {
    launchId:id,eventId:id,chainId:4663,blockNumber:BigInt(block),blockHash:hash(block),observedAtMs:block*1000,
    source:'PONS_V2',launcher:addr(999),txHash:hash(block+1000),logIndex:0,token:addr(token),creator:DEPLOYER,
    pool:addr(curve),name:'',symbol:'',imageUri:'',website:'',twitter:'',telegram:''
  };
}

async function completeHour(value:LaunchObserved) {
  const capability=await buildPonsCurveOutcomeCapabilityReceipt({
    launch:{launchId:value.launchId,token:value.token,curve:value.pool},
    observedBlock:180n,observedBlockHash:hash(180),observedTimestampMs:5_000_000,
    pairToken:NATIVE_QUOTE,quoteDecimals:18,totalSupply:10n**18n,graduated:false,
    quoteReserve:2n*10n**18n,tokenReserve:10n**18n
  });
  return buildPonsOutcomeObservationReceipt({
    launch:{launchId:value.launchId,token:value.token,curve:value.pool},
    horizonMs:3_600_000,targetTimestampMs:4_600_000,capability
  });
}

test('Replay Lab gates identity and outcome evidence at the requested block',async()=>{
  const target=launch('a'.repeat(64),100,1,2);
  const provenance=await buildProvenanceFact(target);
  const identity=await buildPonsTokenIdentityReceipt({
    launch:{launchId:target.launchId,token:target.token},observedBlock:140n,observedBlockHash:hash(140),
    name:'Known Later',symbol:'LATER',decimals:18
  });
  const hour=await completeHour(target);
  const evidence={launch:target,launchTimestampMs:1_000_000,provenanceFact:provenance,tokenIdentity:identity,observations:[hour]};

  const at120=await buildPonsReplaySnapshot({
    targetLaunchId:target.launchId,asOf:{blockNumber:120n,blockHash:hash(120),timestampMs:2_000_000},
    target:evidence,previous:[]
  });
  assert.equal(at120.targetLaunchKnown,true);
  assert.equal(at120.targetLaunch?.tokenIdentity,null);
  assert.equal(at120.targetLaunch?.provenance.state,'OBSERVED');
  assert.equal(at120.targetLaunch?.observations.find(x=>x.horizonLabel==='1h')?.state,'IMMATURE');
  assert.equal(at120.targetLaunch?.observations.find(x=>x.horizonLabel==='1h')?.observationId,null);

  const at150=await buildPonsReplaySnapshot({
    targetLaunchId:target.launchId,asOf:{blockNumber:150n,blockHash:hash(150),timestampMs:5_000_000},
    target:evidence,previous:[]
  });
  assert.equal(at150.targetLaunch?.tokenIdentity?.symbol,'LATER');
  assert.equal(at150.targetLaunch?.tokenIdentity?.observedBlock,'140');
  assert.equal(at150.targetLaunch?.observations.find(x=>x.horizonLabel==='1h')?.state,'PENDING');
  assert.equal(at150.targetLaunch?.observations.find(x=>x.horizonLabel==='1h')?.observationId,null);

  const at200=await buildPonsReplaySnapshot({
    targetLaunchId:target.launchId,asOf:{blockNumber:200n,blockHash:hash(200),timestampMs:10_000_000},
    target:evidence,previous:[]
  });
  const hourAt200=at200.targetLaunch?.observations.find(x=>x.horizonLabel==='1h');
  assert.equal(hourAt200?.state,'COMPLETE');
  assert.equal(hourAt200?.observedBlock,'180');
  assert.equal(hourAt200?.estimatedFdvQuoteRaw,(2n*10n**18n).toString());
  assert.notEqual(at120.outputDigest,at150.outputDigest);
  assert.notEqual(at150.outputDigest,at200.outputDigest);
});

test('Replay Lab hides a supplied target launch that did not exist at the as-of block',async()=>{
  const future=launch('b'.repeat(64),200,3,4);
  const snapshot=await buildPonsReplaySnapshot({
    targetLaunchId:future.launchId,asOf:{blockNumber:150n,blockHash:hash(150),timestampMs:5_000_000},
    target:{launch:future,launchTimestampMs:8_000_000,provenanceFact:null,tokenIdentity:null,observations:[]},
    previous:[]
  });
  assert.equal(snapshot.targetLaunchKnown,false);
  assert.equal(snapshot.targetLaunch,null);
  assert.deepEqual(snapshot.previousLaunches,[]);
  assert.doesNotMatch(JSON.stringify(snapshot),new RegExp(future.token.slice(2),'i'));
});

test('Replay Lab rejects cross-deployer history and preserves evidence boundaries',async()=>{
  const target=launch('c'.repeat(64),200,5,6);
  const wrong={...launch('d'.repeat(64),100,7,8),creator:addr(777)};
  await assert.rejects(
    buildPonsReplaySnapshot({
      targetLaunchId:target.launchId,asOf:{blockNumber:250n,blockHash:hash(250),timestampMs:20_000_000},
      target:{launch:target,launchTimestampMs:10_000_000,provenanceFact:null,tokenIdentity:null,observations:[]},
      previous:[{launch:wrong,launchTimestampMs:1_000_000,provenanceFact:null,tokenIdentity:null,observations:[]}]
    }),
    /PONS_REPLAY_DEPLOYER_SCOPE_DRIFT/
  );
});
