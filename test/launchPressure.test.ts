import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateLaunchPressure,
  type LaunchPressureReceipt
} from '../src/intelligence/launchPressure.js';

function signal(
  observedOn: string,
  kind: LaunchPressureReceipt['kind'],
  sourceRef = `fixture:${kind.toLowerCase()}`
): LaunchPressureReceipt {
  return { observedOn, kind, sourceRef };
}

test('no launch-pressure evidence stays BUILDING', () => {
  const result = evaluateLaunchPressure({ projectId: 'empty', receipts: [] }, '2026-10-07');
  assert.equal(result.state, 'BUILDING');
  assert.equal(result.active90d.length, 0);
});

test('one recent signal means HARDENING, not production prep', () => {
  const result = evaluateLaunchPressure({
    projectId: 'one-signal',
    receipts: [signal('2026-09-20', 'TOKEN_DISTRIBUTION')]
  }, '2026-10-07');

  assert.equal(result.state, 'HARDENING');
  assert.equal(result.active30d.length, 1);
});

test('two distinct recent families with one hard signal become PRODUCTION_PREP', () => {
  const result = evaluateLaunchPressure({
    projectId: 'prep',
    receipts: [
      signal('2026-09-10', 'AUDIT_REMEDIATION'),
      signal('2026-09-20', 'PRODUCTION_INFRA')
    ]
  }, '2026-10-07');

  assert.equal(result.state, 'PRODUCTION_PREP');
  assert.deepEqual(result.active60d.map((row) => row.kind).sort(), [
    'AUDIT_REMEDIATION',
    'PRODUCTION_INFRA'
  ]);
});

test('ARMED requires clustered distinct families, at least two hard signals, and an irreversible signal', () => {
  const result = evaluateLaunchPressure({
    projectId: 'armed',
    receipts: [
      signal('2026-09-20', 'PRODUCTION_CHAIN_CONFIG'),
      signal('2026-09-25', 'PRODUCTION_DEPLOYMENT'),
      signal('2026-10-01', 'RELEASE_CANDIDATE')
    ]
  }, '2026-10-07');

  assert.equal(result.state, 'ARMED');
  assert.equal(result.active30d.length, 3);
  assert.deepEqual(result.hardSignalKinds30d, [
    'PRODUCTION_DEPLOYMENT',
    'RELEASE_CANDIDATE'
  ]);
});

test('three flashy but non-irreversible families cannot become ARMED', () => {
  const result = evaluateLaunchPressure({
    projectId: 'not-armed',
    receipts: [
      signal('2026-09-20', 'PRODUCTION_CHAIN_CONFIG'),
      signal('2026-09-25', 'PRODUCTION_INFRA'),
      signal('2026-10-01', 'RELEASE_CANDIDATE')
    ]
  }, '2026-10-07');

  assert.equal(result.state, 'PRODUCTION_PREP');
});

test('duplicate receipts from one family never multiply pressure', () => {
  const result = evaluateLaunchPressure({
    projectId: 'duplicates',
    receipts: [
      signal('2026-09-01', 'PRODUCTION_DEPLOYMENT', 'fixture:deploy-1'),
      signal('2026-09-20', 'PRODUCTION_DEPLOYMENT', 'fixture:deploy-2'),
      signal('2026-10-01', 'PRODUCTION_DEPLOYMENT', 'fixture:deploy-3')
    ]
  }, '2026-10-07');

  assert.equal(result.state, 'HARDENING');
  assert.equal(result.active30d.length, 1);
  assert.equal(result.active30d[0]?.observedOn, '2026-10-01');
});

test('stale signals decay out of the active pressure window', () => {
  const result = evaluateLaunchPressure({
    projectId: 'stale',
    receipts: [
      signal('2026-06-01', 'PRODUCTION_DEPLOYMENT'),
      signal('2026-06-02', 'PRODUCTION_INFRA'),
      signal('2026-06-03', 'TOKEN_DISTRIBUTION')
    ]
  }, '2026-10-07');

  assert.equal(result.state, 'BUILDING');
  assert.equal(result.active90d.length, 0);
});

test('future evidence cannot affect the point-in-time state', () => {
  const receipts: LaunchPressureReceipt[] = [
    signal('2026-09-20', 'AUDIT_REMEDIATION'),
    signal('2026-10-10', 'PRODUCTION_DEPLOYMENT'),
    signal('2026-10-11', 'TOKEN_DISTRIBUTION')
  ];
  const result = evaluateLaunchPressure({ projectId: 'future', receipts }, '2026-10-07');

  assert.equal(result.state, 'HARDENING');
  assert.equal(result.ignoredFutureReceipts, 2);
  assert.equal(result.active90d.length, 1);
});

test('missing source fails closed', () => {
  assert.throws(() => evaluateLaunchPressure({
    projectId: 'bad-source',
    receipts: [{ observedOn: '2026-10-01', kind: 'RELEASE_CANDIDATE', sourceRef: '' }]
  }, '2026-10-07'), /LAUNCH_PRESSURE_SOURCE_REQUIRED/);
});
