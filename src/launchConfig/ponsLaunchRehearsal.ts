import {
  decodeAbiParameters, decodeFunctionData, decodeFunctionResult, encodeAbiParameters, encodeFunctionData, getAddress, getFunctionSelector,
  isAddress, isHex, keccak256, stringToHex, type Address, type Hex, type PublicClient
} from 'viem';
import { sha256Hex } from '../evidence/canonical.js';
import { PONS_LAUNCH_CHAIN_ID, PONS_LAUNCH_PLAN_DIGEST, PONS_V2_FACTORY_V1, PONS_VAULT_LAUNCHER_V1, type PonsLaunchPlanV1 } from './ponsPlan.js';
import { validatePonsPreflightReceipt, type PonsPreflightReceiptV1 } from './ponsPreflight.js';
import { PONS_LAUNCH_WITH_VAULT_ABI, PONS_LAUNCH_WITH_VAULT_SELECTOR, PONS_LAUNCH_WITH_VAULT_SIGNATURE, PONS_VAULT_UI_ABI_PROVENANCE, type PonsLaunchParamsV1 } from './ponsVaultLaunchAbi.js';

export const PONS_LAUNCH_RUNTIME_HASH_V1 = '0x5a6baeade01d8119231385e1a6f38c50388b2f30063d3c6c3e5736e590ad12a0' as const;
export const PONS_LAUNCH_RUNTIME_BLOCK_V1 = '79428213' as const;
export const PONS_ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
export const PONS_STAKING_TEMPLATE_ID = stringToHex('staking', { size: 32 });
export const PONS_REHEARSAL_SCHEMA = 'binrat.pons-launch-rehearsal/1.0' as const;

export interface PonsExactCallInputs {
  launchWalletAddress: string | null; name: string | null; symbol: string | null; logo: string | null; description: string | null;
  socials: { twitter: string | null; telegram: string | null; discord: string | null; website: string | null; farcaster: string | null } | null;
  creatorFeeRecipient: string | null; expectedEconomics: string | null; salt: string | null;
  launchConfigId: string | null; minimumFeesBeforePayoutWei: string | null; transactionValueWei: string | null;
  /** Must be zero. This policy means no separate initial-buy action. */
  openingBuyWei: string;
  pairToken: string;
  template: string;
  creatorTaxBps: number;
  buybackEnabled: boolean;
  arcWalletAddress?: string | null;
}

export interface PonsLaunchTransactionRequest {
  chainId: typeof PONS_LAUNCH_CHAIN_ID; from: Address; to: Address; value: Hex; data: Hex;
  calldataHash: Hex; templateConfigBytes: Hex; manifestInputDigest: string;
}

const requiredKeys: readonly string[] = [
  'launchWalletAddress', 'name', 'symbol', 'logo', 'description', 'creatorFeeRecipient', 'expectedEconomics', 'salt',
  'launchConfigId', 'minimumFeesBeforePayoutWei', 'transactionValueWei'
] as const;

export function ponsLaunchSelectorFromCanonicalSignature(): Hex {
  return getFunctionSelector(PONS_LAUNCH_WITH_VAULT_SIGNATURE);
}

export function validatePonsLaunchPolicy(input: PonsExactCallInputs): void {
  if (input.template !== 'staking') throw new Error('PONS_REHEARSAL_TEMPLATE_INVALID');
  if (input.pairToken.toLowerCase() !== PONS_ZERO_ADDRESS) throw new Error('PONS_REHEARSAL_PAIR_TOKEN_INVALID');
  if (input.creatorTaxBps !== 0) throw new Error('PONS_REHEARSAL_CREATOR_TAX_INVALID');
  if (input.buybackEnabled !== false) throw new Error('PONS_REHEARSAL_BUYBACK_INVALID');
  if (input.openingBuyWei !== '0') throw new Error('PONS_REHEARSAL_OPENING_BUY_INVALID');
  if (input.arcWalletAddress) throw new Error('PONS_REHEARSAL_ARC_WALLET_LEAKAGE');
}

export function assertPonsLauncherRuntimeHash(codeHash: string): void {
  if (codeHash.toLowerCase() !== PONS_LAUNCH_RUNTIME_HASH_V1) throw new Error('PONS_REHEARSAL_LAUNCHER_RUNTIME_DRIFT');
}

export function inspectPonsLaunchRehearsalInputs(input: PonsExactCallInputs): { status: 'BLOCKED_OWNER_INPUTS' | 'INPUTS_COMPLETE'; missingInputs: string[]; signing: false; broadcast: false; launchAuthorized: false } {
  return { status: ownerInputBlockers(input).length ? 'BLOCKED_OWNER_INPUTS' : 'INPUTS_COMPLETE', missingInputs: ownerInputBlockers(input), signing: false, broadcast: false, launchAuthorized: false };
}

export function encodePonsLaunchWithVault(params: PonsLaunchParamsV1, launchConfigId: bigint, pairToken: Address, minimumFeesBeforePayoutWei: bigint): Hex {
  const vaultConfig = encodeAbiParameters([{ type: 'uint256' }], [minimumFeesBeforePayoutWei]);
  const data = encodeFunctionData({ abi: PONS_LAUNCH_WITH_VAULT_ABI, functionName: 'launchWithVault', args: [params, launchConfigId, pairToken, PONS_STAKING_TEMPLATE_ID, vaultConfig] });
  if (!data.startsWith(PONS_LAUNCH_WITH_VAULT_SELECTOR)) throw new Error('PONS_LAUNCH_SELECTOR_MISMATCH');
  return data;
}

export function ownerInputBlockers(input: PonsExactCallInputs): string[] {
  const missing: string[] = requiredKeys.filter((key) => {
    const value = input[key as keyof PonsExactCallInputs];
    return value === null || value === undefined || value === '';
  });
  if (input.socials === null || input.socials === undefined) missing.push('socials');
  else for (const key of ['twitter', 'telegram', 'discord', 'website', 'farcaster'] as const) {
    if (input.socials[key] === null || input.socials[key] === undefined) missing.push(`socials.${key}`);
  }
  return missing;
}

export async function buildPonsLaunchRehearsalRequest(input: PonsExactCallInputs, plan: PonsLaunchPlanV1, preflight: PonsPreflightReceiptV1): Promise<PonsLaunchTransactionRequest> {
  validatePonsLaunchPolicy(input);
  if (plan.planDigest !== PONS_LAUNCH_PLAN_DIGEST || plan.chainId !== PONS_LAUNCH_CHAIN_ID) throw new Error('PONS_REHEARSAL_PLAN_INVALID');
  const validatedPreflight = await validatePonsPreflightReceipt(preflight, plan);
  if (getAddress(validatedPreflight.contracts.launcher.address) !== getAddress(PONS_VAULT_LAUNCHER_V1)) throw new Error('PONS_REHEARSAL_LAUNCHER_INVALID');
  assertPonsLauncherRuntimeHash(validatedPreflight.contracts.launcher.codeHash);
  const missing = ownerInputBlockers(input);
  if (missing.length) throw new Error(`BLOCKED_OWNER_INPUTS:${missing.join(',')}`);
  if (!input.launchWalletAddress || !isAddress(input.launchWalletAddress, { strict: false })) throw new Error('PONS_REHEARSAL_LAUNCH_WALLET_INVALID');
  if (!isAddress(input.creatorFeeRecipient!, { strict: false })) throw new Error('PONS_REHEARSAL_CREATOR_FEE_RECIPIENT_INVALID');
  if (!/^\d+$/.test(input.launchConfigId!) || !/^\d+$/.test(input.minimumFeesBeforePayoutWei!) || !/^\d+$/.test(input.transactionValueWei!)) throw new Error('PONS_REHEARSAL_UINT_INVALID');
  if (!isHex(input.expectedEconomics!) || input.expectedEconomics!.length !== 66 || !isHex(input.salt!) || input.salt!.length !== 66) throw new Error('PONS_REHEARSAL_BYTES32_INVALID');
  if (BigInt(input.minimumFeesBeforePayoutWei!) < 100000000000000000n) throw new Error('PONS_REHEARSAL_STAKING_MINIMUM_BELOW_UI_FLOOR');
  const params: PonsLaunchParamsV1 = {
    name: input.name!, symbol: input.symbol!, logo: input.logo!, description: input.description!,
    socials: input.socials as NonNullable<PonsExactCallInputs['socials']> as PonsLaunchParamsV1['socials'],
    creatorFeeRecipient: getAddress(input.creatorFeeRecipient!), creatorTaxBps: 0, buybackEnabled: false,
    expectedEconomics: input.expectedEconomics as Hex, salt: input.salt as Hex
  };
  const data = encodePonsLaunchWithVault(params, BigInt(input.launchConfigId!), PONS_ZERO_ADDRESS, BigInt(input.minimumFeesBeforePayoutWei!));
  const material = { schema: PONS_REHEARSAL_SCHEMA, planDigest: plan.planDigest, preflightDigest: validatedPreflight.receiptDigest, input };
  return { chainId: PONS_LAUNCH_CHAIN_ID, from: getAddress(input.launchWalletAddress!), to: getAddress(PONS_VAULT_LAUNCHER_V1), value: `0x${BigInt(input.transactionValueWei!).toString(16)}` as Hex, data, calldataHash: keccak256(data), templateConfigBytes: encodeAbiParameters([{ type: 'uint256' }], [BigInt(input.minimumFeesBeforePayoutWei!)]), manifestInputDigest: await sha256Hex(material) };
}

export async function simulatePonsLaunchRehearsal(client: PublicClient, request: PonsLaunchTransactionRequest, plan: PonsLaunchPlanV1, preflight: PonsPreflightReceiptV1): Promise<{ token: Address; vault: Address }> {
  if (await client.getChainId() !== PONS_LAUNCH_CHAIN_ID) throw new Error('PONS_REHEARSAL_CHAIN_INVALID');
  if (request.chainId !== PONS_LAUNCH_CHAIN_ID || getAddress(request.to) !== getAddress(PONS_VAULT_LAUNCHER_V1)) throw new Error('PONS_REHEARSAL_REQUEST_TARGET_INVALID');
  if (!request.data.startsWith(PONS_LAUNCH_WITH_VAULT_SELECTOR)) throw new Error('PONS_LAUNCH_SELECTOR_MISMATCH');
  let args: ReturnType<typeof decodeFunctionData>['args'];
  try { args = decodeFunctionData({ abi: PONS_LAUNCH_WITH_VAULT_ABI, data: request.data }).args; }
  catch { throw new Error('PONS_REHEARSAL_CALLDATA_INVALID'); }
  const [params, , pairToken, templateId, vaultConfig] = args as [PonsLaunchParamsV1, bigint, Address, Hex, Hex];
  if (pairToken.toLowerCase() !== PONS_ZERO_ADDRESS || templateId !== PONS_STAKING_TEMPLATE_ID) throw new Error('PONS_REHEARSAL_CALL_POLICY_INVALID');
  if (params.creatorTaxBps !== 0 || params.buybackEnabled) throw new Error('PONS_REHEARSAL_CALL_POLICY_INVALID');
  let minimumFees: bigint;
  try { [minimumFees] = decodeAbiParameters([{ type: 'uint256' }], vaultConfig); }
  catch { throw new Error('PONS_REHEARSAL_VAULT_CONFIG_INVALID'); }
  if (minimumFees < 100000000000000000n) throw new Error('PONS_REHEARSAL_VAULT_CONFIG_INVALID');
  const current = await validatePonsPreflightReceipt(preflight, plan);
  assertPonsLauncherRuntimeHash(current.contracts.launcher.codeHash);
  const result = await client.call({ account: request.from, to: request.to, data: request.data, value: BigInt(request.value) });
  if (!result.data) throw new Error('PONS_REHEARSAL_RETURN_MALFORMED');
  let decoded: readonly [Address, Address];
  try { decoded = decodeFunctionResult({ abi: PONS_LAUNCH_WITH_VAULT_ABI, functionName: 'launchWithVault', data: result.data }) as readonly [Address, Address]; }
  catch { throw new Error('PONS_REHEARSAL_RETURN_MALFORMED'); }
  const token = getAddress(decoded[0]);
  const vault = getAddress(decoded[1]);
  if (token.toLowerCase() === PONS_ZERO_ADDRESS || vault.toLowerCase() === PONS_ZERO_ADDRESS || token.toLowerCase() === vault.toLowerCase()) throw new Error('PONS_REHEARSAL_RETURN_ADDRESSES_INVALID');
  return { token, vault };
}

export function createPonsRehearsalReceipt(input: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: PONS_REHEARSAL_SCHEMA, ...input,
    abi: { ...PONS_VAULT_UI_ABI_PROVENANCE, sourceRuntimeBinding: 'UNRESOLVED' },
    selectedLauncher: PONS_VAULT_LAUNCHER_V1, ponsFactory: PONS_V2_FACTORY_V1,
    sourceRuntimeBinding: 'UNRESOLVED', signing: false, broadcast: false, launchAuthorized: false
  };
}
