import {
  decodeAbiParameters, decodeFunctionData, decodeFunctionResult, encodeAbiParameters, encodeFunctionData, getAddress, getFunctionSelector,
  isAddress, isHex, keccak256, stringToHex, type Address, type Hex, type PublicClient
} from 'viem';
import { sha256Hex } from '../evidence/canonical.js';
import { PONS_LAUNCH_CHAIN_ID, PONS_LAUNCH_PLAN_DIGEST, PONS_V2_FACTORY_V1, PONS_VAULT_LAUNCHER_V1, type PonsLaunchPlanV1 } from './ponsPlan.js';
import { validatePonsPreflightReceipt, type PonsPreflightReceiptV1 } from './ponsPreflight.js';
import { PONS_LAUNCH_WITH_VAULT_ABI, PONS_LAUNCH_WITH_VAULT_SELECTOR, PONS_LAUNCH_WITH_VAULT_SIGNATURE, PONS_VAULT_UI_ABI_PROVENANCE, type PonsLaunchParamsV1 } from './ponsVaultLaunchAbi.js';
import { requireCondition } from './ponsLaunchManifest.js';

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
  if (BigInt(input.expectedEconomics!) === 0n) throw new Error('PONS_REHEARSAL_ZERO_ECONOMICS_GUARD');
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
  if (request.calldataHash !== keccak256(request.data)) throw new Error('PONS_REHEARSAL_CALLDATA_HASH_MISMATCH');
  let args: ReturnType<typeof decodeFunctionData>['args'];
  try { args = decodeFunctionData({ abi: PONS_LAUNCH_WITH_VAULT_ABI, data: request.data }).args; }
  catch { throw new Error('PONS_REHEARSAL_CALLDATA_INVALID'); }
  const [params, , pairToken, templateId, vaultConfig] = args as [PonsLaunchParamsV1, bigint, Address, Hex, Hex];
  if (pairToken.toLowerCase() !== PONS_ZERO_ADDRESS || templateId !== PONS_STAKING_TEMPLATE_ID) throw new Error('PONS_REHEARSAL_CALL_POLICY_INVALID');
  if (params.creatorTaxBps !== 0 || params.buybackEnabled || BigInt(params.expectedEconomics) === 0n) throw new Error('PONS_REHEARSAL_CALL_POLICY_INVALID');
  let minimumFees: bigint;
  try { [minimumFees] = decodeAbiParameters([{ type: 'uint256' }], vaultConfig); }
  catch { throw new Error('PONS_REHEARSAL_VAULT_CONFIG_INVALID'); }
  if (request.templateConfigBytes !== vaultConfig) throw new Error('PONS_REHEARSAL_VAULT_CONFIG_INVALID');
  const current = await validatePonsPreflightReceipt(preflight, plan);
  assertPonsLauncherRuntimeHash(current.contracts.launcher.codeHash);
  const blockNumber = BigInt(current.block.number);
  if ((await client.getBlock({ blockNumber })).hash !== current.block.hash) throw new Error('PONS_REHEARSAL_BLOCK_HASH_MISMATCH');
  const result = await client.call({ account: request.from, to: request.to, data: request.data, value: BigInt(request.value), blockNumber });
  if ((await client.getBlock({ blockNumber })).hash !== current.block.hash) throw new Error('PONS_REHEARSAL_BLOCK_HASH_MISMATCH');
  if (!result.data) throw new Error('PONS_REHEARSAL_RETURN_MALFORMED');
  let decoded: readonly [Address, Address];
  try { decoded = decodeFunctionResult({ abi: PONS_LAUNCH_WITH_VAULT_ABI, functionName: 'launchWithVault', data: result.data }) as readonly [Address, Address]; }
  catch { throw new Error('PONS_REHEARSAL_RETURN_MALFORMED'); }
  const token = getAddress(decoded[0]);
  const vault = getAddress(decoded[1]);
  if (token.toLowerCase() === PONS_ZERO_ADDRESS || vault.toLowerCase() === PONS_ZERO_ADDRESS || token.toLowerCase() === vault.toLowerCase()) throw new Error('PONS_REHEARSAL_RETURN_ADDRESSES_INVALID');
  return { token, vault };
}

// The V1 helper above remains a diagnostic decoder, never a phase authority receipt.
export interface ExactTraceEvidence {
  schemaVersion: 'binrat.pons-exact-trace/1'; manifestDigest: string; envelopeDigest: string;
  authorityObservationsDigest: string; token: Address; curve: Address; vault: Address;
  creation:import('./ponsLaunchManifest.js').CreationPostconditions;
  stateOverridesUsed: false; noLiteralVaultDependency: true; reproduction: string; rawTraceDigest: string; digest: string;
}
export async function rehearseExactEnvelope(
  client: PublicClient,
  input: {
    manifest: import('./ponsLaunchManifest.js').PonsLaunchManifest;
    envelope: import('./ponsExecutionEnvelope.js').FinalExecutionEnvelope;
    readPlan: import('./ponsFreshAuthority.js').AuthorityReadPlan;
    snapshot: import('./ponsFreshAuthority.js').AuthoritySnapshot;
    budget: import('./ponsFreshAuthority.js').FreshnessBudget;
    behavior: import('./ponsLaunchManifest.js').BehaviorEvidence;
    trace: ExactTraceEvidence; nowMs: number; headNumber: bigint;
    corroboration?:import('./ponsFreshAuthority.js').FreshCorroboration;
  }
): Promise<import('./ponsExecutionEnvelope.js').ExactRehearsalReceipt> {
  // Project the accepted material before cloning: callers may also carry trusted callbacks.
  input=structuredClone({manifest:input.manifest,envelope:input.envelope,readPlan:input.readPlan,snapshot:input.snapshot,budget:input.budget,behavior:input.behavior,trace:input.trace,nowMs:input.nowMs,headNumber:input.headNumber,corroboration:input.corroboration});
  const { assertCreationPostconditions, assertDigest, digestString, seal, validateBehaviorEvidence, validatePonsLaunchManifest } = await import('./ponsLaunchManifest.js');
  const {canonicalJson}=await import('../evidence/canonical.js');
  const { validateExecutionEnvelope, assertWalletQuiescence } = await import('./ponsExecutionEnvelope.js');
  const { authorityObservationsDigest, validateFreshAuthority } = await import('./ponsFreshAuthority.js');
  const m = await validatePonsLaunchManifest(input.manifest);
  const e = await validateExecutionEnvelope(m,input.envelope,input.nowMs);
  await Promise.all([validateBehaviorEvidence(m,input.behavior),validateFreshAuthority(m,input.readPlan,input.snapshot,input.budget,input.nowMs,input.headNumber,input.corroboration),assertDigest(input.trace)]);
  assertWalletQuiescence(e,input.snapshot);
  const t = input.trace;
  requireCondition(t.schemaVersion === 'binrat.pons-exact-trace/1' && t.manifestDigest === m.digest && t.envelopeDigest === e.digest && t.authorityObservationsDigest === await authorityObservationsDigest(input.snapshot) && t.stateOverridesUsed === false && t.noLiteralVaultDependency === true && t.reproduction.trim().length > 0 && digestString(t.rawTraceDigest), 'EXACT_TRACE_BINDING_INVALID');
  requireCondition(!canonicalJson(m).toLowerCase().includes(t.vault.slice(2).toLowerCase()) && e.calldata.toLowerCase().indexOf(t.vault.slice(2).toLowerCase()) === -1, 'LITERAL_VAULT_DEPENDENCY');
  assertCreationPostconditions(m,t.token,t.vault,t.creation);
  requireCondition(await client.getChainId() === 4663, 'EXACT_REHEARSAL_CHAIN_MISMATCH');
  const blockNumber = BigInt(input.snapshot.block.number);
  requireCondition((await client.getBlock({blockNumber})).hash === input.snapshot.block.hash, 'EXACT_REHEARSAL_CANONICAL_MISMATCH');
  const result = await client.call({account:e.from,to:e.to,data:e.calldata,value:BigInt(e.valueWei),gas:BigInt(e.gasLimit),maxFeePerGas:BigInt(e.maxFeePerGasWei),maxPriorityFeePerGas:BigInt(e.maxPriorityFeePerGasWei),nonce:Number(e.nonce),blockNumber});
  requireCondition(result.data, 'EXACT_REHEARSAL_EMPTY');
  const [token,vault] = decodeFunctionResult({abi:PONS_LAUNCH_WITH_VAULT_ABI,functionName:'launchWithVault',data:result.data});
  requireCondition(getAddress(token) === getAddress(t.token) && getAddress(vault) === getAddress(t.vault), 'EXACT_TRACE_RESULT_MISMATCH');
  requireCondition((await client.getBlock({blockNumber})).hash === input.snapshot.block.hash, 'EXACT_REHEARSAL_CANONICAL_MISMATCH');
  for (const key of ['token','curve'] as const) if (m.predictions[key].classification === 'IMMUTABLE') requireCondition(getAddress(t[key]) === getAddress(m.predictions[key].address!), `EXACT_REHEARSAL_PREDICTION_MISMATCH:${key}`);
  return seal({schemaVersion:'binrat.pons-exact-rehearsal/2' as const,status:'PASS_NO_BROADCAST' as const,manifestDigest:m.digest,envelopeDigest:e.digest,snapshotDigest:input.snapshot.digest,block:input.snapshot.block,calldataHash:e.calldataHash,token:getAddress(token),curve:getAddress(t.curve),provisionalVault:getAddress(vault),traceArtifactDigest:t.digest,stateOverridesUsed:false as const,signing:false as const,broadcast:false as const,launchAuthorized:false as const});
}
/** Fresh call before send. A nonce-dependent vault may change; its literal address is never authority. */
export async function preSendExactCall(client:PublicClient,m:import('./ponsLaunchManifest.js').PonsLaunchManifest,e:import('./ponsExecutionEnvelope.js').FinalExecutionEnvelope,s:import('./ponsFreshAuthority.js').AuthoritySnapshot):Promise<void> {
  [m,e,s]=structuredClone([m,e,s]);
  const {canonicalJson}=await import('../evidence/canonical.js');
  const blockNumber=BigInt(s.block.number);
  requireCondition(await client.getChainId() === 4663 && (await client.getBlock({blockNumber})).hash === s.block.hash,'PRE_SEND_CALL_CHAIN_OR_BLOCK_DRIFT');
  const result=await client.call({account:e.from,to:e.to,data:e.calldata,value:BigInt(e.valueWei),gas:BigInt(e.gasLimit),maxFeePerGas:BigInt(e.maxFeePerGasWei),maxPriorityFeePerGas:BigInt(e.maxPriorityFeePerGasWei),nonce:Number(e.nonce),blockNumber});
  requireCondition(result.data,'PRE_SEND_CALL_EMPTY');
  const [token,vault]=decodeFunctionResult({abi:PONS_LAUNCH_WITH_VAULT_ABI,functionName:'launchWithVault',data:result.data});
  requireCondition(token !== PONS_ZERO_ADDRESS && vault !== PONS_ZERO_ADDRESS && token.toLowerCase() !== vault.toLowerCase(),'PRE_SEND_CALL_OUTPUT_INVALID');
  if(m.predictions.token.classification === 'IMMUTABLE') requireCondition(getAddress(token) === getAddress(m.predictions.token.address!),'PRE_SEND_TOKEN_PREDICTION_DRIFT');
  requireCondition(!canonicalJson(m).toLowerCase().includes(vault.slice(2).toLowerCase()) && !e.calldata.toLowerCase().includes(vault.slice(2).toLowerCase()),'LITERAL_VAULT_DEPENDENCY');
  requireCondition((await client.getBlock({blockNumber})).hash === s.block.hash,'PRE_SEND_CALL_REORGED');
}

export function createPonsRehearsalReceipt(input: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: PONS_REHEARSAL_SCHEMA, ...input,
    abi: { ...PONS_VAULT_UI_ABI_PROVENANCE, sourceRuntimeBinding: 'UNRESOLVED' },
    selectedLauncher: PONS_VAULT_LAUNCHER_V1, ponsFactory: PONS_V2_FACTORY_V1,
    sourceRuntimeBinding: 'UNRESOLVED', signing: false, broadcast: false, launchAuthorized: false
  };
}
