/** Default-off Pons GET-only API. Does not touch the Arc read projection. */
import {PONS_PREVIEW_AUTHORITY as A} from '../ponsPreview/snapshot.js';
import type {D1DatabaseLike} from '../cloudflare/d1Types.js';
import {PonsD1Store} from './store.js';

function reply(status:number,body:unknown,cache=false):Response{
 return new Response(JSON.stringify(body),{status,headers:{
  'content-type':'application/json; charset=utf-8',
  'cache-control':cache?'public, max-age=10':'no-store',
  'x-content-type-options':'nosniff'
 }});
}
export async function handlePonsPublicGet(request:Request,db:D1DatabaseLike,nowMs=Date.now()):Promise<Response>{
 if(request.method!=='GET')return reply(405,{error:'PONS_READ_ONLY'});
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/pons/'))return reply(404,{error:'NOT_FOUND'});
 const store=new PonsD1Store(db);
 try{
  const cp=await store.checkpoint();
  if(!cp)return reply(503,{error:'PONS_INDEX_NOT_INITIALIZED',chainId:4663});
  if(cp.status!=='READY')return reply(503,{error:'PONS_REORG_HALT',chainId:4663,
   checkpointBlock:cp.lastBlock.toString(),dataReleased:false});
  const stale=nowMs-cp.updatedAtMs>180000||nowMs<cp.updatedAtMs;
  const coverage={chainId:4663,factory:A.factory.toLowerCase(),authorityId:A.authorityId,
   factoryRuntimeCodeHash:A.runtimeCodeHash,confirmationDepth:12,
   scannedFromBlock:cp.fromBlock.toString(),asOfBlock:cp.lastBlock.toString(),
   asOfBlockHash:cp.lastHash,generatedAt:new Date(cp.updatedAtMs).toISOString(),
   historyCoverage:'INDEXED_FROM_WINDOW_START',historyComplete:cp.fromBlock===Number(A.fromBlock)?
    false:false,metadataCoverage:'FACTORY_EVENT_ONLY',
   fundingCoverage:'NOT_COLLECTED',stale,sourceMode:'PONS_INDEXED',
   noIdentityAttribution:true};
  if(url.pathname==='/api/pons/health'){
   if(url.search)return reply(400,{error:'PONS_QUERY_INVALID'});
   const count=await store.factCount();
   const after=await store.checkpoint();
   if(!after||after.version!==cp.version||after.status!=='READY')
    return reply(503,{error:'PONS_CHECKPOINT_CHANGED'});
   return reply(200,{schemaVersion:'binrat.pons-health/0.1',...coverage,
    indexReady:!stale,launchFactCount:count,checkpointStatus:cp.status},!stale);
  }
  if(url.pathname==='/api/pons/feed'){
   if([...url.searchParams.keys()].some(k=>k!=='limit')||url.searchParams.getAll('limit').length>1)
    return reply(400,{error:'PONS_QUERY_INVALID'});
   const raw=url.searchParams.get('limit')??'80';
   if(!/^[1-9][0-9]{0,2}$/.test(raw)||Number(raw)>100)
    return reply(400,{error:'PONS_PAGE_LIMIT'});
   const launches=await store.list(Number(raw));
   const after=await store.checkpoint();
   if(!after||after.version!==cp.version||after.status!=='READY')
    return reply(503,{error:'PONS_CHECKPOINT_CHANGED'});
   return reply(200,{schemaVersion:'binrat.pons-index-feed/0.1',...coverage,
    returnedCount:launches.length,pageLimit:Number(raw),hasMoreUnknown:true,launches},!stale);
  }
  if(url.pathname.startsWith('/api/pons/launch/')){
   if(url.search)return reply(400,{error:'PONS_QUERY_INVALID'});
   const id=url.pathname.slice('/api/pons/launch/'.length);
   if(!/^[0-9a-f]{64}$/.test(id))return reply(400,{error:'PONS_LAUNCH_ID_INVALID'});
   const launch=await store.launch(id);
   if(!launch)return reply(404,{error:'PONS_LAUNCH_NOT_IN_CAPTURED_WINDOW',...coverage});
   const prior=(await store.byDeployer(launch.deployer,50)).filter(x=>x.id!==launch.id&&
    (BigInt(x.blockNumber)<BigInt(launch.blockNumber)||
    (x.blockNumber===launch.blockNumber&&x.logIndex<launch.logIndex))).slice(0,5);
   const after=await store.checkpoint();
   if(!after||after.version!==cp.version||after.status!=='READY')
    return reply(503,{error:'PONS_CHECKPOINT_CHANGED'});
   return reply(200,{schemaVersion:'binrat.pons-launch-case/0.1',...coverage,launch,
    previousSameDeployerWithinCapturedWindow:prior,
    proofBoundary:'Exact address recurrence is not human identity or beneficial ownership.'},!stale);
  }
  if(url.pathname.startsWith('/api/pons/creator/')){
   if(url.search)return reply(400,{error:'PONS_QUERY_INVALID'});
   const creator=url.pathname.slice('/api/pons/creator/'.length).toLowerCase();
   if(!/^0x[0-9a-f]{40}$/.test(creator))return reply(400,{error:'PONS_CREATOR_INVALID'});
   const launches=await store.byDeployer(creator,50);
   const after=await store.checkpoint();
   if(!after||after.version!==cp.version||after.status!=='READY')
    return reply(503,{error:'PONS_CHECKPOINT_CHANGED'});
   return reply(200,{schemaVersion:'binrat.pons-creator/0.1',...coverage,creator,
    launches,coverageNotice:'Only this indexed contiguous window is represented.'},!stale);
  }
  return reply(404,{error:'NOT_FOUND'});
 }catch{
  return reply(503,{error:'PONS_PROJECTION_UNAVAILABLE',chainId:4663});
 }
}

