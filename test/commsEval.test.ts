import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  evaluateCommsDraftAttempt,
  failedCommsEvalCase,
  summarizeCommsEval,
  type CommsEvalCase,
} from '../src/comms/eval.js';
import type { ModelDraftAttempt } from '../src/comms/modelWriter.js';

const cases = JSON.parse(
  readFileSync(
    new URL('../docs/comms/eval/historical-v1.json', import.meta.url),
    'utf8',
  ),
) as CommsEvalCase[];

function attempt(
  testCase: CommsEvalCase,
  x: string,
  telegram: string,
  violations: ModelDraftAttempt['bundle']['violations'] = [],
): ModelDraftAttempt {
  return {
    bundle: {
      version: 'binrat.comms.shadow/1',
      eventId: testCase.event.id,
      createdAt: '2026-10-06T12:30:00Z',
      lifecycle: testCase.event.lifecycle,
      triageDecision: 'QUEUE',
      decision: testCase.expectedDecision,
      score: 5,
      reasons: [],
      evidence: testCase.event.evidence,
      drafts: { x, telegram },
      violations,
      requiresHumanApproval: true,
      publishAllowed: false,
    },
    writerReceipt: {
      schemaVersion: 'binrat.comms-writer-receipt/1',
      provider: 'fixture',
      model: 'fixture',
      requestDigest: 'a'.repeat(64),
      rawOutputDigest: 'b'.repeat(64),
      draftsDigest: 'c'.repeat(64),
      acceptedByDeterministicGate: false,
      violationCount: violations.length,
    },
  };
}

test('historical evaluation pack has twelve unique receipt-bound cases', () => {
  assert.equal(cases.length, 12);
  assert.equal(new Set(cases.map((item) => item.id)).size, 12);
  assert.equal(new Set(cases.map((item) => item.source.pr)).size, 12);

  for (const item of cases) {
    assert.equal(item.event.publicAuthorized, false);
    assert.equal(item.expectedDecision, 'QUEUE');
    assert.ok(item.event.evidence.length > 0);
    assert.ok(item.requiredReceiptRefs.length > 0);
    assert.ok(item.forbiddenClaims.length > 0);
  }
});

test('honest negated caveats do not trip affirmative forbidden claims', () => {
  const testCase = cases.find((item) => item.source.pr === 140)!;
  const result = evaluateCommsDraftAttempt(
    testCase,
    attempt(
      testCase,
      'PR #140: one provider-indexed range returned zero transfers. This does not establish chain-wide absence.',
      'Receipt 37462568165. The result does not prove the index is fresh or complete.',
    ),
  );

  assert.equal(result.hardFidelityPass, true);
  assert.equal(result.forbiddenClaims.length, 0);
  assert.equal(result.receiptPresent, true);
});

test('unsupported positive claim kills hard fidelity', () => {
  const testCase = cases.find((item) => item.source.pr === 140)!;
  const result = evaluateCommsDraftAttempt(
    testCase,
    attempt(
      testCase,
      'PR #140 proved there was no funding.',
      'The index is fresh and complete.',
    ),
  );

  assert.equal(result.hardFidelityPass, false);
  assert.ok(result.forbiddenClaims.includes('CHAIN_WIDE_ABSENCE') || result.forbiddenClaims.includes('INDEX_FRESHNESS'));
});

test('status upgrade from deterministic gate kills hard fidelity', () => {
  const testCase = cases[0];
  const result = evaluateCommsDraftAttempt(
    testCase,
    attempt(testCase, 'PR #140', 'Receipt 37462568165', [
      {
        code: 'CAPABILITY_STATUS_UPGRADE',
        message: 'fixture',
        matched: 'live',
      },
    ]),
  );

  assert.equal(result.hardFidelityPass, false);
  assert.equal(result.capabilityUpgradeCount, 1);
});

test('one unsupported factual upgrade blocks the autonomy verdict', () => {
  const clean = cases.map((item) =>
    evaluateCommsDraftAttempt(
      item,
      attempt(
        item,
        'Receipt ' + item.requiredReceiptRefs[0],
        'Receipt ' + item.requiredReceiptRefs[0],
      ),
    ),
  );

  const poisoned = [...clean];
  poisoned[0] = {
    ...poisoned[0],
    hardFidelityPass: false,
    automaticCandidate: false,
    forbiddenClaims: ['UNSUPPORTED_FACT'],
  };

  const summary = summarizeCommsEval(poisoned);
  assert.equal(summary.unsupportedClaimFailures, 1);
  assert.equal(summary.autonomyVerdict, 'BLOCKED_UNSUPPORTED_CLAIMS');
});

test('provider failure blocks before editorial averages matter', () => {
  const results = cases.map((item) =>
    evaluateCommsDraftAttempt(
      item,
      attempt(
        item,
        'Receipt ' + item.requiredReceiptRefs[0],
        'Receipt ' + item.requiredReceiptRefs[0],
      ),
    ),
  );
  results[3] = failedCommsEvalCase(cases[3], 'PROVIDER_FAILED');

  const summary = summarizeCommsEval(results);
  assert.equal(summary.autonomyVerdict, 'BLOCKED_PROVIDER_FAILURE');
});

test('even a clean >=70% automatic pack still requires manual edit review', () => {
  const results = cases.map((item) =>
    evaluateCommsDraftAttempt(
      item,
      attempt(
        item,
        'Receipt ' + item.requiredReceiptRefs[0],
        'Receipt ' + item.requiredReceiptRefs[0],
      ),
    ),
  );

  const summary = summarizeCommsEval(results);
  assert.equal(summary.automaticCandidates, 12);
  assert.equal(summary.autonomyVerdict, 'MANUAL_EDIT_REVIEW_REQUIRED');
  assert.equal(summary.manualEditReviewRequired, true);
});
