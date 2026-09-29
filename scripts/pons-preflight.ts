import { readFile } from 'node:fs/promises';
import { createPublicClient, encodeFunctionData, getAddress, http, keccak256, type Address, type Hex } from 'viem';

type Control = {
  rail: { tokenChain: { chainId: number }; factory: Address; factoryRuntimeCodeHash: Hex; launchConfigId: string; pairToken: Address };
  preflightExpected: { memeHook: Address; memeHookRuntimeCodeHash: Hex; launchDeployer: Address; launchDeployerRuntimeCodeHash: Hex; supplyRaw: string; decimals: number; launchFeeWei: string; creatorTaxBps: number; buybackEnabled: boolean; openingTax: { startBps: number; seconds: number } };
};
type Manifest = { deployer?: Address | null; creatorFeeRecipient?: Address | null; salt?: Hex | null; metadata?: Record<string, string | null>; supplyConfig?: { expectedEconomics?: Hex | null }; launchFeeWei?: string | null; gasSpendCapWei?: string | null };

const control = JSON.parse(await readFile(new URL('../docs/launch/BINRAT_LAUNCH_CONTROL_V1.json', import.meta.url), 'utf8')) as Control;
const args = parseArgs(process.argv.slice(2));
const manifest = args.manifest
  ? JSON.parse(await readFile(args.manifest, 'utf8')) as Manifest
  : {};
const client = createPublicClient({ transport: http(args.rpc ?? process.env.ROBINHOOD_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com') });
const factory = getAddress(control.rail.factory);
const block = await client.getBlock({ blockTag: 'latest' });
const blockNumber = block.number;
if (!blockNumber) throw new Error('PONS_PREFLIGHT_HEAD_MISSING');

const factoryAbi = [
  { type: 'function', name: 'launchEnabled', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'launchFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'maxCreatorTaxBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'snipeTaxStartBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'snipeTaxSeconds', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'launchConfigCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'memeHook', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'launchDeployer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'canLaunch', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'previewLaunchEconomics', stateMutability: 'view', inputs: [{ type: 'uint256' }, { type: 'address' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'getLaunchConfig', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'tuple', components: [{ name: 'supply', type: 'uint256' }, { name: 'curveFeeBps', type: 'uint256' }, { name: 'phantomQuote', type: 'uint256' }, { name: 'graduationThreshold', type: 'uint256' }, { name: 'poolFee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'enabled', type: 'bool' }] }] },
  { type: 'function', name: 'launchToken', stateMutability: 'payable', inputs: [{ name: 'params', type: 'tuple', components: [{ name: 'name', type: 'string' }, { name: 'symbol', type: 'string' }, { name: 'logo', type: 'string' }, { name: 'description', type: 'string' }, { name: 'socials', type: 'tuple', components: [{ name: 'twitter', type: 'string' }, { name: 'telegram', type: 'string' }, { name: 'discord', type: 'string' }, { name: 'website', type: 'string' }, { name: 'farcaster', type: 'string' }] }, { name: 'creatorFeeRecipient', type: 'address' }, { name: 'creatorTaxBps', type: 'uint16' }, { name: 'buybackEnabled', type: 'bool' }, { name: 'expectedEconomics', type: 'bytes32' }, { name: 'salt', type: 'bytes32' }] }, { name: 'launchConfigId', type: 'uint256' }, { name: 'pairToken', type: 'address' }], outputs: [{ type: 'address' }, { type: 'address' }] }
] as const;
const hookAbi = [{ type: 'function', name: 'currentFeePolicy', stateMutability: 'view', inputs: [], outputs: [{ type: 'tuple', components: [{ name: 'protocolFeeRecipient', type: 'address' }, { name: 'protocolFeeShareBps', type: 'uint16' }, { name: 'buybackBurnBps', type: 'uint16' }, { name: 'hookFeeBps', type: 'uint16' }, { name: 'maxInternalPriceImpactBps', type: 'uint16' }] }] }] as const;
const deployerAbi = [{ type: 'function', name: 'factory', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const;

const chainId = await client.getChainId();
const checks: Array<{ id: string; status: 'PASS' | 'BLOCKED' | 'OWNER_INPUT_REQUIRED'; detail: string }> = [];
const check = (id: string, condition: boolean, detail: string) => checks.push({ id, status: condition ? 'PASS' : 'BLOCKED', detail });
check('CHAIN_ID', chainId === control.rail.tokenChain.chainId, `expected=${control.rail.tokenChain.chainId} actual=${chainId}`);
const factoryCode = await client.getCode({ address: factory, blockNumber });
check('FACTORY_CODE', Boolean(factoryCode) && keccak256(factoryCode!) === control.rail.factoryRuntimeCodeHash, `expected=${control.rail.factoryRuntimeCodeHash} actual=${factoryCode ? keccak256(factoryCode) : 'MISSING'}`);

let observed: Record<string, unknown> = {};
let simulation: Record<string, unknown> = { status: 'NOT_RUN' };
if (checks.every((item) => item.status === 'PASS')) {
  const read = (functionName: any, args: readonly unknown[] = []) => client.readContract({ address: factory, abi: factoryAbi, functionName, args: args as any, blockNumber } as any);
  const [enabled, fee, configCount, hookRaw, deployerRaw, config, economics, maxCreatorTax, openingStart, openingSeconds] = await Promise.all([
    read('launchEnabled'), read('launchFee'), read('launchConfigCount'), read('memeHook'), read('launchDeployer'), read('getLaunchConfig', [BigInt(control.rail.launchConfigId)]), read('previewLaunchEconomics', [BigInt(control.rail.launchConfigId), control.rail.pairToken]), read('maxCreatorTaxBps'), read('snipeTaxStartBps'), read('snipeTaxSeconds')
  ]);
  const hook = getAddress(String(hookRaw)); const launchDeployer = getAddress(String(deployerRaw));
  const [hookCode, deployerCode, feePolicy, deployerFactory] = await Promise.all([
    client.getCode({ address: hook, blockNumber }), client.getCode({ address: launchDeployer, blockNumber }), client.readContract({ address: hook, abi: hookAbi, functionName: 'currentFeePolicy', blockNumber }), client.readContract({ address: launchDeployer, abi: deployerAbi, functionName: 'factory', blockNumber })
  ]);
  check('CONFIG_ENABLED', Boolean(enabled) && BigInt(configCount as bigint) > BigInt(control.rail.launchConfigId) && Boolean((config as any).enabled), `enabled=${String(enabled)} configCount=${String(configCount)}`);
  check('SUPPLY_AND_DECIMALS', String((config as any).supply) === control.preflightExpected.supplyRaw && control.preflightExpected.decimals === 18, `supply=${String((config as any).supply)} decimals=${control.preflightExpected.decimals}`);
  check('LAUNCH_FEE', BigInt(fee as bigint) === BigInt(control.preflightExpected.launchFeeWei), `expected=${control.preflightExpected.launchFeeWei} actual=${String(fee)}`);
  check('OPENING_TAX', Number(openingStart) === control.preflightExpected.openingTax.startBps && Number(openingSeconds) === control.preflightExpected.openingTax.seconds, `startBps=${String(openingStart)} seconds=${String(openingSeconds)}`);
  check('CREATOR_TAX_POLICY', control.preflightExpected.creatorTaxBps <= Number(maxCreatorTax), `creatorTaxBps=${control.preflightExpected.creatorTaxBps} max=${String(maxCreatorTax)}`);
  check('HOOK_CODE', hook === getAddress(control.preflightExpected.memeHook) && Boolean(hookCode) && keccak256(hookCode!) === control.preflightExpected.memeHookRuntimeCodeHash, `hook=${hook}`);
  check('LAUNCH_DEPLOYER_CODE', launchDeployer === getAddress(control.preflightExpected.launchDeployer) && Boolean(deployerCode) && keccak256(deployerCode!) === control.preflightExpected.launchDeployerRuntimeCodeHash && getAddress(String(deployerFactory)) === factory, `deployer=${launchDeployer} factory=${String(deployerFactory)}`);
  check('EXPECTED_ECONOMICS', manifest.supplyConfig?.expectedEconomics === undefined || manifest.supplyConfig.expectedEconomics === null || manifest.supplyConfig.expectedEconomics === economics, `actual=${String(economics)}`);
  observed = { launchEnabled: enabled, launchFeeWei: String(fee), launchConfig: stringify(config), economicsDigest: economics, openingTax: { startBps: String(openingStart), seconds: String(openingSeconds) }, maxCreatorTaxBps: String(maxCreatorTax), feePolicy: stringify(feePolicy), hook, launchDeployer };
  const metadata = manifest.metadata;
  const missing = !manifest.deployer || !manifest.creatorFeeRecipient || !manifest.salt || !metadata || !manifest.supplyConfig?.expectedEconomics || !manifest.launchFeeWei || ['name', 'symbol', 'description', 'logo', 'website', 'telegram', 'x'].some((key) => !metadata[key]);
  if (missing) {
    checks.push({ id: 'EXACT_SIMULATION', status: 'OWNER_INPUT_REQUIRED', detail: 'local unexpired manifest needs deployer, fee recipient, nonzero salt, frozen economics/fee and complete approved metadata' });
  } else {
    const deployer = getAddress(manifest.deployer!); const recipient = getAddress(manifest.creatorFeeRecipient!);
    const [canLaunch, balance] = await Promise.all([read('canLaunch', [deployer]), client.getBalance({ address: deployer, blockNumber })]);
    check('DEPLOYER_ACCESS', Boolean(canLaunch), `canLaunch=${String(canLaunch)}`);
    check('DEPLOYER_ETH', balance >= BigInt(fee as bigint) + BigInt(manifest.gasSpendCapWei ?? '0'), `balanceWei=${balance} feePlusCapWei=${BigInt(fee as bigint) + BigInt(manifest.gasSpendCapWei ?? '0')}`);
    check('FROZEN_FEE', manifest.launchFeeWei === String(fee), `manifest=${manifest.launchFeeWei} current=${String(fee)}`);
    const data = encodeFunctionData({ abi: factoryAbi, functionName: 'launchToken', args: [{ name: metadata.name!, symbol: metadata.symbol!, logo: metadata.logo!, description: metadata.description!, socials: { twitter: metadata.x!, telegram: metadata.telegram!, discord: metadata.discord ?? '', website: metadata.website!, farcaster: metadata.farcaster ?? '' }, creatorFeeRecipient: recipient, creatorTaxBps: control.preflightExpected.creatorTaxBps, buybackEnabled: control.preflightExpected.buybackEnabled, expectedEconomics: economics as Hex, salt: manifest.salt! }, BigInt(control.rail.launchConfigId), control.rail.pairToken] });
    try { await client.call({ account: deployer, to: factory, data, value: BigInt(fee as bigint), blockNumber }); simulation = { status: 'PASS', calldataHash: keccak256(data), persistedState: false }; checks.push({ id: 'EXACT_SIMULATION', status: 'PASS', detail: 'eth_call succeeded; no state persisted' }); } catch (error) { simulation = { status: 'BLOCKED', error: error instanceof Error ? error.message.slice(0, 240) : 'UNKNOWN', persistedState: false }; checks.push({ id: 'EXACT_SIMULATION', status: 'BLOCKED', detail: 'eth_call reverted' }); }
  }
}
const status = checks.some((item) => item.status === 'BLOCKED') ? 'BLOCKED' : checks.some((item) => item.status === 'OWNER_INPUT_REQUIRED') ? 'OWNER_INPUT_REQUIRED' : 'PASS';
process.stdout.write(`${JSON.stringify({ schemaVersion: 'binrat.pons-preflight/1.0', readOnly: true, authorizationEffect: 'NONE', status, pinnedBlock: { number: blockNumber.toString(), hash: block.hash }, checks, observed, simulation, manifestSalt: manifest.salt ? 'REDACTED' : null }, null, 2)}\n`);
process.exitCode = status === 'PASS' ? 0 : status === 'OWNER_INPUT_REQUIRED' ? 2 : 1;

function parseArgs(values: string[]): Record<string, string> { const out: Record<string, string> = {}; for (let i = 0; i < values.length; i += 2) { if (!values[i]?.startsWith('--') || !values[i + 1]) throw new Error('PONS_PREFLIGHT_ARGUMENT_INVALID'); out[values[i]!.slice(2)] = values[i + 1]!; } if (Object.keys(out).some((key) => key !== 'rpc' && key !== 'manifest')) throw new Error('PONS_PREFLIGHT_ARGUMENT_UNKNOWN'); return out; }
function stringify(value: unknown): unknown { return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item)); }
