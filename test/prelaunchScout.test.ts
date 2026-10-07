import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluatePrelaunchProject,
  type PrelaunchProjectFixture
} from '../src/intelligence/prelaunchScout.js';

const taiko: PrelaunchProjectFixture = {
  projectId: 'taiko',
  receipts: [
    {
      observedOn: '2022-07-28',
      kind: 'PUBLIC_CODE',
      sourceRef: 'https://github.com/taikoxyz/taiko-mono'
    },
    {
      observedOn: '2022-12-27',
      kind: 'TESTNET_DEPLOYMENT',
      sourceRef: 'https://www.reddit.com/r/taiko_xyz/comments/zwoz3z'
    },
    {
      observedOn: '2024-03-03',
      kind: 'INSTITUTIONAL_RELATION',
      entity: 'Wintermute Ventures',
      relation: 'INVESTOR',
      sourceRef: 'https://defillama.com/raises/gsr'
    },
    {
      observedOn: '2024-03-03',
      kind: 'INSTITUTIONAL_RELATION',
      entity: 'GSR',
      relation: 'INVESTOR',
      sourceRef: 'https://defillama.com/raises/gsr'
    },
    {
      observedOn: '2024-05-27',
      kind: 'PUBLIC_LAUNCH',
      sourceRef: 'https://github.com/taikoxyz/taiko-mono/blob/main/packages/protocol/deployments/mainnet-contract-logs-L1.md'
    }
  ]
};

const gte: PrelaunchProjectFixture = {
  projectId: 'gte',
  receipts: [
    {
      observedOn: '2025-04-15',
      kind: 'PUBLIC_CODE',
      sourceRef: 'https://github.com/liquid-labs-inc/gte-python-sdk'
    },
    {
      observedOn: '2025-06-23',
      kind: 'TESTNET_DEPLOYMENT',
      sourceRef: 'https://www.theblock.co/news/deals/2025-06-23-paradigm-gte-worlds-fastest-dex-clob-359205'
    },
    {
      observedOn: '2025-06-23',
      kind: 'INSTITUTIONAL_RELATION',
      entity: 'Paradigm',
      relation: 'LEAD_INVESTOR',
      sourceRef: 'https://www.theblock.co/news/deals/2025-06-23-paradigm-gte-worlds-fastest-dex-clob-359205'
    },
    {
      observedOn: '2025-07-23',
      kind: 'AUDIT',
      sourceRef: 'https://code4rena.com/audits/2025-07-gte-spot-clob-and-router'
    },
    {
      observedOn: '2026-10-07',
      kind: 'INSTITUTIONAL_RELATION',
      entity: 'Wintermute Ventures',
      relation: 'INVESTOR',
      sourceRef: 'https://www.wintermute.com/ventures/portfolio'
    }
  ]
};

test('historical replay detects Taiko before observed public launch with measurable lead time', () => {
  const beforeFunding = evaluatePrelaunchProject(taiko, '2024-03-02');
  assert.equal(beforeFunding.status, 'TECHNICAL_ONLY');

  const afterFunding = evaluatePrelaunchProject(taiko, '2024-03-04');
  assert.equal(afterFunding.status, 'QUALIFIED_WATCH');
  assert.deepEqual(afterFunding.backingEntities, ['GSR', 'Wintermute Ventures']);
  assert.equal(afterFunding.laterObservedLaunchInFixture, true);\n  assert.equal(afterFunding.leadDaysToObservedLaunch, 84);

  const launchDay = evaluatePrelaunchProject(taiko, '2024-05-27');
  assert.equal(launchDay.status, 'ALREADY_LAUNCHED');
  assert.equal(launchDay.leadDaysToObservedLaunch, null);
});

test('future launch outcome never changes the detector decision', () => {
  const withFutureOutcome = evaluatePrelaunchProject(taiko, '2024-03-04');
  const withoutFutureOutcome = evaluatePrelaunchProject({
    ...taiko,
    receipts: taiko.receipts.filter((receipt) => receipt.observedOn <= '2024-03-04')
  }, '2024-03-04');

  assert.equal(withFutureOutcome.status, 'QUALIFIED_WATCH');
  assert.equal(withoutFutureOutcome.status, 'QUALIFIED_WATCH');
  assert.deepEqual(withoutFutureOutcome.backingEntities, withFutureOutcome.backingEntities);
  assert.deepEqual(withoutFutureOutcome.technicalSignals, withFutureOutcome.technicalSignals);
  assert.equal(withFutureOutcome.leadDaysToObservedLaunch, 84);
  assert.equal(withoutFutureOutcome.leadDaysToObservedLaunch, null);
});

test('current GTE evidence becomes a watch candidate without pretending absence proves prelaunch', () => {
  const result = evaluatePrelaunchProject(gte, '2026-10-07');
  assert.equal(result.status, 'QUALIFIED_WATCH');
  assert.deepEqual(result.backingEntities, ['Paradigm', 'Wintermute Ventures']);
  assert.ok(result.technicalSignals.includes('PUBLIC_CODE'));
  assert.ok(result.technicalSignals.includes('TESTNET_DEPLOYMENT'));
  assert.ok(result.technicalSignals.includes('AUDIT'));
  assert.equal(result.laterObservedLaunchInFixture, false);\n  assert.equal(result.leadDaysToObservedLaunch, null);
});

test('GitHub plus testnet activity without a typed backing relation does not qualify', () => {
  const result = evaluatePrelaunchProject({
    projectId: 'technical-control',
    receipts: [
      { observedOn: '2026-01-01', kind: 'PUBLIC_CODE', sourceRef: 'fixture:public-code' },
      { observedOn: '2026-01-02', kind: 'TESTNET_DEPLOYMENT', sourceRef: 'fixture:testnet' }
    ]
  }, '2026-01-03');

  assert.equal(result.status, 'TECHNICAL_ONLY');
  assert.deepEqual(result.backingEntities, []);
});

test('wallet adjacency and liquidity-provider relationships cannot be laundered into investor backing', () => {
  for (const relation of ['WALLET_ADJACENCY', 'LIQUIDITY_PROVIDER', 'MARKET_MAKER'] as const) {
    const result = evaluatePrelaunchProject({
      projectId: `relation-control-${relation.toLowerCase().replaceAll('_', '-')}`,
      receipts: [
        { observedOn: '2026-01-01', kind: 'PUBLIC_CODE', sourceRef: 'fixture:public-code' },
        { observedOn: '2026-01-02', kind: 'TESTNET_DEPLOYMENT', sourceRef: 'fixture:testnet' },
        {
          observedOn: '2026-01-03',
          kind: 'INSTITUTIONAL_RELATION',
          entity: 'Example Institution',
          relation,
          sourceRef: 'fixture:relationship'
        }
      ]
    }, '2026-01-04');

    assert.equal(result.status, 'TECHNICAL_ONLY');
    assert.deepEqual(result.backingEntities, []);
    assert.deepEqual(result.nonBackingRelations, [{ entity: 'Example Institution', relation }]);
  }
});

test('missing source or relation evidence fails closed', () => {
  assert.throws(() => evaluatePrelaunchProject({
    projectId: 'bad-source',
    receipts: [{ observedOn: '2026-01-01', kind: 'PUBLIC_CODE', sourceRef: '' }]
  }, '2026-01-02'), /PRELAUNCH_SCOUT_SOURCE_REQUIRED/);

  assert.throws(() => evaluatePrelaunchProject({
    projectId: 'bad-relation',
    receipts: [{
      observedOn: '2026-01-01',
      kind: 'INSTITUTIONAL_RELATION',
      entity: 'Example Institution',
      sourceRef: 'fixture:relationship'
    }]
  }, '2026-01-02'), /PRELAUNCH_SCOUT_RELATION_REQUIRED/);
});
