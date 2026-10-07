import {
  evaluatePrelaunchProject,
  type PrelaunchProjectFixture,
  type PrelaunchScoutStatus
} from './prelaunchScout.js';

export const PRELAUNCH_BENCHMARK_VERSION = 'BINRAT_PRELAUNCH_BENCHMARK_V1' as const;

export interface HistoricalBenchmarkProject {
  projectId: string;
  launchOn: string;
  fixture: PrelaunchProjectFixture;
}

export interface PrelaunchBenchmarkCase {
  caseId: string;
  projectId: string;
  cutoffOn: string;
  launchOn: string;
  horizonDays: number;
  expectedLaunchWithinHorizon: boolean;
  predictedStatus: PrelaunchScoutStatus;
  predictedWatch: boolean;
  daysToLaunch: number;
}

export interface PrelaunchBenchmarkProjectResult {
  projectId: string;
  launchOn: string;
  firstQualifiedOn: string | null;
  firstQualificationLeadDays: number | null;
}

export interface PrelaunchBenchmarkReport {
  version: typeof PRELAUNCH_BENCHMARK_VERSION;
  projectCount: number;
  caseCount: number;
  horizonDays: number;
  earlyLeadDays: number;
  lateLeadDays: number;
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
  precision: number | null;
  recall: number | null;
  falsePositiveRate: number | null;
  specificity: number | null;
  accuracy: number | null;
  temporalDiscrimination: number | null;
  medianFirstQualificationLeadDays: number | null;
  projectsQualifiedTooEarly: number;
  tooEarlyQualificationRate: number | null;
  cases: PrelaunchBenchmarkCase[];
  projects: PrelaunchBenchmarkProjectResult[];
}

export interface PrelaunchBenchmarkOptions {
  horizonDays?: number;
  earlyLeadDays?: number;
  lateLeadDays?: number;
}

export function runPrelaunchBenchmark(
  projects: readonly HistoricalBenchmarkProject[],
  options: PrelaunchBenchmarkOptions = {}
): PrelaunchBenchmarkReport {
  const horizonDays = options.horizonDays ?? 90;
  const earlyLeadDays = options.earlyLeadDays ?? 180;
  const lateLeadDays = options.lateLeadDays ?? 45;
  validateBenchmarkShape(projects, horizonDays, earlyLeadDays, lateLeadDays);

  const cases = projects.flatMap((project) => [
    buildCase(project, earlyLeadDays, horizonDays, 'early'),
    buildCase(project, lateLeadDays, horizonDays, 'late')
  ]);

  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  for (const row of cases) {
    if (row.expectedLaunchWithinHorizon && row.predictedWatch) truePositive += 1;
    else if (!row.expectedLaunchWithinHorizon && row.predictedWatch) falsePositive += 1;
    else if (!row.expectedLaunchWithinHorizon && !row.predictedWatch) trueNegative += 1;
    else falseNegative += 1;
  }

  const projectResults = projects
    .map(firstQualificationResult)
    .sort((a, b) => a.projectId.localeCompare(b.projectId));
  const qualificationLeads = projectResults
    .map((row) => row.firstQualificationLeadDays)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const projectsQualifiedTooEarly = qualificationLeads.filter((days) => days > horizonDays).length;

  const precision = ratio(truePositive, truePositive + falsePositive);
  const recall = ratio(truePositive, truePositive + falseNegative);
  const falsePositiveRate = ratio(falsePositive, falsePositive + trueNegative);
  const specificity = ratio(trueNegative, trueNegative + falsePositive);

  return {
    version: PRELAUNCH_BENCHMARK_VERSION,
    projectCount: projects.length,
    caseCount: cases.length,
    horizonDays,
    earlyLeadDays,
    lateLeadDays,
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    precision,
    recall,
    falsePositiveRate,
    specificity,
    accuracy: ratio(truePositive + trueNegative, cases.length),
    temporalDiscrimination: recall === null || falsePositiveRate === null
      ? null
      : recall - falsePositiveRate,
    medianFirstQualificationLeadDays: median(qualificationLeads),
    projectsQualifiedTooEarly,
    tooEarlyQualificationRate: ratio(projectsQualifiedTooEarly, projectResults.length),
    cases,
    projects: projectResults
  };
}

function buildCase(
  project: HistoricalBenchmarkProject,
  leadDays: number,
  horizonDays: number,
  phase: 'early' | 'late'
): PrelaunchBenchmarkCase {
  const launchMs = parseIsoDay(project.launchOn, 'PRELAUNCH_BENCHMARK_LAUNCH_DATE_INVALID');
  const cutoffMs = launchMs - leadDays * 86_400_000;
  const cutoffOn = isoDay(cutoffMs);
  const result = evaluatePrelaunchProject(project.fixture, cutoffOn);
  const daysToLaunch = Math.floor((launchMs - cutoffMs) / 86_400_000);
  return {
    caseId: `${project.projectId}:${phase}`,
    projectId: project.projectId,
    cutoffOn,
    launchOn: project.launchOn,
    horizonDays,
    expectedLaunchWithinHorizon: daysToLaunch <= horizonDays,
    predictedStatus: result.status,
    predictedWatch: result.status === 'QUALIFIED_WATCH',
    daysToLaunch
  };
}

function firstQualificationResult(project: HistoricalBenchmarkProject): PrelaunchBenchmarkProjectResult {
  const launchMs = parseIsoDay(project.launchOn, 'PRELAUNCH_BENCHMARK_LAUNCH_DATE_INVALID');
  const candidateDays = [...new Set(
    project.fixture.receipts
      .map((receipt) => receipt.observedOn)
      .filter((day) => parseIsoDay(day, 'PRELAUNCH_BENCHMARK_RECEIPT_DATE_INVALID') < launchMs)
  )].sort();

  let firstQualifiedOn: string | null = null;
  for (const day of candidateDays) {
    if (evaluatePrelaunchProject(project.fixture, day).status === 'QUALIFIED_WATCH') {
      firstQualifiedOn = day;
      break;
    }
  }

  return {
    projectId: project.projectId,
    launchOn: project.launchOn,
    firstQualifiedOn,
    firstQualificationLeadDays: firstQualifiedOn === null
      ? null
      : Math.floor((launchMs - parseIsoDay(firstQualifiedOn, 'PRELAUNCH_BENCHMARK_RECEIPT_DATE_INVALID')) / 86_400_000)
  };
}

function validateBenchmarkShape(
  projects: readonly HistoricalBenchmarkProject[],
  horizonDays: number,
  earlyLeadDays: number,
  lateLeadDays: number
): void {
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 365) {
    throw new Error('PRELAUNCH_BENCHMARK_HORIZON_INVALID');
  }
  if (!Number.isInteger(earlyLeadDays) || earlyLeadDays <= horizonDays || earlyLeadDays > 730) {
    throw new Error('PRELAUNCH_BENCHMARK_EARLY_LEAD_INVALID');
  }
  if (!Number.isInteger(lateLeadDays) || lateLeadDays < 1 || lateLeadDays > horizonDays) {
    throw new Error('PRELAUNCH_BENCHMARK_LATE_LEAD_INVALID');
  }
  if (projects.length < 1) throw new Error('PRELAUNCH_BENCHMARK_PROJECTS_REQUIRED');

  const ids = new Set<string>();
  for (const project of projects) {
    if (ids.has(project.projectId)) throw new Error('PRELAUNCH_BENCHMARK_DUPLICATE_PROJECT');
    ids.add(project.projectId);
    if (project.fixture.projectId !== project.projectId) {
      throw new Error('PRELAUNCH_BENCHMARK_PROJECT_ID_MISMATCH');
    }
    const launchMs = parseIsoDay(project.launchOn, 'PRELAUNCH_BENCHMARK_LAUNCH_DATE_INVALID');
    const launchReceipts = project.fixture.receipts.filter((receipt) => receipt.kind === 'PUBLIC_LAUNCH');
    if (launchReceipts.length !== 1 || launchReceipts[0]?.observedOn !== project.launchOn) {
      throw new Error('PRELAUNCH_BENCHMARK_LAUNCH_RECEIPT_INVALID');
    }
    if (project.fixture.receipts.some(
      (receipt) => parseIsoDay(receipt.observedOn, 'PRELAUNCH_BENCHMARK_RECEIPT_DATE_INVALID') > launchMs
    )) {
      throw new Error('PRELAUNCH_BENCHMARK_POST_LAUNCH_RECEIPT');
    }
  }
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1
    ? values[middle]!
    : (values[middle - 1]! + values[middle]!) / 2;
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
