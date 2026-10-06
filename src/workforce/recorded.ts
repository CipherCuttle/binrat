/** Offline admission of one recorded, retrospective RPC relation. No network adapter. */
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { decodeEventLog, keccak256, type Hex } from 'viem';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { deriveLaunchId } from '../core/identity.js';
import { PONS_V2_FACTORY, PONS_V2_FACTORY_CODE_HASH } from '../pons/chain.js';
import { ponsTokenLaunchedEvent } from '../pons/ponsAbi.js';
import { buildPonsPrelaunchNativeInboundReceipt } from '../pons/fundingProvenance.js';
import { assertSeal, type Job, type Claim, type Launch, type Transfer } from './contracts.js';
import type { JobReceipt } from './offline.js';

export interface Recording {
  endpoint: string;
  responses: { label: string; request: Record<string, unknown>; response: Record<string, unknown>; receivedAt: string }[];
}
export interface RecordedSource {
  schemaVersion: 'binrat.recorded-evidence/1'; provenance: 'RECORDED_RPC_RETROSPECTIVE';
  job: Omit<Job, 'schemaVersion' | 'objective'> & { schemaVersion: 'binrat.recorded-job/1'; objective: 'REPLAY_RECORDED_FUNDING_AND_PONS_LAUNCH' };
  recording: Recording; digest: string;
}
type RecordedClaim = Omit<Claim, 'scope'> & { scope: 'RECORDED_RPC_RESPONSES_ONLY' };
export interface RecordedReceipt {
  schemaVersion: 'binrat.recorded-job-receipt/1'; provenance: 'RECORDED_RPC_RETROSPECTIVE';
  receiptId: string; jobId: string; inputDigest: string; throughBlock: string;
  status: JobReceipt['status']; coverage: 'PARTIAL_RECORDED_RELATION_NO_RECIPIENT_HISTORY';
  claims: RecordedClaim[]; evidence: (Transfer | Launch)[]; handoffs: [];
  caseDiff: { beforeDigest: string; afterDigest: string; addedClaims: RecordedClaim[];
    fundingReceipt: Record<string, string | number> } | null;
  alert: { decision: 'ALERT' | 'SUPPRESS'; reason: 'RETROSPECTIVE_RELATION' | 'NOT_YET_OBSERVED' | 'BUDGET_EXHAUSTED'; findingId: string | null };
  usage: JobReceipt['usage']; trace: { sequence: number; tool: string; atBlock: string }[];
  observation: { availableAtBlock: string; receivedAt: string; predictionEstablished: false;
    recipientFreshnessEstablished: false; authentication: 'PROVIDER_REPORTED_NOT_CONSENSUS_PROVEN' };
}
const validate = new Ajv2020({ strict: true }).compile(JSON.parse(readFileSync('contracts/rat-workforce/recorded/RECORDED_EVIDENCE_V1.schema.json','utf8')));
const reject = (): never => { throw new Error('RECORDED_EVIDENCE_INVALID'); };
function hex(value: unknown, length?: number): Hex {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/.test(value) || (length && value.length !== length + 2)) return reject();
  return value as Hex;
}
function quantity(value: unknown): bigint {
  if (typeof value !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(value)) return reject();
  const number = BigInt(value); if (number > (1n << 256n) - 1n) return reject(); return number;
}
function data(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return reject();
  return value as Record<string, any>;
}
/** Strict envelope, response/request bindings and independent payload consistency; no claim of RPC authenticity. */
export async function assertRecordedSource(input: unknown): Promise<RecordedSource> {
  if (canonicalJson(input).length > 512_000 || !validate(input)) return reject();
  const source = structuredClone(input) as RecordedSource;
  await assertSeal(source, 'digest');
  const labels = ['chain','factoryCode','transfer','launch','transferBlock','launchBlock','head','transferReceipt','captureHead'];
  if (source.recording.responses.some((r,i) => r.label !== labels[i])) return reject();
  let priorTime = 0;
  for (const [index, r] of source.recording.responses.entries()) {
    const time = Date.parse(r.receivedAt);
    if (!Number.isFinite(time) || time < priorTime || r.request.jsonrpc !== '2.0' || r.response.jsonrpc !== '2.0' ||
        r.request.id !== index + 1 || r.response.id !== r.request.id || 'error' in r.response || r.response.result == null ||
        Object.keys(r.request).sort().join(',') !== 'id,jsonrpc,method,params' ||
        Object.keys(r.response).sort().join(',') !== 'id,jsonrpc,result') return reject();
    priorTime = time;
  }
  const [chain, code, transfer, launch, transferBlock, launchBlock, priorHead, transferReceipt, head] = source.recording.responses;
  const tx = data(transfer!.response.result), receipt = data(launch!.response.result), tr = data(transferReceipt!.response.result);
  const tb = data(transferBlock!.response.result), lb = data(launchBlock!.response.result), hb = data(head!.response.result);
  const requests = [ ['eth_chainId',[]], ['eth_getCode',[PONS_V2_FACTORY,'latest']],
    ['eth_getTransactionByHash',[tx.hash]], ['eth_getTransactionReceipt',[receipt.transactionHash]],
    ['eth_getBlockByNumber',[tx.blockNumber,false]], ['eth_getBlockByNumber',[receipt.blockNumber,false]], ['eth_getBlockByNumber',['latest',false]], ['eth_getTransactionReceipt',[tx.hash]], ['eth_getBlockByNumber',['latest',false]] ];
  if (source.recording.responses.some((r,i) => r.request.method !== requests[i]![0] ||
      canonicalJson(r.request.params) !== canonicalJson(requests[i]![1]))) return reject();
  if (quantity(chain!.response.result) !== 4663n || quantity(tx.chainId) !== 4663n || keccak256(hex(code!.response.result)) !== PONS_V2_FACTORY_CODE_HASH) return reject();
  const block = quantity(tx.blockNumber), launchNumber = quantity(receipt.blockNumber), headNumber = quantity(hb.number);
  if (block >= launchNumber || launchNumber > headNumber || quantity(tb.number) !== block || quantity(lb.number) !== launchNumber ||
      hex(tx.blockHash,64) !== hex(tb.hash,64) || hex(receipt.blockHash,64) !== hex(lb.hash,64) ||
      quantity(tr.status) !== 1n || tr.transactionHash !== tx.hash || tr.blockNumber !== tx.blockNumber || tr.blockHash !== tx.blockHash || tr.from !== tx.from || tr.to !== tx.to ||
      quantity(data(priorHead!.response.result).number) > headNumber || quantity(receipt.status) !== 1n || !Array.isArray(receipt.logs) || receipt.logs.length > 128 ||
      !Array.isArray(tb.transactions) || !tb.transactions.includes(hex(tx.hash,64)) ||
      !Array.isArray(lb.transactions) || !lb.transactions.includes(hex(receipt.transactionHash,64)) ||
      quantity(tx.value) === 0n || hex(tx.from,40) === hex(tx.to,40) ||
      hex(tx.from,40) !== source.job.subject.entityId || source.job.subject.entityType !== 'WALLET' ||
      source.job.window.fromBlock !== block.toString() || source.job.window.toBlock !== headNumber.toString() ||
      quantity(tb.timestamp) > quantity(lb.timestamp) || quantity(lb.timestamp) > quantity(hb.timestamp) ||
      Number(quantity(hb.timestamp)) * 1000 > priorTime + 60_000) return reject();
  hex(hb.hash,64);
  for (const log of receipt.logs) {
    if (log.removed !== false || log.blockNumber !== receipt.blockNumber || log.blockHash !== receipt.blockHash ||
        log.transactionHash !== receipt.transactionHash) return reject();
  }
  return source;
}

export async function replayRecorded(input: unknown, throughBlock: string): Promise<RecordedReceipt> {
  const source = await assertRecordedSource(input);
  if (!/^(0|[1-9][0-9]{0,19})$/.test(throughBlock) || BigInt(throughBlock) < BigInt(source.job.window.fromBlock) ||
      BigInt(throughBlock) > BigInt(source.job.window.toBlock)) throw new Error('REPLAY_BOUNDARY_INVALID');
  const responses = source.recording.responses;
  const tx = data(responses[2]!.response.result), launch = data(responses[3]!.response.result), tb = data(responses[4]!.response.result);
  const availableAtBlock = source.job.window.toBlock;
  const claims: RecordedClaim[] = [], evidence: (Transfer | Launch)[] = [], trace: RecordedReceipt['trace'] = [];
  let caseDiff: RecordedReceipt['caseDiff'] = null;
  let alert: RecordedReceipt['alert'] = { decision:'SUPPRESS',reason:'NOT_YET_OBSERVED',findingId:null };
  let exhausted = false;
  function reserve(tool: string) {
    if (trace.length >= source.job.budget.maxToolCalls) { exhausted = true; throw new Error('BUDGET_EXHAUSTED'); }
    trace.push({sequence:trace.length+1,tool,atBlock:availableAtBlock});
  }
  // Everything was obtained in this capture. Historic block inclusion never establishes historic observation.
  if (throughBlock === availableAtBlock) {
    try {
      reserve('READ_RECORDED_TRANSFER');
      const content = { id:tx.hash,kind:'NATIVE_TRANSFER' as const,chainId:4663 as const,blockNumber:BigInt(tx.blockNumber).toString(),
        blockHash:tx.blockHash,availableAtBlock,from:tx.from,to:tx.to,txHash:tx.hash,valueWei:BigInt(tx.value).toString() };
      const transfer: Transfer = {...content,digest:await sha256Hex(content)}; evidence.push(transfer);
      const claim = (kind: Claim['kind'], refs: string[]): RecordedClaim => ({kind,subject:{chainId:4663,entityType:kind === 'NATIVE_TRANSFER_OBSERVED' ? 'WALLET' : 'CREATOR',entityId:tx.to},
        evidenceRefs:refs,scope:'RECORDED_RPC_RESPONSES_ONLY'});
      claims.push(claim('NATIVE_TRANSFER_OBSERVED',[transfer.id]));
      reserve('READ_RECORDED_PONS_LAUNCH');
      const logs = launch.logs.filter((l: any) => l.address === PONS_V2_FACTORY);
      const decoded = logs.flatMap((l: any) => {
        try { return [{log:l,args:decodeEventLog({abi:[ponsTokenLaunchedEvent],topics:l.topics,data:l.data,strict:true}).args}]; }
        catch { return []; }
      }).filter((entry: any) => entry.args.deployer.toLowerCase() === tx.to);
      if (decoded.length !== 1) throw new Error('RECORDED_LAUNCH_BINDING_INVALID');
      const {log,args} = decoded[0]!;
      const index = quantity(log.logIndex); if (index > BigInt(Number.MAX_SAFE_INTEGER)) return reject();
      const event = { id:`${launch.transactionHash}:${index}`,kind:'PONS_LAUNCH' as const,chainId:4663 as const,
        blockNumber:BigInt(launch.blockNumber).toString(),blockHash:launch.blockHash,availableAtBlock,
        launcher:PONS_V2_FACTORY,creator:args.deployer.toLowerCase(),token:args.token.toLowerCase(),pool:args.curve.toLowerCase(),
        txHash:launch.transactionHash,logIndex:Number(index) };
      const observed: Launch = {...event,digest:await sha256Hex(event)}; evidence.push(observed);
      const launchId = await deriveLaunchId({chainId:4663,source:'PONS_V2',launcher:PONS_V2_FACTORY,txHash:observed.txHash as Hex,token:observed.token as Hex});
      reserve('BUILD_RECORDED_CASE_DIFF');
      const fundingReceipt = await buildPonsPrelaunchNativeInboundReceipt({launch:{launchId,deployer:tx.to,blockNumber:BigInt(observed.blockNumber),blockHash:observed.blockHash as Hex},
        sourceAddress:tx.from,transferTxHash:tx.hash,transferBlock:BigInt(transfer.blockNumber),transferBlockHash:tx.blockHash,
        transferTimestampMs:Number(quantity(tb.timestamp))*1000,valueWei:BigInt(tx.value)});
      const addedClaims = [claim('PONS_REPORTED_DEPLOYER_LAUNCH',[observed.id]),claim('FUNDING_PRECEDES_LAUNCH',[transfer.id,observed.id])];
      reserve('PREPARE_RECORDED_ALERT');
      const beforeDigest = await sha256Hex(claims), afterDigest = await sha256Hex([...claims,...addedClaims]);
      caseDiff = {beforeDigest,afterDigest,addedClaims,fundingReceipt:JSON.parse(canonicalJson(fundingReceipt))}; claims.push(...addedClaims);
      alert = {decision:'ALERT',reason:'RETROSPECTIVE_RELATION',findingId:afterDigest};
    } catch (error) { if (!(error instanceof Error) || error.message !== 'BUDGET_EXHAUSTED') throw error; }
  }
  if (exhausted) alert = {decision:'SUPPRESS',reason:'BUDGET_EXHAUSTED',findingId:null};
  const result: Omit<RecordedReceipt,'receiptId'> = {
    schemaVersion:'binrat.recorded-job-receipt/1',provenance:'RECORDED_RPC_RETROSPECTIVE',jobId:source.job.jobId,
    inputDigest:source.digest,throughBlock,status:exhausted?'EXHAUSTED':throughBlock===availableAtBlock?'DONE':'SLEEPING',
    coverage:'PARTIAL_RECORDED_RELATION_NO_RECIPIENT_HISTORY',claims,evidence,handoffs:[],caseDiff,alert,
    usage:{toolCalls:trace.length,handoffs:0,modelCalls:0,costMicrousd:0},trace,
    observation:{availableAtBlock,receivedAt:responses[8]!.receivedAt,predictionEstablished:false,recipientFreshnessEstablished:false,
      authentication:'PROVIDER_REPORTED_NOT_CONSENSUS_PROVEN'}
  };
  return {...result,receiptId:await sha256Hex(result)};
}
