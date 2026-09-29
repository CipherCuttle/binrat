import { readFile } from 'node:fs/promises';
import { createPublicClient, decodeEventLog, getAddress, http, keccak256, type Address, type Hex } from 'viem';

const args = parseArgs(process.argv.slice(2));
const txHash = args.tx as Hex;
const manifest = args.manifest ? JSON.parse(await readFile(args.manifest, 'utf8')) as { creatorFeeRecipient?: Address | null; treasury?: Address | null } : null;
const control = JSON.parse(await readFile(new URL('../docs/launch/BINRAT_LAUNCH_CONTROL_V1.json', import.meta.url), 'utf8')) as any;
const client = createPublicClient({ transport: http(args.rpc ?? process.env.ROBINHOOD_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com') });
const factory = getAddress(control.rail.factory) as Address;
const eventAbi = [{ type: 'event', name: 'TokenLaunched', anonymous: false, inputs: [{ indexed: true, name: 'token', type: 'address' }, { indexed: true, name: 'curve', type: 'address' }, { indexed: true, name: 'deployer', type: 'address' }, { indexed: false, name: 'pairToken', type: 'address' }, { indexed: false, name: 'launchConfigId', type: 'uint256' }, { indexed: false, name: 'graduationThreshold', type: 'uint256' }] }] as const;
const erc20Abi = [{ type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }, { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }, { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }, { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }, { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }] as const;
const launchedTokenAbi = [{ type: 'function', name: 'getLaunchedToken', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'tuple', components: [{ name: 'token', type: 'address' }, { name: 'curve', type: 'address' }, { name: 'deployer', type: 'address' }, { name: 'creatorFeeRecipient', type: 'address' }, { name: 'pairToken', type: 'address' }, { name: 'graduationThreshold', type: 'uint256' }, { name: 'poolFee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'creatorTaxBps', type: 'uint16' }, { name: 'buybackEnabled', type: 'bool' }, { name: 'phase', type: 'uint8' }, { name: 'sweptQuote', type: 'uint256' }, { name: 'sweptTokens', type: 'uint256' }, { name: 'sweptAt', type: 'uint256' }, { name: 'exists', type: 'bool' }] }] }] as const;
const curveBuyAbi = [{ type: 'event', name: 'CurveBuy', anonymous: false, inputs: [{ indexed: true, name: 'buyer', type: 'address' }, { indexed: true, name: 'recipient', type: 'address' }, { indexed: false, name: 'quoteIn', type: 'uint256' }, { indexed: false, name: 'tokensOut', type: 'uint256' }, { indexed: false, name: 'fee', type: 'uint256' }, { indexed: false, name: 'tax', type: 'uint256' }] }] as const;
const chainId = await client.getChainId();
const receipt = await client.getTransactionReceipt({ hash: txHash });
const block = await client.getBlock({ blockHash: receipt.blockHash });
const factoryCode = await client.getCode({ address: factory, blockNumber: receipt.blockNumber });
const launches = receipt.logs.filter((log) => log.address.toLowerCase() === factory.toLowerCase()).flatMap((log) => { try { return [decodeEventLog({ abi: eventAbi, data: log.data, topics: log.topics, strict: true })]; } catch { return []; } });
const problems: string[] = [];
if (chainId !== 4663) problems.push('WRONG_CHAIN');
if (receipt.status !== 'success') problems.push('TRANSACTION_FAILED');
if (block.hash !== receipt.blockHash) problems.push('NONCANONICAL_BLOCK');
if (!factoryCode || keccak256(factoryCode) !== control.rail.factoryRuntimeCodeHash) problems.push('FACTORY_CODE_DRIFT');
if (launches.length !== 1) problems.push('TOKEN_LAUNCHED_EVENT_AMBIGUOUS');
const launch = launches[0];
const token = launch ? getAddress(String((launch.args as any).token)) : null;
const curve = launch ? getAddress(String((launch.args as any).curve)) : null;
let tokenData: Record<string, unknown> = {};
let launchRecord: Record<string, unknown> | null = null;
let founderLaunchBuys = 0;
if (token) {
  const record: any = await client.readContract({ address: factory, abi: launchedTokenAbi, functionName: 'getLaunchedToken', args: [token], blockNumber: receipt.blockNumber });
  if (!record.exists || getAddress(record.token) !== token || getAddress(record.curve) !== curve || getAddress(record.deployer) !== getAddress(receipt.from)) problems.push('LAUNCH_RECORD_EVENT_MISMATCH');
  if (record.creatorTaxBps !== 0 || record.buybackEnabled !== false || record.phase !== 0) problems.push('LAUNCH_RECORD_POLICY_MISMATCH');
  if (!manifest?.creatorFeeRecipient || getAddress(record.creatorFeeRecipient) !== getAddress(manifest.creatorFeeRecipient)) problems.push('CREATOR_FEE_RECIPIENT_MISMATCH_OR_MANIFEST_MISSING');
  const [supply, decimals, name, symbol, deployerBalance, feeRecipientBalance, treasuryBalance] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: 'totalSupply', blockNumber: receipt.blockNumber }), client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals', blockNumber: receipt.blockNumber }), client.readContract({ address: token, abi: erc20Abi, functionName: 'name', blockNumber: receipt.blockNumber }), client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol', blockNumber: receipt.blockNumber }), client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [getAddress(receipt.from)], blockNumber: receipt.blockNumber }), manifest?.creatorFeeRecipient ? client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [getAddress(manifest.creatorFeeRecipient)], blockNumber: receipt.blockNumber }) : Promise.resolve(null), manifest?.treasury ? client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [getAddress(manifest.treasury)], blockNumber: receipt.blockNumber }) : Promise.resolve(null)
  ]);
  launchRecord = { creatorFeeRecipient: getAddress(record.creatorFeeRecipient), creatorTaxBps: record.creatorTaxBps, buybackEnabled: record.buybackEnabled, phase: record.phase, graduationThreshold: record.graduationThreshold.toString() };
  for (const log of receipt.logs.filter((item) => item.address.toLowerCase() === curve!.toLowerCase())) { try { const buy = decodeEventLog({ abi: curveBuyAbi, data: log.data, topics: log.topics, strict: true }); if (getAddress(String((buy.args as any).buyer)) === getAddress(receipt.from)) founderLaunchBuys += 1; } catch {} }
  if (founderLaunchBuys !== 0) problems.push('FOUNDER_LAUNCH_AND_BUY_OBSERVED');
  tokenData = { supply: supply.toString(), decimals, name, symbol, deployer: getAddress(receipt.from), deployerBalance: deployerBalance.toString(), creatorFeeRecipientBalance: feeRecipientBalance?.toString() ?? 'MANIFEST_MISSING', treasuryBalance: treasuryBalance?.toString() ?? 'MANIFEST_MISSING' };
}
const status = problems.length === 0 ? 'PASS' : 'BLOCKED';
process.stdout.write(`${JSON.stringify({ schemaVersion: 'binrat.post-launch-verifier/1.0', readOnly: true, inputTransactionHash: txHash, status, publicationState: status === 'PASS' ? 'PUBLICATION_ELIGIBLE' : 'EXECUTED_UNVERIFIED', chainId, canonicalBlock: { number: receipt.blockNumber.toString(), hash: receipt.blockHash }, factory, token, curve, launch: launch ? { pairToken: (launch.args as any).pairToken, launchConfigId: String((launch.args as any).launchConfigId), graduationThreshold: String((launch.args as any).graduationThreshold) } : null, launchRecord, tokenData, launchAndBuy: founderLaunchBuys === 0 ? 'NONE_OBSERVED' : 'FOUNDER_BUY_OBSERVED', problems }, null, 2)}\n`);
process.exitCode = status === 'PASS' ? 0 : 1;
function parseArgs(values: string[]): Record<string, string> { const out: Record<string, string> = {}; for (let i = 0; i < values.length; i += 2) { if (!values[i]?.startsWith('--') || !values[i + 1]) throw new Error('PONS_VERIFIER_ARGUMENT_INVALID'); out[values[i]!.slice(2)] = values[i + 1]!; } if (!/^0x[0-9a-fA-F]{64}$/.test(out.tx ?? '') || Object.keys(out).some((key) => key !== 'tx' && key !== 'rpc' && key !== 'manifest')) throw new Error('PONS_VERIFIER_ARGUMENT_INVALID'); return out; }
