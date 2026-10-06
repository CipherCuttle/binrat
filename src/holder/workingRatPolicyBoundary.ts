import type { PonsStakeReceipt } from './ponsStakeReader.js';

export type WorkingRatPolicyResult = 'NOT_CONFIGURED' | 'NOT_QUALIFIED' | 'QUALIFIED';

/** Policy boundary only: unresolved (null) thresholds can never be interpreted as zero. */
export function evaluateWorkingRatPolicy(
  stake: PonsStakeReceipt,
  workingRatMinStakeRaw: bigint | null
): WorkingRatPolicyResult {
  if (workingRatMinStakeRaw === null || workingRatMinStakeRaw <= 0n) return 'NOT_CONFIGURED';
  if (stake.status !== 'VERIFIED' || stake.freshness !== 'FRESH' || stake.authority !== 'CANONICAL_LAUNCH_BOUND' || stake.chainId !== 4663 || stake.stakedRaw === null || !/^(0|[1-9][0-9]*)$/.test(stake.stakedRaw)) return 'NOT_QUALIFIED';
  return BigInt(stake.stakedRaw) >= workingRatMinStakeRaw ? 'QUALIFIED' : 'NOT_QUALIFIED';
}
