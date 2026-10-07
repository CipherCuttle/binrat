import assert from 'node:assert/strict';
import test from 'node:test';
import { runPrelaunchBenchmark } from '../src/intelligence/prelaunchBenchmark.js';
import { PRELAUNCH_BENCHMARK_PROJECTS } from './fixtures/prelaunchBenchmarkProjects.js';
import { evaluatePrelaunchProject } from '../src/intelligence/prelaunchScout.js';

test('paired benchmark freezes 20 projects into 20 early controls and 20 late positives', () => {
  const report = runPrelaunchBenchmark(PRELAUNCH_BENCHMARK_PROJECTS);

  assert.equal(report.projectCount, 20);
  assert.equal(report.caseCount, 40);
  assert.equal(report.horizonDays, 90);
  assert.equal(report.earlyLeadDays, 180);
  assert.equal(report.lateLeadDays, 45);

  assert.equal(report.cases.filter((row) => row.expectedLaunchWithinHorizon).length, 20);
  assert.equal(report.cases.filter((row) => !row.expectedLaunchWithinHorizon).length, 20);
  assert.ok(report.cases.filter((row) => row.expectedLaunchWithinHorizon).every((row) => row.daysToLaunch === 45));
  assert.ok(report.cases.filter((row) => !row.expectedLaunchWithinHorizon).every((row) => row.daysToLaunch === 180));
});

test('baseline scout has perfect paired recall but unacceptable 90-day false-positive rate', () => {
  const report = runPrelaunchBenchmark(PRELAUNCH_BENCHMARK_PROJECTS);

  assert.deepEqual({
    truePositive: report.truePositive,
    falsePositive: report.falsePositive,
    trueNegative: report.trueNegative,
    falseNegative: report.falseNegative
  }, {
    truePositive: 20,
    falsePositive: 10,
    trueNegative: 10,
    falseNegative: 0
  });

  assert.equal(report.precision, 2 / 3);
  assert.equal(report.recall, 1);
  assert.equal(report.falsePositiveRate, 0.5);
  assert.equal(report.specificity, 0.5);
  assert.equal(report.accuracy, 0.75);
  assert.equal(report.temporalDiscrimination, 0.5);
});

test('current rule usually identifies serious projects long before a 90-day launch horizon', () => {
  const report = runPrelaunchBenchmark(PRELAUNCH_BENCHMARK_PROJECTS);

  assert.equal(report.medianFirstQualificationLeadDays, 190.5);
  assert.equal(report.projectsQualifiedTooEarly, 18);
  assert.equal(report.tooEarlyQualificationRate, 0.9);

  const byProject = new Map(report.projects.map((row) => [row.projectId, row]));
  assert.equal(byProject.get('manta-pacific')?.firstQualificationLeadDays, 55);
  assert.equal(byProject.get('taiko')?.firstQualificationLeadDays, 86);
  assert.equal(byProject.get('aleo')?.firstQualificationLeadDays, 778);
});

test('future launch receipt scores the benchmark but cannot change point-in-time qualification', () => {
  const original = PRELAUNCH_BENCHMARK_PROJECTS.find((project) => project.projectId === 'taiko');
  assert.ok(original);

  const launchless = {
    ...original,
    fixture: {
      ...original.fixture,
      receipts: original.fixture.receipts.filter((receipt) => receipt.kind !== 'PUBLIC_LAUNCH')
    }
  };

  const cutoff = '2024-04-12';
  const withOutcome = evaluatePrelaunchProject(original.fixture, cutoff);
  const withoutOutcome = evaluatePrelaunchProject(launchless.fixture, cutoff);

  assert.equal(withOutcome.status, 'QUALIFIED_WATCH');
  assert.equal(withoutOutcome.status, 'QUALIFIED_WATCH');
  assert.deepEqual(withoutOutcome.backingEntities, withOutcome.backingEntities);
  assert.deepEqual(withoutOutcome.technicalSignals, withOutcome.technicalSignals);
});

test('benchmark shape rejects a leaked post-launch receipt', () => {
  const first = PRELAUNCH_BENCHMARK_PROJECTS[0]!;
  assert.throws(() => runPrelaunchBenchmark([{
    ...first,
    fixture: {
      ...first.fixture,
      receipts: [
        ...first.fixture.receipts,
        {
          observedOn: '2024-06-01',
          kind: 'AUDIT' as const,
          sourceRef: 'fixture:post-launch-leak'
        }
      ]
    }
  }]), /PRELAUNCH_BENCHMARK_POST_LAUNCH_RECEIPT/);
});
