import type { PonsStakeReceipt } from './ponsStakeReader.js';

export type WorkingRatPolicyResult = 'NOT_CONFIGURED' | 'NOT_QUALIFIED' | 'QUALIFIED';

/** Policy boundary only: unresolved (null) thresholds can never be interpreted as zero. */
export function evaluateWorkingRatPolicy(
  stake: PonsStakeReceipt,
  workingRatMinStakeRaw: bigint | null
): WorkingRatPolicyResult {
  if (workingRatMinStakeRaw === null || workingRatMinStakeRaw <= 0n) return 'NOT_CONFIGURED';
  if (stake.status !== 'VERIFIED' || stake.stakedRaw === null) return 'NOT_QUALIFIED';
  return BigInt(stake.stakedRaw) >= workingRatMinStakeRaw ? 'QUALIFIED' : 'NOT_QUALIFIED';
}
