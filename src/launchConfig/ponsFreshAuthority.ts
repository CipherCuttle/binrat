import { encodeAbiParameters, getFunctionSelector, keccak256, type Address, type Hex, type PublicClient } from 'viem';
import { sha256Hex } from '../evidence/canonical.js';
import { addressArgCalldata, registryStakingFactoryCalldata, PONS_PREFLIGHT_SELECTORS as S } from './ponsPreflight.js';
import { address, assertDigest, hex32, requireCondition, same, seal, uint, validatePonsLaunchManifest, type PonsLaunchManifest } from './ponsLaunchManifest.js';

export interface AuthorityRead { key: string; to: Address; data: Hex; expected: Hex }
export interface AuthorityReadPlan { schemaVersion: 'binrat.pons-authority-reads/1'; reads: AuthorityRead[]; digest: string }
export interface ProviderPath { id: string; backingId: string; client: PublicClient }
export interface FreshnessMeasurements {
  blockIntervalsMs: number[]; rpcRoundTripsMs: number[]; signingWorkflowMs: number[];
  criticalReadBatches: number; runtimeMaxAgeMs: number; mutationNoticeMs: number | null;
  mutability: 'UNTIMELOCKED' | 'TIMELOCKED'; measurementEvidenceDigest: string;
}
export interface FreshnessBudget { schemaVersion: 'binrat.pons-freshness-budget/1'; maxAgeMs: number; maxBlockAge: number; measurements: FreshnessMeasurements; digest: string }
export interface AuthoritySnapshot {
  schemaVersion: 'binrat.pons-fresh-authority/1'; manifestDigest: string; readPlanDigest: string; chainId: 4663;
  provider: { id: string; backingId: string }; block: { number: string; hash: Hex; timestampMs: number };
  observedAtMs: number; completedAtMs: number; canonicalHash: Hex;
  codes: Record<string, Hex>; results: Record<string, Hex>;
  wallet: { nonce: string; pendingNonce: string; balanceWei: string; codeHash: Hex; accountType: 'EOA' | 'OTHER' };
  independent: { status: 'AGREE' | 'UNAVAILABLE'; providerId: string | null; backingId: string | null; strongerArtifactDigest: string | null };
  digest: string;
}
export interface FreshCorroboration {schemaVersion:'binrat.pons-fresh-corroboration/1';observationsDigest:string;blockHash:Hex;method:'REPRODUCIBLE_FORK_TRACE';rawArtifactDigest:string;reproduction:string;digest:string}
const hashOrHex = (value: unknown): value is Hex => typeof value === 'string' && /^0x(?:[0-9a-fA-F]{2})*$/.test(value);
const addrResult = (value: Address) => encodeAbiParameters([{type:'address'}], [value]);
export async function deriveFreshnessBudget(measurements: FreshnessMeasurements): Promise<FreshnessBudget> {
  const m = structuredClone(measurements);
  for (const samples of [m.blockIntervalsMs, m.rpcRoundTripsMs, m.signingWorkflowMs]) requireCondition(samples.length >= 3 && samples.every(v => Number.isSafeInteger(v) && v > 0), 'FRESHNESS_MEASUREMENTS_INCOMPLETE');
  requireCondition(Number.isSafeInteger(m.criticalReadBatches) && m.criticalReadBatches > 0 && Number.isSafeInteger(m.runtimeMaxAgeMs) && m.runtimeMaxAgeMs > 0 && /^[a-f0-9]{64}$/.test(m.measurementEvidenceDigest), 'FRESHNESS_RUNTIME_LIMIT_UNRESOLVED');
  requireCondition(m.mutability === 'UNTIMELOCKED' ? m.mutationNoticeMs === null : m.mutability === 'TIMELOCKED' && Number.isSafeInteger(m.mutationNoticeMs) && m.mutationNoticeMs! > 0, 'FRESHNESS_MUTABILITY_UNKNOWN');
  // Observed worst-case workflow plus one observed block interval; no fixed seconds default.
  // Untimelocked controllers still require immediate revalidation and explicit residual acceptance.
  const workflow = Math.max(...m.rpcRoundTripsMs) * m.criticalReadBatches + Math.max(...m.signingWorkflowMs);
  const maxAgeMs = Math.min(workflow + Math.max(...m.blockIntervalsMs), m.runtimeMaxAgeMs, m.mutationNoticeMs ?? Number.MAX_SAFE_INTEGER);
  requireCondition(maxAgeMs >= workflow, 'FRESHNESS_WORKFLOW_INFEASIBLE');
  return seal({schemaVersion:'binrat.pons-freshness-budget/1' as const, maxAgeMs, maxBlockAge:Math.ceil(maxAgeMs / Math.min(...m.blockIntervalsMs)), measurements:m});
}
export async function validateFreshnessBudget(budget: FreshnessBudget): Promise<void> {
  budget=structuredClone(budget);
  await assertDigest(budget);
  requireCondition(same(budget, await deriveFreshnessBudget(budget.measurements)), 'FRESHNESS_BUDGET_NOT_DERIVED');
}
export async function validateAuthorityReadPlan(m: PonsLaunchManifest, plan: AuthorityReadPlan): Promise<void> {
  [m,plan]=structuredClone([m,plan]);
  await assertDigest(plan);
  requireCondition(plan.schemaVersion === 'binrat.pons-authority-reads/1' && plan.digest === m.authorityReadPlanDigest && Array.isArray(plan.reads), 'AUTHORITY_READ_PLAN_BINDING');
  const expected: Record<string, { to: Address; data: Hex; result?: Hex }> = {
    launcherPonsFactory:{to:m.contracts.launcher.address,data:S.launcherPonsFactory,result:addrResult(m.contracts.ponsFactory.address)},
    launcherRegistry:{to:m.contracts.launcher.address,data:S.launcherRegistry,result:addrResult(m.contracts.registry.address)},
    registryStakingFactory:{to:m.contracts.registry.address,data:registryStakingFactoryCalldata(),result:addrResult(m.contracts.stakingFactory.address)},
    stakingFactoryBeacon:{to:m.contracts.stakingFactory.address,data:S.stakingFactoryBeacon,result:addrResult(m.contracts.stakingBeacon.address)},
    stakingFactoryImplementation:{to:m.contracts.stakingFactory.address,data:S.stakingFactoryImplementation,result:addrResult(m.contracts.stakingImplementation.address)},
    stakingBeaconImplementation:{to:m.contracts.stakingBeacon.address,data:S.beaconImplementation,result:addrResult(m.contracts.stakingImplementation.address)},
    canLaunchWallet:{to:m.contracts.ponsFactory.address,data:addressArgCalldata(getFunctionSelector('canLaunch(address)'), m.wallet.address),result:encodeAbiParameters([{type:'bool'}],[true])},
    canLaunchCaller:{to:m.contracts.ponsFactory.address,data:addressArgCalldata(getFunctionSelector('canLaunch(address)'), m.contracts.launcher.address),result:encodeAbiParameters([{type:'bool'}],[true])},
    launchFee:{to:m.contracts.ponsFactory.address,data:getFunctionSelector('launchFee()'),result:encodeAbiParameters([{type:'uint256'}],[BigInt(m.config.launchFeeWei)])},
    previewLaunchEconomics:{to:m.contracts.ponsFactory.address,data:`${getFunctionSelector('previewLaunchEconomics(uint256,address)')}${encodeAbiParameters([{type:'uint256'},{type:'address'}],[BigInt(m.config.id),'0x0000000000000000000000000000000000000000']).slice(2)}`},
    selectedConfig:{to:m.contracts.ponsFactory.address,data:`${getFunctionSelector('getLaunchConfig(uint256)')}${encodeAbiParameters([{type:'uint256'}],[BigInt(m.config.id)]).slice(2)}`},
  };
  expected.previewLaunchEconomics.result=m.config.expectedEconomics;
  const economics=m.config.economics;
  const configResult=encodeAbiParameters([{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint24'},{type:'int24'},{type:'bool'}],[BigInt(economics.supply),BigInt(economics.curveFeeBps),BigInt(economics.phantomQuote),BigInt(economics.graduationThreshold),Number(economics.poolFee),Number(economics.tickSpacing),true]);
  expected.selectedConfig.result=configResult;
  expected.configEnabled={...expected.selectedConfig,result:configResult};
  expected.launchForwarder={to:m.contracts.ponsFactory.address,data:getFunctionSelector('launchForwarder()'),result:addrResult(m.bindings.launchForwarder)};
  expected.launchDeployer={to:m.contracts.ponsFactory.address,data:getFunctionSelector('launchDeployer()'),result:addrResult(m.contracts.launchDeployer.address)};
  expected.antiSnipeStartBps={to:m.contracts.ponsFactory.address,data:getFunctionSelector('snipeTaxStartBps()'),result:encodeAbiParameters([{type:'uint256'}],[BigInt(m.config.configuration.snipeTaxStartBps)])};
  expected.antiSnipeSeconds={to:m.contracts.ponsFactory.address,data:getFunctionSelector('snipeTaxSeconds()'),result:encodeAbiParameters([{type:'uint256'}],[BigInt(m.config.configuration.snipeTaxSeconds)])};
  expected.launchEnabled={to:m.contracts.ponsFactory.address,data:getFunctionSelector('launchEnabled()'),result:encodeAbiParameters([{type:'bool'}],[m.config.configuration.launchEnabled === 'true'])};
  for (const role of ['memeHook','feeEscrow','locker','graduationExecutor']) expected[role]={to:m.contracts.ponsFactory.address,data:getFunctionSelector(`${role}()`),result:addrResult(m.contracts[role].address)};
  for (const [role, authority] of Object.entries(m.contracts)) if (authority.owner !== null) expected[`owner:${role}`] = {to:authority.address,data:S.registryOwner,result:addrResult(authority.owner)};
  // Extra launch-critical selectors and decoded semantics are proven by the bound behavior bundle.
  const keys = plan.reads.map(r => r.key);
  requireCondition(new Set(keys).size === keys.length && Object.keys(expected).every(key => keys.includes(key)), 'AUTHORITY_CRITICAL_READ_MISSING');
  for (const r of plan.reads) {
    requireCondition(address(r.to) && hashOrHex(r.data) && r.data.length >= 10 && hashOrHex(r.expected) && r.expected !== '0x', 'AUTHORITY_READ_INVALID');
    const rule = expected[r.key];
    if (rule) requireCondition(r.to.toLowerCase() === rule.to.toLowerCase() && r.data.toLowerCase() === rule.data.toLowerCase() && (!rule.result || r.expected.toLowerCase() === rule.result.toLowerCase()), `AUTHORITY_READ_WRONG_SELECTOR:${r.key}`);
  }
}
async function readAt(m: PonsLaunchManifest, plan: AuthorityReadPlan, path: ProviderPath, block: {number: bigint; hash: Hex; timestamp: bigint}) {
  requireCondition(await path.client.getChainId() === 4663, 'AUTHORITY_CHAIN_MISMATCH');
  const served = await path.client.getBlock({blockNumber:block.number});
  requireCondition(served.hash === block.hash, 'RPC_PINNED_STATE_UNAVAILABLE');
  const codes: Record<string, Hex> = {};
  const results: Record<string, Hex> = {};
  await Promise.all(Object.entries(m.contracts).map(async ([key, c]) => {
    const code = await path.client.getCode({address:c.address, blockNumber:block.number});
    requireCondition(code && code !== '0x', `AUTHORITY_CODE_MISSING:${key}`);
    codes[key] = keccak256(code);
  }));
  await Promise.all(Object.entries(m.controllerCodeHashes).map(async ([controller]) => {
    const code = await path.client.getCode({address:controller as Address, blockNumber:block.number});
    requireCondition(code !== undefined,'AUTHORITY_CONTROLLER_CODE_UNAVAILABLE');
    codes[`controller:${controller}`] = keccak256(code);
  }));
  await Promise.all(plan.reads.map(async read => {
    const call = await path.client.call({account:m.wallet.address, to:read.to, data:read.data, blockNumber:block.number});
    requireCondition(call.data && call.data !== '0x', `AUTHORITY_CALL_EMPTY:${read.key}`);
    results[read.key] = call.data.toLowerCase() as Hex;
  }));
  const [nonce, balance, code] = await Promise.all([
    path.client.getTransactionCount({address:m.wallet.address, blockNumber:block.number}),
    path.client.getBalance({address:m.wallet.address, blockNumber:block.number}),
    path.client.getCode({address:m.wallet.address, blockNumber:block.number})
  ]);
  requireCondition(code !== undefined && Number.isSafeInteger(nonce) && nonce >= 0 && typeof balance === 'bigint' && balance >= 0n,'AUTHORITY_WALLET_READ_UNAVAILABLE');
  requireCondition((await path.client.getBlock({blockNumber:block.number})).hash === block.hash, 'AUTHORITY_CANONICAL_RECHECK_FAILED');
  return {codes, results, nonce:String(nonce), balanceWei:String(balance), codeHash:keccak256(code)};
}
export async function collectFreshAuthority(input: { manifest: PonsLaunchManifest; plan: AuthorityReadPlan; primary: ProviderPath; secondary?: ProviderPath; strongerArtifactDigest?: string; now?: () => number; pinnedBlock?:{number:string;hash:Hex} }): Promise<AuthoritySnapshot> {
  const {manifest,plan:readPlan,pinnedBlock,...paths}=input;
  input={...paths,primary:{...paths.primary},secondary:paths.secondary ? {...paths.secondary} : undefined,...structuredClone({manifest,plan:readPlan,pinnedBlock})};
  const m = await validatePonsLaunchManifest(input.manifest);
  const plan = structuredClone(input.plan);
  await validateAuthorityReadPlan(m, plan);
  const now = input.now ?? Date.now;
  requireCondition(input.primary.id.trim().length > 0 && input.primary.backingId.trim().length > 0,'APPROVED_PRIMARY_PATH_REQUIRED');
  const observedAtMs = now();
  if(input.pinnedBlock) requireCondition(uint(input.pinnedBlock.number) && hex32(input.pinnedBlock.hash),'AUTHORITY_PINNED_BLOCK_INVALID');
  const block = await input.primary.client.getBlock(input.pinnedBlock ? {blockNumber:BigInt(input.pinnedBlock.number)} : {blockTag:'latest'});
  requireCondition(block.hash && block.number !== null && block.timestamp !== undefined, 'AUTHORITY_HEAD_MISSING');
  if(input.pinnedBlock) requireCondition(String(block.number) === input.pinnedBlock.number && block.hash === input.pinnedBlock.hash,'AUTHORITY_PINNED_BLOCK_REORGED');
  const context = {number:block.number, hash:block.hash, timestamp:block.timestamp};
  const primary = await readAt(m, plan, input.primary, context);
  let independent: AuthoritySnapshot['independent'] = {status:'UNAVAILABLE',providerId:input.secondary?.id ?? null,backingId:input.secondary?.backingId ?? null,strongerArtifactDigest:input.strongerArtifactDigest ?? null};
  if (input.secondary) {
    requireCondition(input.primary.id !== input.secondary.id && input.primary.backingId !== input.secondary.backingId, 'RPC_NOT_INDEPENDENT');
    try {
      const second = await readAt(m, plan, input.secondary, context);
      requireCondition(same(primary, second), 'RPC_SAME_STATE_DISAGREEMENT');
      independent = {status:'AGREE',providerId:input.secondary.id,backingId:input.secondary.backingId,strongerArtifactDigest:null};
    } catch (error) {
      if (error instanceof Error && /DISAGREEMENT|CHAIN_MISMATCH|CANONICAL_RECHECK_FAILED/.test(error.message)) throw error;
      // Cannot serve this pinned state is unavailable, never evidence of agreement.
    }
  }
  const pendingNonce = await input.primary.client.getTransactionCount({address:m.wallet.address,blockTag:'pending'});
  const result = await seal({schemaVersion:'binrat.pons-fresh-authority/1' as const,manifestDigest:m.digest,readPlanDigest:plan.digest,chainId:4663 as const,provider:{id:input.primary.id,backingId:input.primary.backingId},block:{number:String(block.number),hash:block.hash,timestampMs:Number(block.timestamp)*1000},observedAtMs,completedAtMs:now(),canonicalHash:(await input.primary.client.getBlock({blockNumber:block.number})).hash!,codes:primary.codes,results:primary.results,wallet:{nonce:primary.nonce,pendingNonce:String(pendingNonce),balanceWei:primary.balanceWei,codeHash:primary.codeHash,accountType:primary.codeHash === keccak256('0x') ? 'EOA' as const : 'OTHER' as const},independent});
  return result;
}
export async function validateFreshAuthority(m: PonsLaunchManifest, plan: AuthorityReadPlan, snapshot: AuthoritySnapshot, budget: FreshnessBudget, nowMs: number, headNumber: bigint, corroboration?:FreshCorroboration): Promise<void> {
  [m,plan,snapshot,budget,corroboration]=structuredClone([m,plan,snapshot,budget,corroboration]);
  await Promise.all([assertDigest(snapshot),validateAuthorityReadPlan(m, plan),validateFreshnessBudget(budget)]);
  requireCondition(snapshot.schemaVersion === 'binrat.pons-fresh-authority/1' && snapshot.manifestDigest === m.digest && snapshot.readPlanDigest === plan.digest && snapshot.chainId === 4663 && hex32(snapshot.block.hash) && snapshot.canonicalHash === snapshot.block.hash && uint(snapshot.block.number), 'FRESH_AUTHORITY_BINDING_INVALID');
  requireCondition(snapshot.observedAtMs <= snapshot.completedAtMs && snapshot.completedAtMs <= nowMs && nowMs - snapshot.observedAtMs <= budget.maxAgeMs && headNumber >= BigInt(snapshot.block.number) && headNumber - BigInt(snapshot.block.number) <= BigInt(budget.maxBlockAge), 'FRESH_AUTHORITY_STALE');
  for (const [key, c] of Object.entries(m.contracts)) requireCondition(snapshot.codes[key]?.toLowerCase() === c.codeHash.toLowerCase(), `AUTHORITY_CODE_DRIFT:${key}`);
  for (const [controller, hash] of Object.entries(m.controllerCodeHashes)) requireCondition(snapshot.codes[`controller:${controller}`]?.toLowerCase() === hash.toLowerCase(), 'AUTHORITY_CONTROLLER_CODE_DRIFT');
  for (const r of plan.reads) requireCondition(snapshot.results[r.key]?.toLowerCase() === r.expected.toLowerCase(), `AUTHORITY_SEMANTIC_DRIFT:${r.key}`);
  requireCondition(snapshot.wallet.codeHash === m.wallet.codeHash && snapshot.wallet.accountType === m.wallet.accountType && uint(snapshot.wallet.nonce) && uint(snapshot.wallet.pendingNonce) && uint(snapshot.wallet.balanceWei), 'AUTHORITY_WALLET_INVALID');
  requireCondition(snapshot.independent.status === 'AGREE' ? snapshot.independent.backingId !== snapshot.provider.backingId && !!snapshot.independent.providerId && snapshot.independent.providerId !== snapshot.provider.id : snapshot.independent.status === 'UNAVAILABLE' && /^[a-f0-9]{64}$/.test(snapshot.independent.strongerArtifactDigest ?? ''), 'INDEPENDENT_CONFIRMATION_REQUIRED');
  if (snapshot.independent.status === 'UNAVAILABLE') {
    requireCondition(corroboration,'FRESH_CORROBORATION_ARTIFACT_REQUIRED');
    await assertDigest(corroboration);
    requireCondition(corroboration.schemaVersion === 'binrat.pons-fresh-corroboration/1' && corroboration.digest === snapshot.independent.strongerArtifactDigest && corroboration.observationsDigest === await authorityObservationsDigest(snapshot) && corroboration.blockHash === snapshot.block.hash && corroboration.method === 'REPRODUCIBLE_FORK_TRACE' && /^[a-f0-9]{64}$/.test(corroboration.rawArtifactDigest) && corroboration.reproduction.trim().length > 0,'FRESH_CORROBORATION_WRONG_STATE');
  }
}
export async function authorityObservationsDigest(snapshot: AuthoritySnapshot): Promise<string> {
  return sha256Hex({manifestDigest:snapshot.manifestDigest,block:snapshot.block,codes:snapshot.codes,results:snapshot.results,wallet:{nonce:snapshot.wallet.nonce,balanceWei:snapshot.wallet.balanceWei,codeHash:snapshot.wallet.codeHash}});
}
