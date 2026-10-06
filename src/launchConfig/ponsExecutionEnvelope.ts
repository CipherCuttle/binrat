import { encodeFunctionData, keccak256, recoverMessageAddress, type Address, type Hex } from 'viem';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { PONS_LAUNCH_WITH_VAULT_ABI } from './ponsVaultLaunchAbi.js';
import { PONS_STAKING_TEMPLATE_ID, PONS_ZERO_ADDRESS } from './ponsLaunchRehearsal.js';
import { assertDigest, digestString, exactKeys, hex32, requireCondition, same, seal, uint, validateBehaviorEvidence, validatePonsLaunchManifest, validateRiskDeclaration, type BehaviorEvidence, type PonsLaunchManifest, type UpstreamRiskDeclaration } from './ponsLaunchManifest.js';
import { validateFreshAuthority, type AuthorityReadPlan, type AuthoritySnapshot, type FreshnessBudget, type FreshCorroboration } from './ponsFreshAuthority.js';
import { validatePhaseGates, type PhaseGateBundle } from './gateMatrix.js';

export interface FinalExecutionEnvelope {
  schemaVersion: 'binrat.pons-execution-envelope/1'; manifestDigest: string; chainId: 4663;
  from: Address; nonce: string; to: Address; calldata: Hex; calldataHash: Hex; valueWei: string;
  gasLimit: string; maxFeePerGasWei: string; maxPriorityFeePerGasWei: string; approvedFeeCeilingWei: string;
  createdAtMs: number; expiresAtMs: number; digest: string;
}
export type ApprovalKind = 'OWNER_ARM' | 'OWNER_PUBLICATION' | 'LEGAL_EXECUTION' | 'LEGAL_PUBLICATION' | 'UPSTREAM_ACCEPTANCE' | 'BEHAVIOR_REVIEW';
export interface ScopedApproval {
  body: { id: string; kind: ApprovalKind; manifestDigest: string; envelopeDigest: string | null; notBeforeMs: number; expiresAtMs: number; scope: string[]; conditionsDigest: string; references: Record<string, string>; walletQuiescence: boolean };
  signer: Address; signature: Hex; digest: string;
}
export interface ApprovalTrust {
  legalSigner: Address; behaviorReviewer: Address;
  /** Trusted private approval/revocation store. Failure or missing state must throw. */
  approvalState: (id: string, digest: string) => Promise<'VALID' | 'REVOKED' | 'UNKNOWN'>;
  /** Fresh documented inventory. UNAVAILABLE means retrieval completed without obtainable source, not proof of global absence. */
  sourceState:(role:string,address:Address,codeHash:Hex)=>Promise<'MATCHED' | 'UNAVAILABLE' | 'AVAILABLE_UNMATCHED' | 'UNKNOWN'>;
  /** Trusted quiescence registry: exactly one active envelope per chain/wallet; explicit re-arm replaces it. */
  activeEnvelope:(chainId:4663,wallet:Address)=>Promise<string|null>;
}
export interface ExactRehearsalReceipt {
  schemaVersion: 'binrat.pons-exact-rehearsal/2'; status: 'PASS_NO_BROADCAST'; manifestDigest: string;
  envelopeDigest: string; snapshotDigest: string; block: AuthoritySnapshot['block'];
  calldataHash: Hex; token: Address; curve: Address; provisionalVault: Address;
  traceArtifactDigest: string; stateOverridesUsed: false; signing: false; broadcast: false; launchAuthorized: false; digest: string;
}
export interface ArmReceipt {
  schemaVersion: 'binrat.pons-arm/1'; state: 'ARMED'; manifestDigest: string; envelopeDigest: string;
  budgetDigest: string; rehearsalDigest: string; snapshotDigest: string;
  ownerApprovalDigest: string; legalApprovalDigest: string; riskApprovalDigest: string; behaviorApprovalDigest: string;
  armedAtMs: number; expiresAtMs: number; broadcast: false; digest: string;
}
export interface ArmInputs {
  manifest: PonsLaunchManifest; envelope: FinalExecutionEnvelope; behavior: BehaviorEvidence; risk: UpstreamRiskDeclaration;
  readPlan: AuthorityReadPlan; snapshot: AuthoritySnapshot; budget: FreshnessBudget; rehearsal: ExactRehearsalReceipt;
  approvals: { owner: ScopedApproval; legal: ScopedApproval; risk: ScopedApproval; behavior: ScopedApproval };
  trust: ApprovalTrust; nowMs: number; headNumber: bigint;
  gates: PhaseGateBundle;
  corroboration?:FreshCorroboration;
}
export function cloneApprovalTrust(trust:ApprovalTrust):ApprovalTrust {
  // Capture trust identities and callback functions; their private stores still supply fresh state.
  return Object.freeze({legalSigner:trust.legalSigner,behaviorReviewer:trust.behaviorReviewer,approvalState:trust.approvalState.bind(trust),sourceState:trust.sourceState.bind(trust),activeEnvelope:trust.activeEnvelope.bind(trust)});
}
export function cloneArmInputs(input:ArmInputs):ArmInputs {const {trust,...material}=input;return {...structuredClone(material),trust:cloneApprovalTrust(trust)};}
export function calldataForManifest(m: PonsLaunchManifest): Hex {
  return encodeFunctionData({abi:PONS_LAUNCH_WITH_VAULT_ABI,functionName:'launchWithVault',args:[{...m.metadata,creatorFeeRecipient:m.call.creatorFeeRecipient,creatorTaxBps:0,buybackEnabled:false,expectedEconomics:m.config.expectedEconomics,salt:m.call.salt},BigInt(m.config.id),PONS_ZERO_ADDRESS,PONS_STAKING_TEMPLATE_ID,m.staking.configBytes]});
}
export async function validateExecutionEnvelope(m: PonsLaunchManifest, envelope: FinalExecutionEnvelope, nowMs: number): Promise<FinalExecutionEnvelope> {
  m=structuredClone(m);
  const e = structuredClone(envelope);
  await assertDigest(e);
  exactKeys(e,['schemaVersion','manifestDigest','chainId','from','nonce','to','calldata','calldataHash','valueWei','gasLimit','maxFeePerGasWei','maxPriorityFeePerGasWei','approvedFeeCeilingWei','createdAtMs','expiresAtMs','digest'],'ENVELOPE_FIELD_SET_INVALID');
  requireCondition(e.schemaVersion === 'binrat.pons-execution-envelope/1' && e.manifestDigest === m.digest && e.chainId === 4663 && e.from.toLowerCase() === m.wallet.address.toLowerCase() && e.to.toLowerCase() === m.contracts.launcher.address.toLowerCase(), 'ENVELOPE_MANIFEST_BINDING');
  requireCondition(e.calldata === calldataForManifest(m) && e.calldataHash === keccak256(e.calldata) && hex32(e.calldataHash), 'ENVELOPE_CALLDATA_DRIFT');
  requireCondition([e.nonce,e.valueWei,e.gasLimit,e.maxFeePerGasWei,e.maxPriorityFeePerGasWei,e.approvedFeeCeilingWei].every(uint) && BigInt(e.nonce) <= BigInt(Number.MAX_SAFE_INTEGER), 'ENVELOPE_UINT_INVALID');
  requireCondition(e.valueWei === m.config.launchFeeWei && BigInt(e.gasLimit) > 0n && BigInt(e.maxFeePerGasWei) > 0n && BigInt(e.maxPriorityFeePerGasWei) <= BigInt(e.maxFeePerGasWei) && BigInt(e.approvedFeeCeilingWei) === BigInt(e.gasLimit) * BigInt(e.maxFeePerGasWei), 'ENVELOPE_VALUE_OR_FEE_INVALID');
  requireCondition(Number.isSafeInteger(e.createdAtMs) && Number.isSafeInteger(e.expiresAtMs) && e.createdAtMs <= nowMs && nowMs < e.expiresAtMs, 'ENVELOPE_EXPIRED');
  return e;
}
export async function approvalMessage(body: ScopedApproval['body']): Promise<string> { return `BINRAT_PONS_SCOPED_APPROVAL_V1:${await sha256Hex(body)}`; }
export async function validateScopedApproval(approval: ScopedApproval, kind: ApprovalKind, manifestDigest: string, envelopeDigest: string | null, expectedSigner: Address, nowMs: number, trust: ApprovalTrust): Promise<void> {
  approval=structuredClone(approval);trust=cloneApprovalTrust(trust);
  await assertDigest(approval);
  const b = approval.body;
  requireCondition(b.id.trim().length > 0 && b.kind === kind && b.manifestDigest === manifestDigest && b.envelopeDigest === envelopeDigest && Number.isSafeInteger(b.notBeforeMs) && Number.isSafeInteger(b.expiresAtMs) && b.notBeforeMs <= nowMs && nowMs < b.expiresAtMs && digestString(b.conditionsDigest), 'APPROVAL_SCOPE_OR_VALIDITY_INVALID');
  requireCondition(Array.isArray(b.scope) && b.scope.length > 0 && b.scope.every(s => typeof s === 'string' && s.length > 0) && Object.values(b.references).every(digestString), 'APPROVAL_SCOPE_INVALID');
  requireCondition(approval.signer.toLowerCase() === expectedSigner.toLowerCase() && (await recoverMessageAddress({message:await approvalMessage(b),signature:approval.signature})).toLowerCase() === expectedSigner.toLowerCase(), 'APPROVAL_SIGNATURE_INVALID');
  requireCondition(await trust.approvalState(b.id, approval.digest) === 'VALID', 'APPROVAL_REVOKED_OR_UNKNOWN');
}
export async function validateRehearsal(m: PonsLaunchManifest, e: FinalExecutionEnvelope, s: AuthoritySnapshot, r: ExactRehearsalReceipt): Promise<void> {
  [m,e,s,r]=structuredClone([m,e,s,r]);
  await assertDigest(r);
  requireCondition(r.schemaVersion === 'binrat.pons-exact-rehearsal/2' && r.status === 'PASS_NO_BROADCAST' && r.manifestDigest === m.digest && r.envelopeDigest === e.digest && r.snapshotDigest === s.digest && same(r.block,s.block) && r.calldataHash === e.calldataHash && r.stateOverridesUsed === false && r.signing === false && r.broadcast === false && r.launchAuthorized === false && digestString(r.traceArtifactDigest), 'REHEARSAL_EXACT_BINDING_INVALID');
  for (const key of ['token','curve'] as const) if (m.predictions[key].classification === 'IMMUTABLE') requireCondition(r[key].toLowerCase() === m.predictions[key].address!.toLowerCase(), `REHEARSAL_PREDICTION_MISMATCH:${key}`);
  requireCondition(new Set([r.token.toLowerCase(),r.curve.toLowerCase(),r.provisionalVault.toLowerCase()]).size === 3 && [r.token,r.curve,r.provisionalVault].every(a => /^0x[0-9a-fA-F]{40}$/.test(a) && a.toLowerCase() !== PONS_ZERO_ADDRESS), 'REHEARSAL_OUTPUT_INVALID');
}
export function assertWalletQuiescence(e: FinalExecutionEnvelope, s: AuthoritySnapshot): void {
  requireCondition(s.wallet.nonce === e.nonce && s.wallet.pendingNonce === e.nonce, 'ARMED_WALLET_NONCE_DRIFT_ABORT');
  requireCondition(BigInt(s.wallet.balanceWei) >= BigInt(e.valueWei) + BigInt(e.approvedFeeCeilingWei), 'ARMED_WALLET_FUNDS_ABORT');
  requireCondition(s.wallet.accountType === 'EOA', 'ARMED_WALLET_ACCOUNT_TYPE_ABORT');
}
export async function armExecutionEnvelope(input: ArmInputs): Promise<ArmReceipt> {
  input=cloneArmInputs(input);
  const m = await validatePonsLaunchManifest(input.manifest);
  const e = await validateExecutionEnvelope(m,input.envelope,input.nowMs);
  await Promise.all([validateBehaviorEvidence(m,input.behavior),validateRiskDeclaration(m,input.risk),validateFreshAuthority(m,input.readPlan,input.snapshot,input.budget,input.nowMs,input.headNumber,input.corroboration),validateRehearsal(m,e,input.snapshot,input.rehearsal)]);
  assertWalletQuiescence(e,input.snapshot);
  await validatePhaseGates(input.gates,'PRE-ARM',m.digest,e.digest);
  for (const [role,c] of Object.entries(m.contracts)) {
    const state=await input.trust.sourceState(role,c.address,c.codeHash);
    requireCondition((state === 'MATCHED' || state === 'UNAVAILABLE') && state === input.behavior.contractSources[role].status,`FRESH_SOURCE_MATCH_REQUIRED:${role}`);
  }
  const a = input.approvals;
  await Promise.all([
    validateScopedApproval(a.owner,'OWNER_ARM',m.digest,e.digest,m.wallet.address,input.nowMs,input.trust),
    validateScopedApproval(a.legal,'LEGAL_EXECUTION',m.digest,null,input.trust.legalSigner,input.nowMs,input.trust),
    validateScopedApproval(a.risk,'UPSTREAM_ACCEPTANCE',m.digest,null,m.wallet.address,input.nowMs,input.trust),
    validateScopedApproval(a.behavior,'BEHAVIOR_REVIEW',m.digest,null,input.trust.behaviorReviewer,input.nowMs,input.trust)
  ]);
  requireCondition(a.owner.body.walletQuiescence === true && a.owner.body.scope.includes('ONE_SEND') && a.legal.body.scope.includes('EXECUTION') && a.risk.body.scope.includes('BOUNDED_UPSTREAM_RISK') && a.behavior.body.scope.includes('CRITICAL_BEHAVIOR_VERIFIED'), 'ARM_SCOPED_AUTHORITY_MISSING');
  requireCondition(a.risk.body.references.riskDeclaration === input.risk.digest && a.behavior.body.references.behaviorEvidence === input.behavior.digest && a.behavior.body.references.exactTrace === input.rehearsal.traceArtifactDigest, 'ARM_EVIDENCE_REVIEW_MISSING');
  const refs = {legal:a.legal.digest,risk:a.risk.digest,behavior:a.behavior.digest,budget:input.budget.digest,rehearsal:input.rehearsal.digest,gates:input.gates.digest};
  requireCondition(same(a.owner.body.references,refs), 'ARM_OWNER_REFERENCES_MISMATCH');
  requireCondition(await input.trust.activeEnvelope(4663,m.wallet.address) === e.digest,'EXPLICIT_ARM_REGISTRATION_REQUIRED');
  if (input.behavior.source === 'UNAVAILABLE') requireCondition(input.risk.risks.includes('PUBLIC_SOURCE_UNAVAILABLE'), 'SOURCE_RISK_NOT_ACCEPTED');
  if (input.snapshot.independent.status === 'UNAVAILABLE') requireCondition(a.behavior.body.references.freshCorroboration === input.snapshot.independent.strongerArtifactDigest, 'FRESH_CORROBORATION_NOT_REVIEWED');
  return seal({schemaVersion:'binrat.pons-arm/1' as const,state:'ARMED' as const,manifestDigest:m.digest,envelopeDigest:e.digest,budgetDigest:input.budget.digest,rehearsalDigest:input.rehearsal.digest,snapshotDigest:input.snapshot.digest,ownerApprovalDigest:a.owner.digest,legalApprovalDigest:a.legal.digest,riskApprovalDigest:a.risk.digest,behaviorApprovalDigest:a.behavior.digest,armedAtMs:input.nowMs,expiresAtMs:Math.min(e.expiresAtMs,...Object.values(a).map(v => v.body.expiresAtMs)),broadcast:false as const});
}
export async function preSendRevalidation(input: ArmInputs, armed: ArmReceipt, fresh: AuthoritySnapshot, nowMs: number, headNumber: bigint): Promise<void> {
  input=cloneArmInputs(input);armed=structuredClone(armed);fresh=structuredClone(fresh);
  await assertDigest(armed);
  // Revalidate the original exact authorization; new evidence may refresh observations, never semantics or envelope.
  requireCondition(armed.schemaVersion === 'binrat.pons-arm/1' && armed.state === 'ARMED' && armed.manifestDigest === input.manifest.digest && armed.envelopeDigest === input.envelope.digest && armed.ownerApprovalDigest === input.approvals.owner.digest && armed.expiresAtMs > nowMs, 'EXPLICIT_REARM_REQUIRED');
  requireCondition((await armExecutionEnvelope({...input,nowMs:armed.armedAtMs})).digest === armed.digest,'ARM_RECEIPT_NOT_REPRODUCIBLE');
  const e = await validateExecutionEnvelope(input.manifest,input.envelope,nowMs);
  await Promise.all([validatePonsLaunchManifest(input.manifest),validateBehaviorEvidence(input.manifest,input.behavior),validateRiskDeclaration(input.manifest,input.risk),validateFreshAuthority(input.manifest,input.readPlan,fresh,input.budget,nowMs,headNumber,input.corroboration)]);
  // Legal validity/revocation and all scoped approval signatures are checked again before send.
  for (const [key, kind, signer, envelope] of [
    ['owner','OWNER_ARM',input.manifest.wallet.address,e.digest],['legal','LEGAL_EXECUTION',input.trust.legalSigner,null],['risk','UPSTREAM_ACCEPTANCE',input.manifest.wallet.address,null],['behavior','BEHAVIOR_REVIEW',input.trust.behaviorReviewer,null]
  ] as const) await validateScopedApproval(input.approvals[key],kind,input.manifest.digest,envelope,signer,nowMs,input.trust);
  requireCondition(armed.budgetDigest === input.budget.digest && armed.legalApprovalDigest === input.approvals.legal.digest && armed.riskApprovalDigest === input.approvals.risk.digest && armed.behaviorApprovalDigest === input.approvals.behavior.digest && input.approvals.owner.body.walletQuiescence, 'ARM_AUTHORITY_CHANGED');
  assertWalletQuiescence(e,fresh);
}
/** Public references contain no signer identity, conditions text or private legal memo. */
export function publicLegalReference(approval: ScopedApproval) { return {artifactId:approval.body.id,artifactDigest:approval.digest,manifestDigest:approval.body.manifestDigest,scope:approval.body.scope,conditionsDigest:approval.body.conditionsDigest,validUntilMs:approval.body.expiresAtMs}; }
