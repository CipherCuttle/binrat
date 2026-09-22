import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PONS_EXPECTED_CONFIG_0,
  PONS_EXPECTED_FEE_POLICY,
  PONS_EXPECTED_LAUNCH_FEE_WEI,
  PONS_NATIVE_PAIR_TOKEN,
  PONS_V2_FACTORY,
  PONS_V2_LAUNCH_DEPLOYER,
  PONS_V2_LAUNCH_DEPLOYER_RUNTIME_CODE_HASH,
  PONS_V2_MEME_HOOK,
  ROBINHOOD_CHAIN_ID,
  buildPonsLaunchReadinessReceipt
} from '../src/ponsLaunchReceipt/receipt.js';

test('Pons BINRAT launch policy pins native ETH config 0 economics', () => {
  assert.equal(ROBINHOOD_CHAIN_ID, 4663);
  assert.equal(PONS_V2_FACTORY, '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e');
  assert.equal(PONS_NATIVE_PAIR_TOKEN, '0x0000000000000000000000000000000000000000');
  assert.equal(PONS_V2_MEME_HOOK, '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044');
  assert.equal(PONS_V2_LAUNCH_DEPLOYER, '0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42');
  assert.equal(
    PONS_V2_LAUNCH_DEPLOYER_RUNTIME_CODE_HASH,
    '0xeade22566c766377f6adfb99534f2772251efad9568642c0704a7051418e624c'
  );
  assert.deepEqual(PONS_EXPECTED_CONFIG_0, {
    supply: 1_000_000_000n * 10n ** 18n,
    curveFeeBps: 100n,
    phantomQuote: 1_680_000_000_000_000_000n,
    graduationThreshold: 4_200_000_000_000_000_000n,
    poolFee: 0,
    tickSpacing: 200,
    enabled: true
  });
  assert.equal(PONS_EXPECTED_LAUNCH_FEE_WEI, 500_000_000_000_000n);
  assert.deepEqual(PONS_EXPECTED_FEE_POLICY, {
    protocolFeeShareBps: 3_000n,
    buybackBurnBps: 5_000n,
    hookFeeBps: 100n,
    maxInternalPriceImpactBps: 300n
  });
});

test('receipt fails closed on the wrong chain before launch reads or simulation', async () => {
  const fake = {
    getChainId: async () => 1,
    getBlockNumber: async () => 123n,
    getBlock: async () => ({ hash: `0x${'1'.repeat(64)}`, timestamp: 1_700_000_000n }),
    getCode: async () => undefined
  };
  const receipt = await buildPonsLaunchReadinessReceipt(fake as any);
  assert.equal(receipt.status, 'BLOCKED');
  assert.equal(receipt.readOnly, true);
  assert.equal(receipt.launchAuthorizationEffect, 'NONE');
  assert.equal(receipt.simulation.status, 'NOT_RUN_WRONG_CHAIN_OR_FACTORY');
  assert.equal(receipt.checks.find((item) => item.id === 'CHAIN_ID')?.status, 'BLOCKED');
});

test('Pons launch receipt code contains no wallet/signing/broadcast surface', async () => {
  const moduleSource = await readFile(
    new URL('../src/ponsLaunchReceipt/receipt.ts', import.meta.url),
    'utf8'
  );
  const cliSource = await readFile(
    new URL('../scripts/pons-launch-receipt.ts', import.meta.url),
    'utf8'
  );
  const source = `${moduleSource}\n${cliSource}`;
  for (const forbidden of [
    'createWalletClient',
    'privateKeyToAccount',
    'writeContract',
    'sendTransaction',
    'signTransaction',
    'signTypedData',
    'sendRawTransaction'
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden launch surface: ${forbidden}`);
  }
  assert.match(source, /client\.call\(/);
  assert.match(source, /creatorTaxBps:\s*0/);
  assert.match(source, /buybackEnabled:\s*false/);
  assert.match(source, /founderOpeningBuy:\s*'NONE'/);
  assert.match(source, /FEE_RECIPIENT_BINDING/);
  assert.match(source, /PONS_V2_LAUNCH_DEPLOYER_RUNTIME_CODE_HASH/);
  assert.match(source, /BINRAT_PONS_SALT_ZERO/);
});

test('CLI requires owner inputs instead of inventing deployer, fee recipient or salt', async () => {
  const cliSource = await readFile(
    new URL('../scripts/pons-launch-receipt.ts', import.meta.url),
    'utf8'
  );
  assert.match(cliSource, /BINRAT_PONS_DEPLOYER/);
  assert.match(cliSource, /BINRAT_PONS_FEE_RECIPIENT/);
  assert.match(cliSource, /BINRAT_PONS_SALT/);
  assert.doesNotMatch(cliSource, /randomBytes|Math\.random/);
});
