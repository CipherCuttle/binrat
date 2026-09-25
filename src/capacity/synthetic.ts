import { createHmac, timingSafeEqual } from 'node:crypto';

// Synthetic-only provider contracts. None uses live credentials, chains, messages or payments.
export type WorkClass = 'PUBLIC_CACHED' | 'PUBLIC_MISS' | 'ACCOUNT' | 'PREMIUM';
export interface VirtualResult {
  kind: 'VIRTUAL_ONLY_NOT_WORKER_CAPACITY';
  requests: number;
  rps: number;
  seconds: number;
  lanes: number;
  cacheHitPct: number;
  serviceP95Ms: number;
  endToEndP95Ms: number;
  endToEndP99Ms: number;
  delayedRequests: number;
  maxWaitMs: number;
  cachedCandidateRequests: number;
  simulatedCacheHits: number;
  simulatedCacheMisses: number;
  candidateOnlyP95Ms: number;
  candidateOnlyP99Ms: number;
  distribution: Record<WorkClass, number>;
}
const work: readonly WorkClass[] = ['PUBLIC_CACHED', 'PUBLIC_MISS', 'ACCOUNT', 'PREMIUM'];
const weights = [70, 15, 10, 5] as const;
const services: Record<WorkClass, number> = {
  PUBLIC_CACHED: 7, PUBLIC_MISS: 38, ACCOUNT: 65, PREMIUM: 90
};
function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] ?? 0;
}
export function runVirtualLoad(rps: number, seconds: number, lanes: number, cacheHitPct: number): VirtualResult {
  for (const value of [rps, seconds, lanes, cacheHitPct]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('VIRTUAL_INPUT_INVALID');
  }
  if (!rps || !seconds || !lanes || rps > 1_000 || seconds > 3_600 || lanes > 2_000 || cacheHitPct > 100) {
    throw new Error('VIRTUAL_INPUT_OUT_OF_BOUNDS');
  }
  const ends = Array<number>(lanes).fill(0);
  const distribution = Object.fromEntries(work.map((kind) => [kind, 0])) as Record<WorkClass, number>;
  const latencies: number[] = [];
  const serviceTimes: number[] = [];
  let delayedRequests = 0;
  let maxWaitMs = 0;
  let simulatedCacheHits = 0;
  let simulatedCacheMisses = 0;
  const cachedCandidateLatencies: number[] = [];
  const count = rps * seconds;
  for (let i = 0; i < count; i++) {
    const arrival = (i * 1_000) / rps;
    const bucket = i % 100;
    const type = bucket < weights[0] ? work[0]! : bucket < 85 ? work[1]! : bucket < 95 ? work[2]! : work[3]!;
    distribution[type]++;
    // Cold-cache profiles replace intended cached hits with expensive indexed reads.
    const isCacheMiss = type === 'PUBLIC_CACHED' && (i * 37 % 100) >= cacheHitPct;
    if (type === 'PUBLIC_CACHED') {
      if (isCacheMiss) simulatedCacheMisses++;
      else simulatedCacheHits++;
    }
    const service = isCacheMiss ? services.PUBLIC_MISS : services[type];
    let lane = 0;
    for (let j = 1; j < lanes; j++) if (ends[j]! < ends[lane]!) lane = j;
    const start = Math.max(arrival, ends[lane]!);
    const completion = start + service;
    ends[lane] = completion;
    latencies.push(completion - arrival);
    serviceTimes.push(service);
    if (type === 'PUBLIC_CACHED') cachedCandidateLatencies.push(completion - arrival);
    if (start > arrival) delayedRequests++;
    maxWaitMs = Math.max(maxWaitMs, start - arrival);
  }
  latencies.sort((a, b) => a - b);
  serviceTimes.sort((a, b) => a - b);
  cachedCandidateLatencies.sort((a, b) => a - b);
  return {
    kind: 'VIRTUAL_ONLY_NOT_WORKER_CAPACITY',
    requests: count, rps, seconds, lanes, cacheHitPct,
    serviceP95Ms: percentile(serviceTimes, 0.95),
    endToEndP95Ms: percentile(latencies, 0.95),
    endToEndP99Ms: percentile(latencies, 0.99),
    delayedRequests, maxWaitMs,
    cachedCandidateRequests: cachedCandidateLatencies.length,
    simulatedCacheHits, simulatedCacheMisses,
    candidateOnlyP95Ms: percentile(cachedCandidateLatencies, 0.95),
    candidateOnlyP99Ms: percentile(cachedCandidateLatencies, 0.99),
    distribution
  };
}

export class FakeRpc {
  constructor(private mode: 'OK' | 'TIMEOUT' | '429' = 'OK') {}
  async getBlockHash(block: number): Promise<string> {
    if (this.mode === '429') throw Object.assign(new Error('RPC_429'), { status: 429 });
    if (this.mode === 'TIMEOUT') throw new Error('RPC_TIMEOUT');
    return '0x' + block.toString(16).padStart(64, '0');
  }
}
export class FakeD1 {
  private records = new Map<string, string>();
  failWrites = false;
  write(key: string, value: string): void {
    if (this.failWrites) throw new Error('D1_SYNTHETIC_WRITE_REJECTED');
    this.records.set(key, value);
  }
  get(key: string): string | undefined { return this.records.get(key); }
}
export class FakeImmutableReceipts {
  private receipts = new Map<string, string>();
  put(chainId: number, emitter: string, tx: string, logIndex: number, blockHash: string): 'INSERTED' | 'DUPLICATE' {
    const key = [chainId, emitter.toLowerCase(), tx.toLowerCase(), logIndex].join(':');
    const existing = this.receipts.get(key);
    if (existing && existing !== blockHash) throw new Error('REORG_IDENTITY_FENCE');
    if (existing) return 'DUPLICATE';
    this.receipts.set(key, blockHash);
    return 'INSERTED';
  }
  size(): number { return this.receipts.size; }
}

export class FakeTelegram {
  private sent = new Set<string>();
  private oneTime429 = new Set<string>();
  private attempts = new Map<string, number>();
  constructor(private readonly throttledKey?: string) {}
  send(key: string): 'SENT' | 'DUPLICATE' | 'RETRY_429' {
    this.attempts.set(key, (this.attempts.get(key) ?? 0) + 1);
    if (this.sent.has(key)) return 'DUPLICATE';
    if (key === this.throttledKey && !this.oneTime429.has(key)) {
      this.oneTime429.add(key);
      return 'RETRY_429';
    }
    this.sent.add(key);
    return 'SENT';
  }
  count(): number { return this.sent.size; }
  attemptsFor(key: string): number { return this.attempts.get(key) ?? 0; }
}
export function simulateFanout(subscribers: number, chainId = 4663): {
  unique: number; retries: number; drainSeconds: number; peakPerSecond: number; duplicateDeliveries: number
} {
  if (!Number.isSafeInteger(subscribers) || subscribers < 1 || subscribers > 100_000) throw new Error('FANOUT_INVALID');
  // 25 successful sends/sec is conservative vs standard Telegram bot rate. Each synthetic chat is distinct.
  const prefix = `${chainId}:event-synthetic:`;
  const throttled = prefix + 'chat-100';
  const sender = new FakeTelegram(throttled);
  const backlog = Array.from({ length: subscribers }, (_, i) => prefix + `chat-${i}`);
  let second = 0; let retries = 0; let duplicates = 0; let peak = 0;
  while (backlog.length > 0) {
    let delivered = 0;
    let tried = 0;
    // At most 25 successful deliveries and at most 25+one retry attempts per tick.
    while (backlog.length && delivered < 25 && tried < 26) {
      tried++;
      const key = backlog.shift()!;
      const outcome = sender.send(key);
      if (outcome === 'SENT') delivered++;
      else if (outcome === 'RETRY_429') { retries++; backlog.push(key); }
      else duplicates++;
    }
    peak = Math.max(peak, delivered);
    second++;
    if (second > 10_000) throw new Error('FANOUT_STALLED');
  }
  return { unique: sender.count(), retries, drainSeconds: second, peakPerSecond: peak, duplicateDeliveries: duplicates };
}

export class FakeAtomicQuota {
  private remaining: number;
  private keys = new Map<string, boolean>();
  private chain: Promise<unknown> = Promise.resolve();
  constructor(units: number) {
    if (!Number.isSafeInteger(units) || units < 0) throw new Error('QUOTA_INVALID');
    this.remaining = units;
  }
  reserve(key: string, units = 1): Promise<boolean> {
    const next = this.chain.then(() => {
      if (this.keys.has(key)) return this.keys.get(key)!;
      if (!Number.isSafeInteger(units) || units < 1 || this.remaining < units) {
        this.keys.set(key, false); return false;
      }
      this.remaining -= units;
      this.keys.set(key, true);
      return true;
    });
    this.chain = next.then(() => undefined, () => undefined);
    return next;
  }
  getRemaining(): number { return this.remaining; }
}
export interface FakePaymentEvent {
  id: string; account: string; revision: number; action: 'PAID' | 'REFUND' | 'CHARGEBACK';
}
export class FakeSignedPayment {
  private events = new Set<string>();
  private state = new Map<string, { revision: number; active: boolean }>();
  constructor(private readonly sandboxSecret: string) {}
  sign(payload: string): string { return createHmac('sha256', this.sandboxSecret).update(payload).digest('hex'); }
  receive(payload: string, signature: string): 'APPLIED' | 'REPLAY' | 'STALE' {
    const expected = this.sign(payload);
    if (!/^[0-9a-f]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw new Error('PAYMENT_SIGNATURE_INVALID');
    const item = JSON.parse(payload) as FakePaymentEvent;
    if (typeof item.id !== 'string' || typeof item.account !== 'string' || !Number.isSafeInteger(item.revision) ||
        !['PAID', 'REFUND', 'CHARGEBACK'].includes(item.action)) throw new Error('PAYMENT_PAYLOAD_INVALID');
    if (this.events.has(item.id)) return 'REPLAY';
    this.events.add(item.id);
    const previous = this.state.get(item.account);
    if (previous && item.revision <= previous.revision) return 'STALE';
    this.state.set(item.account, { revision: item.revision, active: item.action === 'PAID' });
    return 'APPLIED';
  }
  active(account: string): boolean { return this.state.get(account)?.active ?? false; }
}
