import {
  evaluateLaunchPressure,
  type LaunchPressureInput,
  type LaunchPressureSignalKind,
  type LaunchPressureState
} from './launchPressure.js';

export const HARD_DELAYED_CONTROLS_VERSION = 'BINRAT_HARD_DELAYED_CONTROLS_V1' as const;

export type HardControlOutcome = 'LATER_LAUNCH' | 'STILL_UNLAUNCHED';
export type HardControlScope = 'NETWORK_MAINNET' | 'NETWORK_UPGRADE' | 'PROTOCOL_V2';

export interface HardDelayedControl {
  projectId: string;
  cutoffOn: string;
  observedThrough: string;
  outcome: HardControlOutcome;
  launchOn?: string;
  scope: HardControlScope;
  evidenceReason: string;
  outcomeSourceRef: string;
  pressure: LaunchPressureInput;
}

export interface HardDelayedControlRow {
  projectId: string;
  cutoffOn: string;
  observedThrough: string;
  outcome: HardControlOutcome;
  scope: HardControlScope;
  state: LaunchPressureState;
  active60dFamilies: LaunchPressureSignalKind[];
  familyKey: string;
  delayDaysLowerBound: number;
}

export interface HardDelayedControlsReport {
  version: typeof HARD_DELAYED_CONTROLS_VERSION;
  counterexampleCount: number;
  laterLaunchCount: number;
  stillUnlaunchedCount: number;
  minDelayDaysLowerBound: number;
  medianDelayDaysLowerBound: number;
  maxDelayDaysLowerBound: number;
  familyHistogram: Record<string, number>;
  rows: HardDelayedControlRow[];
}

/**
 * Adversarial counterexample benchmark.
 *
 * This is deliberately NOT a population false-positive-rate estimate. Every
 * admitted row is selected because frozen Pressure V0 is already positive at T,
 * then reality supplies >=90 days of subsequent non-launch evidence.
 */
export function runHardDelayedControls(
  controls: readonly HardDelayedControl[]
): HardDelayedControlsReport {
  if (controls.length < 1) throw new Error('HARD_CONTROL_REQUIRED');
  assertUniqueIds(controls);

  const rows = controls.map(validateAndScore);
  const delays = rows.map((row) => row.delayDaysLowerBound).sort((a, b) => a - b);
  const familyHistogram: Record<string, number> = {};

  for (const row of rows) {
    familyHistogram[row.familyKey] = (familyHistogram[row.familyKey] ?? 0) + 1;
  }

  return {
    version: HARD_DELAYED_CONTROLS_VERSION,
    counterexampleCount: rows.length,
    laterLaunchCount: rows.filter((row) => row.outcome === 'LATER_LAUNCH').length,
    stillUnlaunchedCount: rows.filter((row) => row.outcome === 'STILL_UNLAUNCHED').length,
    minDelayDaysLowerBound: delays[0]!,
    medianDelayDaysLowerBound: median(delays),
    maxDelayDaysLowerBound: delays[delays.length - 1]!,
    familyHistogram,
    rows
  };
}

function validateAndScore(control: HardDelayedControl): HardDelayedControlRow {
  if (control.pressure.projectId !== control.projectId) {
    throw new Error('HARD_CONTROL_PROJECT_ID_MISMATCH');
  }
  if (!control.evidenceReason.trim()) throw new Error('HARD_CONTROL_REASON_REQUIRED');
  if (!control.outcomeSourceRef.trim()) throw new Error('HARD_CONTROL_OUTCOME_SOURCE_REQUIRED');

  const cutoffMs = parseIsoDay(control.cutoffOn, 'HARD_CONTROL_CUTOFF_INVALID');
  const observedThroughMs = parseIsoDay(
    control.observedThrough,
    'HARD_CONTROL_OBSERVED_THROUGH_INVALID'
  );
  if (observedThroughMs < cutoffMs) throw new Error('HARD_CONTROL_OBSERVATION_ORDER_INVALID');

  if (control.pressure.receipts.some((receipt) =>
    parseIsoDay(receipt.observedOn, 'HARD_CONTROL_RECEIPT_DATE_INVALID') > cutoffMs
  )) {
    throw new Error('HARD_CONTROL_FUTURE_RECEIPT');
  }

  const result = evaluateLaunchPressure(control.pressure, control.cutoffOn);
  if (!isImminent(result.state)) throw new Error('HARD_CONTROL_NOT_V0_POSITIVE');

  let delayDaysLowerBound: number;

  if (control.outcome === 'LATER_LAUNCH') {
    if (!control.launchOn) throw new Error('HARD_CONTROL_LAUNCH_REQUIRED');
    const launchMs = parseIsoDay(control.launchOn, 'HARD_CONTROL_LAUNCH_INVALID');
    if (launchMs <= cutoffMs) throw new Error('HARD_CONTROL_LAUNCH_ORDER_INVALID');
    if (observedThroughMs < launchMs) throw new Error('HARD_CONTROL_LAUNCH_NOT_OBSERVED');
    delayDaysLowerBound = wholeDays(launchMs - cutoffMs);
  } else {
    if (control.launchOn !== undefined) throw new Error('HARD_CONTROL_UNLAUNCHED_HAS_LAUNCH');
    delayDaysLowerBound = wholeDays(observedThroughMs - cutoffMs);
  }

  if (delayDaysLowerBound < 90) throw new Error('HARD_CONTROL_DELAY_LT_90');

  const active60dFamilies = result.active60d
    .map((signal) => signal.kind)
    .sort();

  return {
    projectId: control.projectId,
    cutoffOn: control.cutoffOn,
    observedThrough: control.observedThrough,
    outcome: control.outcome,
    scope: control.scope,
    state: result.state,
    active60dFamilies,
    familyKey: active60dFamilies.join('+'),
    delayDaysLowerBound
  };
}

function isImminent(state: LaunchPressureState): boolean {
  return state === 'PRODUCTION_PREP' || state === 'ARMED';
}

function assertUniqueIds(controls: readonly HardDelayedControl[]): void {
  const ids = controls.map((control) => control.projectId);
  if (new Set(ids).size !== ids.length) throw new Error('HARD_CONTROL_DUPLICATE_PROJECT');
}

function median(values: readonly number[]): number {
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[middle]!;
  return (values[middle - 1]! + values[middle]!) / 2;
}

function wholeDays(milliseconds: number): number {
  return Math.floor(milliseconds / 86_400_000);
}

function parseIsoDay(value: string, error: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(error);
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new Error(error);
  }
  return parsed;
}
