#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import type { Hex } from '../src/core/types.js';
import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from '../src/cloudflare/d1Types.js';
import { readPonsReplaySnapshot } from '../src/cloudflare/ponsReplayReadModel.js';
import { resolveRobinhoodArchiveRpcUrl } from '../src/cloudflare/syncQueue.js';
import { RpcPonsOutcomeObservationSource } from '../src/pons/outcomeReceipts.js';

const DB='binrat-v0';
const DB_ID='46814564-1a41-449a-88e5-c1349eed3a27';
const CONFIG='/tmp/binrat-replay-inspect-wrangler.jsonc';
const WRANGLER=['dlx','wrangler@4.135.0'];
const MAX_PREVIOUS=25;
let d1ReadCalls=0;
let writeAttempts=0;

function gate(value:unknown,code:string):asserts value { if(!value) throw new Error(code); }

function cli(args:string[]):string {
  try {
    return execFileSync('pnpm',[...WRANGLER,...args],{
      encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120_000,env:process.env
    }).trim();
  } catch (error) {
    const status=(error as {status?:number}).status ?? 'UNKNOWN';
    throw new Error('PONS_REPLAY_INSPECT_WRANGLER_FAILED:'+String(status));
  }
}

function jsonFromOutput(output:string):unknown {
  const positions=[output.indexOf('{'),output.indexOf('[')].filter((value)=>value>=0);
  gate(positions.length>0,'PONS_REPLAY_INSPECT_JSON_MISSING');
  return JSON.parse(output.slice(Math.min(...positions)));
}

function assertSelectOnly(sql:string):string {
  let normalized=sql.trim();
  if(normalized.endsWith(';')) normalized=normalized.slice(0,-1).trim();
  gate(!normalized.includes(';'),'PONS_REPLAY_INSPECT_MULTI_STATEMENT_BLOCKED');
  gate(/^(SELECT|WITH)\b/i.test(normalized),'PONS_REPLAY_INSPECT_NON_SELECT_BLOCKED');
  gate(!/\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX|BEGIN|COMMIT|ROLLBACK)\b/i.test(normalized),'PONS_REPLAY_INSPECT_MUTATION_KEYWORD_BLOCKED');
  return normalized;
}

type WranglerResult<T>={results?:T[];success?:boolean;meta?:{changes?:number;changed_db?:boolean;rows_written?:number}};

function selectRows<T>(sql:string):T[] {
  const safe=assertSelectOnly(sql);
  const parsed=jsonFromOutput(cli(['d1','execute',DB,'--remote','--yes','--json','--config',CONFIG,'--command',safe]));
  gate(Array.isArray(parsed),'PONS_REPLAY_INSPECT_D1_SHAPE_INVALID');
  d1ReadCalls+=1;
  const batches=parsed as WranglerResult<T>[];
  gate(batches.length===1&&batches[0]?.success===true,'PONS_REPLAY_INSPECT_D1_QUERY_FAILED');
  const meta=batches[0]!.meta??{};
  gate(Number(meta.changes??0)===0,'PONS_REPLAY_INSPECT_D1_CHANGES_NONZERO');
  gate(Number(meta.rows_written??0)===0,'PONS_REPLAY_INSPECT_D1_ROWS_WRITTEN_NONZERO');
  gate(meta.changed_db!==true,'PONS_REPLAY_INSPECT_D1_CHANGED_DB');
  return batches[0]!.results??[];
}

function literal(value:unknown):string {
  if(value===null) return 'NULL';
  if(typeof value==='number') {
    gate(Number.isSafeInteger(value),'PONS_REPLAY_INSPECT_BIND_NUMBER_INVALID');
    return String(value);
  }
  if(typeof value==='bigint') return value.toString();
  if(typeof value==='string') return "'" + value.replaceAll("'","''") + "'";
  throw new Error('PONS_REPLAY_INSPECT_BIND_TYPE_INVALID');
}

function interpolate(sql:string,values:readonly unknown[]):string {
  let index=0;
  const rendered=sql.replace(/\?/g,()=>{
    gate(index<values.length,'PONS_REPLAY_INSPECT_BIND_MISSING');
    return literal(values[index++]);
  });
  gate(index===values.length,'PONS_REPLAY_INSPECT_BIND_EXTRA');
  return rendered;
}

class RemoteSelectStatement implements D1PreparedStatementLike {
  constructor(private readonly sql:string,private readonly values:readonly unknown[]=[]) {}
  bind(...values:unknown[]):D1PreparedStatementLike { return new RemoteSelectStatement(this.sql,values); }
  run<T=Record<string,unknown>>():Promise<D1ResultLike<T>> {
    writeAttempts+=1;
    return Promise.reject(new Error('PONS_REPLAY_INSPECT_WRITE_ATTEMPT'));
  }
  async first<T=Record<string,unknown>>():Promise<T|null> {
    return selectRows<T>(interpolate(this.sql,this.values))[0]??null;
  }
  async all<T=Record<string,unknown>>():Promise<D1ResultLike<T>> {
    return {success:true,results:selectRows<T>(interpolate(this.sql,this.values)),meta:{changes:0}};
  }
}

class RemoteSelectDb implements D1DatabaseLike {
  prepare(sql:string):D1PreparedStatementLike { return new RemoteSelectStatement(sql); }
  batch(_statements:D1PreparedStatementLike[]):Promise<D1ResultLike[]> {
    writeAttempts+=1;
    return Promise.reject(new Error('PONS_REPLAY_INSPECT_WRITE_ATTEMPT'));
  }
  exec(_sql:string):Promise<unknown> {
    writeAttempts+=1;
    return Promise.reject(new Error('PONS_REPLAY_INSPECT_WRITE_ATTEMPT'));
  }
}

interface TargetCandidateRow {
  launch_id:string;
  creator:Hex;
  block_number:string;
  prior_count:number;
}

interface IdentityMarkerRow {
  observed_block:string;
  identity_id:string;
}

interface OutcomeMarkerRow {
  horizon_ms:number;
  observed_block:string;
  observation_id:string;
}

function snapshotSummary(snapshot:Awaited<ReturnType<typeof readPonsReplaySnapshot>>) {
  return {
    asOfBlock:snapshot.asOfBlock,
    asOfBlockHash:snapshot.asOfBlockHash,
    asOfTimestampMs:snapshot.asOfTimestampMs,
    targetLaunchKnown:snapshot.targetLaunchKnown,
    previousLaunchCount:snapshot.previousLaunches.length,
    target:snapshot.targetLaunch?{
      launchId:snapshot.targetLaunch.launchId,
      token:snapshot.targetLaunch.token,
      deployer:snapshot.targetLaunch.deployer,
      provenance:snapshot.targetLaunch.provenance,
      tokenIdentity:snapshot.targetLaunch.tokenIdentity,
      observations:snapshot.targetLaunch.observations.map((item)=>({
        horizon:item.horizonLabel,
        state:item.state,
        observationId:item.observationId,
        observedBlock:item.observedBlock,
        estimatedFdvQuoteRaw:item.estimatedFdvQuoteRaw,
        evidenceDigest:item.evidenceDigest
      }))
    }:null,
    outputDigest:snapshot.outputDigest
  };
}

gate(process.env.CLOUDFLARE_API_TOKEN,'PONS_REPLAY_INSPECT_CLOUDFLARE_TOKEN_MISSING');
gate(process.env.CLOUDFLARE_ACCOUNT_ID,'PONS_REPLAY_INSPECT_CLOUDFLARE_ACCOUNT_MISSING');
const archiveRpcUrl=resolveRobinhoodArchiveRpcUrl({
  BINRAT_ROBINHOOD_ARCHIVE_RPC_URL:process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL
});

writeFileSync(CONFIG,JSON.stringify({
  name:'binrat-pons-replay-readonly-inspect',
  main:'src/cloudflare/worker.ts',
  compatibility_date:'2026-09-18',
  d1_databases:[{binding:'DB',database_name:DB,database_id:DB_ID}]
},null,2));

try {
  const checkpointRows=selectRows<{block_number:string;block_hash:Hex}>(
    "SELECT block_number,block_hash FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1"
  );
  gate(checkpointRows.length===1,'PONS_REPLAY_INSPECT_CHECKPOINT_MISSING');
  const checkpointBlock=BigInt(checkpointRows[0]!.block_number);

  const source=new RpcPonsOutcomeObservationSource({
    discoveryRpcUrl:archiveRpcUrl,
    archiveRpcUrl
  });
  await source.assertAuthority();
  const checkpointPoint=await source.getBlockPoint(checkpointBlock);
  gate(checkpointPoint.blockHash.toLowerCase()===checkpointRows[0]!.block_hash.toLowerCase(),'PONS_REPLAY_INSPECT_CHECKPOINT_REORG');

  const diagnostics={
    identityReceipts:Number(selectRows<{n:number}>("SELECT COUNT(*) AS n FROM pons_token_identity_receipts WHERE chain_id=4663")[0]?.n??0),
    outcomeReceipts:Number(selectRows<{n:number}>("SELECT COUNT(*) AS n FROM pons_outcome_receipts WHERE chain_id=4663")[0]?.n??0),
    identityLaunches:Number(selectRows<{n:number}>("SELECT COUNT(DISTINCT launch_id) AS n FROM pons_token_identity_receipts WHERE chain_id=4663")[0]?.n??0),
    outcomeLaunches:Number(selectRows<{n:number}>("SELECT COUNT(DISTINCT launch_id) AS n FROM pons_outcome_receipts WHERE chain_id=4663")[0]?.n??0),
    overlappingLaunches:Number(selectRows<{n:number}>(
      "SELECT COUNT(*) AS n FROM pons_token_identity_receipts i JOIN (SELECT DISTINCT launch_id FROM pons_outcome_receipts WHERE chain_id=4663) o ON o.launch_id=i.launch_id WHERE i.chain_id=4663"
    )[0]?.n??0)
  };

  const priorCountSql=(alias:string)=>[
    "(SELECT COUNT(*) FROM launches p WHERE p.chain_id=4663 AND p.source='PONS_V2' AND p.creator="+alias+".creator AND (",
    "CAST(p.block_number AS INTEGER)<CAST("+alias+".block_number AS INTEGER)",
    "OR (CAST(p.block_number AS INTEGER)=CAST("+alias+".block_number AS INTEGER) AND (p.log_index<"+alias+".log_index",
    "OR (p.log_index="+alias+".log_index AND p.launch_id<"+alias+".launch_id)))))"
  ].join(' ');

  const identityCandidates=selectRows<TargetCandidateRow>([
    "SELECT l.launch_id,l.creator,l.block_number,"+priorCountSql('l')+" AS prior_count",
    "FROM launches l JOIN pons_token_identity_receipts i ON i.chain_id=4663 AND i.launch_id=l.launch_id",
    "WHERE l.chain_id=4663 AND l.source='PONS_V2' AND "+priorCountSql('l')+" BETWEEN 0 AND "+MAX_PREVIOUS,
    "ORDER BY CASE WHEN CAST(i.observed_block AS INTEGER)>CAST(l.block_number AS INTEGER) THEN 0 ELSE 1 END,",
    "CAST(l.block_number AS INTEGER) DESC LIMIT 20"
  ].join(' '));

  const outcomeCandidates=selectRows<TargetCandidateRow>([
    "SELECT l.launch_id,l.creator,l.block_number,"+priorCountSql('l')+" AS prior_count",
    "FROM launches l JOIN pons_outcome_receipts o ON o.chain_id=4663 AND o.launch_id=l.launch_id",
    "WHERE l.chain_id=4663 AND l.source='PONS_V2' AND "+priorCountSql('l')+" BETWEEN 0 AND "+MAX_PREVIOUS,
    "GROUP BY l.launch_id,l.creator,l.block_number,l.log_index",
    "ORDER BY CASE WHEN MIN(CAST(o.observed_block AS INTEGER))>CAST(l.block_number AS INTEGER) THEN 0 ELSE 1 END,",
    "CAST(l.block_number AS INTEGER) DESC LIMIT 20"
  ].join(' '));

  const chosen=[] as TargetCandidateRow[];
  const firstIdentity=identityCandidates.find((row)=>BigInt(row.block_number)<=checkpointBlock)??null;
  const firstOutcome=outcomeCandidates.find((row)=>BigInt(row.block_number)<=checkpointBlock)??null;
  if(firstIdentity) chosen.push(firstIdentity);
  if(firstOutcome && !chosen.some((row)=>row.launch_id===firstOutcome.launch_id)) chosen.push(firstOutcome);
  gate(chosen.length>0,'PONS_REPLAY_INSPECT_NO_EVIDENCE_CANDIDATE');

  const db=new RemoteSelectDb();
  const scenarios=[] as Array<{
    candidate:TargetCandidateRow;
    identityMarker:IdentityMarkerRow|null;
    outcomeMarkers:OutcomeMarkerRow[];
    timeline:Array<ReturnType<typeof snapshotSummary>>;
  }>;

  for(const candidate of chosen) {
    gate(/^[0-9a-f]{64}$/i.test(candidate.launch_id),'PONS_REPLAY_INSPECT_CANDIDATE_ID_INVALID');
    const identityMarker=selectRows<IdentityMarkerRow>(
      "SELECT observed_block,identity_id FROM pons_token_identity_receipts WHERE chain_id=4663 AND launch_id='"+
      candidate.launch_id.toLowerCase()+"' LIMIT 1"
    )[0]??null;
    const outcomeMarkers=selectRows<OutcomeMarkerRow>(
      "SELECT horizon_ms,observed_block,observation_id FROM pons_outcome_receipts WHERE chain_id=4663 AND launch_id='"+
      candidate.launch_id.toLowerCase()+"' ORDER BY CAST(observed_block AS INTEGER),horizon_ms"
    );

    const transitionBlocks=[
      BigInt(candidate.block_number),
      ...(identityMarker?[BigInt(identityMarker.observed_block)]:[]),
      ...outcomeMarkers.map((row)=>BigInt(row.observed_block)),
      checkpointBlock
    ].filter((value)=>value>=BigInt(candidate.block_number)&&value<=checkpointBlock);
    const uniqueBlocks=[...new Set(transitionBlocks.map(String))].map(BigInt).sort((a,b)=>a<b?-1:a>b?1:0);
    gate(uniqueBlocks.length>=2,'PONS_REPLAY_INSPECT_TIMELINE_TOO_SHORT');

    const timeline=[] as Array<ReturnType<typeof snapshotSummary>>;
    for(const asOfBlock of uniqueBlocks) {
      const snapshot=await readPonsReplaySnapshot(db,source,{
        targetLaunchId:candidate.launch_id,
        asOfBlock,
        maxPreviousLaunches:MAX_PREVIOUS
      });
      timeline.push(snapshotSummary(snapshot));
    }

    for(const item of timeline) {
      const block=BigInt(item.asOfBlock);
      if(identityMarker) {
        const visible=item.target?.tokenIdentity!==null;
        gate(visible===(block>=BigInt(identityMarker.observed_block)),'PONS_REPLAY_INSPECT_IDENTITY_LOOKAHEAD');
      }
      for(const marker of outcomeMarkers) {
        const visible=item.target?.observations.some((obs)=>obs.observationId===marker.observation_id)??false;
        gate(visible===(block>=BigInt(marker.observed_block)),'PONS_REPLAY_INSPECT_OUTCOME_LOOKAHEAD');
      }
    }

    const first=timeline[0]!;
    const last=timeline[timeline.length-1]!;
    gate(first.targetLaunchKnown&&last.targetLaunchKnown,'PONS_REPLAY_INSPECT_TARGET_VISIBILITY_INVALID');
    gate(first.previousLaunchCount===Number(candidate.prior_count),'PONS_REPLAY_INSPECT_PRIOR_COUNT_INVALID');
    gate(last.previousLaunchCount===first.previousLaunchCount,'PONS_REPLAY_INSPECT_PRIOR_COUNT_DRIFT');
    gate(new Set(timeline.map((item)=>item.outputDigest)).size===timeline.length,'PONS_REPLAY_INSPECT_DIGEST_NOT_TIME_BOUND');

    scenarios.push({candidate,identityMarker,outcomeMarkers,timeline});
  }

  gate(writeAttempts===0,'PONS_REPLAY_INSPECT_WRITE_ATTEMPTED');
  gate(scenarios.some((item)=>item.identityMarker!==null),'PONS_REPLAY_INSPECT_IDENTITY_SCENARIO_MISSING');
  gate(scenarios.some((item)=>item.outcomeMarkers.length>0),'PONS_REPLAY_INSPECT_OUTCOME_SCENARIO_MISSING');

  console.log(JSON.stringify({
    kind:'BINRAT_PONS_REPLAY_PRODUCTION_INSPECTION_V1',
    productionMutation:false,
    semantics:'KNOWABLE_AS_OF_BLOCK',
    checkpoint:{
      blockNumber:checkpointBlock.toString(),
      blockHash:checkpointPoint.blockHash,
      timestampMs:checkpointPoint.timestampMs
    },
    diagnostics,
    d1ReadCalls,
    writeAttempts,
    scenarios:scenarios.map((scenario)=>({
      candidate:{
        launchId:scenario.candidate.launch_id,
        deployer:scenario.candidate.creator,
        launchBlock:scenario.candidate.block_number,
        priorLaunchCount:Number(scenario.candidate.prior_count)
      },
      identityMarker:scenario.identityMarker,
      outcomeMarkers:scenario.outcomeMarkers,
      timeline:scenario.timeline
    }))
  },null,2));
} finally {
  rmSync(CONFIG,{force:true});
}
