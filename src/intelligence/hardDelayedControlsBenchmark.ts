import {
  evaluateLaunchPressure,
  type LaunchPressureInput,
  type LaunchPressureSignalKind,
  type LaunchPressureState
} from './launchPressure.js';

export const HARD_DELAYED_CONTROLS_VERSION = 'BINRAT_HARD_DELAYED_CONTROLS_V1' as const;

export type HardDelayedOutcome =
  | {
      kind: 'HISTORICAL_LAUNCH';
      launchOn: string;
      sourceRef: string;
    }
  | {
      kind: 'UNRESOLVED';
      observedThrough: string;
      sourceRef: string;
    };

export interface HardDelayedControl {
  projectId: string;
  targetLabel: string;
  triggerOn: string;
  pressure: LaunchPressureInput;
  outcome: HardDelayedOutcome;
  notes: string;
}

export interface HardDelayedControlResult {
  projectId: string;
  targetLabel: string;
  triggerOn: string;
  state: LaunchPressureState;
  activeFamilies60d: LaunchPressureSignalKind[];
  outcomeKind: HardDelayedOutcome['kind'];
  lagDays: number;
}

export interface HardDelayedControlsReport {
  version: typeof HARD_DELAYED_CONTROLS_VERSION;
  targetCount: number;
  admittedCount: number;
  targetMet: boolean;
  historicalCount: number;
  unresolvedCount: number;
  minLagDays: number | null;
  medianLagDays: number | null;
  maxLagDays: number | null;
  stateCounts: Record<LaunchPressureState, number>;
  familyCombinationCounts: Record<string, number>;
  results: HardDelayedControlResult[];
}

export function runHardDelayedControlsBenchmark(
  controls: readonly HardDelayedControl[],
  targetCount = 10
): HardDelayedControlsReport {
  if (!Number.isInteger(targetCount) || targetCount < 1) {
    throw new Error('HARD_DELAYED_TARGET_COUNT_INVALID');
  }

  validateUniqueIds(controls);

  const results = controls.map((control) => evaluateControl(control));
  const lags = results.map((row) => row.lagDays).sort((a, b) => a - b);

  const stateCounts: Record<LaunchPressureState, number> = {
    BUILDING: 0,
    HARDENING: 0,
    PRODUCTION_PREP: 0,
    ARMED: 0
  };
  const familyCombinationCounts: Record<string, number> = {};

  for (const row of results) {
    stateCounts[row.state] += 1;
    const key = row.activeFamilies60d.join('+');
    familyCombinationCounts[key] = (familyCombinationCounts[key] ?? 0) + 1;
  }

  return {
    version: HARD_DELAYED_CONTROLS_VERSION,
    targetCount,
    admittedCount: results.length,
    targetMet: results.length >= targetCount,
    historicalCount: results.filter((row) => row.outcomeKind === 'HISTORICAL_LAUNCH').length,
    unresolvedCount: results.filter((row) => row.outcomeKind === 'UNRESOLVED').length,
    minLagDays: lags.length === 0 ? null : lags[0]!,
    medianLagDays: median(lags),
    maxLagDays: lags.length === 0 ? null : lags[lags.length - 1]!,
    stateCounts,
    familyCombinationCounts,
    results
  };
}

function evaluateControl(control: HardDelayedControl): HardDelayedControlResult {
  if (control.pressure.projectId !== control.projectId) {
    throw new Error('HARD_DELAYED_PROJECT_ID_MISMATCH');
  }
  if (!control.targetLabel.trim()) throw new Error('HARD_DELAYED_TARGET_LABEL_REQUIRED');
  if (!control.notes.trim()) throw new Error('HARD_DELAYED_NOTES_REQUIRED');

  const triggerMs = parseIsoDay(control.triggerOn, 'HARD_DELAYED_TRIGGER_INVALID');

  for (const receipt of control.pressure.receipts) {
    const receiptMs = parseIsoDay(receipt.observedOn, 'HARD_DELAYED_RECEIPT_DATE_INVALID');
    if (receiptMs > triggerMs) {
      throw new Error('HARD_DELAYED_FUTURE_RECEIPT');
    }
  }

  const pressure = evaluateLaunchPressure(control.pressure, control.triggerOn);
  if (pressure.state !== 'PRODUCTION_PREP' && pressure.state !== 'ARMED') {
    throw new Error('HARD_DELAYED_NOT_PRESSURE_IMMINENT');
  }

  const lagDays = outcomeLagDays(control.outcome, triggerMs);
  if (lagDays < 90) throw new Error('HARD_DELAYED_LT_90_DAYS');

  const activeFamilies60d = pressure.active60d
    .map((signal) => signal.kind)
    .sort();

  return {
    projectId: control.projectId,
    targetLabel: control.targetLabel,
    triggerOn: control.triggerOn,
    state: pressure.state,
    activeFamilies60d,
    outcomeKind: control.outcome.kind,
    lagDays
  };
}

function outcomeLagDays(outcome: HardDelayedOutcome, triggerMs: number): number {
  if (!outcome.sourceRef.trim()) throw new Error('HARD_DELAYED_OUTCOME_SOURCE_REQUIRED');

  const outcomeDay = outcome.kind === 'HISTORICAL_LAUNCH'
    ? outcome.launchOn
    : outcome.observedThrough;

  const outcomeMs = parseIsoDay(outcomeDay, 'HARD_DELAYED_OUTCOME_DATE_INVALID');
  if (outcomeMs <= triggerMs) throw new Error('HARD_DELAYED_OUTCOME_NOT_AFTER_TRIGGER');

  return Math.floor((outcomeMs - triggerMs) / 86_400_000);
}

function validateUniqueIds(controls: readonly HardDelayedControl[]): void {
  const ids = new Set<string>();
  for (const control of controls) {
    if (ids.has(control.projectId)) throw new Error('HARD_DELAYED_DUPLICATE_PROJECT');
    ids.add(control.projectId);
  }
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[middle]!;
  return (values[middle - 1]! + values[middle]!) / 2;
}

function parseIsoDay(value: string, error: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(error);
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new Error(error);
  }
  return parsed;
}
