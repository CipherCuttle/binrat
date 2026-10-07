import assert from 'node:assert/strict';
import test from 'node:test';
import { runHardDelayedControls } from '../src/intelligence/launchPressureHardControlsV1.js';
import { HARD_DELAYED_CONTROLS_V1 } from './fixtures/launchPressureHardControlsV1.js';

test('strict cohort contains four direct frozen-V0 counterexamples', () => {
  const report = runHardDelayedControls(HARD_DELAYED_CONTROLS_V1);

  assert.equal(report.counterexampleCount, 4);
  assert.equal(report.laterLaunchCount, 4);
  assert.equal(report.stillUnlaunchedCount, 0);
  assert.equal(report.minDelayDaysLowerBound, 110);
  assert.equal(report.medianDelayDaysLowerBound, 227);
  assert.equal(report.maxDelayDaysLowerBound, 509);

  assert.deepEqual(report.familyHistogram, {
    'AUDIT_REMEDIATION+RELEASE_CANDIDATE': 1,
    'AUDIT_REMEDIATION+TOKEN_DISTRIBUTION': 1,
    'AUDIT_REMEDIATION+PRODUCTION_INFRA': 1,
    'RELEASE_CANDIDATE+TOKEN_DISTRIBUTION': 1
  });

  assert.ok(report.rows.every((row) => row.state === 'PRODUCTION_PREP'));
});

test('each strict counterexample remains beyond the 90-day launch-clock boundary', () => {
  const report = runHardDelayedControls(HARD_DELAYED_CONTROLS_V1);
  const delays = new Map(report.rows.map((row) => [row.projectId, row.delayDaysLowerBound]));

  assert.equal(delays.get('tari'), 509);
  assert.equal(delays.get('zetachain'), 237);
  assert.equal(delays.get('neon-evm'), 217);
  assert.equal(delays.get('namada'), 110);
  assert.ok([...delays.values()].every((delay) => delay >= 90));
});

test('hard controls reject a delayed outcome shorter than 90 days', () => {
  assert.throws(() => runHardDelayedControls([{
    projectId: 'synthetic-short-delay',
    cutoffOn: '2024-01-01',
    observedThrough: '2024-03-30',
    outcome: 'LATER_LAUNCH',
    launchOn: '2024-03-30',
    scope: 'NETWORK_MAINNET',
    evidenceReason: 'Synthetic boundary guard.',
    outcomeSourceRef: 'fixture:outcome',
    pressure: {
      projectId: 'synthetic-short-delay',
      receipts: [
        {
          observedOn: '2023-12-20',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'fixture:audit'
        },
        {
          observedOn: '2023-12-25',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'fixture:rc'
        }
      ]
    }
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
          observedOn: '2023-12-15',
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
