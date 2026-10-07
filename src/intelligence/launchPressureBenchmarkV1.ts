import {
  evaluateLaunchPressure,
  type LaunchPressureInput,
  type LaunchPressureState
} from './launchPressure.js';

export const LAUNCH_PRESSURE_BENCHMARK_V1 = 'BINRAT_LAUNCH_PRESSURE_BENCHMARK_V1' as const;

export type PressureEvidenceCoverage = 'VERIFIED' | 'PARTIAL';

export interface PressureEvidenceMetadata {
  coverage: PressureEvidenceCoverage;
  coverageReason: string;
}

export interface LaunchedPressureProject extends PressureEvidenceMetadata {
  projectId: string;
  launchOn: string;
  pressure: LaunchPressureInput;
}

export interface UnresolvedPressureControl extends PressureEvidenceMetadata {
  projectId: string;
  observedThrough: string;
  pressure: LaunchPressureInput;
}

export interface PressureReplayCase {
  caseId: string;
  projectId: string;
  cohort: 'LAUNCHED' | 'UNRESOLVED_CONTROL';
  cutoffOn: string;
  expectedLaunchWithin90d: boolean;
  daysToLaunch: number | null;
  state: LaunchPressureState;
  predictedImminent: boolean;
}

export interface HorizonRecall {
  leadDays: number;
  truePositive: number;
  falseNegative: number;
  recall: number | null;
}

export interface LaunchPressureBenchmarkV1Report {
  version: typeof LAUNCH_PRESSURE_BENCHMARK_V1;
  launcherCount: number;
  verifiedLauncherCount: number;
  partialLauncherCount: number;
  controlCount: number;
  verifiedControlCount: number;
  partialControlCount: number;
  horizons: HorizonRecall[];
  earlyLeadDays: number;
  launcherEarlyFalsePositive: number;
  launcherEarlyTrueNegative: number;
  launcherEarlyFalsePositiveRate: number | null;
  controlLeadDays: number;
  controlFalsePositive: number;
  controlTrueNegative: number;
  externalControlFalsePositiveRate: number | null;
  cases: PressureReplayCase[];
}

export function runLaunchPressureBenchmarkV1(
  launchers: readonly LaunchedPressureProject[],
  controls: readonly UnresolvedPressureControl[],
  options: {
    horizons?: readonly number[];
    earlyLeadDays?: number;
    controlLeadDays?: number;
  } = {}
): LaunchPressureBenchmarkV1Report {
  const horizons = [...(options.horizons ?? [45, 30, 14, 7])];
  const earlyLeadDays = options.earlyLeadDays ?? 180;
  const controlLeadDays = options.controlLeadDays ?? 90;

  validateOptions(horizons, earlyLeadDays, controlLeadDays);
  validateLaunchers(launchers);
  validateControls(controls);

  const verifiedLaunchers = launchers.filter((project) => project.coverage === 'VERIFIED');
  const verifiedControls = controls.filter((project) => project.coverage === 'VERIFIED');
  const cases: PressureReplayCase[] = [];

  for (const project of verifiedLaunchers) {
    cases.push(buildLauncherCase(project, earlyLeadDays, 'early'));
    for (const horizon of horizons) cases.push(buildLauncherCase(project, horizon, `h${horizon}`));
  }

  for (const project of verifiedControls) {
    cases.push(buildControlCase(project, controlLeadDays));
  }

  const horizonReports = horizons.map((leadDays): HorizonRecall => {
    const rows = cases.filter(
      (row) => row.cohort === 'LAUNCHED' && row.daysToLaunch === leadDays
    );
    const truePositive = rows.filter((row) => row.predictedImminent).length;
    const falseNegative = rows.length - truePositive;
    return {
      leadDays,
      truePositive,
      falseNegative,
      recall: ratio(truePositive, rows.length)
    };
  });

  const earlyRows = cases.filter(
    (row) => row.cohort === 'LAUNCHED' && row.daysToLaunch === earlyLeadDays
  );
  const launcherEarlyFalsePositive = earlyRows.filter((row) => row.predictedImminent).length;
  const launcherEarlyTrueNegative = earlyRows.length - launcherEarlyFalsePositive;

  const controlRows = cases.filter((row) => row.cohort === 'UNRESOLVED_CONTROL');
  const controlFalsePositive = controlRows.filter((row) => row.predictedImminent).length;
  const controlTrueNegative = controlRows.length - controlFalsePositive;

  return {
    version: LAUNCH_PRESSURE_BENCHMARK_V1,
    launcherCount: launchers.length,
    verifiedLauncherCount: verifiedLaunchers.length,
    partialLauncherCount: launchers.length - verifiedLaunchers.length,
    controlCount: controls.length,
    verifiedControlCount: verifiedControls.length,
    partialControlCount: controls.length - verifiedControls.length,
    horizons: horizonReports,
    earlyLeadDays,
    launcherEarlyFalsePositive,
    launcherEarlyTrueNegative,
    launcherEarlyFalsePositiveRate: ratio(launcherEarlyFalsePositive, earlyRows.length),
    controlLeadDays,
    controlFalsePositive,
    controlTrueNegative,
    externalControlFalsePositiveRate: ratio(controlFalsePositive, controlRows.length),
    cases
  };
}

function buildLauncherCase(
  project: LaunchedPressureProject,
  leadDays: number,
  label: string
): PressureReplayCase {
  const launchMs = parseIsoDay(project.launchOn, 'LP_V1_LAUNCH_DATE_INVALID');
  const cutoffOn = isoDay(launchMs - leadDays * 86_400_000);
  const state = evaluateLaunchPressure(project.pressure, cutoffOn).state;
  return {
    caseId: `${project.projectId}:${label}`,
    projectId: project.projectId,
    cohort: 'LAUNCHED',
    cutoffOn,
    expectedLaunchWithin90d: leadDays <= 90,
    daysToLaunch: leadDays,
    state,
    predictedImminent: isImminent(state)
  };
}

function buildControlCase(
  project: UnresolvedPressureControl,
  leadDays: number
): PressureReplayCase {
  const observedThroughMs = parseIsoDay(
    project.observedThrough,
    'LP_V1_CONTROL_OBSERVED_THROUGH_INVALID'
  );
  const cutoffOn = isoDay(observedThroughMs - leadDays * 86_400_000);
  const state = evaluateLaunchPressure(project.pressure, cutoffOn).state;
  return {
    caseId: `${project.projectId}:control`,
    projectId: project.projectId,
    cohort: 'UNRESOLVED_CONTROL',
    cutoffOn,
    expectedLaunchWithin90d: false,
    daysToLaunch: null,
    state,
    predictedImminent: isImminent(state)
  };
}

function validateOptions(
  horizons: readonly number[],
  earlyLeadDays: number,
  controlLeadDays: number
): void {
  if (horizons.length === 0 || new Set(horizons).size !== horizons.length) {
    throw new Error('LP_V1_HORIZONS_INVALID');
  }
  if (horizons.some((value) => !Number.isInteger(value) || value < 1 || value > 90)) {
    throw new Error('LP_V1_HORIZONS_INVALID');
  }
  if (!Number.isInteger(earlyLeadDays) || earlyLeadDays <= 90 || earlyLeadDays > 730) {
    throw new Error('LP_V1_EARLY_LEAD_INVALID');
  }
  if (!Number.isInteger(controlLeadDays) || controlLeadDays < 90 || controlLeadDays > 730) {
    throw new Error('LP_V1_CONTROL_LEAD_INVALID');
  }
}

function validateLaunchers(projects: readonly LaunchedPressureProject[]): void {
  assertUniqueIds(projects.map((project) => project.projectId), 'LP_V1_DUPLICATE_LAUNCHER');
  for (const project of projects) {
    assertProjectShape(project.projectId, project.pressure, project.coverageReason);
    const launchMs = parseIsoDay(project.launchOn, 'LP_V1_LAUNCH_DATE_INVALID');
    if (project.pressure.receipts.some((receipt) =>
      parseIsoDay(receipt.observedOn, 'LP_V1_RECEIPT_DATE_INVALID') >= launchMs
    )) {
      throw new Error('LP_V1_NON_PRELAUNCH_LAUNCHER_RECEIPT');
    }
  }
}

function validateControls(projects: readonly UnresolvedPressureControl[]): void {
  assertUniqueIds(projects.map((project) => project.projectId), 'LP_V1_DUPLICATE_CONTROL');
  for (const project of projects) {
    assertProjectShape(project.projectId, project.pressure, project.coverageReason);
    const observedThroughMs = parseIsoDay(
      project.observedThrough,
      'LP_V1_CONTROL_OBSERVED_THROUGH_INVALID'
    );
    if (project.pressure.receipts.some((receipt) =>
      parseIsoDay(receipt.observedOn, 'LP_V1_RECEIPT_DATE_INVALID') > observedThroughMs
    )) {
      throw new Error('LP_V1_CONTROL_RECEIPT_AFTER_OBSERVATION');
    }
  }
}

function assertProjectShape(
  projectId: string,
  pressure: LaunchPressureInput,
  coverageReason: string
): void {
  if (pressure.projectId !== projectId) throw new Error('LP_V1_PROJECT_ID_MISMATCH');
  if (!coverageReason.trim()) throw new Error('LP_V1_COVERAGE_REASON_REQUIRED');
}

function assertUniqueIds(ids: readonly string[], error: string): void {
  if (new Set(ids).size !== ids.length) throw new Error(error);
}

function isImminent(state: LaunchPressureState): boolean {
  return state === 'PRODUCTION_PREP' || state === 'ARMED';
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function parseIsoDay(value: string, error: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(error);
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new Error(error);
  }
  return parsed;
}

function isoDay(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}
