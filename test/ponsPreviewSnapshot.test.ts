import assert from "node:assert/strict";
import {test} from "node:test";
import {sha256Hex} from "../src/evidence/canonical.js";
import {PONS_PREVIEW_AUTHORITY as a,safeDirectMetadata,buildPonsPreviewSnapshot,type PonsLog} from "../src/ponsPreview/snapshot.js";
const h="0x"+"a".repeat(64),f="0x"+"b".repeat(64);
const addr=(n:number)=>"0x"+n.toString(16).padStart(40,"0");
const mk=(block:bigint,index:number,who=1):PonsLog=>({
  blockNumber:block,blockHash:h,transactionHash:"0x"+index.toString(16).padStart(64,"0"),
  logIndex:index,token:addr(100+index),curve:addr(200+index),deployer:addr(who),
  pairToken:addr(0),launchConfigId:0n,
});
const build=(logs:PonsLog[])=>buildPonsPreviewSnapshot({
  generatedAt:"2026-09-25T06:00:00.000Z",asOfBlock:26842500n,asOfBlockHash:h,
  scannedFromBlock:26842000n,factoryCodeHash:a.runtimeCodeHash,
  logs,metadataByTx:new Map([[f,safeDirectMetadata(null)]])
});
test("recent creator recurrence counts older matching launches only; newest-first, unique IDs",async()=>{
  const result=build([mk(26842200n,2,1),mk(26842300n,3,2),mk(26842100n,1,1)]);
  assert.equal(result.chainId,4663);
  assert.deepEqual(result.launches.map(x=>x.blockNumber),["26842300","26842200","26842100"]);
  assert.deepEqual(result.launches.map(x=>x.previousFromSameDeployerWithinWindow),[0,1,0]);
  assert.equal(new Set(result.launches.map(x=>x.id)).size,3);
  const source=result.launches[0]!;
  assert.equal(source.id,await sha256Hex({kind:"PONS_V2_LAUNCH_V1",chainId:4663,
    factory:a.factory.toLowerCase(),txHash:source.txHash,token:source.token}));
  assert.equal(result.historyCoverage,"RECENT_WINDOW_ONLY");
  assert.equal(result.fundingCoverage,"NOT_COLLECTED");
});
test("no older launch in bounded window never means clean wallet",()=>{
  const snapshot=build([mk(26842300n,2)]);
  assert.equal(snapshot.launches[0]?.previousFromSameDeployerWithinWindow,0);
  assert.equal(snapshot.metadataCoverage,"DIRECT_FACTORY_INPUT_ONLY");
});
test("fail closed on factory drift, duplicate events and malformed / beyond-window logs",()=>{
  const log=mk(26842200n,2);
  assert.throws(()=>buildPonsPreviewSnapshot({generatedAt:"2026-09-25T06:00:00Z",asOfBlock:26842500n,
    asOfBlockHash:h,scannedFromBlock:26842000n,factoryCodeHash:f,logs:[log],
    metadataByTx:new Map()}),/FACTORY_RUNTIME_MISMATCH/);
  assert.throws(()=>build([log,log]),/DUPLICATE_EVENT_IDENTITY/);
  assert.throws(()=>build([{...log,blockNumber:26842501n}]),/LAUNCH_LOG_INVALID/);
  assert.throws(()=>build([{...log,deployer:"bad"}]),/LAUNCH_LOG_INVALID/);
});
test("source-reported descriptions bounded and URLs accept HTTPS only",()=>{
  const metadata=safeDirectMetadata({name:" My Token ",symbol:"MTK",logo:"ipfs://abc",
    description:"testing",socials:{website:"javascript:alert(1)",telegram:"https://t.me/demo"}});
  assert.equal(metadata.status,"DIRECT_FACTORY_INPUT");
  assert.equal(metadata.name,"My Token");
  assert.equal(metadata.website,null);
  assert.equal(metadata.telegram,"https://t.me/demo");
  assert.equal(safeDirectMetadata({symbol:"X",name:"x".repeat(10000)}).status,"NOT_AVAILABLE");
});
