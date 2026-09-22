import {
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  keccak256,
  type Address,
  type Hex,
  type PublicClient
} from 'viem';
import { sha256Hex } from '../evidence/canonical.js';

export const ROBINHOOD_CHAIN_ID = 4663 as const;
export const PONS_V2_FACTORY = getAddress('0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e');
export const PONS_V2_FACTORY_RUNTIME_CODE_HASH =
  '0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84' as Hex;
export const PONS_NATIVE_PAIR_TOKEN =
  '0x0000000000000000000000000000000000000000' as Address;
export const PONS_LAUNCH_CONFIG_ID = 0n;
export const PONS_EXPECTED_LAUNCH_FEE_WEI = 500_000_000_000_000n;

export const PONS_EXPECTED_CONFIG_0 = Object.freeze({
  supply: 1_000_000_000n * 10n ** 18n,
  curveFeeBps: 100n,
  phantomQuote: 1_680_000_000_000_000_000n,
  graduationThreshold: 4_200_000_000_000_000_000n,
  poolFee: 0,
  tickSpacing: 200,
  enabled: true
});

export const PONS_EXPECTED_FEE_POLICY = Object.freeze({
  protocolFeeShareBps: 3_000n,
  buybackBurnBps: 5_000n,
  hookFeeBps: 100n,
  maxInternalPriceImpactBps: 300n
});

export const PONS_EXPECTED_MAX_CREATOR_TAX_BPS = 1_000n;
export const PONS_EXPECTED_SNIPE_TAX_START_BPS = 9_900n;
export const PONS_EXPECTED_SNIPE_TAX_SECONDS = 15n;

export interface PonsLaunchMetadata {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  socials: {
    twitter: string;
    telegram: string;
    discord: string;
    website: string;
    farcaster: string;
  };
}

export interface PonsLaunchReceiptOptions {
  deployer?: Address;
  creatorFeeRecipient?: Address;
  salt?: Hex;
  metadata?: Partial<PonsLaunchMetadata>;
}

export interface PonsLaunchReadinessReceipt {
  schemaVersion: 'binrat.pons-launch-readiness/0.1';
  status: 'PASS' | 'BLOCKED' | 'OWNER_INPUT_REQUIRED';
  readOnly: true;
  generatedAt: string;
  chainId: number;
  snapshotBlock: { number: string; hash: Hex | null };
  authority: {
    factory: Address;
    expectedFactoryRuntimeCodeHash: Hex;
    actualFactoryRuntimeCodeHash: Hex | null;
  };
  ownerInputs: {
    deployer: Address | null;
    creatorFeeRecipient: Address | null;
    salt: Hex | null;
  };
  launchPolicy: {
    pairToken: Address;
    launchConfigId: string;
    creatorTaxBps: 0;
    buybackEnabled: false;
    extraSnipeTaxExemptions: readonly [];
    executionPath: 'DIRECT_FACTORY_LAUNCH_TOKEN';
    founderOpeningBuy: 'NONE';
  };
  observed: Record<string, unknown>;
  checks: Array<{
    id: string;
    status: 'PASS' | 'BLOCKED' | 'OWNER_INPUT_REQUIRED';
    detail: string;
  }>;
  simulation: Record<string, unknown>;
  launchAuthorizationEffect: 'NONE';
  receiptDigest: string;
}

const factoryReadAbi = [
  { type: 'function', name: 'launchEnabled', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'launchFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'maxCreatorTaxBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'snipeTaxStartBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'snipeTaxSeconds', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'launchConfigCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'getLaunchConfig',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'supply', type: 'uint256' },
        { name: 'curveFeeBps', type: 'uint256' },
        { name: 'phantomQuote', type: 'uint256' },
        { name: 'graduationThreshold', type: 'uint256' },
        { name: 'poolFee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'enabled', type: 'bool' }
      ]
    }]
  },
  {
    type: 'function',
    name: 'canLaunch',
    stateMutability: 'view',
    inputs: [{ name: 'launcher', type: 'address' }],
    outputs: [{ type: 'bool' }]
  },
  {
    type: 'function',
    name: 'previewLaunchEconomics',
    stateMutability: 'view',
    inputs: [
      { name: 'launchConfigId', type: 'uint256' },
      { name: 'pairToken', type: 'address' }
    ],
    outputs: [{ type: 'bytes32' }]
  },
  { type: 'function', name: 'memeHook', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'launchDeployer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }
] as const;

const memeHookReadAbi = [{
  type: 'function',
  name: 'currentFeePolicy',
  stateMutability: 'view',
  inputs: [],
  outputs: [{
    type: 'tuple',
    components: [
      { name: 'protocolFeeRecipient', type: 'address' },
      { name: 'protocolFeeShareBps', type: 'uint16' },
      { name: 'buybackBurnBps', type: 'uint16' },
      { name: 'hookFeeBps', type: 'uint16' },
      { name: 'maxInternalPriceImpactBps', type: 'uint16' }
    ]
  }]
}] as const;

const launchDeployerReadAbi = [{
  type: 'function',
  name: 'factory',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ type: 'address' }]
}] as const;

const directLaunchAbi = [{
  type: 'function',
  name: 'launchToken',
  stateMutability: 'payable',
  inputs: [
    {
      name: 'params',
      type: 'tuple',
      components: [
        { name: 'name', type: 'string' },
        { name: 'symbol', type: 'string' },
        { name: 'logo', type: 'string' },
        { name: 'description', type: 'string' },
        {
          name: 'socials',
          type: 'tuple',
          components: [
            { name: 'twitter', type: 'string' },
            { name: 'telegram', type: 'string' },
            { name: 'discord', type: 'string' },
            { name: 'website', type: 'string' },
            { name: 'farcaster', type: 'string' }
          ]
        },
        { name: 'creatorFeeRecipient', type: 'address' },
        { name: 'creatorTaxBps', type: 'uint16' },
        { name: 'buybackEnabled', type: 'bool' },
        { name: 'expectedEconomics', type: 'bytes32' },
        { name: 'salt', type: 'bytes32' }
      ]
    },
    { name: 'launchConfigId', type: 'uint256' },
    { name: 'pairToken', type: 'address' }
  ],
  outputs: [
    { name: 'token', type: 'address' },
    { name: 'curve', type: 'address' }
  ]
}] as const;

export async function buildPonsLaunchReadinessReceipt(
  client: PublicClient,
  options: PonsLaunchReceiptOptions = {}
): Promise<PonsLaunchReadinessReceipt> {
  const chainId = await client.getChainId();
  const blockNumber = await client.getBlockNumber();
  const block = await client.getBlock({ blockNumber });
  const checks: PonsLaunchReadinessReceipt['checks'] = [];

  const factoryCode = await client.getCode({ address: PONS_V2_FACTORY, blockNumber });
  const actualFactoryRuntimeCodeHash = factoryCode ? keccak256(factoryCode) : null;

  checks.push(check(
    'CHAIN_ID',
    chainId === ROBINHOOD_CHAIN_ID,
    `expected=${ROBINHOOD_CHAIN_ID} actual=${chainId}`
  ));
  checks.push(check(
    'FACTORY_RUNTIME',
    actualFactoryRuntimeCodeHash === PONS_V2_FACTORY_RUNTIME_CODE_HASH,
    `expected=${PONS_V2_FACTORY_RUNTIME_CODE_HASH} actual=${actualFactoryRuntimeCodeHash ?? 'MISSING'}`
  ));

  if (chainId !== ROBINHOOD_CHAIN_ID || !factoryCode) {
    return finalize({
      chainId,
      blockNumber,
      blockHash: block.hash ?? null,
      blockTimestamp: block.timestamp,
      actualFactoryRuntimeCodeHash,
      options,
      checks,
      observed: {},
      simulation: { status: 'NOT_RUN_WRONG_CHAIN_OR_FACTORY' }
    });
  }

  const [
    launchEnabled,
    launchFee,
    maxCreatorTaxBps,
    snipeTaxStartBps,
    snipeTaxSeconds,
    launchConfigCount,
    rawConfig,
    memeHookRaw,
    launchDeployerRaw
  ] = await Promise.all([
    read(client, blockNumber, 'launchEnabled'),
    read(client, blockNumber, 'launchFee'),
    read(client, blockNumber, 'maxCreatorTaxBps'),
    read(client, blockNumber, 'snipeTaxStartBps'),
    read(client, blockNumber, 'snipeTaxSeconds'),
    read(client, blockNumber, 'launchConfigCount'),
    client.readContract({
      address: PONS_V2_FACTORY,
      abi: factoryReadAbi,
      functionName: 'getLaunchConfig',
      args: [PONS_LAUNCH_CONFIG_ID],
      blockNumber
    }),
    read(client, blockNumber, 'memeHook'),
    read(client, blockNumber, 'launchDeployer')
  ]);

  const cfg = rawConfig as any;
  const config = {
    supply: BigInt(cfg.supply),
    curveFeeBps: BigInt(cfg.curveFeeBps),
    phantomQuote: BigInt(cfg.phantomQuote),
    graduationThreshold: BigInt(cfg.graduationThreshold),
    poolFee: Number(cfg.poolFee),
    tickSpacing: Number(cfg.tickSpacing),
    enabled: Boolean(cfg.enabled)
  };
  const memeHook = getAddress(String(memeHookRaw));
  const launchDeployer = getAddress(String(launchDeployerRaw));

  checks.push(check('CONFIG_COUNT', BigInt(launchConfigCount as bigint) > PONS_LAUNCH_CONFIG_ID,
    `count=${String(launchConfigCount)}`));
  checks.push(check('CONFIG_0', sameConfig(config), JSON.stringify(stringifyBigints(config))));
  checks.push(check('LAUNCH_FEE', BigInt(launchFee as bigint) === PONS_EXPECTED_LAUNCH_FEE_WEI,
    `wei=${String(launchFee)}`));
  checks.push(check('CREATOR_TAX_CEILING',
    BigInt(maxCreatorTaxBps as bigint) === PONS_EXPECTED_MAX_CREATOR_TAX_BPS,
    `bps=${String(maxCreatorTaxBps)}`));
  checks.push(check('SNIPE_TAX',
    BigInt(snipeTaxStartBps as bigint) === PONS_EXPECTED_SNIPE_TAX_START_BPS &&
      BigInt(snipeTaxSeconds as bigint) === PONS_EXPECTED_SNIPE_TAX_SECONDS,
    `startBps=${String(snipeTaxStartBps)} seconds=${String(snipeTaxSeconds)}`));

  const [memeHookCode, launchDeployerCode, rawFeePolicy, deployerFactoryRaw] = await Promise.all([
    client.getCode({ address: memeHook, blockNumber }),
    client.getCode({ address: launchDeployer, blockNumber }),
    client.readContract({
      address: memeHook,
      abi: memeHookReadAbi,
      functionName: 'currentFeePolicy',
      blockNumber
    }),
    client.readContract({
      address: launchDeployer,
      abi: launchDeployerReadAbi,
      functionName: 'factory',
      blockNumber
    })
  ]);
  const fee = rawFeePolicy as any;
  const feePolicy = {
    protocolFeeRecipient: getAddress(String(fee.protocolFeeRecipient)),
    protocolFeeShareBps: BigInt(fee.protocolFeeShareBps),
    buybackBurnBps: BigInt(fee.buybackBurnBps),
    hookFeeBps: BigInt(fee.hookFeeBps),
    maxInternalPriceImpactBps: BigInt(fee.maxInternalPriceImpactBps)
  };

  checks.push(check('MEME_HOOK', Boolean(memeHookCode && memeHookCode !== '0x'), `address=${memeHook}`));
  checks.push(check('FEE_POLICY', sameFeePolicy(feePolicy),
    JSON.stringify(stringifyBigints(feePolicy))));
  checks.push(check('LAUNCH_DEPLOYER', Boolean(launchDeployerCode && launchDeployerCode !== '0x'),
    `address=${launchDeployer}`));
  checks.push(check('LAUNCH_DEPLOYER_FACTORY',
    getAddress(String(deployerFactoryRaw)) === PONS_V2_FACTORY,
    `factory=${String(deployerFactoryRaw)}`));

  const deployer = options.deployer ? getAddress(options.deployer) : null;
  const creatorFeeRecipient = options.creatorFeeRecipient ? getAddress(options.creatorFeeRecipient) : null;
  const salt = options.salt ?? null;

  let canLaunch: boolean | null = null;
  let deployerBalance: bigint | null = null;
  if (deployer) {
    [canLaunch, deployerBalance] = await Promise.all([
      client.readContract({
        address: PONS_V2_FACTORY,
        abi: factoryReadAbi,
        functionName: 'canLaunch',
        args: [deployer],
        blockNumber
      }) as Promise<boolean>,
      client.getBalance({ address: deployer, blockNumber })
    ]);
  }
  checks.push(ownerCheck('PUBLIC_OR_WHITELIST_ACCESS', deployer,
    canLaunch === true, deployer ? `canLaunch=${String(canLaunch)} launchEnabled=${String(launchEnabled)}` : 'deployer missing'));
  checks.push(ownerCheck('DEPLOYER_BALANCE', deployer,
    deployerBalance !== null && deployerBalance >= BigInt(launchFee as bigint),
    deployerBalance === null ? 'deployer missing' : `balanceWei=${deployerBalance} launchFeeWei=${String(launchFee)}`));

  checks.push({ id: 'CREATOR_TAX_ZERO', status: 'PASS', detail: 'creatorTaxBps=0' });
  checks.push({ id: 'BUYBACK_OFF', status: 'PASS', detail: 'buybackEnabled=false' });
  checks.push({ id: 'NO_EXTRA_EXEMPTIONS_DIRECT', status: 'PASS',
    detail: 'direct launchToken overload; no extra snipe-tax exemption list; founder opening buy=NONE' });

  const economics = await client.readContract({
    address: PONS_V2_FACTORY,
    abi: factoryReadAbi,
    functionName: 'previewLaunchEconomics',
    args: [PONS_LAUNCH_CONFIG_ID, PONS_NATIVE_PAIR_TOKEN],
    blockNumber
  }) as Hex;
  checks.push(check('ECONOMICS_PIN', /^0x[0-9a-fA-F]{64}$/.test(economics) && !/^0x0{64}$/.test(economics),
    `digest=${economics}`));

  let simulation: Record<string, unknown> = { status: 'OWNER_INPUT_REQUIRED' };
  if (!deployer || !creatorFeeRecipient || !salt) {
    checks.push({
      id: 'LAUNCH_ETH_CALL',
      status: 'OWNER_INPUT_REQUIRED',
      detail: 'requires deployer, creatorFeeRecipient and 32-byte salt'
    });
  } else {
    const metadata = normalizeMetadata(options.metadata);
    const calldata = encodeFunctionData({
      abi: directLaunchAbi,
      functionName: 'launchToken',
      args: [{
        ...metadata,
        creatorFeeRecipient,
        creatorTaxBps: 0,
        buybackEnabled: false,
        expectedEconomics: economics,
        salt
      }, PONS_LAUNCH_CONFIG_ID, PONS_NATIVE_PAIR_TOKEN]
    });
    try {
      const call = await client.call({
        account: deployer,
        to: PONS_V2_FACTORY,
        data: calldata,
        value: BigInt(launchFee as bigint),
        blockNumber
      });
      if (!call.data) throw new Error('EMPTY_RETURN_DATA');
      const [token, curve] = decodeFunctionResult({
        abi: directLaunchAbi,
        functionName: 'launchToken',
        data: call.data
      }) as readonly [Address, Address];
      simulation = {
        status: 'PASS',
        token: getAddress(token),
        curve: getAddress(curve),
        calldataKeccak256: keccak256(calldata),
        persistedState: false
      };
      checks.push({
        id: 'LAUNCH_ETH_CALL',
        status: 'PASS',
        detail: `token=${getAddress(token)} curve=${getAddress(curve)}`
      });
    } catch (error) {
      simulation = {
        status: 'BLOCKED',
        error: sanitizeError(error),
        persistedState: false
      };
      checks.push({ id: 'LAUNCH_ETH_CALL', status: 'BLOCKED', detail: sanitizeError(error) });
    }
  }

  const observed = {
    launchEnabled: Boolean(launchEnabled),
    launchFeeWei: String(launchFee),
    maxCreatorTaxBps: String(maxCreatorTaxBps),
    snipeTaxStartBps: String(snipeTaxStartBps),
    snipeTaxSeconds: String(snipeTaxSeconds),
    launchConfigCount: String(launchConfigCount),
    launchConfig0: stringifyBigints(config),
    memeHook,
    launchDeployer,
    currentFeePolicy: stringifyBigints(feePolicy),
    previewLaunchEconomics: economics,
    canLaunch,
    deployerBalanceWei: deployerBalance?.toString() ?? null
  };

  return finalize({
    chainId,
    blockNumber,
    blockHash: block.hash ?? null,
    blockTimestamp: block.timestamp,
    actualFactoryRuntimeCodeHash,
    options: { ...options, deployer: deployer ?? undefined, creatorFeeRecipient: creatorFeeRecipient ?? undefined },
    checks,
    observed,
    simulation
  });
}

async function read(
  client: PublicClient,
  blockNumber: bigint,
  functionName: 'launchEnabled' | 'launchFee' | 'maxCreatorTaxBps' |
    'snipeTaxStartBps' | 'snipeTaxSeconds' | 'launchConfigCount' | 'memeHook' | 'launchDeployer'
) {
  return client.readContract({
    address: PONS_V2_FACTORY,
    abi: factoryReadAbi,
    functionName,
    blockNumber
  } as any);
}

function sameConfig(actual: {
  supply: bigint;
  curveFeeBps: bigint;
  phantomQuote: bigint;
  graduationThreshold: bigint;
  poolFee: number;
  tickSpacing: number;
  enabled: boolean;
}): boolean {
  return actual.supply === PONS_EXPECTED_CONFIG_0.supply &&
    actual.curveFeeBps === PONS_EXPECTED_CONFIG_0.curveFeeBps &&
    actual.phantomQuote === PONS_EXPECTED_CONFIG_0.phantomQuote &&
    actual.graduationThreshold === PONS_EXPECTED_CONFIG_0.graduationThreshold &&
    actual.poolFee === PONS_EXPECTED_CONFIG_0.poolFee &&
    actual.tickSpacing === PONS_EXPECTED_CONFIG_0.tickSpacing &&
    actual.enabled === PONS_EXPECTED_CONFIG_0.enabled;
}

function sameFeePolicy(actual: {
  protocolFeeRecipient: Address;
  protocolFeeShareBps: bigint;
  buybackBurnBps: bigint;
  hookFeeBps: bigint;
  maxInternalPriceImpactBps: bigint;
}): boolean {
  return actual.protocolFeeRecipient !== PONS_NATIVE_PAIR_TOKEN &&
    actual.protocolFeeShareBps === PONS_EXPECTED_FEE_POLICY.protocolFeeShareBps &&
    actual.buybackBurnBps === PONS_EXPECTED_FEE_POLICY.buybackBurnBps &&
    actual.hookFeeBps === PONS_EXPECTED_FEE_POLICY.hookFeeBps &&
    actual.maxInternalPriceImpactBps === PONS_EXPECTED_FEE_POLICY.maxInternalPriceImpactBps;
}

function normalizeMetadata(input: Partial<PonsLaunchMetadata> | undefined): PonsLaunchMetadata {
  return {
    name: input?.name ?? 'BINRAT',
    symbol: input?.symbol ?? 'BINRAT',
    logo: input?.logo ?? '',
    description: input?.description ?? '',
    socials: {
      twitter: input?.socials?.twitter ?? '',
      telegram: input?.socials?.telegram ?? '',
      discord: input?.socials?.discord ?? '',
      website: input?.socials?.website ?? '',
      farcaster: input?.socials?.farcaster ?? ''
    }
  };
}

function check(id: string, pass: boolean, detail: string): PonsLaunchReadinessReceipt['checks'][number] {
  return { id, status: pass ? 'PASS' : 'BLOCKED', detail };
}

function ownerCheck(id: string, ownerValue: unknown, pass: boolean, detail: string):
  PonsLaunchReadinessReceipt['checks'][number] {
  if (!ownerValue) return { id, status: 'OWNER_INPUT_REQUIRED', detail };
  return check(id, pass, detail);
}

async function finalize(input: {
  chainId: number;
  blockNumber: bigint;
  blockHash: Hex | null;
  blockTimestamp: bigint;
  actualFactoryRuntimeCodeHash: Hex | null;
  options: PonsLaunchReceiptOptions;
  checks: PonsLaunchReadinessReceipt['checks'];
  observed: Record<string, unknown>;
  simulation: Record<string, unknown>;
}): Promise<PonsLaunchReadinessReceipt> {
  const ownerInputMissing = input.checks.some((item) => item.status === 'OWNER_INPUT_REQUIRED');
  const blocked = input.checks.some((item) => item.status === 'BLOCKED');
  const receipt: Omit<PonsLaunchReadinessReceipt, 'receiptDigest'> = {
    schemaVersion: 'binrat.pons-launch-readiness/0.1',
    status: blocked ? 'BLOCKED' : ownerInputMissing ? 'OWNER_INPUT_REQUIRED' : 'PASS',
    readOnly: true,
    generatedAt: new Date(Number(input.blockTimestamp) * 1000).toISOString(),
    chainId: input.chainId,
    snapshotBlock: { number: input.blockNumber.toString(), hash: input.blockHash },
    authority: {
      factory: PONS_V2_FACTORY,
      expectedFactoryRuntimeCodeHash: PONS_V2_FACTORY_RUNTIME_CODE_HASH,
      actualFactoryRuntimeCodeHash: input.actualFactoryRuntimeCodeHash
    },
    ownerInputs: {
      deployer: input.options.deployer ? getAddress(input.options.deployer) : null,
      creatorFeeRecipient: input.options.creatorFeeRecipient ? getAddress(input.options.creatorFeeRecipient) : null,
      salt: input.options.salt ?? null
    },
    launchPolicy: {
      pairToken: PONS_NATIVE_PAIR_TOKEN,
      launchConfigId: PONS_LAUNCH_CONFIG_ID.toString(),
      creatorTaxBps: 0,
      buybackEnabled: false,
      extraSnipeTaxExemptions: [],
      executionPath: 'DIRECT_FACTORY_LAUNCH_TOKEN',
      founderOpeningBuy: 'NONE'
    },
    observed: input.observed,
    checks: input.checks,
    simulation: input.simulation,
    launchAuthorizationEffect: 'NONE'
  };
  return { ...receipt, receiptDigest: await sha256Hex(receipt) };
}

function stringifyBigints<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, current) =>
    typeof current === 'bigint' ? current.toString() : current)) as T;
}

function sanitizeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
}
