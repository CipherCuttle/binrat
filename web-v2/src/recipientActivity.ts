import { publicApiUrl } from "./previewRuntime.js";

/**
 * Public Rat Radar recipient-activity transport boundary.
 * The backend remains evidence authority: these checks validate transport and
 * schema consistency, NOT a client-side cryptographic proof of provenance.
 * An observed swap recipient is never inferred to be an identified person.
 */
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const UNSIGNED = /^(0|[1-9][0-9]*)$/;
const SIGNED = /^(0|-?[1-9][0-9]*)$/;
const ERROR = 'RAT_RADAR_RECIPIENT_ACTIVITY_SCHEMA_INVALID';

type Json = Record<string, unknown>;
function fail(): never { throw new Error(ERROR); }
function object(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Json;
}
function string(value: unknown, pattern?: RegExp): string {
  if (typeof value !== 'string' || (pattern && !pattern.test(value))) return fail();
  return value;
}
function unsigned(value: unknown): string { return string(value, UNSIGNED); }
function signed(value: unknown): string { return string(value, SIGNED); }
function nonnegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return fail();
  return value;
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return fail();
  return value;
}

export interface PublicRadarActivity {
  schemaVersion: 'binrat.rat-radar-activity/0.1';
  version: 'binrat.rat-radar-swap/0.1';
  activityId: string;
  chainId: 5042;
  launchId: string;
  pool: string;
  token: string;
  token0: string;
  token1: string;
  blockNumber: string;
  blockHash: string;
  txHash: string;
  logIndex: number;
  sender: string;
  recipient: string;
  tokenSide: 'TOKEN0' | 'TOKEN1';
  amount0: string;
  amount1: string;
  sqrtPriceX96: string;
  liquidity: string;
  tick: number;
  launchedTokenDelta: string;
  launchedTokenFlow: 'POOL_TO_RECIPIENT' | 'CALLBACK_SIDE_TO_POOL' | 'ZERO_DELTA';
  evidenceDigest: string;
  identityBoundary: string;
}
export interface PublicRecipientActivity {
  schemaVersion: 'binrat.rat-radar-address-activity/0.1';
  chainId: 5042;
  asOfBlock: string;
  observedRecipientAddress: string;
  activityCount: number;
  activities: PublicRadarActivity[];
  identityBoundary: string;
}

/** Normalizes a response only after every record and its envelope pass. */
export function adaptPublicRecipientActivity(
  value: unknown, requestedAddress: string,
): PublicRecipientActivity {
  if (!ADDRESS.test(requestedAddress)) return fail();
  const envelope = object(value);
  if (envelope.schemaVersion !== 'binrat.rat-radar-address-activity/0.1' ||
      envelope.chainId !== 5042) return fail();
  const checkpoint = unsigned(envelope.asOfBlock);
  const recipient = string(envelope.observedRecipientAddress, ADDRESS).toLowerCase();
  if (recipient !== requestedAddress.toLowerCase()) return fail();
  const count = nonnegativeInteger(envelope.activityCount);
  if (!Array.isArray(envelope.activities) || envelope.activities.length !== count) return fail();
  const boundary = string(envelope.identityBoundary);
  if (!boundary.includes('not automatically a human trader identity')) return fail();
  const seen = new Set<string>();
  const activities = (envelope.activities as unknown[]).map((raw): PublicRadarActivity => {
    const record = object(raw);
    if (record.schemaVersion !== 'binrat.rat-radar-activity/0.1' ||
        record.version !== 'binrat.rat-radar-swap/0.1' ||
        record.chainId !== 5042) return fail();
    const activityId = string(record.activityId, DIGEST);
    const launchId = string(record.launchId, DIGEST);
    if (seen.has(activityId)) return fail();
    seen.add(activityId);
    const pool = string(record.pool, ADDRESS).toLowerCase();
    const token = string(record.token, ADDRESS).toLowerCase();
    const token0 = string(record.token0, ADDRESS).toLowerCase();
    const token1 = string(record.token1, ADDRESS).toLowerCase();
    if (token0 === token1) return fail();
    const expectedSide = token === token0 ? 'TOKEN0' : token === token1 ? 'TOKEN1' : null;
    if (record.tokenSide !== expectedSide || expectedSide === null) return fail();
    const blockNumber = unsigned(record.blockNumber);
    if (BigInt(blockNumber) > BigInt(checkpoint)) return fail();
    const blockHash = string(record.blockHash, HASH);
    const txHash = string(record.txHash, HASH);
    const logIndex = nonnegativeInteger(record.logIndex);
    const sender = string(record.sender, ADDRESS).toLowerCase();
    const recordRecipient = string(record.recipient, ADDRESS).toLowerCase();
    if (recordRecipient !== recipient) return fail();
    const amount0 = signed(record.amount0);
    const amount1 = signed(record.amount1);
    const sqrtPriceX96 = unsigned(record.sqrtPriceX96);
    const liquidity = unsigned(record.liquidity);
    const tick = integer(record.tick);
    const delta = signed(record.launchedTokenDelta);
    if (delta !== (expectedSide === 'TOKEN0' ? amount0 : amount1)) return fail();
    const expectedFlow = BigInt(delta) < 0n ? 'POOL_TO_RECIPIENT' :
      BigInt(delta) > 0n ? 'CALLBACK_SIDE_TO_POOL' : 'ZERO_DELTA';
    if (record.launchedTokenFlow !== expectedFlow) return fail();
    const evidenceDigest = string(record.evidenceDigest, DIGEST);
    const identityBoundary = string(record.identityBoundary);
    if (!identityBoundary.includes('not inferred human identities')) return fail();
    return {
      schemaVersion: 'binrat.rat-radar-activity/0.1',
      version: 'binrat.rat-radar-swap/0.1',
      activityId, chainId: 5042, launchId, pool, token, token0, token1,
      blockNumber, blockHash, txHash, logIndex, sender, recipient: recordRecipient,
      tokenSide: expectedSide, amount0, amount1, sqrtPriceX96, liquidity, tick,
      launchedTokenDelta: delta, launchedTokenFlow: expectedFlow, evidenceDigest,
      identityBoundary,
    };
  });
  return {
    schemaVersion: 'binrat.rat-radar-address-activity/0.1',
    chainId: 5042,
    asOfBlock: checkpoint,
    observedRecipientAddress: recipient,
    activityCount: count,
    activities,
    identityBoundary: boundary,
  };
}

/** No fixture fallback. A 404 is not conflated with an empty indexed response. */
export async function loadLiveRecipientActivity(
  requestedAddress: string,
  fetcher: typeof fetch = fetch,
): Promise<PublicRecipientActivity> {
  if (!ADDRESS.test(requestedAddress)) throw new Error('RAT_RADAR_RECIPIENT_INVALID');
  const response = await fetcher(
    publicApiUrl('/api/rat-radar/address/' + encodeURIComponent(requestedAddress.toLowerCase()) + '/activity'),
    { headers: { accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new Error('RAT_RADAR_RECIPIENT_ACTIVITY_UNAVAILABLE');
  return adaptPublicRecipientActivity(await response.json() as unknown, requestedAddress);
}
