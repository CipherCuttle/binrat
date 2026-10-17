/** Dormant candidate proof budget. This does NOT create a live grant. */
export const POSITIVE_EVENT_BUDGET = Object.freeze({
  utcDayRequests: 100, setupSlots: 11, slotsPerCandidate: 6,
  setupModeledCu: 3809.12, cuPerCandidate: 400,
  grantModeledCu: 10000, maxCandidates: 12, maxHintRows: 32,
  lifetimeMs: 86_400_000, maxJobMs: 60_000,
  // These are models, NOT provider invoice guarantees.
  modeledUsdCeiling: 0.01
});
export const PROOF_METHOD_RESERVATIONS = Object.freeze([
  'eth_getBlockByNumber:latest',
  'eth_getBlockByNumber:finalized',
  'eth_getBlockByNumber:candidate',
  'eth_getLogs:exact-candidate',
  'eth_getBlockReceipts:exact-candidate',
  'eth_getBlockByNumber:candidate-recheck'
]);
export type BudgetQuote = { ok: boolean; reason: string;
  totalDailyRequests: number; grantModeledCu: number; plannedCandidates: number };
export function quotePositiveEventBudget(priorSharedDebits: number, candidates: number): BudgetQuote {
  if (!Number.isSafeInteger(priorSharedDebits) || priorSharedDebits < 0 || priorSharedDebits > 100 ||
    !Number.isSafeInteger(candidates) || candidates < 0 || candidates > POSITIVE_EVENT_BUDGET.maxCandidates) {
    return {ok:false,reason:'BAD_OR_EXCESSIVE_GRANT',totalDailyRequests:0,grantModeledCu:0,plannedCandidates:0};
  }
  const totalDailyRequests=priorSharedDebits+POSITIVE_EVENT_BUDGET.setupSlots+
    candidates*POSITIVE_EVENT_BUDGET.slotsPerCandidate;
  const grantModeledCu=POSITIVE_EVENT_BUDGET.setupModeledCu+
    candidates*POSITIVE_EVENT_BUDGET.cuPerCandidate;
  return {ok:totalDailyRequests<=POSITIVE_EVENT_BUDGET.utcDayRequests &&
    grantModeledCu<=POSITIVE_EVENT_BUDGET.grantModeledCu,
    reason:totalDailyRequests>100?'SHARED_DAILY_REQUEST_CAP':
      grantModeledCu>10000?'MODELED_CU_CAP':'WITHIN_MODEL_NOT_ACTUAL_BILLING',
    totalDailyRequests, grantModeledCu, plannedCandidates:candidates};
}
