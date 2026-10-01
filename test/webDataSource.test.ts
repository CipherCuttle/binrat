import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadPublicBag } from '../web/data-source.js';

const id='1'.repeat(64);
const hash='0x'+'f'.repeat(64);
const creator='0x'+'a'.repeat(40);
const token='0x'+'b'.repeat(40);
const pool='0x'+'c'.repeat(40);

test('historical Creator File launches can rehydrate a canonical public bag outside the latest-20 array', async () => {
  const previous=globalThis.fetch;
  let requested='';
  globalThis.fetch=(async input=>{
    requested=String(input);
    return Response.json({
      schemaVersion:'binrat.public-feed/0.1',
      chainId:4663,
      asOfBlock:'120',
      historyCoverage:'UNVERIFIED',
      bag:{
        id,source:'PONS_V2',token,symbol:'OLD',name:'Older Rat',blockNumber:'100',blockHash:hash,
        txHash:hash,logIndex:0,reportedCreatorAddress:creator,pool,
        metadata:{imageUri:'',website:'',twitter:'',telegram:''},
        trashTrail:{priorLaunchCount:0,coverage:'UNVERIFIED',prior:[]},
        evidence:[{state:'OBSERVED',code:'PONS_REPORTED_CREATOR',text:'Pons reported this deployer.',sourceFactIds:[]}]
      },
      receipt:{
        projectionVersion:'BINRAT_PUBLIC_PROJECTION_V0',chainId:4663,asOfBlock:'120',asOfBlockHash:hash,
        historyCoverage:'UNVERIFIED',inputDigest:'a'.repeat(64),outputDigest:'b'.repeat(64),
        receiptId:'binrat-public:'+'c'.repeat(64)
      }
    });
  }) as typeof fetch;
  try {
    const bag=await loadPublicBag(id);
    assert.equal(requested,`/api/bag/${id}`);
    assert.equal(bag?.id,id);
    assert.equal(bag?.reportedCreatorAddress,creator);
  } finally {
    globalThis.fetch=previous;
  }
});

test('Creator File OPEN CHANGES no longer silently gates historical launches on the current latest array', () => {
  const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  assert.match(app,/await loadPublicBag\(launchId\)/);
  assert.doesNotMatch(app,/bags\.some\(\(item\) => item\.id === launchId\)/);
});
