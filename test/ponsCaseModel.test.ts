import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPonsCaseModel } from '../src/pons/caseModel.js';

const launch = {
  launchId: 'a'.repeat(64),
  token: '0x1111111111111111111111111111111111111111' as const,
  deployer: '0x2222222222222222222222222222222222222222' as const,
  canonicalName: 'Canonical Rat',
  canonicalSymbol: 'CRAT'
};

test('Pons case model composes only positive factual reasons in deterministic order', () => {
  const model = buildPonsCaseModel({
    launch,
    identity: {
      name: 'Receipt Rat',
      symbol: 'RRAT',
      decimals: 18,
      evidenceDigest: 'b'.repeat(64)
    },
    history: {
      previousLaunches: 3,
      launchesWithAnyMemory: 2,
      launchesWithFullMemory: 1,
      launchesPendingMemory: 1,
      launchesStillImmature: 0
    },
    funding: {
      currentFunding: {
        sourceAddress: '0x3333333333333333333333333333333333333333',
        transferTxHash: `0x${'44'.repeat(32)}`,
        transferBlock: '78000000',
        transferTimestampMs: 1_800_000_000_000,
        valueWei: '1000000000000000'
      },
      sameFundingSource: {
        sourceAddress: '0x3333333333333333333333333333333333333333',
        distinctDeployersAtLeast: 2,
        distinctLaunchesAtLeast: 4
      },
      recurrenceCoverage: {
        status: 'PARTIAL',
        verifiedReceipts: 4,
        truncated: true
      }
    },
    replay: {
      semantics: 'KNOWABLE_AS_OF_BLOCK',
      available: true,
      receiptId: `binrat-pons-replay:${'c'.repeat(64)}`
    }
  });

  assert.equal(model.launch.label, '$RRAT');
  assert.equal(model.launch.labelSource, 'PERSISTED_TOKEN_IDENTITY');
  assert.equal(model.launch.identityEvidenceDigest, 'b'.repeat(64));
  assert.deepEqual(model.reasons.map((reason) => reason.code), [
    'REPEAT_DEPLOYER',
    'SAME_FUNDING_SOURCE',
    'OUTCOME_MEMORY'
  ]);
  assert.equal(model.reasons[0]?.label, '3 PRIOR LAUNCHES');
  assert.equal(model.reasons[1]?.label, 'SAME FUNDING SOURCE');
  assert.equal(model.reasons[1]?.evidence.distinctDeployersAtLeast, 2);
  assert.equal(model.reasons[1]?.evidence.coverageStatus, 'PARTIAL');
  assert.equal(model.reasons[2]?.label, '2/3 PRIOR LAUNCHES WITH OUTCOME MEMORY');
  assert.deepEqual(model.rails, {
    identity: 'OBSERVED',
    history: 'AVAILABLE',
    funding: 'POSITIVE_EVIDENCE',
    replay: 'AVAILABLE'
  });
  assert.deepEqual(model.handoffs, {
    trashTrail: true,
    replay: true,
    receipts: true
  });
  assert.match(model.boundaries.noRiskScore, /not a risk score/i);
  assert.match(model.boundaries.fundingIdentity, /does not establish common ownership/i);
});

test('missing optional rails never become a negative intelligence claim', () => {
  const model = buildPonsCaseModel({ launch });

  assert.deepEqual(model.reasons, []);
  assert.deepEqual(model.rails, {
    identity: 'NO_RECEIPT_SUPPLIED',
    history: 'NOT_SUPPLIED',
    funding: 'NO_POSITIVE_EVIDENCE_SUPPLIED',
    replay: 'NOT_SUPPLIED'
  });
  assert.deepEqual(model.handoffs, {
    trashTrail: false,
    replay: false,
    receipts: false
  });
  assert.match(model.boundaries.missingEvidence, /not negative evidence/i);
  assert.ok(!JSON.stringify(model).includes('NO SAME FUNDING'));
  assert.ok(!JSON.stringify(model).includes('SAFE'));
});

test('funding without recurrence is preserved as positive evidence but does not invent SAME FUNDING SOURCE', () => {
  const model = buildPonsCaseModel({
    launch,
    funding: {
      currentFunding: {
        sourceAddress: '0x3333333333333333333333333333333333333333',
        transferTxHash: `0x${'44'.repeat(32)}`,
        transferBlock: '78000000',
        transferTimestampMs: 1_800_000_000_000,
        valueWei: '1000000000000000'
      },
      sameFundingSource: null,
      recurrenceCoverage: {
        status: 'COMPLETE',
        verifiedReceipts: 1,
        truncated: false
      }
    }
  });

  assert.equal(model.rails.funding, 'POSITIVE_EVIDENCE');
  assert.equal(model.reasons.some((reason) => reason.code === 'SAME_FUNDING_SOURCE'), false);
  assert.equal(model.handoffs.receipts, true);
});

test('canonical launch label is fallback when persisted identity is absent', () => {
  const model = buildPonsCaseModel({ launch });
  assert.equal(model.launch.label, '$CRAT');
  assert.equal(model.launch.labelSource, 'CANONICAL_LAUNCH');
  assert.equal(model.launch.identityEvidenceDigest, null);
});

test('case model rejects a recurrence source that disagrees with the current funding receipt', () => {
  assert.throws(() => buildPonsCaseModel({
    launch,
    funding: {
      currentFunding: {
        sourceAddress: '0x3333333333333333333333333333333333333333',
        transferTxHash: `0x${'44'.repeat(32)}`,
        transferBlock: '78000000',
        transferTimestampMs: 1_800_000_000_000,
        valueWei: '1000000000000000'
      },
      sameFundingSource: {
        sourceAddress: '0x5555555555555555555555555555555555555555',
        distinctDeployersAtLeast: 2,
        distinctLaunchesAtLeast: 2
      },
      recurrenceCoverage: {
        status: 'COMPLETE',
        verifiedReceipts: 2,
        truncated: false
      }
    }
  }), /PONS_CASE_FUNDING_SOURCE_MISMATCH/);
});

test('case model rejects a Replay receipt when Replay is unavailable', () => {
  assert.throws(() => buildPonsCaseModel({
    launch,
    replay: {
      semantics: 'KNOWABLE_AS_OF_BLOCK',
      available: false,
      receiptId: `binrat-pons-replay:${'c'.repeat(64)}`
    }
  }), /PONS_CASE_REPLAY_RECEIPT_WITHOUT_AVAILABILITY/);
});
