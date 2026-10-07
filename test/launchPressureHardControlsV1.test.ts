import assert from 'node:assert/strict';
import test from 'node:test';
import { runHardDelayedControls } from '../src/intelligence/launchPressureHardControlsV1.js';
import { HARD_DELAYED_CONTROLS_V1 } from './fixtures/launchPressureHardControlsV1.js';

test('strict cohort contains six direct frozen-V0 counterexamples', () => {
  const report = runHardDelayedControls(HARD_DELAYED_CONTROLS_V1);

  assert.equal(report.counterexampleCount, 6);
  assert.equal(report.laterLaunchCount, 5);
  assert.equal(report.stillUnlaunchedCount, 1);
  assert.equal(report.minDelayDaysLowerBound, 90);
  assert.equal(report.medianDelayDaysLowerBound, 144);
  assert.equal(report.maxDelayDaysLowerBound, 509);

  assert.deepEqual(report.familyHistogram, {
    'RELEASE_CANDIDATE+TOKEN_DISTRIBUTION': 1,
    'AUDIT_REMEDIATION+RELEASE_CANDIDATE': 5
  });

  assert.ok(report.rows.every((row) => row.state === 'PRODUCTION_PREP'));
});

test('QRL 2.0 remains a chronology-safe current delayed control', () => {
  const report = runHardDelayedControls(HARD_DELAYED_CONTROLS_V1);
  const qrl = report.rows.find((row) => row.projectId === 'qrl-2');

  assert.ok(qrl);
  assert.equal(qrl.outcome, 'STILL_UNLAUNCHED');
  assert.equal(qrl.cutoffOn, '2026-04-03');
  assert.equal(qrl.observedThrough, '2026-10-02');
  assert.equal(qrl.delayDaysLowerBound, 182);
  assert.deepEqual(qrl.active60dFamilies, [
    'AUDIT_REMEDIATION',
    'RELEASE_CANDIDATE'
  ]);
});

test('hard controls reject a delayed outcome shorter than 90 days', () => {
  const base = HARD_DELAYED_CONTROLS_V1.find((row) => row.projectId === 'dusk');
  assert.ok(base);

  assert.throws(() => runHardDelayedControls([{
    ...base,
    cutoffOn: '2024-10-10'
  }]), /HARD_CONTROL_DELAY_LT_90/);
});

test('hard controls reject evidence observed after the frozen cutoff', () => {
  const base = HARD_DELAYED_CONTROLS_V1[0]!;
  assert.throws(() => runHardDelayedControls([{
    ...base,
    pressure: {
      ...base.pressure,
      receipts: [
        ...base.pressure.receipts,
        {
          observedOn: '2024-08-01',
          kind: 'PRODUCTION_DEPLOYMENT' as const,
          sourceRef: 'fixture:future-receipt'
        }
      ]
    }
  }]), /HARD_CONTROL_FUTURE_RECEIPT/);
});

test('a sophisticated project that is not V0-positive cannot enter the adversarial cohort', () => {
  assert.throws(() => runHardDelayedControls([{
    projectId: 'one-family',
    cutoffOn: '2024-01-01',
    observedThrough: '2024-05-01',
    outcome: 'STILL_UNLAUNCHED',
    scope: 'NETWORK_MAINNET',
    evidenceReason: 'Synthetic admission guard.',
    outcomeSourceRef: 'fixture:outcome',
    pressure: {
      projectId: 'one-family',
      receipts: [{
        observedOn: '2023-12-20',
        kind: 'RELEASE_CANDIDATE',
        sourceRef: 'fixture:release'
      }]
    }
  }]), /HARD_CONTROL_NOT_V0_POSITIVE/);
});

test('duplicate receipts from one family cannot fake a hard control', () => {
  assert.throws(() => runHardDelayedControls([{
    projectId: 'duplicates',
    cutoffOn: '2024-01-01',
    observedThrough: '2024-05-01',
    outcome: 'STILL_UNLAUNCHED',
    scope: 'NETWORK_MAINNET',
    evidenceReason: 'Synthetic duplicate-family guard.',
    outcomeSourceRef: 'fixture:outcome',
    pressure: {
      projectId: 'duplicates',
      receipts: [
        {
          observedOn: '2023-12-10',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'fixture:rc-1'
        },
        {
          observedOn: '2023-12-20',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'fixture:rc-2'
        }
      ]
    }
  }]), /HARD_CONTROL_NOT_V0_POSITIVE/);
});

test('outcome evidence is mandatory', () => {
  const base = HARD_DELAYED_CONTROLS_V1[0]!;
  assert.throws(() => runHardDelayedControls([{
    ...base,
    outcomeSourceRef: ''
  }]), /HARD_CONTROL_OUTCOME_SOURCE_REQUIRED/);
});
