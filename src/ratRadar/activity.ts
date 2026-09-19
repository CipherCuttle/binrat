import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import type { Hex } from '../core/types.js';

export const RAT_RADAR_SWAP_VERSION = 'binrat.rat-radar-swap/0.1' as const;

export type RatRadarTokenSide = 'TOKEN0' | 'TOKEN1';
export type RatRadarLaunchedTokenFlow = 'POOL_TO_RECIPIENT' | 'CALLBACK_SIDE_TO_POOL' | 'ZERO_DELTA';

export interface RatRadarSwapInput {
  chainId: number;
  launchId: string;
  pool: Hex;
  token: Hex;
  token0: Hex;
  token1: Hex;
  blockNumber: bigint;
  blockHash: Hex;
  txHash: Hex;
  logIndex: number;
  sender: Hex;
  recipient: Hex;
  amount0: bigint;
  amount1: bigint;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tick: number;
}

export interface RatRadarSwapReceipt extends RatRadarSwapInput {
  version: typeof RAT_RADAR_SWAP_VERSION;
  activityId: string;
  tokenSide: RatRadarTokenSide;
  launchedTokenDelta: bigint;
  launchedTokenFlow: RatRadarLaunchedTokenFlow;
  evidenceDigest: string;
}

export async function deriveRatRadarSwapReceipt(
  input: RatRadarSwapInput
): Promise<RatRadarSwapReceipt> {
  if (!Number.isInteger(input.chainId) || input.chainId <= 0) throw new Error('RAT_RADAR_CHAIN_INVALID');
  if (!input.launchId) throw new Error('RAT_RADAR_LAUNCH_ID_REQUIRED');
  if (!Number.isSafeInteger(input.logIndex) || input.logIndex < 0) throw new Error('RAT_RADAR_LOG_INDEX_INVALID');
  if (!Number.isSafeInteger(input.tick)) throw new Error('RAT_RADAR_TICK_INVALID');
  if (input.blockNumber < 0n) throw new Error('RAT_RADAR_BLOCK_INVALID');
  if (input.sqrtPriceX96 < 0n || input.liquidity < 0n) throw new Error('RAT_RADAR_POOL_STATE_INVALID');

  const normalized: RatRadarSwapInput = {
    ...input,
    pool: normalizeHex(input.pool),
    token: normalizeHex(input.token),
    token0: normalizeHex(input.token0),
    token1: normalizeHex(input.token1),
    blockHash: normalizeHex(input.blockHash),
    txHash: normalizeHex(input.txHash),
    sender: normalizeHex(input.sender),
    recipient: normalizeHex(input.recipient)
  };
  if (normalized.token0 === normalized.token1) throw new Error('RAT_RADAR_POOL_TOKENS_INVALID');
  const tokenSide: RatRadarTokenSide =
    normalized.token === normalized.token0
      ? 'TOKEN0'
      : normalized.token === normalized.token1
        ? 'TOKEN1'
        : (() => { throw new Error('RAT_RADAR_TOKEN_NOT_IN_POOL'); })();
  const launchedTokenDelta = tokenSide === 'TOKEN0' ? normalized.amount0 : normalized.amount1;
  const launchedTokenFlow: RatRadarLaunchedTokenFlow =
    launchedTokenDelta < 0n
      ? 'POOL_TO_RECIPIENT'
      : launchedTokenDelta > 0n
        ? 'CALLBACK_SIDE_TO_POOL'
        : 'ZERO_DELTA';

  const activityId = await sha256Hex({
    kind: 'BINRAT_RAT_RADAR_SWAP_V0',
    chainId: normalized.chainId,
    pool: normalized.pool,
    txHash: normalized.txHash,
    logIndex: normalized.logIndex
  });

  const authority = {
    version: RAT_RADAR_SWAP_VERSION,
    activityId,
    ...normalized,
    tokenSide,
    launchedTokenDelta,
    launchedTokenFlow
  };
  const evidenceDigest = await sha256Hex(authority);

  return { ...authority, evidenceDigest };
}

export function sameRatRadarSwapReceipt(a: RatRadarSwapReceipt, b: RatRadarSwapReceipt): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

function normalizeHex(value: Hex): Hex {
  return value.toLowerCase() as Hex;
}
