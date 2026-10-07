import { encodeAbiParameters, getAddress, isAddress, keccak256, type Address, type Hex } from 'viem';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { PONS_LAUNCH_CHAIN_ID, PONS_STAKING_FACTORY_V1, PONS_V2_FACTORY_V1, PONS_VAULT_LAUNCHER_V1, PONS_VAULT_REGISTRY_V1 } from './ponsPlan.js';
import { PONS_ZERO_ADDRESS } from './ponsLaunchRehearsal.js';

export const MANIFEST_SCHEMA = 'binrat.pons-semantic-manifest/1' as const;
export const CRITICAL_BEHAVIORS = [
  'sourceRuntime', 'abiSelectors', 'nativeValue', 'vaultCreation', 'tokenVaultBinding',
  'economics', 'fundsFlow', 'recipientDeployer', 'rewardClaimAssets', 'payoutLock',
  'principalSafety', 'controllers', 'postLaunchAuthority', 'literalVaultIndependence'
] as const;
export type CriticalBehavior = typeof CRITICAL_BEHAVIORS[number];
export const CONTRACT_ROLES = ['ponsFactory', 'launcher', 'registry', 'stakingFactory', 'stakingBeacon', 'stakingImplementation', 'launchDeployer', 'memeHook', 'feeEscrow', 'locker', 'graduationExecutor'] as const;
export type ContractRole = typeof CONTRACT_ROLES[number];
export interface ContractAuthority { address: Address; codeHash: Hex; owner: Address | null }
export type AssetIdentity = { status: 'VERIFIED'; kind: 'NATIVE_ETH' | 'ERC20'; address: Address; evidenceDigest: string } | { status: 'UNKNOWN' };
export const ASSET_FIELDS = ['pairQuoteAsset', 'vaultQuoteAsset', 'feeAccountingAsset', 'rewardAccountingAsset', 'claimAsset'] as const;
export type LaunchAssets = Record<typeof ASSET_FIELDS[number], AssetIdentity>;
export interface CreationPostconditions {
  stakingFactory:Address; vaultToken:Address; vaultBeacon:Address; vaultImplementation:Address;
  minimumFeesBeforePayoutWei:string; lock:PonsLaunchManifest['staking']['lock']; assets:LaunchAssets;
  roles:Record<string,Address>; economics:Record<string,string>; configuration:Record<string,string>;
  metadata:PonsLaunchManifest['metadata']; postconditions:Record<string,string>;
}
export function assertCreationPostconditions(m:PonsLaunchManifest,token:Address,vault:Address,p:CreationPostconditions):void {
  requireCondition(p.stakingFactory.toLowerCase() === m.contracts.stakingFactory.address.toLowerCase() && p.vaultToken.toLowerCase() === token.toLowerCase() && p.vaultBeacon.toLowerCase() === m.contracts.stakingBeacon.address.toLowerCase() && p.vaultImplementation.toLowerCase() === m.contracts.stakingImplementation.address.toLowerCase() && p.minimumFeesBeforePayoutWei === m.staking.minimumFeesBeforePayoutWei && same(p.lock,m.staking.lock),'EXACT_CREATION_STAKING_MISMATCH');
  assertAssets(p.assets);
  requireCondition(same(p.assets,m.assets) && same(p.economics,m.config.economics) && same(p.configuration,m.config.configuration) && same(p.metadata,m.metadata) && same(p.postconditions,m.postconditions),'EXACT_CREATION_SEMANTICS_MISMATCH');
  requireCondition(same(Object.keys(p.roles).sort(),Object.keys(m.roles).sort()),'EXACT_CREATION_ROLE_SET_MISMATCH');
  for (const [key,reference] of Object.entries(m.roles)) {const expected=reference === 'ACTUAL_VAULT' ? vault : reference === 'LAUNCH_WALLET' ? m.wallet.address : reference;requireCondition(p.roles[key]?.toLowerCase() === expected.toLowerCase(),`EXACT_CREATION_ROLE_MISMATCH:${key}`);}
}
export type RoleReference = 'ACTUAL_VAULT' | 'LAUNCH_WALLET' | Address;
export interface Prediction { classification: 'IMMUTABLE' | 'PROVISIONAL'; address: Address | null; derivationEvidenceDigest: string | null }
export interface PonsLaunchManifest {
  schemaVersion: typeof MANIFEST_SCHEMA;
  chainId: 4663;
  rail: 'PONS_V2_NATIVE_ETH_PONSVault_STAKING';
  wallet: { address: Address; accountType: 'EOA'; codeHash: Hex };
  contracts: Record<ContractRole, ContractAuthority> & Record<string, ContractAuthority>;
  bindings: Record<string, Address>;
  authorityReadPlanDigest: string;
  controllerCodeHashes: Record<string, Hex>;
  config: { id: string; expectedEconomics: Hex; launchFeeWei: string; economics: Record<string, string>; configuration: Record<string, string> };
  metadata: { name: string; symbol: string; logo: string; description: string; socials: { twitter: string; telegram: string; discord: string; website: string; farcaster: string } };
  policy: { creatorTaxBps: 0; buybackEnabled: false; openingBuyWei: '0'; privatePresale: 'NONE'; discountedInsiderRound: 'NONE'; hiddenTeamAllocation: 'NONE'; laterFounderPurchase: 'PUBLIC_MARKET_DISCLOSED' };
  staking: { required: true; template: 'staking'; configBytes: Hex; minimumFeesBeforePayoutWei: string; contractMinimumPayoutWei: string; lock: { kind: 'NO_SUPPORTED_LOCK' | 'CONFIGURED'; seconds: string }; creationRuleEvidenceDigest: string; vaultPrediction: 'PROVISIONAL' };
  roles: Record<string, RoleReference>;
  assets: LaunchAssets;
  call: { creatorFeeRecipient: Address; salt: Hex; selector: '0x969e6741' };
  predictions: { token: Prediction; curve: Prediction };
  postconditions: Record<string, string>;
  behaviorEvidenceDigest: string;
  upstreamRiskDeclarationDigest: string;
  workingRatStatus: 'PLANNED';
  productionEntitlementActive: false;
  digest: string;
}
export interface BehaviorEvidence {
  schemaVersion: 'binrat.pons-behavior-evidence/1';
  contractsDigest: string;
  semanticInputsDigest: string;
  source: 'MATCHED' | 'UNAVAILABLE' | 'AVAILABLE_UNMATCHED';
  contractSources: Record<string,{status:'MATCHED' | 'UNAVAILABLE' | 'AVAILABLE_UNMATCHED';runtimeCodeHash:Hex;artifactDigest:string}>;
  critical: Record<CriticalBehavior, { status: 'VERIFIED' | 'UNKNOWN'; method: 'SOURCE_RUNTIME_MATCH' | 'INDEPENDENT_RPC' | 'REPRODUCIBLE_FORK_TRACE'; artifactDigest: string; reproduction: string }>;
  predictionProofs: { token: { deterministic: boolean; artifactDigest: string | null }; curve: { deterministic: boolean; artifactDigest: string | null } };
  noLiteralVaultDependency: boolean;
  digest: string;
}
export const ACCEPTABLE_RESIDUAL_RISKS = ['PUBLIC_SOURCE_UNAVAILABLE', 'SHARED_BEACON_UPGRADES', 'DISCLOSED_OWNER_POWERS', 'NO_COMPLETED_THIRD_PARTY_AUDIT'] as const;
export interface UpstreamRiskDeclaration { schemaVersion: 'binrat.pons-upstream-risk/1'; risks: typeof ACCEPTABLE_RESIDUAL_RISKS[number][]; behaviorEvidenceDigest: string; disclosures: string[]; digest: string }

export function requireCondition(ok: unknown, code: string): asserts ok { if (!ok) throw new Error(code); }
export function digestString(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
export function hex32(value: unknown): value is Hex { return typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value); }
export function uint(value: unknown): value is string { return typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value); }
export function address(value: unknown, nonzero = true): value is Address { return typeof value === 'string' && isAddress(value, { strict: false }) && (!nonzero || value.toLowerCase() !== PONS_ZERO_ADDRESS); }
export function same(a: unknown, b: unknown): boolean { return canonicalJson(a) === canonicalJson(b); }
export function exactKeys(value:object,keys:readonly string[],code:string):void {requireCondition(same(Object.keys(value).sort(),[...keys].sort()),code);}
export function jsonMaterial(value: unknown): void {
  requireCondition(value !== undefined, 'ARTIFACT_UNDEFINED');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { requireCondition(Number.isSafeInteger(value), 'ARTIFACT_NUMBER_INVALID'); return; }
  requireCondition(typeof value === 'object' && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype), 'ARTIFACT_JSON_REQUIRED');
  for (const item of Object.values(value as object)) jsonMaterial(item);
}
export async function artifactDigest(value: unknown): Promise<string> {
  jsonMaterial(value);
  const { digest: _digest, ...payload } = value as Record<string, unknown>;
  return sha256Hex(payload);
}
export async function seal<T extends object>(payload: T): Promise<T & { digest: string }> {
  const copy = structuredClone(payload);
  return { ...copy, digest: await artifactDigest(copy) };
}
export async function assertDigest(value: { digest: string }): Promise<void> {
  requireCondition(digestString(value.digest) && await artifactDigest(value) === value.digest, 'ARTIFACT_DIGEST_MISMATCH');
}
export async function semanticInputsDigest(manifest: PonsLaunchManifest): Promise<string> {
  const { digest: _digest, behaviorEvidenceDigest: _behavior, upstreamRiskDeclarationDigest: _risk, predictions: _predictions, ...inputs } = manifest;
  return sha256Hex(inputs);
}
export const ECONOMICS_KEYS=['phantomQuote','graduationThreshold','supply','curveFeeBps','poolFee','tickSpacing','protocolFeeShareBps','buybackBurnBps','hookFeeBps','maxInternalPriceImpactBps'] as const;
export function economicsHash(values:Record<string,string>):Hex {
  requireCondition(same(Object.keys(values).sort(),[...ECONOMICS_KEYS].sort()) && Object.values(values).every(v=>/^-?(0|[1-9][0-9]*)$/.test(v)), 'EXACT_ECONOMICS_FIELDS_MISSING');
  const v=ECONOMICS_KEYS.map(k=>BigInt(values[k]));
  requireCondition(v.every((n,i)=>i === 5 ? n >= -(2n**23n) && n < 2n**23n : n >= 0n && n < 2n**256n), 'EXACT_ECONOMICS_RANGE_INVALID');
  return keccak256(encodeAbiParameters([{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint24'},{type:'int24'},{type:'uint16'},{type:'uint16'},{type:'uint16'},{type:'uint16'}],[v[0],v[1],v[2],v[3],Number(v[4]),Number(v[5]),Number(v[6]),Number(v[7]),Number(v[8]),Number(v[9])]));
}
export function assertAssets(assets: LaunchAssets): void {
  requireCondition(assets && same(Object.keys(assets).sort(), [...ASSET_FIELDS].sort()), 'ASSET_SET_INVALID');
  for (const key of ASSET_FIELDS) {
    const asset = assets[key];
    requireCondition(asset?.status === 'VERIFIED', `CRITICAL_ASSET_UNKNOWN:${key}`);
    requireCondition(address(asset.address, false) && digestString(asset.evidenceDigest), `ASSET_INVALID:${key}`);
    requireCondition(asset.kind === 'NATIVE_ETH' ? asset.address.toLowerCase() === PONS_ZERO_ADDRESS : asset.kind === 'ERC20' && address(asset.address), `ASSET_REPRESENTATION_INVALID:${key}`);
  }
  requireCondition(assets.pairQuoteAsset.status === 'VERIFIED' && assets.pairQuoteAsset.kind === 'NATIVE_ETH', 'PAIR_NOT_NATIVE_ETH');
}
export async function validatePonsLaunchManifest(input: PonsLaunchManifest): Promise<PonsLaunchManifest> {
  const m = structuredClone(input);
  await assertDigest(m);
  exactKeys(m,['schemaVersion','chainId','rail','wallet','contracts','bindings','authorityReadPlanDigest','controllerCodeHashes','config','metadata','policy','staking','roles','assets','call','predictions','postconditions','behaviorEvidenceDigest','upstreamRiskDeclarationDigest','workingRatStatus','productionEntitlementActive','digest'],'MANIFEST_FIELD_SET_INVALID');
  requireCondition(m.schemaVersion === MANIFEST_SCHEMA && m.chainId === PONS_LAUNCH_CHAIN_ID && m.rail === 'PONS_V2_NATIVE_ETH_PONSVault_STAKING', 'MANIFEST_RAIL_INVALID');
  requireCondition(address(m.wallet?.address) && m.wallet.accountType === 'EOA' && m.wallet.codeHash === keccak256('0x'), 'MANIFEST_WALLET_INVALID');
  const pinned: Partial<Record<ContractRole, Address>> = { ponsFactory: PONS_V2_FACTORY_V1, launcher: PONS_VAULT_LAUNCHER_V1, registry: PONS_VAULT_REGISTRY_V1, stakingFactory: PONS_STAKING_FACTORY_V1 };
  for (const role of CONTRACT_ROLES) requireCondition(m.contracts?.[role], `MANIFEST_CONTRACT_MISSING:${role}`);
  for (const [role, authority] of Object.entries(m.contracts)) {
    requireCondition(address(authority.address) && hex32(authority.codeHash) && (authority.owner === null || address(authority.owner)), `MANIFEST_CONTRACT_INVALID:${role}`);
    if (pinned[role as ContractRole]) requireCondition(getAddress(authority.address) === getAddress(pinned[role as ContractRole]!), `MANIFEST_CONTRACT_RAIL_DRIFT:${role}`);
  }
  for (const value of Object.values(m.bindings)) requireCondition(address(value), 'MANIFEST_BINDING_INVALID');
  requireCondition(digestString(m.authorityReadPlanDigest), 'MANIFEST_READ_PLAN_MISSING');
  for (const role of ['ponsFactory','registry','stakingFactory','stakingBeacon']) requireCondition(address(m.contracts[role].owner), `MANIFEST_CONTROLLER_UNKNOWN:${role}`);
  for (const authority of Object.values(m.contracts)) if (authority.owner !== null) requireCondition(hex32(m.controllerCodeHashes[authority.owner.toLowerCase()]), 'MANIFEST_CONTROLLER_CODE_UNKNOWN');
  const bindings = { launcherPonsFactory: m.contracts.ponsFactory.address, launcherRegistry: m.contracts.registry.address, registryStakingFactory: m.contracts.stakingFactory.address, stakingFactoryBeacon: m.contracts.stakingBeacon.address, stakingFactoryImplementation: m.contracts.stakingImplementation.address, stakingBeaconImplementation: m.contracts.stakingImplementation.address, launchDeployer:m.contracts.launchDeployer.address,memeHook:m.contracts.memeHook.address,feeEscrow:m.contracts.feeEscrow.address,locker:m.contracts.locker.address,graduationExecutor:m.contracts.graduationExecutor.address };
  for (const [key, value] of Object.entries(bindings)) requireCondition(m.bindings[key]?.toLowerCase() === value.toLowerCase(), `MANIFEST_BINDING_MISSING:${key}`);
  requireCondition(uint(m.config.id) && uint(m.config.launchFeeWei) && hex32(m.config.expectedEconomics) && BigInt(m.config.expectedEconomics) !== 0n, 'MANIFEST_ECONOMICS_INVALID');
  requireCondition(economicsHash(m.config.economics) === m.config.expectedEconomics && m.config.configuration.enabled === 'true' && uint(m.config.configuration.snipeTaxStartBps) && uint(m.config.configuration.snipeTaxSeconds) && ['true','false'].includes(m.config.configuration.launchEnabled), 'MANIFEST_CONFIGURATION_MISSING');
  requireCondition(same(m.policy, { creatorTaxBps: 0, buybackEnabled: false, openingBuyWei: '0', privatePresale: 'NONE', discountedInsiderRound: 'NONE', hiddenTeamAllocation: 'NONE', laterFounderPurchase: 'PUBLIC_MARKET_DISCLOSED' }), 'MANIFEST_POLICY_INVALID');
  requireCondition(m.staking?.required === true && m.staking.template === 'staking' && m.staking.vaultPrediction === 'PROVISIONAL' && /^0x[0-9a-fA-F]+$/.test(m.staking.configBytes) && m.staking.configBytes.length % 2 === 0, 'MANIFEST_STAKING_REQUIRED');
  requireCondition(uint(m.staking.minimumFeesBeforePayoutWei) && uint(m.staking.contractMinimumPayoutWei) && BigInt(m.staking.minimumFeesBeforePayoutWei) >= BigInt(m.staking.contractMinimumPayoutWei) && digestString(m.staking.creationRuleEvidenceDigest), 'MANIFEST_PAYOUT_INVALID');
  requireCondition(['NO_SUPPORTED_LOCK', 'CONFIGURED'].includes(m.staking.lock?.kind) && uint(m.staking.lock.seconds) && (m.staking.lock.kind !== 'NO_SUPPORTED_LOCK' || m.staking.lock.seconds === '0'), 'MANIFEST_LOCK_UNKNOWN');
  requireCondition(m.workingRatStatus === 'PLANNED' && m.productionEntitlementActive === false, 'MANIFEST_ENTITLEMENT_NOT_AUTHORIZED');
  for (const key of ['name', 'symbol', 'logo', 'description'] as const) requireCondition(typeof m.metadata?.[key] === 'string' && m.metadata[key].trim().length > 0, `MANIFEST_METADATA_MISSING:${key}`);
  requireCondition(same(Object.keys(m.metadata.socials).sort(), ['twitter','telegram','discord','website','farcaster'].sort()) && Object.values(m.metadata.socials).every(v => typeof v === 'string'), 'MANIFEST_SOCIALS_INVALID');
  for (const key of ['creator', 'deployer', 'creatorFeeRecipient', 'vaultController']) requireCondition(m.roles?.[key], `MANIFEST_ROLE_MISSING:${key}`);
  for (const value of Object.values(m.roles)) requireCondition(value === 'ACTUAL_VAULT' || value === 'LAUNCH_WALLET' || address(value), 'MANIFEST_ROLE_INVALID');
  requireCondition(address(m.call?.creatorFeeRecipient) && hex32(m.call.salt) && m.call.selector === '0x969e6741', 'MANIFEST_CALL_INVALID');
  for (const prediction of Object.values(m.predictions)) {
    requireCondition(prediction.classification === 'IMMUTABLE' || prediction.classification === 'PROVISIONAL', 'MANIFEST_PREDICTION_INVALID');
    requireCondition(prediction.classification === 'IMMUTABLE' ? address(prediction.address) && digestString(prediction.derivationEvidenceDigest) : prediction.address === null && prediction.derivationEvidenceDigest === null, 'MANIFEST_PREDICTION_UNPROVEN');
  }
  requireCondition(same(Object.keys(m.predictions).sort(), ['curve','token']) && Object.keys(m.postconditions).length > 0 && Object.values(m.postconditions).every(v => typeof v === 'string'), 'MANIFEST_POSTCONDITIONS_MISSING');
  requireCondition(digestString(m.behaviorEvidenceDigest) && digestString(m.upstreamRiskDeclarationDigest), 'MANIFEST_EVIDENCE_MISSING');
  assertAssets(m.assets);
  for (const asset of Object.values(m.assets)) if (asset.status === 'VERIFIED' && asset.kind === 'ERC20') requireCondition(Object.values(m.contracts).some(c=>c.address.toLowerCase() === asset.address.toLowerCase()),'MANIFEST_ASSET_CODE_AUTHORITY_MISSING');
  requireCondition(m.staking.configBytes === encodeAbiParameters([{type:'uint256'}],[BigInt(m.staking.minimumFeesBeforePayoutWei)]),'STAKING_CONFIG_ABI_OR_PAYOUT_MISMATCH');
  return m;
}
export async function validateBehaviorEvidence(m: PonsLaunchManifest, bundle: BehaviorEvidence): Promise<void> {
  [m,bundle]=structuredClone([m,bundle]);
  await assertDigest(bundle);
  requireCondition(bundle.schemaVersion === 'binrat.pons-behavior-evidence/1' && bundle.digest === m.behaviorEvidenceDigest && bundle.contractsDigest === await sha256Hex(m.contracts) && bundle.semanticInputsDigest === await semanticInputsDigest(m), 'BEHAVIOR_BINDING_INVALID');
  requireCondition(bundle.source === 'MATCHED' || bundle.source === 'UNAVAILABLE', 'AVAILABLE_SOURCE_UNMATCHED');
  requireCondition(same(Object.keys(bundle.contractSources).sort(),Object.keys(m.contracts).sort()), 'CONTRACT_SOURCE_COVERAGE_MISSING');
  for (const [role,source] of Object.entries(bundle.contractSources)) requireCondition((source.status === 'MATCHED' || source.status === 'UNAVAILABLE') && source.runtimeCodeHash === m.contracts[role].codeHash && digestString(source.artifactDigest), `CONTRACT_SOURCE_UNMATCHED:${role}`);
  requireCondition(bundle.source === 'UNAVAILABLE' ? Object.values(bundle.contractSources).some(s=>s.status === 'UNAVAILABLE') : Object.values(bundle.contractSources).every(s=>s.status === 'MATCHED'), 'SOURCE_CLASSIFICATION_MISMATCH');
  requireCondition(same(Object.keys(bundle.critical).sort(), [...CRITICAL_BEHAVIORS].sort()), 'BEHAVIOR_SET_INVALID');
  for (const key of CRITICAL_BEHAVIORS) {
    const proof = bundle.critical[key];
    requireCondition(proof.status === 'VERIFIED' && ['SOURCE_RUNTIME_MATCH','INDEPENDENT_RPC','REPRODUCIBLE_FORK_TRACE'].includes(proof.method) && digestString(proof.artifactDigest) && proof.reproduction.trim().length > 0, `CRITICAL_BEHAVIOR_UNKNOWN:${key}`);
    if (bundle.source === 'UNAVAILABLE') requireCondition(proof.method !== 'SOURCE_RUNTIME_MATCH', `SOURCE_PROOF_UNAVAILABLE:${key}`);
  }
  requireCondition(bundle.noLiteralVaultDependency === true, 'LITERAL_VAULT_DEPENDENCY');
  for (const key of ['token', 'curve'] as const) {
    const p = m.predictions[key], proof = bundle.predictionProofs[key];
    if (p.classification === 'IMMUTABLE') requireCondition(proof.deterministic === true && proof.artifactDigest === p.derivationEvidenceDigest, `PREDICTION_NOT_DETERMINISTIC:${key}`);
    else requireCondition(proof.deterministic === false, `PREDICTION_CLASSIFICATION_MISMATCH:${key}`);
  }
}
export async function validateRiskDeclaration(m: PonsLaunchManifest, risk: UpstreamRiskDeclaration): Promise<void> {
  [m,risk]=structuredClone([m,risk]);
  await assertDigest(risk);
  exactKeys(risk,['schemaVersion','risks','behaviorEvidenceDigest','disclosures','digest'],'RISK_FIELD_SET_INVALID');
  requireCondition(risk.schemaVersion === 'binrat.pons-upstream-risk/1' && risk.digest === m.upstreamRiskDeclarationDigest && risk.behaviorEvidenceDigest === m.behaviorEvidenceDigest && Array.isArray(risk.risks) && new Set(risk.risks).size === risk.risks.length && risk.risks.every(r => ACCEPTABLE_RESIDUAL_RISKS.includes(r)) && risk.disclosures.length > 0 && risk.disclosures.every(v => typeof v === 'string' && v.trim().length > 0), 'RISK_WAIVER_INVALID');
  requireCondition(['SHARED_BEACON_UPGRADES','DISCLOSED_OWNER_POWERS','NO_COMPLETED_THIRD_PARTY_AUDIT'].every(r=>risk.risks.includes(r as typeof risk.risks[number])),'FROZEN_UPSTREAM_RISKS_NOT_DISCLOSED');
}
