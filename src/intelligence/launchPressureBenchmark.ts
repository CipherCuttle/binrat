import {
  evaluateLaunchPressure,
  type LaunchPressureInput,
  type LaunchPressureState
} from './launchPressure.js';

export const LAUNCH_PRESSURE_BENCHMARK_VERSION = 'BINRAT_LAUNCH_PRESSURE_BENCHMARK_V0' as const;

export interface HistoricalPressureProject {
  projectId: string;
  launchOn: string;
  pressure: LaunchPressureInput;
}

export interface LaunchPressureBenchmarkCase {
  caseId: string;
  projectId: string;
  cutoffOn: string;
  launchOn: string;
  daysToLaunch: number;
  expectedLaunchWithinHorizon: boolean;
  state: LaunchPressureState;
  predictedImminent: boolean;
}

export interface LaunchPressureBenchmarkReport {
  version: typeof LAUNCH_PRESSURE_BENCHMARK_VERSION;
  projectCount: number;
  caseCount: number;
  horizonDays: number;
  earlyLeadDays: number;
  lateLeadDays: number;
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
  recall: number | null;
  falsePositiveRate: number | null;
  specificity: number | null;
  temporalDiscrimination: number | null;
  cases: LaunchPressureBenchmarkCase[];
}

export function runLaunchPressureBenchmark(
  projects: readonly HistoricalPressureProject[],
  options: { horizonDays?: number; earlyLeadDays?: number; lateLeadDays?: number } = {}
): LaunchPressureBenchmarkReport {
  const horizonDays = options.horizonDays ?? 90;
  const earlyLeadDays = options.earlyLeadDays ?? 180;
  const lateLeadDays = options.lateLeadDays ?? 45;
  validate(projects, horizonDays, earlyLeadDays, lateLeadDays);

  const cases = projects.flatMap((project) => [
    buildCase(project, earlyLeadDays, horizonDays, 'early'),
    buildCase(project, lateLeadDays, horizonDays, 'late')
  ]);

  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;

  for (const row of cases) {
    if (row.expectedLaunchWithinHorizon && row.predictedImminent) truePositive += 1;
    else if (!row.expectedLaunchWithinHorizon && row.predictedImminent) falsePositive += 1;
    else if (!row.expectedLaunchWithinHorizon && !row.predictedImminent) trueNegative += 1;
    else falseNegative += 1;
  }

  const recall = ratio(truePositive, truePositive + falseNegative);
  const falsePositiveRate = ratio(falsePositive, falsePositive + trueNegative);

  return {
    version: LAUNCH_PRESSURE_BENCHMARK_VERSION,
    projectCount: projects.length,
    caseCount: cases.length,
    horizonDays,
    earlyLeadDays,
    lateLeadDays,
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    recall,
    falsePositiveRate,
    specificity: ratio(trueNegative, trueNegative + falsePositive),
    temporalDiscrimination: recall === null || falsePositiveRate === null
      ? null
      : recall - falsePositiveRate,
    cases
  };
}

function buildCase(
  project: HistoricalPressureProject,
  leadDays: number,
  horizonDays: number,
  phase: 'early' | 'late'
): LaunchPressureBenchmarkCase {
  const launchMs = parseIsoDay(project.launchOn, 'LAUNCH_PRESSURE_BENCHMARK_LAUNCH_INVALID');
  const cutoffOn = new Date(launchMs - leadDays * 86_400_000).toISOString().slice(0, 10);
  const result = evaluateLaunchPressure(project.pressure, cutoffOn);

  return {
    caseId: `${project.projectId}:${phase}`,
    projectId: project.projectId,
    cutoffOn,
    launchOn: project.launchOn,
    daysToLaunch: leadDays,
    expectedLaunchWithinHorizon: leadDays <= horizonDays,
    state: result.state,
    predictedImminent: result.state === 'PRODUCTION_PREP' || result.state === 'ARMED'
  };
}

function validate(
  projects: readonly HistoricalPressureProject[],
  horizonDays: number,
  earlyLeadDays: number,
  lateLeadDays: number
): void {
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 365) {
    throw new Error('LAUNCH_PRESSURE_BENCHMARK_HORIZON_INVALID');
  }
  if (!Number.isInteger(earlyLeadDays) || earlyLeadDays <= horizonDays || earlyLeadDays > 730) {
    throw new Error('LAUNCH_PRESSURE_BENCHMARK_EARLY_INVALID');
  }
  if (!Number.isInteger(lateLeadDays) || lateLeadDays < 1 || lateLeadDays > horizonDays) {
    throw new Error('LAUNCH_PRESSURE_BENCHMARK_LATE_INVALID');
  }
  if (projects.length < 1) throw new Error('LAUNCH_PRESSURE_BENCHMARK_PROJECTS_REQUIRED');

  const ids = new Set<string>();
  for (const project of projects) {
    if (ids.has(project.projectId)) throw new Error('LAUNCH_PRESSURE_BENCHMARK_DUPLICATE_PROJECT');
    ids.add(project.projectId);
    if (project.pressure.projectId !== project.projectId) {
      throw new Error('LAUNCH_PRESSURE_BENCHMARK_PROJECT_ID_MISMATCH');
    }
    const launchMs = parseIsoDay(project.launchOn, 'LAUNCH_PRESSURE_BENCHMARK_LAUNCH_INVALID');
    if (project.pressure.receipts.some((receipt) =>
      parseIsoDay(receipt.observedOn, 'LAUNCH_PRESSURE_BENCHMARK_RECEIPT_INVALID') >= launchMs
    )) {
      throw new Error('LAUNCH_PRESSURE_BENCHMARK_NON_PRELAUNCH_RECEIPT');
    }
  }
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
