import { createHash } from 'node:crypto';
import type { D1DatabaseLike } from '../cloudflare/d1Types.js';

const PROVIDER = 'OFFLINE_SIGNED_FIXTURE' as const;
const actions = ['AUTHORIZED', 'REFUNDED', 'CHARGEBACK', 'REVOKED'] as const;
type FundingAction = typeof actions[number];
type Verifier = (rawPayload: string, signature: string) => boolean | Promise<boolean>;
type Options = {
  enabled?: boolean;
  allowSignedFixtures?: boolean;
  now?: () => number;
  verify?: Verifier;
};
type FundingPayload = {
  provider: typeof PROVIDER;
  eventId: string;
  fundingRef: string;
  accountId: string;
  periodId: string;
  revision: number;
  action: FundingAction;
  occurredAtMs: number;
};
type FundingRow = {
  event_id: string;
  provider: string;
  funding_ref: string;
  account_id: string;
  period_id: string;
  revision: number;
  action: FundingAction;
  payload_sha256: string;
  occurred_at_ms: number;
  received_at_ms: number;
};

function safeId(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_:/.-]{1,128}$/.test(value)) {
    throw new Error('FUNDING_' + name + '_INVALID');
  }
}
function safeClock(value: unknown, name: string): asserts value is number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 8_640_000_000_000_000) {
    throw new Error('FUNDING_' + name + '_INVALID');
  }
}
function parsePayload(raw: string): FundingPayload {
  if (typeof raw !== 'string' || raw.length < 2 || raw.length > 4096) throw new Error('FUNDING_PAYLOAD_INVALID');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('FUNDING_PAYLOAD_INVALID'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('FUNDING_PAYLOAD_INVALID');
  const item = value as Record<string, unknown>;
  const expected = ['accountId','action','eventId','fundingRef','occurredAtMs','periodId','provider','revision'];
  if (Object.keys(item).sort().join(',') !== expected.join(',')) throw new Error('FUNDING_PAYLOAD_FIELDS_INVALID');
  if (item.provider !== PROVIDER) throw new Error('FUNDING_PROVIDER_UNSUPPORTED');
  safeId(item.eventId, 'EVENT_ID'); safeId(item.fundingRef, 'REF');
  safeId(item.accountId, 'ACCOUNT'); safeId(item.periodId, 'PERIOD');
  if (!Number.isSafeInteger(item.revision) || Number(item.revision) < 1 || Number(item.revision) > 1_000_000) {
    throw new Error('FUNDING_REVISION_INVALID');
  }
  if (!actions.includes(item.action as FundingAction)) throw new Error('FUNDING_ACTION_INVALID');
  safeClock(item.occurredAtMs, 'OCCURRED_AT');
  return item as FundingPayload;
}
const digest = (raw: string) => createHash('sha256').update(raw).digest('hex');
const same = (row: FundingRow, item: FundingPayload, hash: string) =>
  row.event_id === item.eventId && row.provider === item.provider && row.funding_ref === item.fundingRef &&
  row.account_id === item.accountId && row.period_id === item.periodId && row.revision === item.revision &&
  row.action === item.action && row.occurred_at_ms === item.occurredAtMs && row.payload_sha256 === hash;

/**
 * Disabled provider-event receipt candidate. It records only signed offline
 * fixtures and deliberately cannot open, extend or refund a quota period.
 */
export class D1FundingEventCandidate {
  private readonly enabled: boolean;
  private readonly fixtures: boolean;
  private readonly now: () => number;
  private readonly verify?: Verifier;
  constructor(private readonly db: D1DatabaseLike, options: Options = {}) {
    this.enabled = options.enabled === true;
    this.fixtures = options.allowSignedFixtures === true;
    this.now = options.now ?? Date.now;
    this.verify = options.verify;
  }

  async record(rawPayload: string, signature: string): Promise<'APPLIED' | 'REPLAY' | 'STALE_RECORDED'> {
    if (!this.enabled || !this.fixtures || !this.verify) throw new Error('FUNDING_EVENTS_DISABLED');
    if (typeof rawPayload !== 'string' || rawPayload.length < 2 || rawPayload.length > 4096 ||
        typeof signature !== 'string' || signature.length < 1 || signature.length > 1024) {
      throw new Error('FUNDING_ENVELOPE_BOUNDS');
    }
    const verified = await this.verify(rawPayload, signature);
    if (verified !== true) throw new Error('FUNDING_SIGNATURE_INVALID');
    const item = parsePayload(rawPayload);
    const now = this.now(); safeClock(now, 'CLOCK');
    const hash = digest(rawPayload);
    const result = await this.db.prepare(
      'INSERT OR IGNORE INTO candidate_entitlement_funding_events ' +
      '(event_id,provider,funding_ref,account_id,period_id,revision,action,payload_sha256,occurred_at_ms,received_at_ms) ' +
      'SELECT ?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (' +
      'SELECT 1 FROM candidate_entitlement_funding_events WHERE provider=? AND funding_ref=? ' +
      'AND (account_id<>? OR period_id<>?))'
    ).bind(item.eventId,item.provider,item.fundingRef,item.accountId,item.periodId,item.revision,
      item.action,hash,item.occurredAtMs,now,
      item.provider,item.fundingRef,item.accountId,item.periodId).run();
    if (result.meta?.changes !== 1) {
      const byId = await this.db.prepare(
        'SELECT * FROM candidate_entitlement_funding_events WHERE event_id=?'
      ).bind(item.eventId).first<FundingRow>();
      if (byId) {
        if (!same(byId,item,hash)) throw new Error('FUNDING_EVENT_ID_CONFLICT');
        return 'REPLAY';
      }
      const sameRevision = await this.db.prepare(
        'SELECT * FROM candidate_entitlement_funding_events WHERE provider=? AND funding_ref=? AND revision=?'
      ).bind(item.provider,item.fundingRef,item.revision).first<FundingRow>();
      if (sameRevision) throw new Error('FUNDING_REVISION_CONFLICT');
      const identity = await this.db.prepare(
        'SELECT account_id,period_id FROM candidate_entitlement_funding_events WHERE provider=? AND funding_ref=? LIMIT 1'
      ).bind(item.provider,item.fundingRef).first<{account_id:string;period_id:string}>();
      if (identity && (identity.account_id !== item.accountId || identity.period_id !== item.periodId)) {
        throw new Error('FUNDING_IDENTITY_CONFLICT');
      }
      throw new Error('FUNDING_EVENT_WRITE_REJECTED');
    }
    const latest = await this.db.prepare(
      'SELECT * FROM candidate_entitlement_funding_events WHERE provider=? AND funding_ref=? ' +
      'ORDER BY revision DESC LIMIT 1'
    ).bind(item.provider,item.fundingRef).first<FundingRow>();
    return latest?.event_id === item.eventId ? 'APPLIED' : 'STALE_RECORDED';
  }

  async status(fundingRef: string): Promise<{
    known: boolean; action: FundingAction | null; revision: number | null; grantAuthority: false
  }> {
    if (!this.enabled) throw new Error('FUNDING_EVENTS_DISABLED');
    safeId(fundingRef, 'REF');
    const row = await this.db.prepare(
      'SELECT action,revision FROM candidate_entitlement_funding_events WHERE provider=? AND funding_ref=? ' +
      'ORDER BY revision DESC LIMIT 1'
    ).bind(PROVIDER,fundingRef).first<{action:FundingAction;revision:number}>();
    return row ? {known:true,action:row.action,revision:row.revision,grantAuthority:false} :
      {known:false,action:null,revision:null,grantAuthority:false};
  }
}
