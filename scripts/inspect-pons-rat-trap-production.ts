#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { parsePonsOutcomeObservationReceipt, RpcPonsOutcomeObservationSource, type PonsOutcomeObservationReceipt } from '../src/pons/outcomeReceipts.js';
import { buildPonsRatTrapProjection, type PonsRatTrapProjection } from '../src/pons/ratTrapProjection.js';
import { resolveRobinhoodArchiveRpcUrl } from '../src/cloudflare/syncQueue.js';
import { ponsErc20Abi } from '../src/pons/ponsAbi.js';
import { robinhoodMainnet } from '../src/pons/chain.js';
import { createPublicClient, http, type Address } from 'viem';

const DB='binrat-v0';
const DB_ID='46814564-1a41-449a-88e5-c1349eed3a27';
const WORKER_URL='https://binrat-edge-v0.pettevik.workers.dev';
const CONFIG='/tmp/binrat-rat-trap-inspect-wrangler.jsonc';
const WRANGLER=['dlx','wrangler@4.135.0'];
const MAX_COHORTS=3;
const MAX_PREVIOUS_LAUNCHES=25;
let d1ReadCalls=0;

function gate(value:unknown,code:string):asserts value { if(!value) throw new Error(code); }

function cli(args:string[]):string {
  try {
    return execFileSync('pnpm',[...WRANGLER,...args],{
      encoding:'utf8',
      stdio:['ignore','pipe','pipe'],
      timeout:120_000,
      env:process.env
    }).trim();
  } catch (error) {
    const status=(error as {status?:number}).status ?? 'UNKNOWN';
    throw new Error(`RAT_TRAP_INSPECT_WRANGLER_FAILED:${String(status)}`);
  }
}

function jsonFromOutput(output:string):unknown {
  const positions=[output.indexOf('{'),output.indexOf('[')].filter((value)=>value>=0);
  gate(positions.length>0,'RAT_TRAP_INSPECT_JSON_MISSING');
  return JSON.parse(output.slice(Math.min(...positions)));
}

function assertSelectOnly(sql:string):string {
  let normalized=sql.trim();
  if(normalized.endsWith(';')) normalized=normalized.slice(0,-1).trim();
  gate(!normalized.includes(';'),'RAT_TRAP_INSPECT_MULTI_STATEMENT_BLOCKED');
  gate(/^(SELECT|WITH)\b/i.test(normalized),'RAT_TRAP_INSPECT_NON_SELECT_BLOCKED');
  gate(!/\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX|BEGIN|COMMIT|ROLLBACK)\b/i.test(normalized),'RAT_TRAP_INSPECT_MUTATION_KEYWORD_BLOCKED');
  return normalized;
}

type WranglerResult<T>={results?:T[];success?:boolean;meta?:{changes?:number;changed_db?:boolean;rows_written?:number}};

function selectRows<T>(sql:string):T[] {
  const safe=assertSelectOnly(sql);
  const parsed=jsonFromOutput(cli(['d1','execute',DB,'--remote','--yes','--json','--config',CONFIG,'--command',safe]));
  gate(Array.isArray(parsed),'RAT_TRAP_INSPECT_D1_SHAPE_INVALID');
  d1ReadCalls+=1;
  const batches=parsed as WranglerResult<T>[];
  gate(batches.length===1&&batches[0]?.success===true,'RAT_TRAP_INSPECT_D1_QUERY_FAILED');
  const meta=batches[0]!.meta ?? {};
  gate(Number(meta.changes ?? 0)===0,'RAT_TRAP_INSPECT_D1_CHANGES_NONZERO');
  gate(Number(meta.rows_written ?? 0)===0,'RAT_TRAP_INSPECT_D1_ROWS_WRITTEN_NONZERO');
  gate(meta.changed_db!==true,'RAT_TRAP_INSPECT_D1_CHANGED_DB');
  return batches[0]!.results ?? [];
}


async function getJson(path:string):Promise<Record<string,unknown>> {
  const response=await fetch(WORKER_URL+path,{signal:AbortSignal.timeout(20_000)});
  const body=await response.json().catch(()=>null);
  gate(response.ok&&body&&typeof body==='object','RAT_TRAP_INSPECT_HTTP_PROBE_FAILED:'+path);
  return body as Record<string,unknown>;
}

function provenanceGap() {
  const rows=selectRows<{
    fact_count:number;missing_direct:number;missing_previous:number;missing_any:number
  }>(`
    WITH contextual AS (
      SELECT p.fact_id,p.chain_id,p.launch_id,p.creator,p.observed_block,p.log_index,
        (
          SELECT prior.fact_id
          FROM provenance_facts prior
          WHERE prior.chain_id=p.chain_id
            AND prior.creator=p.creator
            AND (
              CAST(prior.observed_block AS INTEGER)<CAST(p.observed_block AS INTEGER)
              OR (CAST(prior.observed_block AS INTEGER)=CAST(p.observed_block AS INTEGER) AND prior.log_index<p.log_index)
              OR (
                CAST(prior.observed_block AS INTEGER)=CAST(p.observed_block AS INTEGER)
                AND prior.log_index=p.log_index
                AND prior.fact_id<p.fact_id
              )
            )
          ORDER BY CAST(prior.observed_block AS INTEGER) DESC,prior.log_index DESC,prior.fact_id DESC
          LIMIT 1
        ) AS previous_fact_id
      FROM provenance_facts p
      WHERE p.chain_id=4663
    )
    SELECT
      COUNT(*) AS fact_count,
      SUM(CASE WHEN direct.edge_id IS NULL THEN 1 ELSE 0 END) AS missing_direct,
      SUM(CASE WHEN c.previous_fact_id IS NOT NULL AND previous.edge_id IS NULL THEN 1 ELSE 0 END) AS missing_previous,
      SUM(CASE WHEN direct.edge_id IS NULL OR (c.previous_fact_id IS NOT NULL AND previous.edge_id IS NULL) THEN 1 ELSE 0 END) AS missing_any
    FROM contextual c
    LEFT JOIN provenance_edges direct
      ON direct.edge_id=('reported-creator:' || c.fact_id)
    LEFT JOIN provenance_edges previous
      ON previous.edge_id=CASE
        WHEN c.previous_fact_id IS NULL THEN NULL
        ELSE ('previous-launch:' || c.fact_id || ':' || c.previous_fact_id)
      END
  `);
  const edgeRows=selectRows<{edge_count:number}>("SELECT COUNT(*) AS edge_count FROM provenance_edges WHERE chain_id=4663");
  const row=rows[0]??{fact_count:0,missing_direct:0,missing_previous:0,missing_any:0};
  return {
    factCount:Number(row.fact_count??0),
    missingDirect:Number(row.missing_direct??0),
    missingPrevious:Number(row.missing_previous??0),
    missingAny:Number(row.missing_any??0),
    edgeCount:Number(edgeRows[0]?.edge_count??0)
  };
}

function sqlAddress(value:string):string {
  gate(/^0x[0-9a-f]{40}$/i.test(value),'RAT_TRAP_INSPECT_ADDRESS_INVALID');
  return `'${value.toLowerCase()}'`;
}
function sqlLaunchId(value:string):string {
  gate(/^[0-9a-f]{64}$/i.test(value),'RAT_TRAP_INSPECT_LAUNCH_ID_INVALID');
  return `'${value.toLowerCase()}'`;
}

interface LaunchRow {
  launch_id:string;event_id:string;chain_id:number;block_number:string;block_hash:Hex;source:'PONS_V2';launcher:Hex;tx_hash:Hex;log_index:number;
  token:Hex;creator:Hex;pool:Hex;name:string;symbol:string;image_uri:string;website:string;twitter:string;telegram:string;observed_at_ms:number;
}

function fromLaunchRow(row:LaunchRow):LaunchObserved {
  return {
    launchId:row.launch_id,eventId:row.event_id,chainId:row.chain_id,blockNumber:BigInt(row.block_number),
    blockHash:row.block_hash.toLowerCase() as Hex,source:row.source,launcher:row.launcher.toLowerCase() as Hex,
    txHash:row.tx_hash.toLowerCase() as Hex,logIndex:row.log_index,token:row.token.toLowerCase() as Hex,
    creator:row.creator.toLowerCase() as Hex,pool:row.pool.toLowerCase() as Hex,name:row.name,symbol:row.symbol,
    imageUri:row.image_uri,website:row.website,twitter:row.twitter,telegram:row.telegram,observedAtMs:row.observed_at_ms
  };
}

function launchColumns(prefix=''):string {
  const p=prefix?`${prefix}.`:'';
  return ['launch_id','event_id','chain_id','block_number','block_hash','source','launcher','tx_hash','log_index','token','creator','pool','name','symbol','image_uri','website','twitter','telegram','observed_at_ms'].map((name)=>`${p}${name} AS ${name}`).join(',');
}

function beforeCurrentSql(alias:string,current:LaunchObserved):string {
  const p=alias?`${alias}.`:'';
  return [
    '(',
    `CAST(${p}block_number AS INTEGER) < ${current.blockNumber.toString()}`,
    `OR (CAST(${p}block_number AS INTEGER) = ${current.blockNumber.toString()} AND (`,
    `${p}log_index < ${current.logIndex}`,
    `OR (${p}log_index = ${current.logIndex} AND ${p}launch_id < ${sqlLaunchId(current.launchId)})`,
    '))',
    ')'
  ].join(' ');
}

function short(value:string):string { return value.length>20?`${value.slice(0,10)}…${value.slice(-8)}`:value; }
function label(launch:LaunchObserved):string { return launch.symbol.trim()?`$${launch.symbol.trim()}`:launch.name.trim()||short(launch.token); }
function horizonLabel(ms:number):string { if(ms===300_000)return '5m';if(ms===3_600_000)return '1h';if(ms===86_400_000)return '24h';return `${ms}ms`; }

async function readTokenIdentity(
  client:ReturnType<typeof createPublicClient>,
  token:Hex,
  blockNumber:bigint
):Promise<{name:string;symbol:string;decimals:number}|null> {
  try {
    const [name,symbol,decimals]=await Promise.all([
      client.readContract({address:token as Address,abi:ponsErc20Abi,functionName:'name',blockNumber}),
      client.readContract({address:token as Address,abi:ponsErc20Abi,functionName:'symbol',blockNumber}),
      client.readContract({address:token as Address,abi:ponsErc20Abi,functionName:'decimals',blockNumber})
    ]);
    if(typeof name!=='string'||typeof symbol!=='string'||!Number.isInteger(decimals)) return null;
    return {name,symbol,decimals:Number(decimals)};
  } catch {
    return null;
  }
}

function summarizeProjection(projection:PonsRatTrapProjection) {
  return {
    currentLaunchId:projection.currentLaunchId,
    deployer:projection.deployer,
    asOfBlock:projection.asOfBlock.toString(),
    previousLaunchCount:projection.previousLaunchCount,
    coverage:projection.coverage.map((item)=>({horizon:horizonLabel(item.horizonMs),total:item.totalLaunches,complete:item.complete,partial:item.partial,immature:item.immature,missing:item.missing})),
    launches:projection.launches.map((item)=>({
      label:item.symbol.trim()?`$${item.symbol.trim()}`:item.name.trim()||short(item.token),
      launchId:item.launchId,token:item.token,launchBlock:item.launchBlock.toString(),
      observations:item.observations.map((observation)=>({
        horizon:horizonLabel(observation.horizonMs),state:observation.state,phase:observation.phase,
        estimatedFdvQuoteRaw:observation.estimatedFdvQuoteRaw?.toString()??null,
        quoteAsset:observation.quoteAsset?{kind:observation.quoteAsset.kind,address:observation.quoteAsset.address,decimals:observation.quoteAsset.decimals}:null,
        missing:observation.missing
      })),
      highestObserved:item.highestObserved?{
        estimatedFdvQuoteRaw:item.highestObserved.estimatedFdvQuoteRaw.toString(),
        quoteAsset:item.highestObserved.quoteAsset,
        tiedHorizons:item.highestObserved.tiedHorizonsMs.map(horizonLabel)
      }:null
    }))
  };
}

gate(process.env.CLOUDFLARE_API_TOKEN,'RAT_TRAP_INSPECT_CLOUDFLARE_TOKEN_MISSING');
gate(process.env.CLOUDFLARE_ACCOUNT_ID,'RAT_TRAP_INSPECT_CLOUDFLARE_ACCOUNT_MISSING');
const archiveRpcUrl=resolveRobinhoodArchiveRpcUrl({
  BINRAT_ROBINHOOD_ARCHIVE_RPC_URL:process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL
});

writeFileSync(CONFIG,JSON.stringify({
  name:'binrat-rat-trap-readonly-inspect',main:'src/cloudflare/worker.ts',compatibility_date:'2026-09-18',
  d1_databases:[{binding:'DB',database_name:DB,database_id:DB_ID}]
},null,2));

try {
  const checkpointRows=selectRows<{block_number:string;block_hash:Hex}>("SELECT block_number,block_hash FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1");
  gate(checkpointRows.length===1,'RAT_TRAP_INSPECT_CHECKPOINT_MISSING');
  const checkpoint={blockNumber:BigInt(checkpointRows[0]!.block_number),blockHash:checkpointRows[0]!.block_hash.toLowerCase() as Hex};
  const receiptCountRows=selectRows<{n:number}>("SELECT COUNT(*) AS n FROM pons_outcome_receipts WHERE chain_id=4663");
  const receiptCount=Number(receiptCountRows[0]?.n??0);
  const provenance=provenanceGap();
  const health=await getJson('/api/health');

  const source=new RpcPonsOutcomeObservationSource({discoveryRpcUrl:archiveRpcUrl,archiveRpcUrl});
  const identityClient=createPublicClient({chain:robinhoodMainnet(archiveRpcUrl),transport:http(archiveRpcUrl)});
  await source.assertAuthority();
  const checkpointPoint=await source.getBlockPoint(checkpoint.blockNumber);
  gate(checkpointPoint.blockHash.toLowerCase()===checkpoint.blockHash,'RAT_TRAP_INSPECT_CHECKPOINT_REORG');

  const creatorRows=selectRows<{creator:Hex;receipt_count:number;receipted_launch_count:number;latest_receipted_block:number}>([
    "SELECT l.creator AS creator, COUNT(*) AS receipt_count, COUNT(DISTINCT l.launch_id) AS receipted_launch_count,",
    "MAX(CAST(l.block_number AS INTEGER)) AS latest_receipted_block",
    "FROM pons_outcome_receipts r JOIN launches l ON l.launch_id=r.launch_id",
    "WHERE r.chain_id=4663 AND l.chain_id=4663 AND l.source='PONS_V2'",
    "GROUP BY l.creator ORDER BY receipt_count DESC,latest_receipted_block DESC LIMIT 100"
  ].join(' '));

  const cohorts:unknown[]=[];
  const skipped:unknown[]=[];
  const identityCache=new Map<string,{name:string;symbol:string;decimals:number}|null>();
  async function identity(token:Hex){
    const key=token.toLowerCase();
    if(identityCache.has(key)) return identityCache.get(key)??null;
    const value=await readTokenIdentity(identityClient,key as Hex,checkpoint.blockNumber);
    identityCache.set(key,value);
    return value;
  }
  for(const creatorRow of creatorRows){
    if(cohorts.length>=MAX_COHORTS) break;
    const creator=creatorRow.creator.toLowerCase();
    const currentRows=selectRows<LaunchRow>(`SELECT ${launchColumns()} FROM launches WHERE chain_id=4663 AND source='PONS_V2' AND creator=${sqlAddress(creator)} ORDER BY CAST(block_number AS INTEGER) DESC,log_index DESC,launch_id DESC LIMIT 1`);
    if(currentRows.length!==1) continue;
    const current=fromLaunchRow(currentRows[0]!);
    if(current.blockNumber>checkpoint.blockNumber){ skipped.push({creator,reason:'CURRENT_AFTER_CHECKPOINT'}); continue; }

    const priorCountRows=selectRows<{n:number}>(`SELECT COUNT(*) AS n FROM launches WHERE chain_id=4663 AND source='PONS_V2' AND creator=${sqlAddress(creator)} AND ${beforeCurrentSql('',current)}`);
    const previousCount=Number(priorCountRows[0]?.n??0);
    if(previousCount<1) continue;
    if(previousCount>MAX_PREVIOUS_LAUNCHES){ skipped.push({creator,currentLaunchId:current.launchId,previousCount,reason:'COHORT_TOO_LARGE'}); continue; }

    const receiptRows=selectRows<{launch_id:string;payload_json:string}>(`SELECT r.launch_id AS launch_id,r.payload_json AS payload_json FROM pons_outcome_receipts r JOIN launches l ON l.launch_id=r.launch_id WHERE r.chain_id=4663 AND l.chain_id=4663 AND l.source='PONS_V2' AND l.creator=${sqlAddress(creator)} AND ${beforeCurrentSql('l',current)} ORDER BY CAST(l.block_number AS INTEGER),l.log_index,l.launch_id,r.horizon_ms`);
    if(receiptRows.length===0) continue;

    const priorRows=selectRows<LaunchRow>(`SELECT ${launchColumns()} FROM launches WHERE chain_id=4663 AND source='PONS_V2' AND creator=${sqlAddress(creator)} AND ${beforeCurrentSql('',current)} ORDER BY CAST(block_number AS INTEGER) DESC,log_index DESC,launch_id DESC`);
    gate(priorRows.length===previousCount,'RAT_TRAP_INSPECT_COHORT_COUNT_DRIFT');
    const previous=priorRows.map(fromLaunchRow);
    const receiptsByLaunch=new Map<string,PonsOutcomeObservationReceipt[]>();
    for(const row of receiptRows){
      const receipt=await parsePonsOutcomeObservationReceipt(row.payload_json);
      const list=receiptsByLaunch.get(row.launch_id)??[];list.push(receipt);receiptsByLaunch.set(row.launch_id,list);
    }

    const canonicalLaunchTimestampMsByLaunch=new Map<string,number>();
    const blockCache=new Map<string,Awaited<ReturnType<typeof source.getBlockPoint>>>();
    for(const launch of [current,...previous]){
      const key=launch.blockNumber.toString();
      let point=blockCache.get(key);
      if(!point){point=await source.getBlockPoint(launch.blockNumber);blockCache.set(key,point);}
      gate(point.blockHash.toLowerCase()===launch.blockHash.toLowerCase(),`RAT_TRAP_INSPECT_LAUNCH_REORG:${launch.launchId}`);
      canonicalLaunchTimestampMsByLaunch.set(launch.launchId,point.timestampMs);
    }

    const projection=await buildPonsRatTrapProjection({
      currentLaunch:current,launches:[current,...previous],receiptsByLaunch,canonicalLaunchTimestampMsByLaunch,
      asOfBlock:checkpoint.blockNumber,asOfTimestampMs:checkpointPoint.timestampMs
    });
    const identityByToken:Record<string,unknown>={};
    const tokens=new Set<Hex>([current.token,...previous.map((item)=>item.token)]);
    for(const launch of projection.launches){
      for(const observation of launch.observations){
        if(observation.quoteAsset?.kind==='ERC20') tokens.add(observation.quoteAsset.address);
      }
    }
    for(const token of tokens) identityByToken[token]=await identity(token);
    cohorts.push({
      current:{label:label(current),launchId:current.launchId,token:current.token,deployer:current.creator,block:current.blockNumber.toString()},
      receiptedPriorRows:receiptRows.length,
      identityByToken,
      projection:summarizeProjection(projection)
    });
  }

  const report={
    kind:'BINRAT_PONS_RAT_TRAP_PRODUCTION_INSPECTION_V1',productionMutation:false,
    checkpoint:{blockNumber:checkpoint.blockNumber.toString(),blockHash:checkpoint.blockHash,timestampMs:checkpointPoint.timestampMs},
    receiptCount,provenanceGap:provenance,
    health:{
      ok:health.ok??null,releaseSha:health.releaseSha??null,chainId:health.chainId??null,indexReady:health.indexReady??null,
      liveCaughtUp:health.liveCaughtUp??null,checkpointBlock:health.checkpointBlock??null,headBlock:health.headBlock??null,
      targetBlock:health.targetBlock??null,lastSyncError:health.lastSyncError??null,runtimeFresh:health.runtimeFresh??null
    },
    d1ReadCalls,creatorCandidates:creatorRows.length,selectedCohorts:cohorts.length,skipped,cohorts
  };
  console.log(JSON.stringify(report,null,2));
} finally {
  rmSync(CONFIG,{force:true});
}
