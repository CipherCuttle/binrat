import type { D1DatabaseLike } from '../cloudflare/d1Types.js';

// Isolated server-side research candidate: NOT imported by the Worker. OFF by default.
// Opening an account for real money requires separately authorized provider webhooks,
// merchant compliance, session binding and a fresh review.
export type ResearchChain = 5042 | 4663;
export type MeteredFeature = 'EXTENDED_RADAR' | 'DEEP_REPLAY' | 'PRO_ALERT';
export type ReservationState = 'RESERVED' | 'CONSUMED' | 'RELEASED' | 'REFUNDED';
export type ReserveResult = { outcome: 'RESERVED' | 'DUPLICATE' | 'EXHAUSTED'; state?: ReservationState };
export interface TestPeriod {
  accountId: string;
  periodId: string;
  fundingRef: string;
  globalCapUnits: number;
  arcCapUnits: number;
  ponsCapUnits: number;
  expiresAtMs: number;
}
export interface MeteredRequest {
  accountId: string;
  periodId: string;
  requestKey: string;
  chainId: ResearchChain;
  feature: MeteredFeature;
  units: number;
  nowMs: number;
}

interface ReservationRow {
  account_id: string;
  period_id: string;
  request_key: string;
  chain_id: number;
  cost_class: string;
  units: number;
  state: ReservationState;
}
type LedgerOptions = { enabled?: boolean; allowOfflineFixtures?: boolean };
function safeId(id: string, name: string): void {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_:/.-]{1,128}$/.test(id)) throw new Error(name + '_INVALID');
}
function safeUnits(units: number, allowZero = false): void {
  if (!Number.isSafeInteger(units) || units < (allowZero ? 0 : 1) || units > 1_000_000) {
    throw new Error('ENTITLEMENT_UNITS_INVALID');
  }
}
function safeNow(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000_000) {
    throw new Error('ENTITLEMENT_CLOCK_INVALID');
  }
}
function written(n: unknown): boolean { return n === 1; }

export class D1EntitlementsCandidate {
  private readonly enabled: boolean;
  private readonly fixtures: boolean;
  constructor(private readonly db: D1DatabaseLike, options: LedgerOptions = {}) {
    this.enabled = options.enabled === true;
    this.fixtures = options.allowOfflineFixtures === true;
  }

  // Only offline fixtures can create a period in this slice. No wallet token,
  // hosted checkout return URL, unsigned webhook or test fixture opens Pro.
  async openOfflinePeriod(input: TestPeriod): Promise<'CREATED' | 'DUPLICATE'> {
    if (!this.enabled || !this.fixtures) throw new Error('ENTITLEMENT_OFFLINE_GRANTS_DISABLED');
    for (const [value, key] of [[input.accountId,'ACCOUNT'],[input.periodId,'PERIOD'],
      [input.fundingRef,'FUNDING']] as const) safeId(value,key);
    [input.globalCapUnits,input.arcCapUnits,input.ponsCapUnits].forEach(n=>safeUnits(n,true));
    safeNow(input.expiresAtMs);
    if (input.expiresAtMs === 0) throw new Error('ENTITLEMENT_EXPIRY_INVALID');
    const result = await this.db.prepare(
      'INSERT OR IGNORE INTO candidate_entitlement_periods ' +
      '(account_id,period_id,funding_source,funding_ref,global_cap_units,arc_cap_units,pons_cap_units,expires_at_ms,state) ' +
      "VALUES (?,?,'OFFLINE_FIXTURE',?,?,?,?,?,'ACTIVE')"
    ).bind(input.accountId,input.periodId,input.fundingRef,input.globalCapUnits,
      input.arcCapUnits,input.ponsCapUnits,input.expiresAtMs).run();
    if (written(result.meta?.changes)) return 'CREATED';
    const existing = await this.db.prepare(
      'SELECT * FROM candidate_entitlement_periods WHERE account_id=? AND period_id=?'
    ).bind(input.accountId,input.periodId).first<Record<string,unknown>>();
    if (!existing ||
      existing.funding_ref !== input.fundingRef ||
      existing.funding_source !== 'OFFLINE_FIXTURE' ||
      existing.global_cap_units !== input.globalCapUnits ||
      existing.arc_cap_units !== input.arcCapUnits ||
      existing.pons_cap_units !== input.ponsCapUnits ||
      existing.expires_at_ms !== input.expiresAtMs) {
      throw new Error('ENTITLEMENT_FUNDING_IDENTITY_CONFLICT');
    }
    return 'DUPLICATE';
  }

  private async existing(input: MeteredRequest): Promise<ReservationRow | null> {
    return this.db.prepare(
      'SELECT account_id,period_id,request_key,chain_id,cost_class,units,state ' +
      'FROM candidate_entitlement_reservations WHERE account_id=? AND period_id=? AND request_key=?'
    ).bind(input.accountId,input.periodId,input.requestKey).first<ReservationRow>();
  }
  private assertMatch(old: ReservationRow, input: MeteredRequest): void {
    if (old.chain_id !== input.chainId || old.cost_class !== input.feature || old.units !== input.units) {
      throw new Error('ENTITLEMENT_IDEMPOTENCY_CONFLICT');
    }
    if (old.state === 'REFUNDED' || old.state === 'RELEASED') {
      throw new Error('ENTITLEMENT_FINAL_REQUEST_KEY');
    }
  }

  async reserve(input: MeteredRequest): Promise<ReserveResult> {
    if (!this.enabled) throw new Error('ENTITLEMENTS_DISABLED');
    safeId(input.accountId,'ACCOUNT'); safeId(input.periodId,'PERIOD');
    safeId(input.requestKey,'REQUEST'); safeUnits(input.units); safeNow(input.nowMs);
    if (input.chainId !== 5042 && input.chainId !== 4663) throw new Error('ENTITLEMENT_CHAIN_UNSUPPORTED');
    if (!['EXTENDED_RADAR','DEEP_REPLAY','PRO_ALERT'].includes(input.feature)) {
      throw new Error('ENTITLEMENT_CLASS_UNSUPPORTED');
    }
    const old = await this.existing(input);
    if (old) { this.assertMatch(old,input); return {outcome:'DUPLICATE',state:old.state}; }
    // A single conditional SQLite write is the quota admission point. Both
    // cross-chain and per-chain sums count RESERVED + CONSUMED, never refunded
    // or released. Do not split capacity read and insert into two requests.
    const sql =
      'INSERT OR IGNORE INTO candidate_entitlement_reservations ' +
      '(account_id,period_id,request_key,chain_id,cost_class,units,state,created_at_ms,updated_at_ms) ' +
      "SELECT ?,?,?,?,?,?,'RESERVED',?,? " +
      'FROM candidate_entitlement_periods p WHERE p.account_id=? AND p.period_id=? ' +
      "AND p.state='ACTIVE' AND p.expires_at_ms>? " +
      "AND p.global_cap_units >= ? + COALESCE((SELECT SUM(r.units) FROM candidate_entitlement_reservations r " +
      "WHERE r.account_id=p.account_id AND r.period_id=p.period_id AND r.state IN ('RESERVED','CONSUMED')),0) " +
      "AND (CASE WHEN ?=5042 THEN p.arc_cap_units ELSE p.pons_cap_units END) >= ? + " +
      "COALESCE((SELECT SUM(r.units) FROM candidate_entitlement_reservations r " +
      "WHERE r.account_id=p.account_id AND r.period_id=p.period_id AND r.chain_id=? " +
      "AND r.state IN ('RESERVED','CONSUMED')),0)";
    const result = await this.db.prepare(sql).bind(
      input.accountId,input.periodId,input.requestKey,input.chainId,input.feature,
      input.units,input.nowMs,input.nowMs,
      input.accountId,input.periodId,input.nowMs,
      input.units,input.chainId,input.units,input.chainId
    ).run();
    if (written(result.meta?.changes)) return {outcome:'RESERVED',state:'RESERVED'};
    // Recheck duplicate after the contested write: same key concurrent calls
    // cannot silently double-debit, and conflicting parameters fail closed.
    const raced = await this.existing(input);
    if (raced) { this.assertMatch(raced,input); return {outcome:'DUPLICATE',state:raced.state}; }
    return {outcome:'EXHAUSTED'};
  }

  async consume(input: MeteredRequest): Promise<'CONSUMED' | 'DUPLICATE'> {
    if (!this.enabled) throw new Error('ENTITLEMENTS_DISABLED');
    safeNow(input.nowMs);
    const result=await this.db.prepare(
      "UPDATE candidate_entitlement_reservations SET state='CONSUMED',updated_at_ms=? " +
      "WHERE account_id=? AND period_id=? AND request_key=? AND chain_id=? AND cost_class=? AND units=? " +
      "AND state='RESERVED' AND EXISTS (SELECT 1 FROM candidate_entitlement_periods p " +
      "WHERE p.account_id=? AND p.period_id=? AND p.state='ACTIVE' AND p.expires_at_ms>?)"
    ).bind(input.nowMs,input.accountId,input.periodId,input.requestKey,input.chainId,input.feature,
      input.units,input.accountId,input.periodId,input.nowMs).run();
    if (written(result.meta?.changes)) return 'CONSUMED';
    const old=await this.existing(input);
    if (old) {
      this.assertMatch(old,input);
      if (old.state==='CONSUMED') return 'DUPLICATE';
    }
    throw new Error('ENTITLEMENT_CONSUME_DENIED');
  }

  async release(input: MeteredRequest): Promise<boolean> {
    if (!this.enabled) throw new Error('ENTITLEMENTS_DISABLED');
    safeNow(input.nowMs);
    const result=await this.db.prepare(
      "UPDATE candidate_entitlement_reservations SET state='RELEASED',updated_at_ms=? " +
      "WHERE account_id=? AND period_id=? AND request_key=? AND chain_id=? AND cost_class=? AND units=? " +
      "AND state='RESERVED'"
    ).bind(input.nowMs,input.accountId,input.periodId,input.requestKey,input.chainId,input.feature,input.units).run();
    return written(result.meta?.changes);
  }

  async refundConsumed(input: MeteredRequest): Promise<boolean> {
    if (!this.enabled) throw new Error('ENTITLEMENTS_DISABLED');
    safeNow(input.nowMs);
    const result=await this.db.prepare(
      "UPDATE candidate_entitlement_reservations SET state='REFUNDED',updated_at_ms=? " +
      "WHERE account_id=? AND period_id=? AND request_key=? AND chain_id=? AND cost_class=? AND units=? " +
      "AND state='CONSUMED'"
    ).bind(input.nowMs,input.accountId,input.periodId,input.requestKey,input.chainId,input.feature,input.units).run();
    return written(result.meta?.changes);
  }

  async revokePeriod(accountId: string, periodId: string): Promise<boolean> {
    if (!this.enabled) throw new Error('ENTITLEMENTS_DISABLED');
    safeId(accountId,'ACCOUNT');safeId(periodId,'PERIOD');
    const r=await this.db.prepare(
      "UPDATE candidate_entitlement_periods SET state='REVOKED' " +
      "WHERE account_id=? AND period_id=? AND state='ACTIVE'"
    ).bind(accountId,periodId).run();
    return written(r.meta?.changes);
  }

  async balance(accountId: string, periodId: string): Promise<{
    active: boolean; globalAvailable: number; arcAvailable: number; ponsAvailable: number
  }> {
    if (!this.enabled) throw new Error('ENTITLEMENTS_DISABLED');
    safeId(accountId,'ACCOUNT');safeId(periodId,'PERIOD');
    const r=await this.db.prepare(
      'SELECT p.state,p.expires_at_ms,p.global_cap_units,p.arc_cap_units,p.pons_cap_units, ' +
      "COALESCE(SUM(CASE WHEN r.state IN ('RESERVED','CONSUMED') THEN r.units ELSE 0 END),0) AS spent, " +
      "COALESCE(SUM(CASE WHEN r.state IN ('RESERVED','CONSUMED') AND r.chain_id=5042 THEN r.units ELSE 0 END),0) AS arc_spent, " +
      "COALESCE(SUM(CASE WHEN r.state IN ('RESERVED','CONSUMED') AND r.chain_id=4663 THEN r.units ELSE 0 END),0) AS pons_spent " +
      'FROM candidate_entitlement_periods p LEFT JOIN candidate_entitlement_reservations r ' +
      'ON r.account_id=p.account_id AND r.period_id=p.period_id ' +
      'WHERE p.account_id=? AND p.period_id=? GROUP BY p.account_id,p.period_id'
    ).bind(accountId,periodId).first<Record<string,number|string>>();
    if (!r) return {active:false,globalAvailable:0,arcAvailable:0,ponsAvailable:0};
    // Caller must also check expiry before granting work. balance is diagnostic,
    // not an authority decision; reserve() itself checks server-side expiry.
    if (r.state!=='ACTIVE') return {active:false,globalAvailable:0,arcAvailable:0,ponsAvailable:0};
    return {
      active:true,
      globalAvailable:Math.max(0,Number(r.global_cap_units)-Number(r.spent)),
      arcAvailable:Math.max(0,Number(r.arc_cap_units)-Number(r.arc_spent)),
      ponsAvailable:Math.max(0,Number(r.pons_cap_units)-Number(r.pons_spent))
    };
  }
}
