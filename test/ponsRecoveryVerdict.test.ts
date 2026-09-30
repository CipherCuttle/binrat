import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const verdict = (samples: unknown) => execFileSync(process.execPath, [
  '--input-type=module', '--eval',
  `import { classifyPonsRecovery } from './scripts/ponsRecoveryVerdict.mjs';console.log(classifyPonsRecovery(${JSON.stringify(samples)}));`
], { cwd: process.cwd(), encoding: 'utf8' }).trim();

const progressing = {
  chainId: 4663, sourceVerified: true, lastSyncError: null, runtimeFresh: true,
  indexReady: false, liveCaughtUp: false
};

test('Pons bounded recovery distinguishes final PASS from healthy progress and failure', () => {
  assert.equal(verdict([
    { ...progressing, checkpoint: '10', target: '10', backlog: '0', indexReady: true, liveCaughtUp: true },
    { ...progressing, checkpoint: '11', target: '11', backlog: '0', indexReady: true, liveCaughtUp: true }
  ]), 'PASS');
  assert.equal(verdict([
    { ...progressing, checkpoint: '10', target: '100', backlog: '90' },
    { ...progressing, checkpoint: '30', target: '105', backlog: '75' }
  ]), 'RECOVERY_PROGRESSING');
  assert.equal(verdict([
    { ...progressing, checkpoint: '10', target: '100', backlog: '90' },
    { ...progressing, checkpoint: '30', target: '105', backlog: '75', lastSyncError: 'SYNC_TIMEOUT_ERROR' }
  ]), 'FAIL');
});
