import { createPublicClient, http, type Address } from 'viem';
import { PONS_V2_FACTORY, ROBINHOOD_CHAIN_ID, robinhoodMainnet } from '../src/pons/chain.js';
import { ponsV2FactoryOutcomeReadAbi } from '../src/pons/ponsAbi.js';
import {
  RpcPonsCurveOutcomeSource,
  readPonsCurveOutcomeCapability
} from '../src/pons/outcomeCapability.js';

const apiBase=(process.env.BINRAT_PUBLIC_BASE_URL ?? 'https://binrat-edge-v0.pettevik.workers.dev').replace(/\/$/,'');
const rpcUrl=process.env.ROBINHOOD_RPC_URL?.trim() || 'https://rpc.mainnet.chain.robinhood.com';

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

console.log(JSON.stringify({
  kind:'PONS_OUTCOME_CAPABILITY_PROBE_PASS',
  publicSourceCheckpoint:checkpoint.toString(),
  launchBlock:launchBlock.toString(),
  atLaunch:printable(atLaunch),
  atCheckpoint:printable(atCheckpoint)
},null,2));
