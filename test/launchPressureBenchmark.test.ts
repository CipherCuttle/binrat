import assert from 'node:assert/strict';
import test from 'node:test';
import { runLaunchPressureBenchmark } from '../src/intelligence/launchPressureBenchmark.js';
import { LAUNCH_PRESSURE_PILOT } from './fixtures/launchPressurePilot.js';

test('real-evidence pilot is intentionally not tuned to the old 45-day gate', () => {
  const report = runLaunchPressureBenchmark(LAUNCH_PRESSURE_PILOT, {
    horizonDays: 90,
    earlyLeadDays: 180,
    lateLeadDays: 45
  });

  assert.deepEqual({
    truePositive: report.truePositive,
    falsePositive: report.falsePositive,
    trueNegative: report.trueNegative,
    falseNegative: report.falseNegative
  }, {
    truePositive: 0,
    falsePositive: 0,
    trueNegative: 3,
    falseNegative: 3
  });
  assert.equal(report.recall, 0);
  assert.equal(report.falsePositiveRate, 0);
  assert.equal(report.temporalDiscrimination, 0);
});

test('same frozen pilot reaches two-thirds recall fourteen days before launch without early false positives', () => {
  const report = runLaunchPressureBenchmark(LAUNCH_PRESSURE_PILOT, {
    horizonDays: 90,
    earlyLeadDays: 180,
    lateLeadDays: 14
  });

  assert.deepEqual({
    truePositive: report.truePositive,
    falsePositive: report.falsePositive,
    trueNegative: report.trueNegative,
    falseNegative: report.falseNegative
  }, {
    truePositive: 2,
    falsePositive: 0,
    trueNegative: 3,
    falseNegative: 1
  });
  assert.equal(report.recall, 2 / 3);
  assert.equal(report.falsePositiveRate, 0);

  const late = new Map(
    report.cases
      .filter((row) => row.daysToLaunch === 14)
      .map((row) => [row.projectId, row])
  );
  assert.equal(late.get('taiko')?.state, 'PRODUCTION_PREP');
  assert.equal(late.get('aptos')?.state, 'HARDENING');
  assert.equal(late.get('celestia')?.state, 'PRODUCTION_PREP');
});

test('same frozen pilot reaches full recall seven days before launch', () => {
  const report = runLaunchPressureBenchmark(LAUNCH_PRESSURE_PILOT, {
    horizonDays: 90,
    earlyLeadDays: 180,
    lateLeadDays: 7
  });

  assert.equal(report.truePositive, 3);
  assert.equal(report.falsePositive, 0);
  assert.equal(report.trueNegative, 3);
  assert.equal(report.falseNegative, 0);
  assert.equal(report.recall, 1);
  assert.equal(report.falsePositiveRate, 0);
  assert.equal(report.temporalDiscrimination, 1);

  const late = new Map(
    report.cases
      .filter((row) => row.daysToLaunch === 7)
      .map((row) => [row.projectId, row])
  );
  assert.equal(late.get('taiko')?.state, 'PRODUCTION_PREP');
  assert.equal(late.get('aptos')?.state, 'ARMED');
  assert.equal(late.get('celestia')?.state, 'PRODUCTION_PREP');
});

test('pilot benchmark rejects pressure evidence dated on launch day', () => {
  const first = LAUNCH_PRESSURE_PILOT[0]!;
  assert.throws(() => runLaunchPressureBenchmark([{
    ...first,
    pressure: {
      ...first.pressure,
      receipts: [
        ...first.pressure.receipts,
        {
          observedOn: first.launchOn,
          kind: 'PRODUCTION_INFRA' as const,
          sourceRef: 'fixture:launch-day-leak'
        }
      ]
    }
  }]), /LAUNCH_PRESSURE_BENCHMARK_NON_PRELAUNCH_RECEIPT/);
});
