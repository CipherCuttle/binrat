import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const verdict = (samples: unknown) => execFileSync(process.execPath, [
  '--input-type=module', '--eval',
  `import { classifyPonsRecovery } from './scripts/ponsRecoveryVerdict.mjs';console.log(classifyPonsRecovery(${JSON.stringify(samples)}));`
], { cwd: process.cwd(), encoding: 'utf8' }).trim();

const progressing = {
  chainId: 4663, candidateActive: true, sourceVerified: true, lastSyncError: null, runtimeFresh: true,
  indexReady: false, liveCaughtUp: false
};

test('Pons bounded recovery distinguishes final PASS from healthy progress', () => {
  assert.equal(verdict([
    { ...progressing, atMs: 0, checkpoint: '10', target: '10', backlog: '0', indexReady: true, liveCaughtUp: true },
    { ...progressing, atMs: 15_000, checkpoint: '11', target: '11', backlog: '0', indexReady: true, liveCaughtUp: true }
  ]), 'PASS');
  assert.equal(verdict([
    { ...progressing, atMs: 0, checkpoint: '10', target: '100', backlog: '90' },
    { ...progressing, atMs: 15_000, checkpoint: '30', target: '105', backlog: '75' }
  ]), 'RECOVERY_PROGRESSING');
});

test('Pons timeout after healthy catch-up enters the bounded retry window and then recovers', () => {
  assert.equal(verdict([
    { ...progressing, atMs: 0, checkpoint: '10', target: '100', backlog: '90' },
    { ...progressing, atMs: 15_000, checkpoint: '30', target: '105', backlog: '75' },
    { ...progressing, atMs: 30_000, checkpoint: '30', target: '106', backlog: '76', sourceVerified: false, lastSyncError: 'SYNC_TIMEOUT_ERROR' }
  ]), 'RECOVERY_RETRYING');
  assert.equal(verdict([
    { ...progressing, atMs: 0, checkpoint: '10', target: '100', backlog: '90' },
    { ...progressing, atMs: 15_000, checkpoint: '30', target: '105', backlog: '75' },
    { ...progressing, atMs: 30_000, checkpoint: '30', target: '106', backlog: '76', sourceVerified: false, lastSyncError: 'SYNC_TIMEOUT_ERROR' },
    { ...progressing, atMs: 45_000, checkpoint: '50', target: '108', backlog: '58' }
  ]), 'RECOVERY_PROGRESSING');
});

test('Pons persistent transport timeout, integrity failure, regression, and stalled timeout fail closed', () => {
  const healthyProgress = [
    { ...progressing, atMs: 0, checkpoint: '10', target: '100', backlog: '90' },
    { ...progressing, atMs: 15_000, checkpoint: '30', target: '105', backlog: '75' }
  ];
  assert.equal(verdict([
    ...healthyProgress,
    { ...progressing, atMs: 30_000, checkpoint: '30', target: '106', backlog: '76', sourceVerified: false, lastSyncError: 'SYNC_ETIMEDOUT' },
    { ...progressing, atMs: 135_000, checkpoint: '30', target: '112', backlog: '82', sourceVerified: false, lastSyncError: 'SYNC_ETIMEDOUT' }
  ]), 'FAIL');
  assert.equal(verdict([
    ...healthyProgress,
    { ...progressing, atMs: 30_000, checkpoint: '30', target: '106', backlog: '76', sourceVerified: false, lastSyncError: 'SYNC_TIMEOUT_ERROR' },
    { ...progressing, atMs: 45_000, checkpoint: '30', target: '106', backlog: '76' }
  ]), 'FAIL');
  assert.equal(verdict([
    ...healthyProgress,
    { ...progressing, atMs: 30_000, checkpoint: '30', target: '106', backlog: '76', sourceVerified: false, lastSyncError: 'PONS_CHAIN_ID_DRIFT' }
  ]), 'FAIL');
  assert.equal(verdict([
    ...healthyProgress,
    { ...progressing, atMs: 30_000, checkpoint: '29', target: '106', backlog: '77', sourceVerified: false, lastSyncError: 'SYNC_TIMEOUT_ERROR' }
  ]), 'FAIL');
  assert.equal(verdict([
    { ...progressing, atMs: 0, checkpoint: '10', target: '100', backlog: '90' },
    { ...progressing, atMs: 15_000, checkpoint: '10', target: '105', backlog: '95', sourceVerified: false, lastSyncError: 'SYNC_TIMEOUT_ERROR' }
  ]), 'FAIL');
});
