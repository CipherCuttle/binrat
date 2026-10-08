/**
 * Read-only Cloudflare production inspection acceptance gate.
 *
 * This is NOT launch authorization and does not prove snapshot freshness,
 * source→artifact→Worker identity, customer UX, legal or transaction readiness.
 * It only prevents a successful Actions job when its inspection report FAILED.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const INSPECTION_OPERATIONS = Object.freeze([
  'production-preflight', 'worker-config', 'd1-schema', 'all',
]);

/** Returns only fixed issue codes; never echo captured body/secret/var values. */
export function inspectReadOnlyReport(report, requestedOperation) {
  const issues = [];
  if (!INSPECTION_OPERATIONS.includes(requestedOperation)) {
    issues.push('OPERATION_NOT_ALLOWED');
    return { ok: false, issues };
  }
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return { ok: false, issues: ['REPORT_MISSING_OR_INVALID'] };
  }
  if (report.operation !== requestedOperation) issues.push('OPERATION_MISMATCH');
  if (report.verdict !== 'PASS') issues.push('INSPECTION_REPORTED_FAILURE');
  if (!Array.isArray(report.verdictReasons)) issues.push('INSPECTION_REASONS_MISSING');
  else if (report.verdictReasons.length > 0) issues.push('INSPECTION_HAS_REASONS');

  if (requestedOperation === 'production-preflight' || requestedOperation === 'all') {
    if (report.production?.worker?.present !== true) issues.push('WORKER_NOT_VERIFIED');
    if (report.production?.d1?.name !== 'binrat-v0') issues.push('PRODUCTION_D1_NOT_VERIFIED');
    if (report.production?.d1?.id !== '46814564-1a41-449a-88e5-c1349eed3a27') {
      issues.push('PRODUCTION_D1_ID_MISMATCH');
    }
    for (const route of ['health', 'status', 'launches_latest']) {
      if (report.http?.[route]?.status !== '200') {
        issues.push(`PRODUCTION_HTTP_${route.toUpperCase()}_NOT_200`);
      }
    }
    if (report.schemaFocus?.has_binrat_public_snapshots !== true) {
      issues.push('PRODUCTION_SNAPSHOT_TABLE_UNVERIFIED');
    }
  }
  return { ok: issues.length === 0, issues };
}

function runCli() {
  const [file, operation] = process.argv.slice(2);
  if (!file || !operation) {
    process.stderr.write('PRODUCTION_INSPECTION_GATE_FAIL: ARGUMENTS_REQUIRED\n');
    process.exitCode = 1;
    return;
  }
  let report;
  try {
    report = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    // Do not expose file contents, paths or API payloads through CI logs.
    process.stderr.write('PRODUCTION_INSPECTION_GATE_FAIL: REPORT_UNAVAILABLE\n');
    process.exitCode = 1;
    return;
  }
  const result = inspectReadOnlyReport(report, operation);
  if (!result.ok) {
    process.stderr.write('PRODUCTION_INSPECTION_GATE_FAIL: ' + result.issues.join(',') + '\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write('PRODUCTION_INSPECTION_GATE_PASS: read-only broker observations only; not release or token launch authorization\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
