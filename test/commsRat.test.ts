import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBaselineDrafts,
  buildShadowPostBundle,
  type CommsEvent,
  validateDraftText,
} from '../src/comms/commsRat.js';

function event(overrides: Partial<CommsEvent> = {}): CommsEvent {
  return {
    id: 'evt-001',
    occurredAt: '2026-10-06T11:30:00Z',
    type: 'FEATURE_CHANGE',
    lifecycle: 'BUILDING',
    visibility: 'PUBLIC_OK',
    publicAuthorized: true,
    headline: 'THE RAT IS BUILDING A NEW TRIPWIRE.',
    summary: 'Funding-wallet watch is being implemented behind the existing evidence boundary.',
    userValue: 3,
    novelty: 3,
    repetitionPenalty: 0,
    risk: 'LOW',
    evidence: [
      { kind: 'PR', ref: '#999' },
      { kind: 'CI', ref: 'check', status: 'PASS' },
      { kind: 'DOC', ref: 'docs/comms/README.md' },
    ],
    ...overrides,
  };
}

test('BUILDING baseline stays BUILDING and remains shadow-only', () => {
  const bundle = buildShadowPostBundle(event(), undefined, '2026-10-06T11:31:00Z');

  assert.equal(bundle.triageDecision, 'POST');
  assert.equal(bundle.decision, 'POST');
  assert.equal(bundle.publishAllowed, false);
  assert.equal(bundle.requiresHumanApproval, true);
  assert.equal(bundle.violations.length, 0);
  assert.match(bundle.drafts.x, /BUILDING:/);
  assert.doesNotMatch(bundle.drafts.x, /\blive\b|\bshipped\b|\bavailable now\b/i);
});

test('BUILDING copy cannot silently upgrade itself to PUBLIC_LIVE', () => {
  const violations = validateDraftText(
    'Funding-wallet watch is live. Use it now.',
    event(),
  );

  assert.ok(
    violations.some((item) => item.code === 'CAPABILITY_STATUS_UPGRADE'),
  );
});

test('ENGINEERING_PASS cannot claim DEPLOYED', () => {
  const violations = validateDraftText(
    'The new watcher is deployed.',
    event({ lifecycle: 'ENGINEERING_PASS' }),
  );

  assert.ok(
    violations.some((item) => item.code === 'CAPABILITY_STATUS_UPGRADE'),
  );
});

test('PUBLIC_LIVE may say live when receipts and authority exist', () => {
  const publicEvent = event({
    lifecycle: 'PUBLIC_LIVE',
    headline: 'TRIPWIRE IS LIVE.',
    summary: 'Funding-wallet watch is available on the stated public surface.',
    evidence: [
      { kind: 'DEPLOYMENT', ref: 'prod-123', status: 'PASS' },
      { kind: 'PRODUCT_STATUS', ref: 'public-status-123', status: 'PASS' },
    ],
  });

  const drafts = buildBaselineDrafts(publicEvent);
  const violations = validateDraftText(drafts.x, publicEvent);

  assert.equal(violations.length, 0);
  assert.match(drafts.x, /PUBLIC_LIVE:/);
});

test('missing receipts force queue even when the story looks strong', () => {
  const bundle = buildShadowPostBundle(event({ evidence: [] }));

  assert.equal(bundle.decision, 'QUEUE');
  assert.ok(bundle.reasons.some((reason) => /no receipt/i.test(reason)));
});

test('high-risk events never become immediate POST', () => {
  const bundle = buildShadowPostBundle(event({ risk: 'HIGH' }));

  assert.equal(bundle.decision, 'QUEUE');
});

test('internal-only events are ignored', () => {
  const bundle = buildShadowPostBundle(event({ visibility: 'INTERNAL' }));

  assert.equal(bundle.decision, 'IGNORE');
});

test('Brand V1 hard-ban language is rejected', () => {
  const violations = validateDraftText(
    'AI-powered alpha. Ape in. This wallet is a scammer. This is safe.',
    event({ lifecycle: 'PUBLIC_LIVE' }),
  );

  assert.equal(
    violations.filter((item) => item.code === 'BANNED_LANGUAGE').length,
    4,
  );
});

test('a POST with invalid custom drafts is downgraded to QUEUE', () => {
  const bundle = buildShadowPostBundle(event(), {
    x: 'This feature is live.',
    telegram: 'BUILDING: still under implementation.',
  });

  assert.equal(bundle.triageDecision, 'POST');
  assert.equal(bundle.decision, 'QUEUE');
  assert.ok(bundle.violations.length > 0);
});

test('unknown deployment evidence cannot manufacture an immediate POST', () => {
  const bundle = buildShadowPostBundle(
    event({
      userValue: 3,
      novelty: 3,
      evidence: [{ kind: 'DEPLOYMENT', ref: 'prod-unknown', status: 'UNKNOWN' }],
    }),
  );

  assert.equal(bundle.score, 6);
  assert.equal(bundle.decision, 'QUEUE');
});

test('negated live wording is not treated as a PUBLIC_LIVE claim', () => {
  const violations = validateDraftText(
    'The publishing mechanism remains unconnected, so these drafts are not posted live.',
    event({ lifecycle: 'ENGINEERING_PASS' }),
  );

  assert.equal(
    violations.filter((item) => item.code === 'CAPABILITY_STATUS_UPGRADE').length,
    0,
  );
});

test('later affirmative live wording still fails after an earlier negated mention', () => {
  const violations = validateDraftText(
    'These drafts are not posted live. The feature is live now.',
    event({ lifecycle: 'ENGINEERING_PASS' }),
  );

  assert.ok(
    violations.some((item) => item.code === 'CAPABILITY_STATUS_UPGRADE'),
  );
});

test('no live watcher is a negated capability statement', () => {
  const violations = validateDraftText(
    'There is no live watcher, scheduler, or collector.',
    event({ lifecycle: 'ENGINEERING_PASS' }),
  );

  assert.equal(
    violations.filter((item) => item.code === 'CAPABILITY_STATUS_UPGRADE').length,
    0,
  );
});

test('does not prove live coverage is a negated capability statement', () => {
  const violations = validateDraftText(
    'The offline proof does not prove live coverage.',
    event({ lifecycle: 'ENGINEERING_PASS' }),
  );

  assert.equal(
    violations.filter((item) => item.code === 'CAPABILITY_STATUS_UPGRADE').length,
    0,
  );
});
