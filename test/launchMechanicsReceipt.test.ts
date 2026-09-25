import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  deriveLaunchMechanicsReceiptDigest,
  validateLaunchMechanicsReceipt
} from '../src/launchMechanics/receipt.js';

const RECEIPT_URL = new URL('../docs/LAUNCH_MECHANICS_VERIFICATION_V0.json', import.meta.url);
const MANIFEST_URL = new URL('../docs/CAPABILITY_MANIFEST_V0.json', import.meta.url);

async function fixture(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(RECEIPT_URL, 'utf8')) as Record<string, unknown>;
}

async function resign(value: Record<string, unknown>): Promise<Record<string, unknown>> {
  value.receiptDigest = await deriveLaunchMechanicsReceiptDigest(value);
  return value;
}

test('canonical launch-mechanics receipt validates and has a deterministic digest', async () => {
  const receipt = await fixture();
  await validateLaunchMechanicsReceipt(receipt);
  assert.equal(await deriveLaunchMechanicsReceiptDigest(receipt), receipt.receiptDigest);
  const reordered = Object.fromEntries(Object.entries(receipt).reverse());
  assert.equal(await deriveLaunchMechanicsReceiptDigest(reordered), receipt.receiptDigest);
});

test('launch-mechanics receipt is chain-bound and validates EVM addresses', async () => {
  const wrongChain = await resign({ ...(await fixture()), chainId: 1 });
  await assert.rejects(validateLaunchMechanicsReceipt(wrongChain), /LAUNCH_MECHANICS_CHAIN_INVALID/);

  const badAddress = await fixture();
  const rail = badAddress.launchRail as { selectedVariant: { authority: { launcherAddress: string } } };
  rail.selectedVariant.authority.launcherAddress = 'not-an-address';
  await resign(badAddress);
  await assert.rejects(validateLaunchMechanicsReceipt(badAddress), /LAUNCH_MECHANICS_ADDRESS_INVALID/);
});

test('substantive claims require evidence classification and known evidence', async () => {
  const missingClass = await fixture();
  const token = missingClass.tokenMechanics as { fixedSupply: Record<string, unknown> };
  delete token.fixedSupply.evidenceClass;
  await resign(missingClass);
  await assert.rejects(validateLaunchMechanicsReceipt(missingClass), /EVIDENCE_CLASS_REQUIRED/);

  const unknownRef = await fixture();
  const fixed = (unknownRef.tokenMechanics as { fixedSupply: { evidenceRefs: string[] } }).fixedSupply;
  fixed.evidenceRefs = ['missing-source'];
  await resign(unknownRef);
  await assert.rejects(validateLaunchMechanicsReceipt(unknownRef), /EVIDENCE_REF_UNKNOWN/);
});

test('unresolved findings cannot be rendered as verified', async () => {
  const receipt = await fixture();
  const finding = (receipt.unresolvedFindings as Array<Record<string, unknown>>)[0]!;
  finding.evidenceClass = 'ON_CHAIN_VERIFIED';
  await resign(receipt);
  await assert.rejects(validateLaunchMechanicsReceipt(receipt), /UNRESOLVED_RENDERED_AS_VERIFIED/);
});

test('ambiguous authority addresses and malformed receipts fail closed', async () => {
  const duplicate = await fixture();
  const rail = duplicate.launchRail as {
    selectedVariant: { authority: { launcherAddress: string; lockerAddress: string } };
  };
  rail.selectedVariant.authority.lockerAddress = rail.selectedVariant.authority.launcherAddress;
  await resign(duplicate);
  await assert.rejects(validateLaunchMechanicsReceipt(duplicate), /AUTHORITY_ADDRESS_AMBIGUOUS/);

  await assert.rejects(validateLaunchMechanicsReceipt(null), /RECEIPT_INVALID/);
  await assert.rejects(validateLaunchMechanicsReceipt({}), /SCHEMA_INVALID/);
});

test('receipt existence cannot authorize launch or marketing', async () => {
  const receipt = await fixture();
  const authority = receipt.launchAuthority as Record<string, unknown>;
  assert.deepEqual(authority, {
    launchAuthorization: 'BLOCKED',
    marketingAuthorized: false,
    tokenState: 'NOT_LAUNCHED',
    receiptAuthorizesLaunch: false
  });

  authority.launchAuthorization = 'AUTHORIZED';
  authority.marketingAuthorized = true;
  await resign(receipt);
  await assert.rejects(validateLaunchMechanicsReceipt(receipt), /AUTHORIZATION_ESCALATION/);

  const manifest = JSON.parse(await readFile(MANIFEST_URL, 'utf8')) as {
    capabilities: { launchMechanicsV0: { launchAuthorizationEffect: string } };
    launchAuthorization: {
      status: string;
      marketingAuthorized: boolean;
      launchAuthorized: boolean;
      tokenState: string;
      receiptExistenceAuthorizesLaunch: boolean;
    };
  };
  assert.equal(manifest.capabilities.launchMechanicsV0.launchAuthorizationEffect, 'NONE');
  assert.deepEqual(manifest.launchAuthorization, {
    ...manifest.launchAuthorization,
    status: 'BLOCKED',
    marketingAuthorized: false,
    launchAuthorized: false,
    tokenState: 'NOT_LAUNCHED',
    receiptExistenceAuthorizesLaunch: false
  });
});

test('launch status remains consistent across doctrine and public status surfaces', async () => {
  const [roadmap, doctrine, manifestText, telegram, dumpster, holder] = await Promise.all([
    readFile(new URL('../docs/ROADMAP_V0.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/TOKEN_LAUNCH_DOCTRINE.md', import.meta.url), 'utf8'),
    readFile(MANIFEST_URL, 'utf8'),
    readFile(new URL('../src/telegram/rat.ts', import.meta.url), 'utf8'),
    readFile(new URL('../docs/DUMPSTER_LEDGER_V0.md', import.meta.url), 'utf8'),
    readFile(new URL('../src/holder/eligibility.ts', import.meta.url), 'utf8')
  ]);

  assert.match(roadmap, /BLOCKED.*marketingAuthorized=false.*tokenState=NOT_LAUNCHED/);
  assert.match(doctrine, /marketingAuthorized.*launchAuthorized.*false/);
  const status=(JSON.parse(manifestText) as {
    launchAuthorization:{status:string;tokenState:string;marketingAuthorized:boolean;launchAuthorized:boolean}
  }).launchAuthorization;
  assert.equal(status.status,'BLOCKED');
  assert.equal(status.tokenState,'NOT_LAUNCHED');
  assert.equal(status.marketingAuthorized,false);
  assert.equal(status.launchAuthorized,false);
  assert.match(telegram, /no official \$BINRAT token is launched yet\./);
  assert.match(dumpster, /tokenState: NOT_LAUNCHED/);
  assert.match(dumpster, /launchAuthorization: BLOCKED/);
  assert.match(holder, /TOKEN_AUTHORITY_NOT_CONFIGURED/);
});
