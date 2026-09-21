import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ARCPAD_LAUNCHER_OWNER_ADDRESS,
  ARCPAD_PROTOCOL_TREASURY_ADDRESS,
  BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS,
  BINRAT_TREASURY_ADDRESS,
  LAUNCH_MECHANICS_RECEIPT_DIGEST,
  deriveLaunchConfigDigest,
  deriveLaunchExecutionReceiptDigest,
  validateLaunchConfig,
  validateLaunchExecutionReceipt,
  validateLaunchStatusConsistency
} from '../src/launchConfig/config.js';
import { projectDumpsterLedger } from '../src/dumpsterLedger/project.js';
import { resolveProductionFundingConfig } from '../src/dumpsterLedger/config.js';
import { productionConfigStatus } from '../src/holder/eligibility.js';
import {
  renderRatReply,
  validateCapabilityManifest,
  type CapabilityManifest
} from '../src/telegram/rat.js';

const CONFIG_URL = new URL('../docs/BINRAT_LAUNCH_CONFIG_V0.json', import.meta.url);
const EXECUTION_URL = new URL('../docs/BINRAT_LAUNCH_EXECUTION_RECEIPT_V0.template.json', import.meta.url);
const MANIFEST_URL = new URL('../docs/CAPABILITY_MANIFEST_V0.json', import.meta.url);

async function json(url: URL): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(url, 'utf8')) as Record<string, unknown>;
}

async function resignConfig(value: Record<string, unknown>): Promise<Record<string, unknown>> {
  value.configDigest = await deriveLaunchConfigDigest(value);
  return value;
}

test('canonical Launch Configuration V0 validates with deterministic digest and frozen roles', async () => {
  const config = await json(CONFIG_URL);
  await validateLaunchConfig(config);
  assert.equal(await deriveLaunchConfigDigest(config), config.configDigest);
  assert.equal(
    ((config.authorities as Record<string, unknown>).treasury as Record<string, unknown>).address,
    BINRAT_TREASURY_ADDRESS
  );
  assert.equal(
    ((config.authorities as Record<string, unknown>).projectFeeRecipient as Record<string, unknown>).address,
    BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS
  );
  assert.notEqual(BINRAT_TREASURY_ADDRESS, BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS);
  assert.notEqual(BINRAT_TREASURY_ADDRESS.toLowerCase(), ARCPAD_PROTOCOL_TREASURY_ADDRESS.toLowerCase());
  assert.notEqual(BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS.toLowerCase(), ARCPAD_LAUNCHER_OWNER_ADDRESS.toLowerCase());
});

test('both owner-supplied addresses require canonical EVM checksum and reject zero', async () => {
  const badTreasury = await json(CONFIG_URL);
  const authorities = badTreasury.authorities as {
    treasury: { address: string };
    projectFeeRecipient: { address: string };
  };
  authorities.treasury.address = BINRAT_TREASURY_ADDRESS.toLowerCase();
  await resignConfig(badTreasury);
  await assert.rejects(validateLaunchConfig(badTreasury), /ADDRESS_INVALID/);

  const badFee = await json(CONFIG_URL);
  (badFee.authorities as typeof authorities).projectFeeRecipient.address = 'not-an-address';
  await resignConfig(badFee);
  await assert.rejects(validateLaunchConfig(badFee), /ADDRESS_INVALID/);

  const zero = await json(CONFIG_URL);
  (zero.authorities as typeof authorities).treasury.address =
    '0x0000000000000000000000000000000000000000';
  await resignConfig(zero);
  await assert.rejects(validateLaunchConfig(zero), /ADDRESS_INVALID/);
});

test('wallet roles cannot be silently reversed, duplicated, or confused with ArcPad authorities', async () => {
  const swapped = await json(CONFIG_URL);
  const roles = swapped.authorities as {
    treasury: { role: string; address: string };
    projectFeeRecipient: { role: string; address: string };
  };
  [roles.treasury.address, roles.projectFeeRecipient.address] =
    [roles.projectFeeRecipient.address, roles.treasury.address];
  await resignConfig(swapped);
  await assert.rejects(validateLaunchConfig(swapped), /ROLE_BINDING_INVALID/);

  const duplicate = await json(CONFIG_URL);
  const duplicateRoles = duplicate.authorities as typeof roles;
  duplicateRoles.projectFeeRecipient.address = duplicateRoles.treasury.address;
  await resignConfig(duplicate);
  await assert.rejects(validateLaunchConfig(duplicate), /ROLE_BINDING_INVALID|ROLES_AMBIGUOUS/);

  const protocol = await json(CONFIG_URL);
  (protocol.authorities as typeof roles).treasury.address = ARCPAD_PROTOCOL_TREASURY_ADDRESS;
  await resignConfig(protocol);
  await assert.rejects(validateLaunchConfig(protocol), /ROLE_BINDING_INVALID|PROTOCOL_AUTHORITY_CONFUSION/);
});

test('configured wallets preserve NOT_LAUNCHED and cannot enable launch, accounting, or Holder Gate', async () => {
  const config = await json(CONFIG_URL);
  const token = config.token as Record<string, unknown>;
  const authority = config.launchAuthority as Record<string, unknown>;
  const ledgerConfig = config.dumpsterLedger as Record<string, unknown>;
  assert.deepEqual(
    [token.state, token.addressState, token.address],
    ['NOT_LAUNCHED', 'NOT_YET_CREATED', null]
  );
  assert.deepEqual(
    [authority.launchAuthorization, authority.launchAuthorized, authority.marketingAuthorized],
    ['BLOCKED', false, false]
  );
  assert.equal(ledgerConfig.accountingActive, false);
  assert.equal(productionConfigStatus({}), 'TOKEN_AUTHORITY_NOT_CONFIGURED');

  const manifest = await json(MANIFEST_URL) as unknown as CapabilityManifest;
  const ledger = await projectDumpsterLedger(
    manifest,
    resolveProductionFundingConfig(undefined, 5042),
    []
  );
  assert.equal(ledger.accountingState, 'PRE_LAUNCH_AUTHORITIES_CONFIGURED');
  assert.equal(ledger.fundingAuthority.accountingEnabled, false);
  assert.equal(ledger.configuredAuthorities.treasury.address, BINRAT_TREASURY_ADDRESS);
  assert.equal(
    ledger.configuredAuthorities.projectFeeRecipient.address,
    BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS
  );
  assert.equal(ledger.observedDataAvailability.tokenRelatedInflows, 'NOT_YET_AVAILABLE');
});

test('status consistency validator rejects contradictory token state', async () => {
  const config = await validateLaunchConfig(await json(CONFIG_URL));
  const manifest = await json(MANIFEST_URL);
  validateLaunchStatusConsistency(config, manifest);
  (manifest.launchAuthorization as Record<string, unknown>).tokenState = 'LAUNCHED';
  assert.throws(() => validateLaunchStatusConsistency(config, manifest), /LAUNCH_STATUS_CONTRADICTION/);
  assert.throws(() => validateCapabilityManifest(manifest), /AUTHORIZATION_ESCALATION/);
});

test('canonical Telegram token behavior reports configured roles without escalating launch state', async () => {
  const manifest = await json(MANIFEST_URL) as unknown as CapabilityManifest;
  const reply = await renderRatReply('/token', {
    apiBaseUrl: 'https://binrat.example',
    siteUrl: 'https://binrat.example',
    manifest
  });
  assert.match(reply ?? '', /token state: NOT_LAUNCHED/);
  assert.match(reply ?? '', /launch authorization: BLOCKED/);
  assert.match(reply ?? '', new RegExp(BINRAT_TREASURY_ADDRESS));
  assert.match(reply ?? '', new RegExp(BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS));
  assert.match(reply ?? '', /Holder Gate: TOKEN_AUTHORITY_NOT_CONFIGURED/);
});

test('allocation and first-buy owner policy are explicit and mechanics digest remains bound', async () => {
  const config = await validateLaunchConfig(await json(CONFIG_URL));
  const policy = config.launchPolicy as Record<string, unknown>;
  const disclosure = config.allocationDisclosure as Record<string, unknown>;
  assert.equal(policy.privilegedCreatorFirstBuy, 'DISABLED');
  assert.equal(policy.privatePresale, 'NONE');
  assert.equal(policy.discountedInsiderRound, 'NONE');
  assert.equal(policy.hiddenTeamAllocation, 'NONE');
  assert.equal(disclosure.evidenceClass, 'OWNER_POLICY');
  assert.equal(disclosure.postLaunchOnChainVerification, 'REQUIRED_NOT_YET_AVAILABLE');
  assert.equal(
    ((config.launchRail as Record<string, unknown>).launchMechanicsReceipt as Record<string, unknown>).digest,
    LAUNCH_MECHANICS_RECEIPT_DIGEST
  );
});

test('future execution template and missing launch transaction or token address cannot PASS', async () => {
  const template = await json(EXECUTION_URL);
  await assert.rejects(validateLaunchExecutionReceipt(template), /NOT_EXECUTED/);

  const missingTransaction = await executedFixture();
  missingTransaction.launchTransaction = null;
  missingTransaction.receiptDigest = await deriveLaunchExecutionReceiptDigest(missingTransaction);
  await assert.rejects(validateLaunchExecutionReceipt(missingTransaction), /TRANSACTION_MISSING/);

  const missingToken = await executedFixture();
  missingToken.tokenAddress = null;
  missingToken.receiptDigest = await deriveLaunchExecutionReceiptDigest(missingToken);
  await assert.rejects(validateLaunchExecutionReceipt(missingToken), /TOKEN_ADDRESS_MISSING/);

  const fakeAllocation = await executedFixture();
  (fakeAllocation.allocationVerification as Record<string, unknown>).ownerPolicyMatched = false;
  fakeAllocation.receiptDigest = await deriveLaunchExecutionReceiptDigest(fakeAllocation);
  await assert.rejects(validateLaunchExecutionReceipt(fakeAllocation), /ALLOCATION_MISSING/);
});

test('complete synthetic execution shape validates only as a test of the future schema', async () => {
  await validateLaunchExecutionReceipt(await executedFixture());
});

async function executedFixture(): Promise<Record<string, unknown>> {
  const value = await json(EXECUTION_URL);
  Object.assign(value, {
    executionStatus: 'EXECUTED',
    validationStatus: 'PASS',
    tokenAddress: '0x1111111111111111111111111111111111111111',
    launchTransaction: `0x${'1'.repeat(64)}`,
    launchBlock: 22000000,
    launchBlockHash: `0x${'2'.repeat(64)}`,
    tokenSupply: { raw: '1000000000000000000000000000', decimals: 18 },
    pool: { address: '0x2222222222222222222222222222222222222222' },
    liquidityPosition: { positionId: '1', mintTransaction: `0x${'3'.repeat(64)}` },
    lockerAddress: '0x69A615DD32B89fE40D87b2e3123baE4162f2d450',
    allocationVerification: {
      status: 'PASS',
      evidenceClass: 'POST_LAUNCH_ON_CHAIN_VERIFICATION',
      launchTransactionMatches: true,
      ownerPolicyMatched: true,
      privilegedCreatorFirstBuyObserved: false,
      receiptDigest: '4'.repeat(64),
      verifiedAt: '2026-09-21T12:00:00Z'
    },
    founderProjectPublicPurchase: {
      policy: 'NOT_PLANNED_FOR_LAUNCH',
      observedStatus: 'NONE_OBSERVED',
      transaction: null,
      verificationReceiptDigest: '5'.repeat(64)
    },
    deploymentExecutedAt: '2026-09-21T12:00:00Z'
  });
  value.receiptDigest = await deriveLaunchExecutionReceiptDigest(value);
  return value;
}
