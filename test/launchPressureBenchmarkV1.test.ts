import assert from 'node:assert/strict';
import test from 'node:test';
import { runLaunchPressureBenchmarkV1 } from '../src/intelligence/launchPressureBenchmarkV1.js';
import {
  LAUNCH_PRESSURE_V1_CONTROLS,
  LAUNCH_PRESSURE_V1_LAUNCHERS
} from './fixtures/launchPressureBenchmarkV1.js';

test('v1 cohort freezes 20 launchers but scores only coverage-verified evidence', () => {
  const report = runLaunchPressureBenchmarkV1(
    LAUNCH_PRESSURE_V1_LAUNCHERS,
    LAUNCH_PRESSURE_V1_CONTROLS
  );

  assert.equal(report.launcherCount, 20);
  assert.equal(report.verifiedLauncherCount, 7);
  assert.equal(report.partialLauncherCount, 13);
  assert.equal(report.controlCount, 3);
  assert.equal(report.verifiedControlCount, 2);
  assert.equal(report.partialControlCount, 1);

  assert.equal(
    report.cases.filter((row) => row.cohort === 'LAUNCHED').length,
    7 * 5
  );
  assert.equal(
    report.cases.filter((row) => row.cohort === 'UNRESOLVED_CONTROL').length,
    2
  );
  assert.ok(report.cases.every((row) => row.projectId !== 'scroll'));
  assert.ok(report.cases.every((row) => row.projectId !== 'converge'));
});

test('frozen v0 pressure rule fails the 45d target but improves sharply in the last two weeks', () => {
  const report = runLaunchPressureBenchmarkV1(
    LAUNCH_PRESSURE_V1_LAUNCHERS,
    LAUNCH_PRESSURE_V1_CONTROLS
  );

  const byHorizon = new Map(report.horizons.map((row) => [row.leadDays, row]));
  assert.deepEqual(byHorizon.get(45), {
    leadDays: 45,
    truePositive: 1,
    falseNegative: 6,
    recall: 1 / 7
  });
  assert.deepEqual(byHorizon.get(30), {
    leadDays: 30,
    truePositive: 1,
    falseNegative: 6,
    recall: 1 / 7
  });
  assert.deepEqual(byHorizon.get(14), {
    leadDays: 14,
    truePositive: 5,
    falseNegative: 2,
    recall: 5 / 7
  });
  assert.deepEqual(byHorizon.get(7), {
    leadDays: 7,
    truePositive: 5,
    falseNegative: 2,
    recall: 5 / 7
  });

  assert.equal(report.launcherEarlyFalsePositive, 0);
  assert.equal(report.launcherEarlyTrueNegative, 7);
  assert.equal(report.launcherEarlyFalsePositiveRate, 0);
});

test('verified unresolved controls do not false-positive at a chronology-safe 90d cutoff', () => {
  const report = runLaunchPressureBenchmarkV1(
    LAUNCH_PRESSURE_V1_LAUNCHERS,
    LAUNCH_PRESSURE_V1_CONTROLS
  );

  assert.equal(report.controlFalsePositive, 0);
  assert.equal(report.controlTrueNegative, 2);
  assert.equal(report.externalControlFalsePositiveRate, 0);

  const controls = new Map(
    report.cases
      .filter((row) => row.cohort === 'UNRESOLVED_CONTROL')
      .map((row) => [row.projectId, row])
  );
  assert.equal(controls.get('fhenix-cofhe')?.state, 'BUILDING');
  assert.equal(controls.get('xeris')?.state, 'BUILDING');
  assert.equal(controls.get('xeris')?.cutoffOn, '2026-07-09');
});

test('pressure state can decay when an old family ages out; benchmark preserves this instead of forward-filling state', () => {
  const report = runLaunchPressureBenchmarkV1(
    LAUNCH_PRESSURE_V1_LAUNCHERS,
    LAUNCH_PRESSURE_V1_CONTROLS
  );

  const movement = new Map(
    report.cases
      .filter((row) => row.projectId === 'movement')
      .map((row) => [row.daysToLaunch, row.state])
  );

  assert.equal(movement.get(14), 'PRODUCTION_PREP');
  assert.equal(movement.get(7), 'HARDENING');
});

test('partial evidence cannot improve efficacy metrics even if it contains a pressure receipt', () => {
  const partialSei = LAUNCH_PRESSURE_V1_LAUNCHERS.find((row) => row.projectId === 'sei');
  assert.ok(partialSei);
  assert.equal(partialSei.coverage, 'PARTIAL');
  assert.equal(partialSei.pressure.receipts.length, 1);

  const report = runLaunchPressureBenchmarkV1(
    LAUNCH_PRESSURE_V1_LAUNCHERS,
    LAUNCH_PRESSURE_V1_CONTROLS
  );
  assert.ok(report.cases.every((row) => row.projectId !== 'sei'));
});

test('benchmark rejects launch-day leakage and control receipts after observed-through', () => {
  const taiko = LAUNCH_PRESSURE_V1_LAUNCHERS.find((row) => row.projectId === 'taiko');
  assert.ok(taiko);

  assert.throws(() => runLaunchPressureBenchmarkV1([{
    ...taiko,
    pressure: {
      ...taiko.pressure,
      receipts: [
        ...taiko.pressure.receipts,
        {
          observedOn: taiko.launchOn,
          kind: 'PRODUCTION_INFRA' as const,
          sourceRef: 'fixture:launch-day-leak'
        }
      ]
    }
  }], []), /LP_V1_NON_PRELAUNCH_LAUNCHER_RECEIPT/);

  const fhenix = LAUNCH_PRESSURE_V1_CONTROLS.find((row) => row.projectId === 'fhenix-cofhe');
  assert.ok(fhenix);

  assert.throws(() => runLaunchPressureBenchmarkV1([], [{
    ...fhenix,
    pressure: {
      ...fhenix.pressure,
      receipts: [{
        observedOn: '2026-10-08',
        kind: 'PRODUCTION_DEPLOYMENT' as const,
        sourceRef: 'fixture:future-control-leak'
      }]
    }
  }]), /LP_V1_CONTROL_RECEIPT_AFTER_OBSERVATION/);
});
