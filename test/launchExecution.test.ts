import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeAbiParameters, getAddress, keccak256, toHex, type Address, type Hex } from 'viem';
import {
  ARCPAD_LAUNCHER_ADDRESS,
  buildUnsignedLaunchIntent,
  decodeLaunchCalldata,
  encodeLaunchCalldata,
  reconcileLaunchExecutionEvidence
} from '../src/launchExecution/dryRun.js';
import { BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS, validateLaunchConfig } from '../src/launchConfig/config.js';
import { readFile } from 'node:fs/promises';

const CONFIG_URL = new URL('../docs/BINRAT_LAUNCH_CONFIG_V0.json', import.meta.url);
const ZERO_HASH = `0x${'1'.repeat(64)}` as Hex;
const METADATA = {
  name: 'Dry Run Calibration',
  symbol: 'DRY',
  imageURI: '',
  website: '',
  twitter: '',
  telegram: '',
  salt: `0x${'2'.repeat(64)}` as Hex
};

test('launch calldata uses the verified selector and round-trips exact parameters', () => {
  const calldata = encodeLaunchCalldata(METADATA);
  assert.equal(calldata.slice(0, 10), '0xce5798cd');
  assert.deepEqual(decodeLaunchCalldata(calldata), {
    functionName: 'createToken',
    ...METADATA
  });
});

test('unsigned intent binds rail/config/matrix and keeps first buy and value disabled', async () => {
  const client = fakeClient();
  const intent = await buildUnsignedLaunchIntent(client as any, { metadata: METADATA });
  assert.equal(intent.status, 'OWNER_INPUT_REQUIRED');
  assert.equal((intent.function as any).selector, '0xce5798cd');
  assert.equal((intent.transaction as any).data !== null, true);
  assert.equal((intent.transaction as any).value, '0x0');
  assert.equal((intent.parameters as any).creatorFirstBuy.enabled, false);
  assert.equal((intent.parameters as any).creatorFirstBuy.amountRaw, '0');
  assert.equal((intent.requiredFunds as any).usdcApprovalRaw, '0');
  assert.equal((intent.requiredFunds as any).permitRequired, false);
  assert.equal((intent.bindings as any).launchConfigDigest, 'f631e43287a3bcb6a6da6a7f405d1ad2e3b17c9648b5928dc7c8a3a32890e1f8');
  assert.equal((intent.bindings as any).launchMechanicsReceiptDigest, 'aff37d6d82cced00a34284453c0327bb51e5624b5761b621264f55602e8245e6');
  assert.equal((intent.bindings as any).gateMatrixDigest, 'd244d4b8d19d17679adee0e995dbbf4845f321702ea91bfcc646497e6f2ce73b');
  assert.equal((intent.creationStatus as string), 'NOT_EXECUTED');
});

test('wrong signer role is rejected without accessing a key', async () => {
  const client = fakeClient();
  const wrongSigner = getAddress('0x1111111111111111111111111111111111111111') as Address;
  await assert.rejects(
    buildUnsignedLaunchIntent(client as any, { metadata: METADATA, signer: wrongSigner }),
    /LAUNCH_SIGNER_FEE_RECIPIENT_MISMATCH/
  );
});

test('future launch authorization remains blocked regardless of dry-run calldata', async () => {
  const config = JSON.parse(await readFile(CONFIG_URL, 'utf8')) as any;
  await validateLaunchConfig(config);
  assert.equal(config.launchAuthority.launchAuthorization, 'BLOCKED');
  assert.equal(config.launchAuthority.launchAuthorized, false);
  assert.equal(config.launchAuthority.marketingAuthorized, false);
  assert.equal(config.token.state, 'NOT_LAUNCHED');
});

test('post-launch reconciler rejects unrelated transaction and wrong launcher', async () => {
  await assert.rejects(
    reconcileLaunchExecutionEvidence(baseEvidence({ to: getAddress('0x1111111111111111111111111111111111111111') })),
    /LAUNCH_RECONCILE_WRONG_LAUNCHER/
  );
});

test('post-launch reconciler rejects wrong fee recipient and privileged first buy', async () => {
  await assert.rejects(
    reconcileLaunchExecutionEvidence(baseEvidence({
      from: getAddress('0x1111111111111111111111111111111111111111')
    })),
    /LAUNCH_RECONCILE_WRONG_FEE_RECIPIENT/
  );
  await assert.rejects(
    reconcileLaunchExecutionEvidence(baseEvidence({ value: 1n })),
    /LAUNCH_RECONCILE_PRIVILEGED_FIRST_BUY/
  );
});

test('post-launch reconciler accepts only a complete no-first-buy launch evidence shape', async () => {
  const evidence = baseEvidence({
    input: encodeLaunchCalldata(METADATA)
  });
  const token = getAddress('0x2222222222222222222222222222222222222222');
  const pool = getAddress('0x3333333333333333333333333333333333333333');
  const launcher = getAddress(ARCPAD_LAUNCHER_ADDRESS);
  const creator = getAddress(BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS);
  evidence.receipt.logs = [
    {
      address: launcher,
      topics: [
        topic('TokenCreated(address,address,string,string,address,string,string,string,string)'),
        topicAddress(token),
        topicAddress(creator)
      ],
      data: encodeAbiParameters(
        [{ type: 'string' }, { type: 'string' }, { type: 'address' }, { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'string' }],
        [METADATA.name, METADATA.symbol, pool, METADATA.imageURI, METADATA.website, METADATA.twitter, METADATA.telegram]
      )
    },
    {
      address: getAddress('0xf0db7b58379503491d857dB50AC9ece64c653918'),
      topics: [
        topic('PoolCreated(address,address,uint24,int24,address)'),
        topicAddress('0x3600000000000000000000000000000000000000'),
        topicAddress(token),
        topicUint(10000)
      ],
      data: encodeAbiParameters([{ type: 'int24' }, { type: 'address' }], [200, pool])
    },
    {
      address: getAddress('0x69A615DD32B89fE40D87b2e3123baE4162f2d450'),
      topics: [
        topic('PositionLocked(uint256,address,address)'),
        topicUint(123),
        topicAddress(token),
        topicAddress(creator)
      ],
      data: '0x'
    },
    transferLog(token, '0x0000000000000000000000000000000000000000', launcher),
    transferLog(token, launcher, pool)
  ];
  const result = await reconcileLaunchExecutionEvidence(evidence);
  const resultAny = result as any;
  assert.equal(result.executionStatus, 'EXECUTED');
  assert.equal(result.validationStatus, 'PASS');
  assert.equal(result.tokenAddress, token);
  assert.equal(resultAny.pool.address, pool);
  assert.equal(resultAny.liquidityPosition.positionId, '123');
  assert.equal(resultAny.allocationVerification.privilegedCreatorFirstBuyObserved, false);
  assert.equal(resultAny.authorities.projectFeeRecipient.address, BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS);
});

function fakeClient() {
  return {
    getChainId: async () => 5042,
    getBlock: async () => ({ baseFeePerGas: 20_000_000_000n }),
    request: async () => '0x0cb c0d36'.replace(' ', ''),
    getTransactionCount: async () => 7
  };
}

function baseEvidence(overrides: Partial<ReconcileEvidenceInput['transaction']> = {}): ReconcileEvidenceInput {
  return {
    transaction: {
      hash: ZERO_HASH,
      from: BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS,
      to: ARCPAD_LAUNCHER_ADDRESS,
      input: '0x' as Hex,
      value: 0n,
      blockNumber: 10n,
      ...overrides
    },
    receipt: {
      status: '0x1',
      blockNumber: 10n,
      blockHash: ZERO_HASH,
      logs: []
    },
    blockTimestamp: 1_700_000_000n,
    totalSupply: 1_000_000_000_000_000_000n,
    decimals: 18
  };
}

type ReconcileEvidenceInput = Parameters<typeof reconcileLaunchExecutionEvidence>[0];

function topic(signature: string): Hex {
  return keccak256(toHex(signature));
}

function topicAddress(address: string): Hex {
  return `0x${'0'.repeat(24)}${address.slice(2).toLowerCase()}` as Hex;
}

function topicUint(value: number): Hex {
  return `0x${BigInt(value).toString(16).padStart(64, '0')}` as Hex;
}

function transferLog(token: Address, from: Address | string, to: Address): ReconcileEvidenceInput['receipt']['logs'][number] {
  return {
    address: token,
    topics: [
      topic('Transfer(address,address,uint256)'),
      topicAddress(from),
      topicAddress(to)
    ],
    data: topicUint(1000)
  };
}
