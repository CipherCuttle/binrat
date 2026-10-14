import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectReadOnlyReport } from '../scripts/verify-production-inspection-report.mjs';

const okReport = () => ({
  operation: 'production-preflight',
  verdict: 'PASS',
  verdictReasons: [],
  production: {
    worker: { present: true },
    d1: {
      name: 'binrat-v0',
      id: '46814564-1a41-449a-88e5-c1349eed3a27',
    },
  },
  http: {
    health: { status: '200' },
    status: { status: '200' },
    launches_latest: { status: '200' },
  },
  schemaFocus: { has_binrat_public_snapshots: true },
});

test('only a complete green production inspection passes; no launch authorization implied', () => {
  assert.deepEqual(inspectReadOnlyReport(okReport(), 'production-preflight'), { ok: true, issues: [] });
});

test('Cloudflare 1102 / HTTP 503 is a failure even when old Actions job was green', () => {
  const report = okReport();
  report.http.status = { status: '503', bodyPrefix: 'error code: 1102' };
  report.verdict = 'FAIL';
  report.verdictReasons = ['status endpoint HTTP 503 (recorded, not gating)'];
  const result = inspectReadOnlyReport(report, 'production-preflight');
  assert.equal(result.ok, false);
  assert.ok(result.issues.includes('PRODUCTION_HTTP_STATUS_NOT_200'));
  assert.ok(result.issues.includes('INSPECTION_REPORTED_FAILURE'));
});

test('missing HTTP sample cannot silently produce a passing report', () => {
  const report = okReport();
  delete report.http.status;
  assert.ok(inspectReadOnlyReport(report, 'production-preflight').issues.includes('PRODUCTION_HTTP_STATUS_NOT_200'));
});

test('wrong D1 or absent canonical snapshot blocks inspector PASS', () => {
  const report = okReport();
  report.production.d1.id = 'other';
  report.schemaFocus.has_binrat_public_snapshots = false;
  const issues = inspectReadOnlyReport(report, 'production-preflight').issues;
  assert.ok(issues.includes('PRODUCTION_D1_ID_MISMATCH'));
  assert.ok(issues.includes('PRODUCTION_SNAPSHOT_TABLE_UNVERIFIED'));
});

test('worker-config-only mode does not require HTTP or D1 probes', () => {
  const report = { operation: 'worker-config', verdict: 'PASS', verdictReasons: [] };
  assert.equal(inspectReadOnlyReport(report, 'worker-config').ok, true);
});

test('mismatched selector and missing report always fail closed', () => {
  assert.ok(inspectReadOnlyReport(okReport(), 'all').issues.includes('OPERATION_MISMATCH'));
  assert.equal(inspectReadOnlyReport(null, 'production-preflight').ok, false);
  assert.equal(inspectReadOnlyReport({}, 'unknown').ok, false);
});

test('inspection failure details are replaced by fixed issue codes', () => {
  const report = okReport();
  report.verdict = 'FAIL';
  report.verdictReasons = ['do not print arbitrary source or account metadata'];
  const result = inspectReadOnlyReport(report, 'production-preflight');
  assert.equal(result.ok, false);
  assert.ok(!JSON.stringify(result).includes('do not print arbitrary source'));
});
