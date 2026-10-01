import { createPublicClient, http, zeroAddress, type Address, type PublicClient } from 'viem';
import { PONS_V2_FACTORY, PONS_V2_START_BLOCK, ROBINHOOD_CHAIN_ID, robinhoodMainnet } from '../src/pons/chain.js';
import { ponsTokenLaunchedEvent, ponsV2FactoryOutcomeReadAbi } from '../src/pons/ponsAbi.js';
import { deriveLaunchId } from '../src/core/identity.js';
import {
  RpcPonsCurveOutcomeSource,
  readPonsCurveOutcomeCapability
} from '../src/pons/outcomeCapability.js';

const apiBase=(process.env.BINRAT_PUBLIC_BASE_URL ?? 'https://binrat-edge-v0.pettevik.workers.dev').replace(/\/$/,'');
const rpcUrl=process.env.ROBINHOOD_RPC_URL?.trim() || 'https://rpc.mainnet.chain.robinhood.com';
const discoveryRpcUrl=process.env.ROBINHOOD_DISCOVERY_RPC_URL?.trim() || 'https://rpc.mainnet.chain.robinhood.com';

function gate(condition:unknown,code:string):asserts condition {
  if (!condition) throw new Error(code);
}
function address(value:unknown,code:string):`0x${string}` {
  gate(typeof value==='string' && /^0x[0-9a-fA-F]{40}$/.test(value),code);
  return value.toLowerCase() as `0x${string}`;
}
function launchId(value:unknown):string {
  gate(typeof value==='string' && /^[0-9a-f]{64}$/.test(value),'PROBE_LAUNCH_ID_INVALID');
  return value;
}
function blockNumber(value:unknown):bigint {
  gate(typeof value==='string' && /^\d+$/.test(value),'PROBE_BLOCK_INVALID');
  return BigInt(value);
}
function printable(receipt:Awaited<ReturnType<typeof readPonsCurveOutcomeCapability>>) {
  return {
    outcomeVersion:receipt.outcomeVersion,
    chainId:receipt.chainId,
    launchId:receipt.launchId,
    token:receipt.token,
    curve:receipt.curve,
    observedBlock:receipt.observedBlock.toString(),
    observedBlockHash:receipt.observedBlockHash,
    observedTimestampMs:receipt.observedTimestampMs,
    phase:receipt.phase,
    pairToken:receipt.pairToken,
    quoteDecimals:receipt.quoteDecimals,
    totalSupply:receipt.totalSupply.toString(),
    quoteReserve:receipt.quoteReserve?.toString() ?? null,
    tokenReserve:receipt.tokenReserve?.toString() ?? null,
    estimatedFdvQuoteRaw:receipt.estimatedFdvQuoteRaw?.toString() ?? null,
    status:receipt.status,
    missing:receipt.missing,
    evidenceDigest:receipt.evidenceDigest
  };
}


const MINUTE_MS=60_000;
const HOUR_MS=60*MINUTE_MS;
const DAY_MS=24*HOUR_MS;
const HISTORICAL_SCAN_CHUNK_BLOCKS=4_096n;

async function observedBlockTimestampMs(client:PublicClient,block:bigint):Promise<number> {
  const value=await client.getBlock({blockNumber:block});
  const timestampMs=Number(value.timestamp*1000n);
  gate(Number.isSafeInteger(timestampMs),'PROBE_BLOCK_TIMESTAMP_INVALID');
  return timestampMs;
}

async function firstBlockAtOrAfterTimestamp(
  client:PublicClient,
  lower:bigint,
  upper:bigint,
  targetTimestampMs:number
):Promise<bigint> {
  gate(lower<=upper,'PROBE_TIMESTAMP_SEARCH_RANGE_INVALID');
  const upperTimestampMs=await observedBlockTimestampMs(client,upper);
  gate(upperTimestampMs>=targetTimestampMs,'PROBE_TIMESTAMP_TARGET_AFTER_CHECKPOINT');
  let lo=lower;
  let hi=upper;
  while (lo<hi) {
    const mid=lo+(hi-lo)/2n;
    const timestampMs=await observedBlockTimestampMs(client,mid);
    if (timestampMs>=targetTimestampMs) hi=mid;
    else lo=mid+1n;
  }
  return lo;
}

async function findHistoricalNativeLaunch(
  client:PublicClient,
  fromBlock:bigint,
  throughBlock:bigint
):Promise<{launchId:string;token:`0x${string}`;curve:`0x${string}`;blockNumber:bigint;timestampMs:number}> {
  let to=throughBlock;
  while (to>=fromBlock) {
    const candidateFrom=to-HISTORICAL_SCAN_CHUNK_BLOCKS+1n;
    const from=candidateFrom<fromBlock ? fromBlock : candidateFrom;
    const logs=await client.getLogs({
      address:PONS_V2_FACTORY as Address,
      event:ponsTokenLaunchedEvent,
      fromBlock:from,
      toBlock:to,
      strict:true
    });
    for (const log of [...logs].reverse()) {
      if (log.blockNumber===null || log.transactionHash===null) continue;
      if (!log.args.token || !log.args.curve || !log.args.pairToken) continue;
      if (log.args.pairToken.toLowerCase()!==zeroAddress) continue;
      const token=address(log.args.token,'PROBE_HISTORICAL_TOKEN_INVALID');
      const curve=address(log.args.curve,'PROBE_HISTORICAL_CURVE_INVALID');
      const id=await deriveLaunchId({
        chainId:ROBINHOOD_CHAIN_ID,
        launcher:PONS_V2_FACTORY,
        txHash:log.transactionHash,
        token,
        source:'PONS_V2'
      });
      return {
        launchId:id,
        token,
        curve,
        blockNumber:log.blockNumber,
        timestampMs:await observedBlockTimestampMs(client,log.blockNumber)
      };
    }
    if (from===fromBlock) break;
    to=from-1n;
  }
  throw new Error('PROBE_NO_AGED_NATIVE_LAUNCH');
}

const latestResponse=await fetch(`${apiBase}/api/launches/latest`,{signal:AbortSignal.timeout(20_000)});
gate(latestResponse.ok,`PROBE_LATEST_HTTP_${latestResponse.status}`);
const latest=await latestResponse.json() as {
  schemaVersion?:unknown;
  chainId?:unknown;
  sourceCheckpoint?:unknown;
  launches?:Array<Record<string,unknown>>;
};
gate(latest.schemaVersion==='binrat.latest-launches/0.1','PROBE_LATEST_SCHEMA_INVALID');
gate(latest.chainId===ROBINHOOD_CHAIN_ID,'PROBE_LATEST_CHAIN_INVALID');
gate(typeof latest.sourceCheckpoint==='string' && /^\d+$/.test(latest.sourceCheckpoint),'PROBE_CHECKPOINT_INVALID');
gate(Array.isArray(latest.launches) && latest.launches.length>0,'PROBE_NO_LAUNCHES');

const selected=latest.launches[0]!;
const selectedToken=address(selected.token,'PROBE_TOKEN_INVALID');
const selectedLaunchId=launchId(selected.launchId);
const launchBlock=blockNumber(selected.blockNumber);
const checkpoint=BigInt(latest.sourceCheckpoint);

const client=createPublicClient({
  chain:robinhoodMainnet(rpcUrl),
  transport:http(rpcUrl,{timeout:20_000,retryCount:2,retryDelay:500})
});
const discoveryClient=createPublicClient({
  chain:robinhoodMainnet(discoveryRpcUrl),
  transport:http(discoveryRpcUrl,{timeout:20_000,retryCount:2,retryDelay:500})
});
const registry=await client.readContract({
  address:PONS_V2_FACTORY as Address,
  abi:ponsV2FactoryOutcomeReadAbi,
  functionName:'getLaunchedToken',
  args:[selectedToken as Address],
  blockNumber:launchBlock
});
gate(registry.exists===true,'PROBE_FACTORY_LAUNCH_MISSING');
const curve=address(registry.curve,'PROBE_CURVE_INVALID');

const source=new RpcPonsCurveOutcomeSource({client});
const atLaunch=await readPonsCurveOutcomeCapability(
  source,
  {launchId:selectedLaunchId,token:selectedToken,curve},
  launchBlock
);
gate(atLaunch.phase==='CURVE','PROBE_LAUNCH_BLOCK_NOT_CURVE');
gate(atLaunch.status==='COMPLETE','PROBE_LAUNCH_BLOCK_INCOMPLETE');
gate(atLaunch.estimatedFdvQuoteRaw!==null,'PROBE_LAUNCH_BLOCK_FDV_MISSING');

const atCheckpoint=await readPonsCurveOutcomeCapability(
  source,
  {launchId:selectedLaunchId,token:selectedToken,curve},
  checkpoint
);
gate(
  (atCheckpoint.phase==='CURVE' && atCheckpoint.status==='COMPLETE' && atCheckpoint.estimatedFdvQuoteRaw!==null) ||
  (atCheckpoint.phase==='GRADUATED' && atCheckpoint.status==='PARTIAL' && atCheckpoint.missing.includes('V4_POOL_STATE')),
  'PROBE_CHECKPOINT_STATE_INVALID'
);


const checkpointTimestampMs=await observedBlockTimestampMs(discoveryClient,checkpoint);
const archiveSearchStartTimestampMs=checkpointTimestampMs-30*HOUR_MS;
const archiveSearchEndTimestampMs=checkpointTimestampMs-24*HOUR_MS-10*MINUTE_MS;
const archiveSearchStartBlock=await firstBlockAtOrAfterTimestamp(
  discoveryClient,
  PONS_V2_START_BLOCK,
  checkpoint,
  archiveSearchStartTimestampMs
);
const archiveSearchEndBlock=await firstBlockAtOrAfterTimestamp(
  discoveryClient,
  archiveSearchStartBlock,
  checkpoint,
  archiveSearchEndTimestampMs
);
const agedLaunch=await findHistoricalNativeLaunch(discoveryClient,archiveSearchStartBlock,archiveSearchEndBlock);
gate(
  checkpointTimestampMs-agedLaunch.timestampMs>=24*HOUR_MS+10*MINUTE_MS,
  'PROBE_AGED_LAUNCH_TOO_RECENT'
);

const maturityWindows=[
  {label:'5m',offsetMs:5*MINUTE_MS},
  {label:'1h',offsetMs:HOUR_MS},
  {label:'24h',offsetMs:DAY_MS}
] as const;
const historicalMaturityReceipts=[] as Array<{
  window:'5m'|'1h'|'24h';
  targetTimestampMs:number;
  targetBlock:string;
  availability:'AVAILABLE'|'UNAVAILABLE';
  receipt:ReturnType<typeof printable>|null;
  error:string|null;
}>;
for (const window of maturityWindows) {
  const targetTimestampMs=agedLaunch.timestampMs+window.offsetMs;
  const targetBlock=await firstBlockAtOrAfterTimestamp(
    discoveryClient,
    agedLaunch.blockNumber,
    checkpoint,
    targetTimestampMs
  );
  try {
    const receipt=await readPonsCurveOutcomeCapability(
      source,
      {launchId:agedLaunch.launchId,token:agedLaunch.token,curve:agedLaunch.curve},
      targetBlock
    );
    gate(receipt.observedTimestampMs>=targetTimestampMs,`PROBE_${window.label.toUpperCase()}_BEFORE_MATURITY`);
    historicalMaturityReceipts.push({
      window:window.label,
      targetTimestampMs,
      targetBlock:targetBlock.toString(),
      availability:'AVAILABLE',
      receipt:printable(receipt),
      error:null
    });
  } catch (error) {
    const message=error instanceof Error ? error.message : String(error);
    historicalMaturityReceipts.push({
      window:window.label,
      targetTimestampMs,
      targetBlock:targetBlock.toString(),
      availability:'UNAVAILABLE',
      receipt:null,
      error:message.includes('historical state') ? 'HISTORICAL_STATE_UNAVAILABLE' : message.slice(0,240)
    });
  }
}
console.log(JSON.stringify({
  kind:'PONS_OUTCOME_ARCHIVE_PROBE_RESULT',
  publicSourceCheckpoint:checkpoint.toString(),
  checkpointTimestampMs,
  agedLaunch:{
    launchId:agedLaunch.launchId,
    token:agedLaunch.token,
    curve:agedLaunch.curve,
    blockNumber:agedLaunch.blockNumber.toString(),
    timestampMs:agedLaunch.timestampMs,
    ageMsAtCheckpoint:checkpointTimestampMs-agedLaunch.timestampMs
  },
  historicalMaturityReceipts
},null,2));
gate(
  historicalMaturityReceipts.every((item)=>item.availability==='AVAILABLE'),
  'PROBE_HISTORICAL_MATURITY_UNAVAILABLE'
);

console.log(JSON.stringify({
  kind:'PONS_OUTCOME_CAPABILITY_PROBE_PASS',
  publicSourceCheckpoint:checkpoint.toString(),
  launchBlock:launchBlock.toString(),
  agedLaunch:{
    launchId:agedLaunch.launchId,
    token:agedLaunch.token,
    curve:agedLaunch.curve,
    blockNumber:agedLaunch.blockNumber.toString(),
    timestampMs:agedLaunch.timestampMs
  },
  historicalMaturityReceipts,
  atLaunch:printable(atLaunch),
  atCheckpoint:printable(atCheckpoint)
},null,2));
