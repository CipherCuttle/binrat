import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1PonsFundingStore } from '../src/cloudflare/ponsFundingStore.js';
import { readPonsFundingRecurrence } from '../src/cloudflare/ponsFundingRecurrenceReadModel.js';
import { buildPonsPrelaunchNativeInboundReceipt } from '../src/pons/fundingProvenance.js';
import { D1CompatDatabase } from './support/d1Compat.js';

function addr(n:number):Hex {
  return `0x${n.toString(16).padStart(40,'0')}` as Hex;
}
function hash(n:number):Hex {
  return `0x${n.toString(16).padStart(64,'0')}` as Hex;
}
function launch(input:{id:string;block:number;deployer:number;token:number;pool:number}):LaunchObserved {
  return {
    launchId:input.id.repeat(64),
    eventId:input.id.repeat(64),
    chainId:4663,
    blockNumber:BigInt(input.block),
    blockHash:hash(input.block),
    observedAtMs:1,
    source:'PONS_V2',
    launcher:addr(999),
    txHash:hash(10_000+input.block),
    logIndex:0,
    token:addr(input.token),
    creator:addr(input.deployer),
    pool:addr(input.pool),
    name:'',
    symbol:'',
    imageUri:'',
    website:'',
    twitter:'',
    telegram:''
  };
}

async function putFunding(
  fundingStore:D1PonsFundingStore,
  value:LaunchObserved,
  sourceAddress:Hex,
  transferBlock:number,
  valueWei:bigint
):Promise<void> {
  await fundingStore.put(await buildPonsPrelaunchNativeInboundReceipt({
    launch:{
      launchId:value.launchId,
      deployer:value.creator,
      blockNumber:value.blockNumber,
      blockHash:value.blockHash
    },
    sourceAddress,
    transferTxHash:hash(50_000+transferBlock),
    transferBlock:BigInt(transferBlock),
    transferBlockHash:hash(transferBlock),
    transferTimestampMs:transferBlock*1000,
    valueWei
  }));
}

test('funding recurrence returns factual same-source evidence across distinct deployers', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const fundingStore=new D1PonsFundingStore(db);
  const source=addr(500);
  const first=launch({id:'1',block:100,deployer:11,token:1,pool:2});
  const second=launch({id:'2',block:200,deployer:12,token:3,pool:4});
  try {
    await store.putLaunch(first);
    await store.putLaunch(second);
    await putFunding(fundingStore,first,source,90,1_000n);
    await putFunding(fundingStore,second,source,190,2_000n);

    const model=await readPonsFundingRecurrence(db,{
      currentLaunchId:second.launchId,
      asOfBlock:200n
    });

    assert.equal(model.currentFunding?.sourceAddress,source);
    assert.equal(model.sameFundingSource?.label,'SAME FUNDING SOURCE');
    assert.equal(model.sameFundingSource?.distinctDeployersAtLeast,2);
    assert.equal(model.sameFundingSource?.distinctLaunchesAtLeast,2);
    assert.deepEqual(
      model.sameFundingSource?.relatedLaunches.map((item)=>item.launchId),
      [second.launchId,first.launchId]
    );
    assert.match(model.caveat,/does not establish common ownership, control, team, or person/);
    assert.doesNotMatch(JSON.stringify(model),/insider|same team|smart money/i);
  } finally {
    store.close();
    db.close();
  }
});

test('funding recurrence is point-in-time and never leaks a later launch', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const fundingStore=new D1PonsFundingStore(db);
  const source=addr(501);
  const first=launch({id:'3',block:100,deployer:21,token:5,pool:6});
  const current=launch({id:'4',block:200,deployer:22,token:7,pool:8});
  const future=launch({id:'5',block:300,deployer:23,token:9,pool:10});
  try {
    for(const value of [first,current,future]) await store.putLaunch(value);
    await putFunding(fundingStore,first,source,90,1_000n);
    await putFunding(fundingStore,current,source,190,2_000n);
    await putFunding(fundingStore,future,source,290,3_000n);

    const model=await readPonsFundingRecurrence(db,{
      currentLaunchId:current.launchId,
      asOfBlock:200n
    });
    const ids=model.sameFundingSource?.relatedLaunches.map((item)=>item.launchId) ?? [];
    assert.deepEqual(ids,[current.launchId,first.launchId]);
    assert.equal(ids.includes(future.launchId),false);
    assert.equal(model.sameFundingSource?.distinctDeployersAtLeast,2);
  } finally {
    store.close();
    db.close();
  }
});

test('multiple launches from one deployer do not become SAME FUNDING SOURCE', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const fundingStore=new D1PonsFundingStore(db);
  const source=addr(502);
  const first=launch({id:'6',block:100,deployer:31,token:11,pool:12});
  const second=launch({id:'7',block:200,deployer:31,token:13,pool:14});
  try {
    await store.putLaunch(first);
    await store.putLaunch(second);
    await putFunding(fundingStore,first,source,90,1_000n);
    await putFunding(fundingStore,second,source,190,2_000n);

    const model=await readPonsFundingRecurrence(db,{
      currentLaunchId:second.launchId,
      asOfBlock:200n
    });
    assert.equal(model.currentFunding?.sourceAddress,source);
    assert.equal(model.sameFundingSource,null);
  } finally {
    store.close();
    db.close();
  }
});

test('bounded recurrence explicitly reports partial coverage and only claims verified lower bounds', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const fundingStore=new D1PonsFundingStore(db);
  const source=addr(503);
  const launches=[
    launch({id:'8',block:100,deployer:41,token:15,pool:16}),
    launch({id:'9',block:200,deployer:42,token:17,pool:18}),
    launch({id:'a',block:300,deployer:43,token:19,pool:20})
  ];
  try {
    for(const [index,value] of launches.entries()) {
      await store.putLaunch(value);
      await putFunding(fundingStore,value,source,Number(value.blockNumber)-10,BigInt(index+1)*1_000n);
    }
    const model=await readPonsFundingRecurrence(db,{
      currentLaunchId:launches[2]!.launchId,
      asOfBlock:300n,
      maxRelatedLaunches:2
    });
    assert.deepEqual(model.recurrenceCoverage,{
      status:'PARTIAL',
      verifiedReceipts:2,
      truncated:true
    });
    assert.equal(model.sameFundingSource?.distinctDeployersAtLeast,2);
    assert.equal(model.sameFundingSource?.distinctLaunchesAtLeast,2);
    assert.equal(model.sameFundingSource?.relatedLaunches.length,2);
  } finally {
    store.close();
    db.close();
  }
});

test('funding recurrence fails closed on stored receipt or canonical launch tampering', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const fundingStore=new D1PonsFundingStore(db);
  const value=launch({id:'b',block:200,deployer:51,token:21,pool:22});
  try {
    await store.putLaunch(value);
    await putFunding(fundingStore,value,addr(504),190,2_000n);
    await db.prepare(
      'UPDATE pons_funding_receipts SET payload_json=? WHERE launch_id=?'
    ).bind('{}',value.launchId).run();

    await assert.rejects(
      readPonsFundingRecurrence(db,{currentLaunchId:value.launchId,asOfBlock:200n}),
      /PONS_FUNDING_RECURRENCE_PAYLOAD_MISMATCH/
    );
  } finally {
    store.close();
    db.close();
  }
});

test('launch without positive funding evidence returns an empty factual model', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const value=launch({id:'c',block:200,deployer:61,token:23,pool:24});
  try {
    await store.putLaunch(value);
    const model=await readPonsFundingRecurrence(db,{
      currentLaunchId:value.launchId,
      asOfBlock:200n
    });
    assert.equal(model.currentFunding,null);
    assert.equal(model.sameFundingSource,null);
    assert.deepEqual(model.recurrenceCoverage,{
      status:'COMPLETE',
      verifiedReceipts:0,
      truncated:false
    });
  } finally {
    store.close();
    db.close();
  }
});
