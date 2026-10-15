/**
 * One historical Pons launch source-qualification probe.
 *
 * No transport construction, timer, service, public endpoint or Telegram hook.
 * A caller must supply an exclusive-writer, already reconciled BudgetLedger
 * grant and an explicitly chosen provider adapter. Seven? No: exactly EIGHT
 * pre-reserved, no-retry read requests, and one immutable historical identity.
 * This verifies one positive, never historical absence or live Watch coverage.
 */
import {
  decodeEventLog, getAddress, keccak256, toEventSelector, toHex,
  type Hex, type RpcTransactionReceipt
} from 'viem';
import { PONS_V2_FACTORY, PONS_V2_FACTORY_CODE_HASH, ROBINHOOD_CHAIN_ID } from '../pons/chain.js';
import { ponsTokenLaunchedEvent } from '../pons/ponsAbi.js';
import { forwardReceiptRoot } from './forwardReceiptRoot.js';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { deriveLaunchId, deriveEventId } from '../core/identity.js';
import type { BudgetLedger } from './budget.js';

export const TRIPWIRE_SOURCE_QUALIFICATION_V1 = 'binrat.pons-historical-source-qualification/1' as const;
const TOPIC = toEventSelector(ponsTokenLaunchedEvent).toLowerCase();
const H32 = /^0x[0-9a-f]{64}$/;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const QUANTITY = /^0x(?:0|[1-9a-f][0-9a-f]*)$/;
const MAX_RECEIPTS = 128, MAX_LOGS = 1024, MAX_MATCHES = 20, MAX_RESPONSE = 4 * 1024 * 1024;

export interface KnownHistoricalPonsEvent {
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  logIndex: number;
  deployer: string;
}
export interface ReadOnlyQualificationWire {
  /** Must issue ONE HTTP JSON-RPC attempt, NO retries/batches/fallbacks. */
  request(method: string, params: unknown[], signal: AbortSignal): Promise<unknown>;
  readonly mode: 'OFFLINE_FIXTURE_ONLY' | 'EXPLICIT_READONLY_PROVIDER';
}
export interface HistoricalQualificationResult {
  schemaVersion: typeof TRIPWIRE_SOURCE_QUALIFICATION_V1;
  chainId: 4663;
  source: 'PONS_V2';
  factory: string;
  pinnedFactoryCodeHash: string;
  blockNumber: string;
  blockHash: string;
  receiptsRoot: string;
  transactionHash: string;
  logIndex: number;
  deployer: string;
  token: string;
  curve: string;
  launchId: string;
  eventId: string;
  verifiedAtMs: number;
  requestsReserved: 8;
  requestCostMilliCuReserved: 800000;
  coverage: 'HISTORICAL_POSITIVE_ONLY';
  sourceAuthority: 'OFFLINE_SIMULATED' | 'FACTORY_CODE_HASH_PINNED';
}
export interface QualificationPort {
  ledger: Pick<BudgetLedger, 'reserveTripwireQualification' | 'finishTripwireQualification'>;
  job: string; grantId: string; deadlineMs: number;
  scope: {ownerId:string;generation:string;deployer:string};
  known: KnownHistoricalPonsEvent;
  wire: ReadOnlyQualificationWire;
  /** Only for synthetic fixture tests. It can NEVER produce a live qualification. */
  offlineExpectedCodeHash?: Hex;
  now?: () => number;
}
type Log = {
  address: string; blockNumber: bigint; blockHash: string; transactionHash: string;
  transactionIndex: number; logIndex: number; topics: string[]; data: string;
};
type Header = {
  number: bigint; hash: string; receiptsRoot: string; transactions: string[];
};
function demand(condition: unknown, code: string): asserts condition {
  if (!condition) throw Error(code);
}
function obj(v: unknown): Record<string, unknown> {
  demand(v !== null && typeof v === 'object' && !Array.isArray(v), 'TRIPWIRE_SOURCE_RPC_SHAPE_INVALID');
  return v as Record<string, unknown>;
}
function quantity(v: unknown): bigint {
  demand(typeof v === 'string' && QUANTITY.test(v), 'TRIPWIRE_SOURCE_QUANTITY_INVALID');
  return BigInt(v);
}
function hash(v: unknown): string {
  demand(typeof v === 'string' && H32.test(v.toLowerCase()), 'TRIPWIRE_SOURCE_HASH_INVALID');
  return v.toLowerCase();
}
function header(v: unknown, strictTransactions = false): Header {
  const b = obj(v), number = quantity(b.number);
  const blockHash = hash(b.hash), receiptsRoot = hash(b.receiptsRoot);
  demand(Array.isArray(b.transactions), 'TRIPWIRE_SOURCE_TRANSACTIONS_INVALID');
  if (strictTransactions) demand(b.transactions.length <= MAX_RECEIPTS, 'TRIPWIRE_SOURCE_TRANSACTIONS_LIMIT');
  const transactions = strictTransactions ? b.transactions.map(hash) : [];
  demand(new Set(transactions).size === transactions.length, 'TRIPWIRE_SOURCE_TX_DUPLICATE');
  return {number,hash:blockHash,receiptsRoot,transactions};
}
function normalizedLog(v: unknown): Log {
  const r = obj(v);
  const txIndex = quantity(r.transactionIndex), index = quantity(r.logIndex);
  demand(txIndex <= BigInt(Number.MAX_SAFE_INTEGER) && index <= BigInt(Number.MAX_SAFE_INTEGER) &&
    typeof r.address === 'string' && ADDRESS.test(r.address.toLowerCase()) &&
    Array.isArray(r.topics) && r.topics.length <= 4 &&
    r.topics.every((t:unknown)=>typeof t==='string' && H32.test(t.toLowerCase())) &&
    typeof r.data === 'string' && /^0x(?:[0-9a-f]{2})*$/i.test(r.data) &&
    (r.removed===undefined || r.removed===false), 'TRIPWIRE_SOURCE_LOG_INVALID');
  return {
    address:r.address.toLowerCase(),blockNumber:quantity(r.blockNumber),
    blockHash:hash(r.blockHash),transactionHash:hash(r.transactionHash),
    transactionIndex:Number(txIndex),logIndex:Number(index),
    topics:(r.topics as string[]).map(t=>t.toLowerCase()),data:r.data.toLowerCase()
  };
}
function logKey(l: Log): string {
  return canonicalJson([l.blockNumber.toString(),l.blockHash,l.transactionHash,
    l.transactionIndex,l.logIndex,l.address,l.topics,l.data]);
}
function matches(l:Log,deployer:string) {
  return l.address === PONS_V2_FACTORY && l.topics.length === 4 &&
    l.topics[0] === TOPIC && l.topics[3] === '0x'+deployer.slice(2).padStart(64,'0');
}
function validateKnown(k: KnownHistoricalPonsEvent, scope: QualificationPort['scope']) {
  demand(Number.isSafeInteger(k.blockNumber) && k.blockNumber >= 0 &&
    Number.isSafeInteger(k.logIndex) && k.logIndex >= 0 &&
    H32.test(k.blockHash) && H32.test(k.transactionHash) &&
    ADDRESS.test(k.deployer) && k.deployer === scope.deployer,
    'TRIPWIRE_SOURCE_KNOWN_EVENT_INVALID');
}
function boundedSize(data:unknown) {
  demand(Buffer.byteLength(JSON.stringify(data)) <= MAX_RESPONSE, 'TRIPWIRE_SOURCE_RESPONSE_LIMIT');
}

/** Invoke at most once for a single immutable historical event/grant.
 * A result attests this historical positive only, never new-event coverage. */
export async function qualifyHistoricalPonsLaunch(p: QualificationPort):Promise<HistoricalQualificationResult> {
  const now = p.now ?? Date.now;
  demand(Number.isSafeInteger(p.deadlineMs) && p.deadlineMs > now() &&
    typeof p.wire?.request === 'function', 'TRIPWIRE_SOURCE_ADMISSION_INVALID');
  validateKnown(p.known,p.scope);
  demand(!p.offlineExpectedCodeHash ||
    (p.wire.mode==='OFFLINE_FIXTURE_ONLY' && H32.test(p.offlineExpectedCodeHash)),
    'TRIPWIRE_SOURCE_TEST_OVERRIDE_DENIED');
  p.ledger.reserveTripwireQualification(p.job,p.grantId,p.deadlineMs,p.scope,{
    blockNumber:p.known.blockNumber,transactionHash:p.known.transactionHash,logIndex:p.known.logIndex
  });
  let attempts=0;
  const invoke = async (method: string, params: unknown[]) => {
    demand(++attempts <= 8 && now()<p.deadlineMs,'TRIPWIRE_SOURCE_CALL_BUDGET_EXHAUSTED');
    const timeout = Math.min(8000,p.deadlineMs-now());
    demand(timeout>0,'TRIPWIRE_SOURCE_DEADLINE');
    const abort = new AbortController();
    const timer = setTimeout(()=>abort.abort(),timeout);
    try {
      // No viem/publicClient retries. Caller must use single-attempt transport.
      const value = await p.wire.request(method,params,abort.signal);
      demand(!abort.signal.aborted && now()<p.deadlineMs,'TRIPWIRE_SOURCE_DEADLINE');
      boundedSize(value);
      return value;
    } finally {clearTimeout(timer);abort.abort();}
  };
  try {
    demand(quantity(await invoke('eth_chainId',[]))===BigInt(ROBINHOOD_CHAIN_ID),'TRIPWIRE_CHAIN_ID_DRIFT');
    const bytecode=await invoke('eth_getCode',[PONS_V2_FACTORY,'latest']);
    demand(typeof bytecode==='string' && /^0x(?:[0-9a-f]{2})+$/i.test(bytecode) &&
      keccak256(bytecode as Hex).toLowerCase()===(p.offlineExpectedCodeHash ?? PONS_V2_FACTORY_CODE_HASH),
      'TRIPWIRE_FACTORY_CODE_HASH_DRIFT');
    const latest=header(await invoke('eth_getBlockByNumber',['latest',false]));
    const finalized=header(await invoke('eth_getBlockByNumber',['finalized',false]));
    const n=BigInt(p.known.blockNumber);
    demand(latest.number >= n+2n && finalized.number >= n,'TRIPWIRE_SOURCE_FINALITY_UNAVAILABLE');
    const first=header(await invoke('eth_getBlockByNumber',[toHex(n),false]),true);
    demand(first.number===n && first.hash===p.known.blockHash,'TRIPWIRE_SOURCE_REORG');
    const filter={
      address:PONS_V2_FACTORY,
      topics:[TOPIC,null,null,'0x'+p.scope.deployer.slice(2).padStart(64,'0')],
      fromBlock:toHex(n),toBlock:toHex(n)
    };
    const rawLogs=await invoke('eth_getLogs',[filter]);
    demand(Array.isArray(rawLogs) && rawLogs.length<=MAX_MATCHES,'TRIPWIRE_SOURCE_LOGS_UNAVAILABLE');
    const observed=rawLogs.map(normalizedLog);
    demand(observed.every(log=>log.blockNumber===n && log.blockHash===first.hash &&
      matches(log,p.scope.deployer)), 'TRIPWIRE_SOURCE_LOG_SET_INVALID');
    const rawReceipts=await invoke('eth_getBlockReceipts',[toHex(n)]);
    demand(Array.isArray(rawReceipts) && rawReceipts.length<=MAX_RECEIPTS &&
      rawReceipts.length===first.transactions.length,'TRIPWIRE_SOURCE_RECEIPTS_UNAVAILABLE');
    const receipts=rawReceipts as RpcTransactionReceipt[];
    demand(forwardReceiptRoot(receipts)===first.receiptsRoot,'TRIPWIRE_SOURCE_RECEIPT_ROOT_DRIFT');
    const all:Log[]=[];
    for(let i=0;i<receipts.length;i++){
      const receipt=obj(receipts[i]);
      demand(quantity(receipt.transactionIndex)===BigInt(i) &&
        hash(receipt.transactionHash)===first.transactions[i] &&
        hash(receipt.blockHash)===first.hash &&
        quantity(receipt.blockNumber)===n, 'TRIPWIRE_SOURCE_RECEIPT_BINDING_INVALID');
      demand(Array.isArray(receipt.logs),'TRIPWIRE_SOURCE_RECEIPT_LOGS_INVALID');
      for(const raw of receipt.logs as unknown[]){
        const log=normalizedLog(raw);
        demand(log.blockNumber===n && log.blockHash===first.hash &&
          log.transactionHash===first.transactions[i] &&
          log.transactionIndex===i && log.logIndex===all.length,
          'TRIPWIRE_SOURCE_RECEIPT_LOG_ORDER_INVALID');
        all.push(log);
        demand(all.length<=MAX_LOGS,'TRIPWIRE_SOURCE_RECEIPT_LOG_LIMIT');
      }
    }
    // Canonical launch logs must occur in a successful transaction receipt.
    const matchTxIndex=first.transactions.indexOf(p.known.transactionHash);
    demand(matchTxIndex>=0 && receipts[matchTxIndex]?.status==='0x1',
      'TRIPWIRE_SOURCE_REVERTED_LAUNCH');
    const fromReceipts=all.filter(l=>matches(l,p.scope.deployer));
    const observedKeys=observed.map(logKey).sort(),receiptKeys=fromReceipts.map(logKey).sort();
    demand(fromReceipts.length<=MAX_MATCHES &&
      new Set(observedKeys).size===observedKeys.length &&
      canonicalJson(observedKeys)===canonicalJson(receiptKeys),
      'TRIPWIRE_SOURCE_LOG_SET_MISMATCH');
    const exact=fromReceipts.filter(l=>l.transactionHash===p.known.transactionHash && l.logIndex===p.known.logIndex);
    demand(exact.length===1,'TRIPWIRE_SOURCE_KNOWN_EVENT_ABSENT');
    const stable=header(await invoke('eth_getBlockByNumber',[toHex(n),false]),true);
    demand(canonicalJson({...stable,number:String(stable.number)})===
      canonicalJson({...first,number:String(first.number)}),'TRIPWIRE_SOURCE_REORG');
    const event=decodeEventLog({
      abi:[ponsTokenLaunchedEvent],topics:exact[0].topics as [Hex,...Hex[]],data:exact[0].data as Hex,strict:true
    });
    demand(event.args.deployer.toLowerCase()===p.scope.deployer,'TRIPWIRE_SOURCE_DEPLOYER_DRIFT');
    const token=getAddress(event.args.token).toLowerCase() as Hex;
    const [launchId,eventId]=await Promise.all([
      deriveLaunchId({chainId:ROBINHOOD_CHAIN_ID,launcher:PONS_V2_FACTORY,
        txHash:p.known.transactionHash as Hex,token,source:'PONS_V2'}),
      deriveEventId({chainId:ROBINHOOD_CHAIN_ID,launcher:PONS_V2_FACTORY,
        txHash:p.known.transactionHash as Hex,logIndex:p.known.logIndex,source:'PONS_V2'})
    ]);
    const result: HistoricalQualificationResult={
      schemaVersion:TRIPWIRE_SOURCE_QUALIFICATION_V1,chainId:4663,
      source:'PONS_V2',factory:PONS_V2_FACTORY,pinnedFactoryCodeHash:PONS_V2_FACTORY_CODE_HASH,
      blockNumber:String(p.known.blockNumber),blockHash:p.known.blockHash,
      receiptsRoot:first.receiptsRoot,transactionHash:p.known.transactionHash,
      logIndex:p.known.logIndex,deployer:p.scope.deployer,token,curve:getAddress(event.args.curve).toLowerCase(),
      launchId,eventId,verifiedAtMs:now(),requestsReserved:8,
      requestCostMilliCuReserved:800000,coverage:'HISTORICAL_POSITIVE_ONLY',
      sourceAuthority:p.offlineExpectedCodeHash?'OFFLINE_SIMULATED':'FACTORY_CODE_HASH_PINNED'
    };
    p.ledger.finishTripwireQualification(p.grantId,await sha256Hex(result));
    return result;
  }catch{
    p.ledger.finishTripwireQualification(p.grantId,null);
    throw Error('TRIPWIRE_SOURCE_QUALIFICATION_UNVERIFIED');
  }
}
