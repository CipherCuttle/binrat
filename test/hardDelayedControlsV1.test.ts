import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runHardDelayedControlsBenchmark,
  type HardDelayedControl
} from '../src/intelligence/hardDelayedControlsBenchmark.js';
import { HARD_DELAYED_CONTROLS_V1 } from './fixtures/hardDelayedControlsV1.js';

test('strict cohort admits six clean controls and does not pretend the target of ten was met', () => {
  const report = runHardDelayedControlsBenchmark(HARD_DELAYED_CONTROLS_V1, 10);

  assert.equal(report.targetCount, 10);
  assert.equal(report.admittedCount, 6);
  assert.equal(report.targetMet, false);
  assert.equal(report.historicalCount, 6);
  assert.equal(report.unresolvedCount, 0);
});

test('every admitted control is pressure-imminent under frozen V0 and survives at least 90 days', () => {
  const report = runHardDelayedControlsBenchmark(HARD_DELAYED_CONTROLS_V1, 10);

  assert.ok(report.results.every((row) => row.state === 'PRODUCTION_PREP'));
  assert.ok(report.results.every((row) => row.lagDays >= 90));
  assert.equal(report.stateCounts.PRODUCTION_PREP, 6);
  assert.equal(report.stateCounts.ARMED, 0);

  assert.equal(report.minLagDays, 100);
  assert.equal(report.medianLagDays, 163.5);
  assert.equal(report.maxLagDays, 509);
});

test('strict counterexamples span multiple false-clock family combinations', () => {
  const report = runHardDelayedControlsBenchmark(HARD_DELAYED_CONTROLS_V1, 10);

  assert.deepEqual(report.familyCombinationCounts, {
    'AUDIT_REMEDIATION+RELEASE_CANDIDATE': 2,
    'AUDIT_REMEDIATION+TOKEN_DISTRIBUTION': 1,
    'AUDIT_REMEDIATION+PRODUCTION_INFRA': 1,
    'AUDIT_REMEDIATION+PRODUCTION_DEPLOYMENT': 1,
    'RELEASE_CANDIDATE+TOKEN_DISTRIBUTION': 1
  });
});

test('known hard-control lags remain frozen', () => {
  const report = runHardDelayedControlsBenchmark(HARD_DELAYED_CONTROLS_V1, 10);
  const byId = new Map(report.results.map((row) => [row.projectId, row]));

  assert.equal(byId.get('namada')?.lagDays, 110);
  assert.equal(byId.get('neon-evm')?.lagDays, 217);
  assert.equal(byId.get('zetachain')?.lagDays, 237);
  assert.equal(byId.get('tari-minotari')?.lagDays, 509);
  assert.equal(byId.get('zksync-era')?.lagDays, 101);
  assert.equal(byId.get('rocket-pool')?.lagDays, 100);
});

test('future evidence after the trigger is rejected', () => {
  const base = HARD_DELAYED_CONTROLS_V1[0]!;
  const bad: HardDelayedControl = {
    ...base,
    pressure: {
      ...base.pressure,
      receipts: [
        ...base.pressure.receipts,
        {
          observedOn: '2023-12-15',
          kind: 'PRODUCTION_DEPLOYMENT',
          sourceRef: 'fixture:future-receipt'
        }
      ]
    }
  };

  assert.throws(
    () => runHardDelayedControlsBenchmark([bad]),
    /HARD_DELAYED_FUTURE_RECEIPT/
  );
});

test('a non-imminent control cannot enter the hard-negative cohort', () => {
  const base = HARD_DELAYED_CONTROLS_V1[0]!;
  const bad: HardDelayedControl = {
    ...base,
    projectId: 'one-family',
    pressure: {
      projectId: 'one-family',
      receipts: [base.pressure.receipts[0]!]
    }
  };

  assert.throws(
    () => runHardDelayedControlsBenchmark([bad]),
    /HARD_DELAYED_NOT_PRESSURE_IMMINENT/
  );
});

test('historical launches inside 90 days are rejected', () => {
  const base = HARD_DELAYED_CONTROLS_V1[0]!;
  const bad: HardDelayedControl = {
    ...base,
    outcome: {
      kind: 'HISTORICAL_LAUNCH',
      launchOn: '2024-02-01',
      sourceRef: 'fixture:too-soon'
    }
  };

  assert.throws(
    () => runHardDelayedControlsBenchmark([bad]),
    /HARD_DELAYED_LT_90_DAYS/
  );
});

test('unresolved controls need at least 90 days of observed non-launch after the trigger', () => {
  const base = HARD_DELAYED_CONTROLS_V1[0]!;
  const bad: HardDelayedControl = {
    ...base,
    outcome: {
      kind: 'UNRESOLVED',
      observedThrough: '2024-02-01',
      sourceRef: 'fixture:not-long-enough'
    }
  };

  assert.throws(
    () => runHardDelayedControlsBenchmark([bad]),
    /HARD_DELAYED_LT_90_DAYS/
  );
});
