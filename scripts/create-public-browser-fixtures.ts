// Local acceptance fixture from the actual Worker handlers and existing D1 model.
// Synthetic chain data stays labelled in browser test receipts; no remote writes.
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import worker from '../src/cloudflare/worker.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { D1CompatDatabase } from '../test/support/d1Compat.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { deriveEventId,deriveLaunchId } from '../src/core/identity.js';
import { buildPublicSnapshot,publishPublicSnapshot } from '../src/cloudflare/publicSnapshot.js';
import { latestPonsLaunchSnapshot } from '../src/autonomous/rats.js';
import type { Hex,LaunchObserved } from '../src/core/types.js';

const db=new D1CompatDatabase();await db.exec(D1_SCHEMA_SQL);
const store=new D1Store(db,4663),now=Date.now();
const address=(n:number)=>`0x${n.toString(16).padStart(40,'0')}` as Hex;
const hash=(n:number)=>`0x${n.toString(16).padStart(64,'0')}` as Hex;
const launches:LaunchObserved[]=[];
try {
  for(let i=0;i<3;i++) {
    const launcher=address(1),token=address(20+i),txHash=hash(10+i);
    const launch:LaunchObserved={launchId:await deriveLaunchId({chainId:4663,launcher,token,txHash,source:'PONS_V2'}),
      eventId:await deriveEventId({chainId:4663,launcher,txHash,logIndex:i,source:'PONS_V2'}),chainId:4663,source:'PONS_V2',
      launcher,token,txHash,logIndex:i,blockNumber:100n+BigInt(i),blockHash:hash(100+i),creator:address(3),pool:address(30+i),
      name:`Synthetic Pons ${i}`,symbol:`LOCAL${i}`,imageUri:'',website:'',twitter:'',telegram:'',observedAtMs:now};
    await store.putLaunch(launch);await store.putProvenanceFact(await buildProvenanceFact(launch));launches.push(launch);
  }
  await store.commitCheckpoint({blockNumber:102n,blockHash:hash(102),guardBlockNumber:null,guardBlockHash:null});
  await new D1RuntimeStateStore(db,4663).put({sourceVerified:true,liveCaughtUp:true,headBlock:104n,targetBlock:102n,
    observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:null,lastHistoryError:null,lastObservationError:null,updatedAtMs:now});
  const latest=await latestPonsLaunchSnapshot(db,now,20);
  await publishPublicSnapshot(db,await buildPublicSnapshot({schemaVersion:'binrat.latest-launches/0.1',chainId:4663,...latest,historyCoverage:'PARTIAL'}),now);
  const env={DB:db,CAPABILITY_MANIFEST_JSON:readFileSync('docs/CAPABILITY_MANIFEST_V0.json','utf8')};
  const paths=['/api/capabilities','/api/status','/api/launches/latest','/api/dumpster-ledger',`/api/creator/${address(3)}/summary`];
  for(const launch of launches) for(const suffix of ['','/intelligence','/replay']) paths.push(`/api/bag/${launch.launchId}${suffix}`);
  const routes:Record<string,unknown>={};
  for(const path of paths) {
    const response=await worker.fetch(new Request('https://binrat.example'+path),env);
    if(response.status!==200) throw new Error(`LOCAL_FIXTURE_HANDLER_FAILED:${path}:${response.status}`);
    routes[path]={status:response.status,headers:Object.fromEntries(response.headers),body:await response.json()};
  }
  mkdirSync('.artifacts/public-truth',{recursive:true});writeFileSync('.artifacts/public-truth/browser-fixtures.json',JSON.stringify({synthetic:true,generatedAtMs:now,routes},null,2));
  console.log('LOCAL_WORKER_BROWSER_FIXTURES_PASS (synthetic Pons, actual handlers)');
} finally {store.close();db.close();}
