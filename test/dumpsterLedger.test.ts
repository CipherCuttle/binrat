import assert from 'node:assert/strict';
import test from 'node:test';
import { ARC_CHAIN_ID } from '../src/arc/chain.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { handleWorkerRequest, type BinratWorkerEnv } from '../src/cloudflare/worker.js';
import type { Hex } from '../src/core/types.js';
import {
  FUNDING_CONFIG_SCHEMA_VERSION,
  resolveProductionFundingConfig,
  validateFundingConfig,
  type FundingConfigResolution
} from '../src/dumpsterLedger/config.js';
import {
  buildDumpsterLedgerEntry,
  normalizeDumpsterLedgerEntries,
  type DumpsterLedgerEntryInput
} from '../src/dumpsterLedger/entries.js';
import { projectDumpsterLedger } from '../src/dumpsterLedger/project.js';
import { LAUNCH_MECHANICS_RECEIPT_DIGEST } from '../src/launchConfig/config.js';
import type { CapabilityManifest } from '../src/telegram/rat.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const TOKEN = address(1);
const FEE = address(2);
const TREASURY = address(3);
const EXTERNAL = address(4);
const VENDOR = address(5);

const manifest: CapabilityManifest = {
  schemaVersion: 'binrat.capability-manifest/0.1',
  capabilities: {
    replayLab: {
      engineeringStatus: 'ENGINEERING_PASS',
      deploymentStatus: 'CLOUDFLARE_LIVE_VERIFIED',
      publicStatus: 'PUBLIC_LIVE_BETA'
    },
    dumpsterLedger: {
      engineeringStatus: 'ENGINEERING_PASS',
      deploymentStatus: 'CLOUDFLARE_LIVE_VERIFIED',
      publicStatus: 'PRE_LAUNCH_TRANSPARENCY_LIVE'
    },
    ratDenV0: { engineeringStatus: 'PLANNED', publicStatus: 'NOT_PUBLIC_LIVE_AUTHORIZED' },
    holderGateV0: {
      engineeringStatus: 'ENGINEERING_PASS',
      deploymentStatus: 'CLOUDFLARE_DEPLOYED_FAIL_CLOSED',
      publicStatus: 'TOKEN_AUTHORITY_NOT_CONFIGURED'
    }
  },
  launchAuthorization: {
    status: 'BLOCKED',
    marketingAuthorized: false,
    launchAuthorized: false,
    tokenState: 'NOT_LAUNCHED'
  },
  invariant: 'Degen can decide attention and priority. It cannot decide what is true.'
};

test('empty production ledger is useful, manifest-derived, and fail-closed pre-launch', async () => {
  const funding = resolveProductionFundingConfig(undefined, ARC_CHAIN_ID);
  const ledger = await projectDumpsterLedger(manifest, funding, []);

  assert.equal(ledger.accountingState, 'PRE_LAUNCH_AUTHORITIES_CONFIGURED');
  assert.equal(ledger.fundingAuthority.status, 'PRELAUNCH_AUTHORITIES_CONFIGURED');
  assert.equal(ledger.fundingAuthority.accountingEnabled, false);
  assert.equal(ledger.tokenState, 'NOT_LAUNCHED');
  assert.equal(ledger.launchAuthorization, 'BLOCKED');
  assert.equal(ledger.marketingAuthorized, false);
  assert.deepEqual(ledger.fundingAuthority.creatorFeeRecipients, []);
  assert.deepEqual(ledger.fundingAuthority.treasuryAddresses, []);
  assert.equal(ledger.configuredAuthorities.treasury.role, 'TREASURY');
  assert.equal(ledger.configuredAuthorities.projectFeeRecipient.role, 'PROJECT_FEE_RECIPIENT');
  assert.equal(ledger.configuredAuthorities.onChainRoleProof, 'NOT_YET_AVAILABLE');
  assert.equal(ledger.observedDataAvailability.launchTransaction, 'NOT_YET_AVAILABLE');
  assert.equal(ledger.totals.entryCount, 0);
  assert.equal(ledger.totals.tokenInflowsRaw, '0');
  assert.equal(ledger.totals.tokenOutflowsRaw, '0');
  assert.deepEqual(ledger.entries, []);
  assert.deepEqual(
    ledger.utilityStatus.shipped.map((item) => item.capability),
    ['dumpsterLedger', 'replayLab']
  );
  assert.deepEqual(ledger.utilityStatus.planned.map((item) => item.capability), ['ratDenV0']);
  assert.deepEqual(ledger.utilityStatus.building.map((item) => item.capability), ['holderGateV0']);
  assert.match(ledger.receipt.receiptId, /^binrat-dumpster-ledger:[0-9a-f]{64}$/);
});

test('pre-launch projection rejects contradictory launch authorization state', async () => {
  const contradictory: CapabilityManifest = {
    ...manifest,
    launchAuthorization: {
      status: 'AUTHORIZED',
      marketingAuthorized: true,
      launchAuthorized: true,
      tokenState: 'LAUNCHED'
    }
  };
  await assert.rejects(
    projectDumpsterLedger(
      contradictory,
      resolveProductionFundingConfig(undefined, ARC_CHAIN_ID),
      []
    ),
    /DUMPSTER_LEDGER_STATUS_CONTRADICTION/
  );
});

test('fixture inflow and outflow preserve raw values, unknown category, totals and ordering', async () => {
  const config = fixtureConfig();
  const inflow = await buildDumpsterLedgerEntry(config, entry({
    direction: 'INFLOW',
    fundingRole: 'CREATOR_FEE',
    category: 'UNCATEGORIZED',
    from: EXTERNAL,
    to: FEE,
    amountRaw: '100000000000000000001',
    blockNumber: 101n,
    transactionHash: hash(11),
    logIndex: 2
  }));
  const outflow = await buildDumpsterLedgerEntry(config, entry({
    direction: 'OUTFLOW',
    fundingRole: 'PROJECT_EXPENSE',
    category: 'PROJECT_EXPENSE',
    from: TREASURY,
    to: VENDOR,
    amountRaw: '30000000000000000001',
    blockNumber: 102n,
    transactionHash: hash(12),
    logIndex: 1
  }));
  assert.equal(Object.isFrozen(inflow), true);

  const funding: FundingConfigResolution = {
    status: 'FUNDING_OBSERVATION_SOURCE_NOT_IMPLEMENTED',
    config
  };
  const forward = await projectDumpsterLedger(manifest, funding, [outflow, inflow], 'TEST_FIXTURE');
  const reverse = await projectDumpsterLedger(manifest, funding, [inflow, outflow], 'TEST_FIXTURE');
  assert.deepEqual(forward, reverse);
  assert.equal(forward.accountingState, 'TEST_FIXTURE');
  assert.equal(forward.totals.entryCount, 2);
  assert.equal(forward.totals.inflowEntryCount, 1);
  assert.equal(forward.totals.outflowEntryCount, 1);
  assert.equal(forward.totals.tokenInflowsRaw, '100000000000000000001');
  assert.equal(forward.totals.tokenOutflowsRaw, '30000000000000000001');
  assert.equal(forward.entries[0]?.category, 'UNCATEGORIZED');
  assert.equal(forward.entries[0]?.amountRaw, '100000000000000000001');
  assert.deepEqual(forward.entries[0]?.links, { transaction: null, from: null, to: null });
});

test('duplicate entries are idempotent and conflicting tx/log replay is rejected', async () => {
  const config = fixtureConfig();
  const first = await buildDumpsterLedgerEntry(config, entry({
    direction: 'INFLOW', fundingRole: 'TREASURY', category: 'TREASURY_FUNDING',
    from: EXTERNAL, to: TREASURY, amountRaw: '10', transactionHash: hash(21), logIndex: 7
  }));
  assert.equal((await normalizeDumpsterLedgerEntries(config, [first, first])).length, 1);

  const conflict = await buildDumpsterLedgerEntry(config, entry({
    direction: 'INFLOW', fundingRole: 'TREASURY', category: 'TREASURY_FUNDING',
    from: EXTERNAL, to: TREASURY, amountRaw: '11', transactionHash: hash(21), logIndex: 7
  }));
  assert.equal(conflict.entryId, first.entryId);
  await assert.rejects(
    normalizeDumpsterLedgerEntries(config, [first, conflict]),
    /DUMPSTER_LEDGER_ENTRY_CONFLICT/
  );
});

test('entry validation rejects wrong chain, authority, direction and ambiguous amounts', async () => {
  const config = fixtureConfig();
  await assert.rejects(
    buildDumpsterLedgerEntry(config, { ...entry({}), chainId: 1 }),
    /DUMPSTER_LEDGER_CHAIN_MISMATCH/
  );
  await assert.rejects(
    buildDumpsterLedgerEntry(config, entry({
      direction: 'INFLOW', fundingRole: 'TREASURY', category: 'TREASURY_FUNDING',
      from: EXTERNAL, to: VENDOR
    })),
    /DUMPSTER_LEDGER_FUNDING_AUTHORITY_MISMATCH/
  );
  await assert.rejects(
    buildDumpsterLedgerEntry(config, entry({
      direction: 'OUTFLOW', fundingRole: 'PROJECT_EXPENSE', category: 'PROJECT_EXPENSE',
      from: EXTERNAL, to: TREASURY
    })),
    /DUMPSTER_LEDGER_FUNDING_AUTHORITY_MISMATCH/
  );
  await assert.rejects(
    buildDumpsterLedgerEntry(config, entry({ tokenAddress: VENDOR })),
    /DUMPSTER_LEDGER_ASSET_AUTHORITY_MISMATCH/
  );
  await assert.rejects(
    buildDumpsterLedgerEntry(config, entry({ from: TREASURY, to: FEE })),
    /DUMPSTER_LEDGER_INTERNAL_TRANSFER_UNCLASSIFIED/
  );
  await assert.rejects(
    buildDumpsterLedgerEntry(config, entry({
      direction: 'OUTFLOW', fundingRole: 'PROJECT_EXPENSE', category: 'PROJECT_EXPENSE',
      from: TREASURY, to: FEE
    })),
    /DUMPSTER_LEDGER_INTERNAL_TRANSFER_UNCLASSIFIED/
  );
  await assert.rejects(
    buildDumpsterLedgerEntry(config, {
      ...entry({}), assetType: 'UNSUPPORTED' as DumpsterLedgerEntryInput['assetType']
    }),
    /DUMPSTER_LEDGER_ENTRY_INVALID/
  );
  for (const amountRaw of ['-0', '-1', '00', '01', '1.0']) {
    await assert.rejects(
      buildDumpsterLedgerEntry(config, entry({ amountRaw })),
      /DUMPSTER_LEDGER_ENTRY_INVALID/
    );
  }
});

test('production funding configuration never defaults open and fixtures cannot leak', async () => {
  const missing = resolveProductionFundingConfig(undefined, ARC_CHAIN_ID);
  assert.equal(missing.status, 'PRELAUNCH_AUTHORITIES_CONFIGURED');
  assert.equal(missing.config, null);
  assert.equal(
    resolveProductionFundingConfig('{bad json', ARC_CHAIN_ID).status,
    'TREASURY_AUTHORITY_INVALID'
  );
  assert.equal(resolveProductionFundingConfig(JSON.stringify({
    ...fixtureConfigInput(),
    configVersion: 'PRODUCTION_V0',
    categoryPolicyVersion: 'PRODUCTION_POLICY_V0',
    chainId: 1
  }), ARC_CHAIN_ID).status, 'TREASURY_AUTHORITY_INVALID');
  assert.equal(resolveProductionFundingConfig(JSON.stringify({
    ...fixtureConfigInput(),
    configVersion: 'PRODUCTION_V0',
    categoryPolicyVersion: 'PRODUCTION_POLICY_V0',
    treasuryAddresses: [TREASURY, TREASURY]
  }), ARC_CHAIN_ID).status, 'TREASURY_AUTHORITY_INVALID');
  const validButInactive = resolveProductionFundingConfig(JSON.stringify({
    ...fixtureConfigInput(),
    configVersion: 'PRODUCTION_V0',
    categoryPolicyVersion: 'PRODUCTION_POLICY_V0',
    creatorFeeRecipients: ['0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866'],
    treasuryAddresses: ['0xab063A9b53a2Ab832a941aE5890ea05c1672339D']
  }), ARC_CHAIN_ID);
  assert.equal(validButInactive.status, 'FUNDING_OBSERVATION_SOURCE_NOT_IMPLEMENTED');
  assert.equal((await projectDumpsterLedger(manifest, validButInactive, [])).accountingState, 'FAIL_CLOSED');
  assert.equal(resolveProductionFundingConfig(JSON.stringify({
    ...fixtureConfigInput(),
    configVersion: 'PRODUCTION_V0',
    categoryPolicyVersion: 'PRODUCTION_POLICY_V0',
    creatorFeeRecipients: ['0xab063A9b53a2Ab832a941aE5890ea05c1672339D'],
    treasuryAddresses: ['0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866']
  }), ARC_CHAIN_ID).status, 'TREASURY_AUTHORITY_INVALID');
  assert.equal(resolveProductionFundingConfig(JSON.stringify({
    ...fixtureConfigInput(),
    configVersion: 'PRODUCTION_V0',
    categoryPolicyVersion: 'PRODUCTION_POLICY_V0',
    treasuryAddresses: []
  }), ARC_CHAIN_ID).status, 'TREASURY_AUTHORITY_INVALID');

  const config = fixtureConfig();
  const fixture = await buildDumpsterLedgerEntry(config, entry({}));
  await assert.rejects(
    projectDumpsterLedger(manifest, {
      status: 'FUNDING_OBSERVATION_SOURCE_NOT_IMPLEMENTED', config
    }, [fixture], 'PRODUCTION'),
    /DUMPSTER_LEDGER_FIXTURE_LEAK_BLOCKED/
  );
});

test('Cloudflare exposes the empty ledger without changing existing public routing', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const env: BinratWorkerEnv = {
    DB: db,
    CAPABILITY_MANIFEST_JSON: JSON.stringify(manifest)
  };
  try {
    const ledgerResponse = await handleWorkerRequest(
      new Request('https://binrat.example/api/dumpster-ledger'),
      env
    );
    assert.equal(ledgerResponse.status, 200);
    const ledger = await ledgerResponse.json() as {
      schemaVersion: string;
      fundingAuthority: { status: string };
      totals: { entryCount: number };
    };
    assert.equal(ledger.schemaVersion, 'binrat.dumpster-ledger/0.1');
    assert.equal(ledger.fundingAuthority.status, 'PRELAUNCH_AUTHORITIES_CONFIGURED');
    assert.equal(ledger.totals.entryCount, 0);

    assert.equal((await handleWorkerRequest(
      new Request('https://binrat.example/api/capabilities'), env
    )).status, 200);
    assert.equal((await handleWorkerRequest(
      new Request('https://binrat.example/api/health'), env
    )).status, 200);
  } finally {
    db.close();
  }
});

function fixtureConfig() {
  return validateFundingConfig(fixtureConfigInput(), ARC_CHAIN_ID, 'TEST_FIXTURE');
}

function fixtureConfigInput() {
  return {
    schemaVersion: FUNDING_CONFIG_SCHEMA_VERSION,
    configVersion: 'TEST_FUNDING_V0',
    categoryPolicyVersion: 'TEST_CATEGORY_V0',
    chainId: ARC_CHAIN_ID,
    accountingEnabled: true,
    accountingObserverActivated: true,
    launchMechanicsReceiptDigest: LAUNCH_MECHANICS_RECEIPT_DIGEST,
    effectiveFromBlock: '100',
    tokenAddress: TOKEN,
    creatorFeeRecipients: [FEE],
    treasuryAddresses: [TREASURY]
  };
}

function entry(overrides: Partial<DumpsterLedgerEntryInput> = {}): DumpsterLedgerEntryInput {
  return {
    chainId: ARC_CHAIN_ID,
    blockNumber: 101n,
    blockHash: hash(101),
    transactionHash: hash(10),
    logIndex: 0,
    from: EXTERNAL,
    to: FEE,
    assetType: 'ERC20',
    tokenAddress: TOKEN,
    amountRaw: '1',
    category: 'CREATOR_FEE_RECEIPT',
    direction: 'INFLOW',
    fundingRole: 'CREATOR_FEE',
    ...overrides
  };
}

function address(seed: number): Hex {
  return `0x${seed.toString(16).padStart(40, '0')}` as Hex;
}

function hash(seed: number): Hex {
  return `0x${seed.toString(16).padStart(64, '0')}` as Hex;
}
