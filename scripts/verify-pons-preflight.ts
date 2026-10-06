import { readFile } from 'node:fs/promises';
import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  type Address,
  type Hex
} from 'viem';
import {
  PONS_LAUNCH_PLAN_DIGEST,
  PONS_V2_FACTORY_CODE_HASH_V1,
  validatePonsLaunchPlan,
  type PonsLaunchPlanV1
} from '../src/launchConfig/ponsPlan.js';
import {
  addressArgCalldata,
  decodeAddressWord,
  decodeCanLaunchProbe,
  decodeStringResult,
  decodeUintWord,
  derivePonsPreflightReceiptDigest,
  PONS_PREFLIGHT_SCHEMA_VERSION,
  PONS_PREFLIGHT_SELECTORS,
  PONS_PREFLIGHT_VERSION,
  PONS_STAKE_READ_CANARY_V1,
  PONS_STAKING_BEACON_V1,
  PONS_STAKING_IMPLEMENTATION_V1,
  PONS_VAULT_UPSTREAM_OWNER_V1,
  registryStakingFactoryCalldata,
  unresolvedExactLaunchSimulationInputs,
  validatePonsPreflightReceipt,
  type PonsPreflightContractObservation,
  type PonsPreflightReceiptV1
} from '../src/launchConfig/ponsPreflight.js';

const RPC_URL =
  process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL ??
  process.env.BINRAT_ROBINHOOD_RPC_URL ??
  process.env.ROBINHOOD_RPC_URL;

if (!RPC_URL) {
  throw new Error(
    'PONS_PREFLIGHT_RPC_REQUIRED: set BINRAT_ROBINHOOD_ARCHIVE_RPC_URL (preferred) or BINRAT_ROBINHOOD_RPC_URL'
  );
}

const plan = await loadPlan();
const client = createPublicClient({ transport: http(RPC_URL) });

const chainId = await client.getChainId();
if (chainId !== 4663) fail(`chain id ${chainId}`);

const block = await client.getBlock({ blockTag: 'latest' });
if (block.hash === null) fail('latest block hash unavailable');
const blockNumber = block.number;

const rail = record(plan.launchRail, 'launchRail');
const ponsFactory = address(record(rail.ponsFactory, 'ponsFactory').address);
const launcherPlan = record(rail.ponsVaultLauncher, 'ponsVaultLauncher');
const launcher = address(launcherPlan.address);
const registryPlan = record(rail.ponsVaultRegistry, 'ponsVaultRegistry');
const registry = address(registryPlan.address);
const stakingPlan = record(rail.stakingFactory, 'stakingFactory');
const stakingFactory = address(stakingPlan.address);
const stakingBeacon = getAddress(PONS_STAKING_BEACON_V1);
const stakingImplementation = getAddress(PONS_STAKING_IMPLEMENTATION_V1);
const upstreamOwner = getAddress(PONS_VAULT_UPSTREAM_OWNER_V1);

const contracts = {
  ponsFactory: await observeContract(
    ponsFactory,
    PONS_V2_FACTORY_CODE_HASH_V1
  ),
  launcher: await observeContract(launcher, null),
  registry: await observeContract(
    registry,
    hexHash(registryPlan.runtimeCodeHash, 'registry runtime code hash')
  ),
  stakingFactory: await observeContract(stakingFactory, null),
  stakingBeacon: await observeContract(stakingBeacon, null),
  stakingImplementation: await observeContract(stakingImplementation, null),
  upstreamOwner: {
    address: upstreamOwner,
    code: await requireEoa(upstreamOwner),
    status: 'EOA' as const
  }
};

const launcherPonsFactory = decodeAddressWord(
  await rawCall(launcher, PONS_PREFLIGHT_SELECTORS.launcherPonsFactory)
);
const launcherRegistry = decodeAddressWord(
  await rawCall(launcher, PONS_PREFLIGHT_SELECTORS.launcherRegistry)
);
const registryStakingFactory = decodeAddressWord(
  await rawCall(registry, registryStakingFactoryCalldata())
);
const registryOwner = decodeAddressWord(
  await rawCall(registry, PONS_PREFLIGHT_SELECTORS.registryOwner)
);
const stakingFactoryOwner = decodeAddressWord(
  await rawCall(stakingFactory, PONS_PREFLIGHT_SELECTORS.stakingFactoryOwner)
);
const stakingFactoryBeacon = decodeAddressWord(
  await rawCall(stakingFactory, PONS_PREFLIGHT_SELECTORS.stakingFactoryBeacon)
);
const stakingFactoryImplementation = decodeAddressWord(
  await rawCall(stakingFactory, PONS_PREFLIGHT_SELECTORS.stakingFactoryImplementation)
);
const stakingFactoryTemplate = decodeStringResult(
  await rawCall(stakingFactory, PONS_PREFLIGHT_SELECTORS.stakingFactoryTemplate)
);
const stakingFactoryVaultCount = decodeUintWord(
  await rawCall(stakingFactory, PONS_PREFLIGHT_SELECTORS.stakingFactoryVaultCount)
);
const stakingBeaconOwner = decodeAddressWord(
  await rawCall(stakingBeacon, PONS_PREFLIGHT_SELECTORS.beaconOwner)
);
const stakingBeaconImplementation = decodeAddressWord(
  await rawCall(stakingBeacon, PONS_PREFLIGHT_SELECTORS.beaconImplementation)
);
const canLaunch = decodeCanLaunchProbe(
  await rawCall(launcher, PONS_PREFLIGHT_SELECTORS.launcherCanLaunchProbe)
);

expectAddress('launcher -> Pons factory', launcherPonsFactory, ponsFactory);
expectAddress('launcher -> registry', launcherRegistry, registry);
expectAddress('registry staking factory', registryStakingFactory, stakingFactory);
expectAddress('registry owner', registryOwner, upstreamOwner);
expectAddress('staking factory owner', stakingFactoryOwner, upstreamOwner);
expectAddress('staking factory beacon', stakingFactoryBeacon, stakingBeacon);
expectAddress(
  'staking factory implementation',
  stakingFactoryImplementation,
  stakingImplementation
);
expectAddress('staking beacon owner', stakingBeaconOwner, stakingFactory);
expectAddress(
  'staking beacon implementation',
  stakingBeaconImplementation,
  stakingImplementation
);
if (stakingFactoryTemplate !== 'staking') fail(`staking template ${stakingFactoryTemplate}`);
if (stakingFactoryVaultCount < 1n) fail('staking vault count < 1');
if (canLaunch.canLaunch !== true) fail(`launcher canLaunch false: ${canLaunch.reason}`);

const canaryVault = getAddress(PONS_STAKE_READ_CANARY_V1.vault);
const canaryWallet = getAddress(PONS_STAKE_READ_CANARY_V1.wallet);
const quoteAsset = decodeAddressWord(
  await rawCall(canaryVault, PONS_PREFLIGHT_SELECTORS.quoteAsset)
);
const stakedRaw = decodeUintWord(
  await rawCall(
    canaryVault,
    addressArgCalldata(PONS_PREFLIGHT_SELECTORS.stakedOf, canaryWallet)
  )
);
const totalStakedRaw = decodeUintWord(
  await rawCall(canaryVault, PONS_PREFLIGHT_SELECTORS.totalStaked)
);
expectAddress(
  'stake canary native quote asset',
  quoteAsset,
  '0x0000000000000000000000000000000000000000'
);
if (stakedRaw > totalStakedRaw) fail('stake canary stakedOf > totalStaked');

const missingInputs = unresolvedExactLaunchSimulationInputs(plan);
if (missingInputs.length === 0) {
  throw new Error(
    'PONS_PREFLIGHT_EXACT_SIM_REQUIRED: owner inputs are complete; this baseline preflight must not substitute for the exact-manifest rehearsal'
  );
}

const receiptWithoutDigest = {
  schemaVersion: PONS_PREFLIGHT_SCHEMA_VERSION,
  preflightVersion: PONS_PREFLIGHT_VERSION,
  status: 'UPSTREAM_GRAPH_PASS_BASELINE_EXACT_MANIFEST_BLOCKED' as const,
  observedAt: new Date().toISOString(),
  chainId: 4663 as const,
  block: {
    number: blockNumber.toString(10),
    hash: block.hash
  },
  plan: {
    digest: PONS_LAUNCH_PLAN_DIGEST
  },
  contracts,
  graph: {
    launcherPonsFactory,
    launcherRegistry,
    registryStakingFactory,
    registryOwner,
    stakingFactoryOwner,
    stakingFactoryBeacon,
    stakingFactoryImplementation,
    stakingFactoryTemplate: 'staking' as const,
    stakingFactoryVaultCountRaw: stakingFactoryVaultCount.toString(10),
    stakingBeaconOwner,
    stakingBeaconImplementation,
    launcherCanLaunch: true as const,
    launcherCanLaunchReason: canLaunch.reason,
    status: 'PASS' as const
  },
  stakeReadCanary: {
    vault: canaryVault,
    wallet: canaryWallet,
    quoteAsset: '0x0000000000000000000000000000000000000000' as const,
    stakedRaw: stakedRaw.toString(10),
    totalStakedRaw: totalStakedRaw.toString(10),
    status: 'PASS' as const
  },
  exactManifestSimulation: {
    status: 'BLOCKED_OWNER_INPUTS' as const,
    missingInputs,
    broadcast: false as const
  },
  authorization: {
    marketingAuthorized: false as const,
    launchAuthorized: false as const,
    explicitOwnerLaunchAuthorityState: 'NOT_GRANTED' as const
  }
};

const receipt = {
  ...receiptWithoutDigest,
  receiptDigest: await derivePonsPreflightReceiptDigest(receiptWithoutDigest)
} satisfies PonsPreflightReceiptV1;

if ((await client.getBlock({blockNumber})).hash !== block.hash) fail('canonical block changed during preflight');

await validatePonsPreflightReceipt(receipt, plan);
console.log(JSON.stringify(receipt, null, 2));

async function loadPlan(): Promise<PonsLaunchPlanV1> {
  const raw = JSON.parse(
    await readFile(
      new URL('../docs/BINRAT_PONS_LAUNCH_PLAN_V1.json', import.meta.url),
      'utf8'
    )
  );
  return validatePonsLaunchPlan(raw);
}

async function observeContract(
  contract: Address,
  expectedCodeHash: Hex | null
): Promise<PonsPreflightContractObservation> {
  const code = await client.getCode({ address: contract, blockNumber });
  if (!code || code === '0x') fail(`missing runtime code ${contract}`);
  const codeHash = keccak256(code);
  if (
    expectedCodeHash !== null &&
    codeHash.toLowerCase() !== expectedCodeHash.toLowerCase()
  ) {
    fail(`runtime code hash drift ${contract}: ${codeHash} != ${expectedCodeHash}`);
  }
  return {
    address: contract,
    codeHash,
    expectedCodeHash,
    status: expectedCodeHash === null ? 'OBSERVED_BASELINE' : 'MATCH'
  };
}

async function requireEoa(account: Address): Promise<'0x'> {
  const code = await client.getCode({ address: account, blockNumber });
  if (code && code !== '0x') fail(`upstream owner became contract ${account}`);
  return '0x';
}

async function rawCall(to: Address, data: Hex): Promise<Hex> {
  const result = await client.call({ to, data, blockNumber });
  if (!result.data) fail(`empty eth_call result ${to} ${data.slice(0, 10)}`);
  return result.data;
}

function expectAddress(subject: string, actual: Address, expected: Address): void {
  if (actual.toLowerCase() !== getAddress(expected).toLowerCase()) {
    fail(`${subject}: ${actual} != ${expected}`);
  }
}

function address(value: unknown): Address {
  if (typeof value !== 'string') fail('non-string address in plan');
  return getAddress(value);
}

function hexHash(value: unknown, subject: string): Hex {
  if (
    typeof value !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(value)
  ) fail(`invalid ${subject}`);
  return value as Hex;
}

function record(value: unknown, subject: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`invalid ${subject}`);
  }
  return value as Record<string, any>;
}

function fail(subject: string): never {
  throw new Error(`PONS_PREFLIGHT_FAILED: ${subject}`);
}
