/** Strategy B only. No default endpoint, polling loop, transport fallback or activation. */
import { createPublicClient, formatTransactionReceipt, toHex, toEventSelector, type Address, type Log, type PublicClient } from 'viem';
import { PonsLaunchSource } from '../pons/ponsSource.js';
import { ponsTokenLaunchedEvent } from '../pons/ponsAbi.js';
import { PONS_V2_FACTORY, robinhoodMainnet } from '../pons/chain.js';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import type { LaunchObserved } from '../core/types.js';
import { FORWARD_LIMITS, FORWARD_POLL_FIXED_REQUESTS, forwardRequire, validateForwardPoint, type ForwardPoint, type ForwardRange, type ForwardAuthority, type LiveSourcePolicyV2 } from '../public/forwardCase.js';
import { budgetedTransport } from './rpc.js';
import { BudgetLedger } from './budget.js';
import type { Limits } from './config.js';
import { forwardReceiptRoot } from './forwardReceiptRoot.js';

export interface ForwardScan {
  headers: ForwardPoint[]; launches: LaunchObserved[]; completeness: ForwardRange['completeness'];
}
export interface ForwardSession {
  readonly maxScanBlocks: number;
  authority(): Promise<void>;
  head(): Promise<ForwardPoint>;
  point(block: bigint): Promise<ForwardPoint>;
  scan(deployer: string, from: bigint, through: bigint): Promise<ForwardScan>;
  finalizedTarget?(): Promise<ForwardPoint>;
}
export interface ForwardSource {
  open(requestLimit: number): ForwardSession;
  readonly livePolicy?: LiveSourcePolicyV2;
  prepare?(authority: ForwardAuthority): void;
  commitCheck?(range?: ForwardRange): void;
  committed?(): void;
  locallyReconciled?(): boolean;
  stop?(): void;
  failed?(state: string, code: string): void;
}

/** A bounded handle to the SAME existing ledger file, never a reset or a new
 * ledger. The base ledger owns reservations/usage; freeze its effective limits
 * so caller metadata cannot promise ceilings that its handle does not enforce. */
export class ForwardBudgetLedger extends BudgetLedger {
  readonly forwardLimits: Readonly<Limits>;
  constructor(path: string, limits: Limits, now = Date.now) {
    forwardRequire(limits.attemptsPerRequest === 1 && Number.isSafeInteger(limits.attemptsPerRun) &&
      limits.attemptsPerRun > 0 && limits.attemptsPerRun <= 50 && Number.isSafeInteger(limits.attemptsPerDay) &&
      limits.attemptsPerDay > 0 && limits.attemptsPerDay <= 100, 'FORWARD_BUDGET_INVALID');
    const effective = Object.freeze({ ...limits });
    super(path, effective, now);
    this.forwardLimits = effective;
  }
}

/** The caller supplies the existing, reconciled ledger/job. Reservations are
 * durable before each physical request, including errors; no hidden retries.
 * Completeness trusts canonical RPC headers/receipts, not HTTP 200 or log count.
 * An unsupported block-receipts method leaves coverage UNKNOWN. */
export function forwardPonsSource(options: {
  endpoint: string; ledger: ForwardBudgetLedger; job: string; limits: Limits; deadline: number;
  fetchImpl?: typeof fetch; now?: () => number;
}): ForwardSource {
  const now = options.now ?? Date.now;
  forwardRequire(options.ledger instanceof ForwardBudgetLedger && canonicalJson(options.limits) === canonicalJson(options.ledger.forwardLimits) &&
    options.limits.attemptsPerRequest === 1 && options.limits.attemptsPerRun <= 50 &&
    options.limits.attemptsPerDay <= 100, 'FORWARD_BUDGET_INVALID');
  return { open(requestLimit) {
    forwardRequire(Number.isSafeInteger(requestLimit) && requestLimit > 0 && requestLimit <= 50, 'FORWARD_BUDGET_INVALID');
    let requests = 0;
    const transport = budgetedTransport(options.endpoint, options.ledger, options.job,
      { ...options.limits, attemptsPerRun: Math.min(requestLimit, options.limits.attemptsPerRun) },
      options.deadline, options.fetchImpl, now, 'PONS_FORWARD_V1');
    const client = createPublicClient({ chain: robinhoodMainnet(options.endpoint), cacheTime: 0,
      transport: config => {
        const base = transport(config);
        return { ...base, request: async args => {
          if (++requests > requestLimit) throw new Error('FORWARD_REQUEST_CEILING');
          return base.request(args);
        } };
      } });
    const authoritySource = new PonsLaunchSource({ client, now });
    const maxScanBlocks = Math.max(0, Math.min(FORWARD_LIMITS.blocks, options.limits.blocksPerRun,
      Math.floor((Math.min(requestLimit, options.limits.attemptsPerRun) - FORWARD_POLL_FIXED_REQUESTS) / 2)));
    async function header(blockNumber?: bigint) {
      const b = await client.getBlock(blockNumber === undefined ? { blockTag: 'latest' } : { blockNumber });
      forwardRequire(b.number !== null && (blockNumber === undefined || b.number === blockNumber) && b.hash,
        'FORWARD_HEADER_UNAVAILABLE');
      const point = { block: String(b.number), hash: b.hash.toLowerCase(), parentHash: b.parentHash.toLowerCase(),
        receiptsRoot: b.receiptsRoot, timestampMs: Number(b.timestamp) * 1000 };
      validateForwardPoint(point);
      forwardRequire(point.timestampMs <= now(), 'FORWARD_HEADER_FUTURE');
      return { point, transactions: b.transactions };
    }
    const session: ForwardSession = {
      maxScanBlocks,
      authority: () => authoritySource.assertAuthority(0n),
      async head() {
        const { point } = await header();
        forwardRequire(now() - point.timestampMs <= FORWARD_LIMITS.freshnessMs, 'FORWARD_HEAD_STALE');
        return point;
      },
      async point(block) { return (await header(block)).point; },
      async scan(deployer, from, through) {
        forwardRequire(/^0x[0-9a-f]{40}$/.test(deployer) && from >= 0n && through >= from &&
          through - from < BigInt(maxScanBlocks), 'FORWARD_RANGE_LIMIT');
        const headers: ForwardPoint[] = [], receiptLogs: Log[] = [];
        const responseEvidence: unknown[] = [];
        let transactions = 0;
        for (let n = from; n <= through; n++) {
          const { point, transactions: txs } = await header(n);
          forwardRequire(txs.length <= FORWARD_LIMITS.transactionsPerBlock &&
            txs.every(t => typeof t === 'string' && /^0x[0-9a-f]{64}$/.test(t)) &&
            new Set(txs).size === txs.length, 'FORWARD_COMPLETENESS_UNAVAILABLE');
          const rawReceipts = await client.request({ method: 'eth_getBlockReceipts', params: [toHex(n)] });
          forwardRequire(rawReceipts !== null, 'FORWARD_COMPLETENESS_UNAVAILABLE');
          forwardRequire(forwardReceiptRoot(rawReceipts) === point.receiptsRoot, 'FORWARD_RECEIPTS_ROOT_UNAVAILABLE');
          const receipts = rawReceipts.map(r => formatTransactionReceipt(r));
          forwardRequire(receipts.length === txs.length, 'FORWARD_COMPLETENESS_UNAVAILABLE');
          const allLogs: Log[] = [];
          for (let i = 0; i < receipts.length; i++) {
            const r = receipts[i];
            forwardRequire(r.transactionHash === txs[i] && r.transactionIndex === i && r.blockHash === point.hash &&
              r.blockNumber === n && (r.status === 'success' || r.status === 'reverted') &&
              r.logs.length <= FORWARD_LIMITS.logsPerBlock, 'FORWARD_COMPLETENESS_UNAVAILABLE');
            for (const l of r.logs) {
              forwardRequire(!l.removed && l.blockHash === point.hash && l.blockNumber === n &&
                l.transactionHash === r.transactionHash && l.transactionIndex === i &&
                l.logIndex === allLogs.length, 'FORWARD_COMPLETENESS_UNAVAILABLE');
              allLogs.push(l);
            }
          }
          forwardRequire(allLogs.length <= FORWARD_LIMITS.logsPerBlock, 'FORWARD_COMPLETENESS_UNAVAILABLE');
          receiptLogs.push(...allLogs.filter(l => l.address.toLowerCase() === PONS_V2_FACTORY &&
            l.topics[0] === toEventSelector(ponsTokenLaunchedEvent) &&
            l.topics[3] === `0x${deployer.slice(2).padStart(64, '0')}`));
          transactions += txs.length; headers.push(point);
          responseEvidence.push({ point, transactions: txs, receipts });
        }
        let discovered: Log[] = [];
        // Reuse the existing decoder unchanged. Only the getLogs input is narrowed.
        const filtered = new Proxy(client, { get(target, key) {
          if (key !== 'getLogs') return Reflect.get(target, key);
          return async () => {
            const logs = await client.getLogs({ address: PONS_V2_FACTORY as Address, event: ponsTokenLaunchedEvent,
              args: { deployer: deployer as Address }, fromBlock: from, toBlock: through, strict: true });
            discovered = logs;
            return logs;
          };
        } }) as PublicClient;
        const launches = await new PonsLaunchSource({ client: filtered, now }).catchUp(from, through);
        const identity = (l: Log) => canonicalJson({ address: l.address.toLowerCase(), blockNumber: l.blockNumber,
          blockHash: l.blockHash, transactionHash: l.transactionHash, transactionIndex: l.transactionIndex,
          logIndex: l.logIndex, topics: l.topics, data: l.data });
        // Some providers repeat identical log entries. Collapse only exact replay;
        // any conflicting event identity or omitted receipt log fails the set comparison.
        const found = [...new Set(discovered.map(identity))].sort();
        const complete = receiptLogs.map(identity).sort();
        forwardRequire(found.length <= FORWARD_LIMITS.events && canonicalJson(found) === canonicalJson(complete),
          'FORWARD_COMPLETENESS_UNAVAILABLE');
        const unique = new Map<string, LaunchObserved>();
        for (const l of launches) {
          forwardRequire(l.creator === deployer, 'FORWARD_DEPLOYER_DRIFT');
          const prior = unique.get(l.eventId);
          forwardRequire(!prior || canonicalJson(prior) === canonicalJson(l), 'FORWARD_EVENT_CONFLICT');
          unique.set(l.eventId, l);
        }
        return { headers, launches: [...unique.values()], completeness: { kind: 'FULL_BLOCK_RECEIPTS_V1',
          blocks: headers.length, transactions, matchingEvents: found.length,
          responseDigest: await sha256Hex({ blocks: responseEvidence, matchingLogs: found }) } };
      }
    };
    return session;
  } };
}
