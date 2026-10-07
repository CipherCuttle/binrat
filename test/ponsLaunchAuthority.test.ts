import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { keccak256 } from 'viem';
import { seal, validatePonsLaunchManifest, validateBehaviorEvidence, validateRiskDeclaration } from '../src/launchConfig/ponsLaunchManifest.js';
import { authorityObservationsDigest, collectFreshAuthority, validateFreshAuthority, deriveFreshnessBudget } from '../src/launchConfig/ponsFreshAuthority.js';
import { armExecutionEnvelope, preSendRevalidation, publicLegalReference, validateExecutionEnvelope } from '../src/launchConfig/ponsExecutionEnvelope.js';
import { GATE_PHASES, evaluateLaunchTransition, validatePhaseGates, validateLaunchGateMatrix, launchAuthorizationEligible } from '../src/launchConfig/gateMatrix.js';
import { rehearseExactEnvelope } from '../src/launchConfig/ponsLaunchRehearsal.js';
import { PonsLaunchJournal } from '../src/launchConfig/ponsLaunchJournal.js';
import { confirmPonsExecution, verifyPonsExecution } from '../src/launchConfig/ponsLaunchVerifier.js';
import { generateLaunchFacts, persistLaunchFacts, validateLaunchFacts } from '../src/launchConfig/ponsLaunchFacts.js';
import { ProductionHolderEligibilitySource } from '../src/holder/eligibility.js';
import { evaluateWorkingRatPolicy } from '../src/holder/workingRatPolicyBoundary.js';
import { authorityFixture, collectorClient, executionFixture, phaseBundle, approve, BLOCK_HASH, D, NOW, SECOND_VAULT } from './fixtures/ponsLaunchAuthorityFixture.js';

test('acceptance 1: phase authority, legal/risk boundaries and Staking versus inactive Working Rat', async () => {
  const f=await authorityFixture(),a=f.authority,m=a.manifest;
  const matrix=validateLaunchGateMatrix(JSON.parse(await readFile(new URL('../docs/LAUNCH_GATE_MATRIX_PONS_V1.json',import.meta.url),'utf8')));
  assert.equal(matrix.gates.actual_token_address_and_launch_execution_receipt.blocksLaunchAuthorization,false);
  assert.deepEqual(GATE_PHASES.actual_token_address_and_launch_execution_receipt,['POST-BROADCAST','PRE-PUBLIC']);
  assert.deepEqual(GATE_PHASES.rat_radar_free_value_and_holder_gate_smoke,['POST-LAUNCH']);
  assert.equal(launchAuthorizationEligible(matrix,'GRANTED'),false);
  assert.equal((await evaluateLaunchTransition('PREFLIGHTED','ARMED',a.gates,{authority:a})).eligible,true);
  assert.equal((await evaluateLaunchTransition('PREFLIGHTED','ARMED',a.gates)).eligible,false);
  const publicGates=await phaseBundle('PRE-PUBLIC',m.digest,a.envelope.digest);
  assert.equal((await evaluateLaunchTransition('VERIFIED','PUBLIC',publicGates)).eligible,false);
  const missingFuture=await seal({...publicGates,receipts:publicGates.receipts.filter(r=>r.gateId !== 'actual_token_address_and_launch_execution_receipt')});
  await assert.rejects(validatePhaseGates(missingFuture,'PRE-PUBLIC',m.digest,a.envelope.digest),/INCOMPLETE/);
  await assert.rejects(validatePonsLaunchManifest(await seal({...m,staking:{...m.staking,required:false}}) as any),/STAKING_REQUIRED/);
  await assert.rejects(validatePonsLaunchManifest(await seal({...m,productionEntitlementActive:true}) as any),/ENTITLEMENT/);
  assert.equal((await new ProductionHolderEligibilitySource({BINRAT_HOLDER_GATE_ENABLED:'true',BINRAT_HOLDER_TOKEN_ADDRESS:'0x1111111111111111111111111111111111111111',BINRAT_HOLDER_THRESHOLD:'1'}).evaluate(m.wallet.address)).accessTier,'FREE');
  const stake:any={status:'VERIFIED',chainId:4663,stakedRaw:'999',freshness:'FRESH',authority:'DIAGNOSTIC_ONLY'};
  assert.equal(evaluateWorkingRatPolicy(stake,1n),'NOT_QUALIFIED');
  assert.equal(evaluateWorkingRatPolicy({...stake,authority:'CANONICAL_LAUNCH_BOUND',freshness:'UNKNOWN'},1n),'NOT_QUALIFIED');
  assert.equal(evaluateWorkingRatPolicy(stake,null),'NOT_CONFIGURED');
  await assert.rejects(armExecutionEnvelope({...a,trust:{...a.trust,approvalState:async()=> 'REVOKED'}}),/REVOKED/);
  await assert.rejects(armExecutionEnvelope({...a,trust:{...a.trust,sourceState:async()=> 'AVAILABLE_UNMATCHED'}}),/SOURCE_MATCH_REQUIRED/);
  await assert.rejects(armExecutionEnvelope({...a,trust:{...a.trust,activeEnvelope:async()=>D}}),/ARM_REGISTRATION/);
  const otherLegal=await approve('LEGAL_EXECUTION',D,null,{},['EXECUTION']);
  await assert.rejects(armExecutionEnvelope({...a,approvals:{...a.approvals,legal:otherLegal}}),/SCOPE/);
  const unknown=await seal({...a.behavior,critical:{...a.behavior.critical,principalSafety:{...a.behavior.critical.principalSafety,status:'UNKNOWN' as const}}});
  await assert.rejects(validateBehaviorEvidence({...m,behaviorEvidenceDigest:unknown.digest},unknown),/CRITICAL_BEHAVIOR_UNKNOWN/);
  const source=await seal({...a.behavior,source:'AVAILABLE_UNMATCHED' as const});
  await assert.rejects(validateBehaviorEvidence({...m,behaviorEvidenceDigest:source.digest},source),/SOURCE_UNMATCHED/);
  const waiver=await seal({...a.risk,risks:['UNKNOWN_PRINCIPAL_SAFETY']}) as any;
  await assert.rejects(validateRiskDeclaration({...m,upstreamRiskDeclarationDigest:waiver.digest},waiver),/WAIVER/);
  const hiddenRisk=await seal({...a.risk,risks:['PUBLIC_SOURCE_UNAVAILABLE']}) as any;
  await assert.rejects(validateRiskDeclaration({...m,upstreamRiskDeclarationDigest:hiddenRisk.digest},hiddenRisk),/RISKS_NOT_DISCLOSED/);
  const legalPublic=publicLegalReference(a.approvals.legal);
  assert.equal('signer' in legalPublic,false);
  assert.equal('signature' in legalPublic,false);
});

test('acceptance 2: fresh critical reads, derived budget and independent RPC agreement/unavailability', async () => {
  const f=await authorityFixture(),a=f.authority;
  const primary={id:'A',backingId:'PRIMARY',client:collectorClient(f)};
  const secondary={id:'B',backingId:'SECONDARY',client:collectorClient(f)};
  const snapshot=await collectFreshAuthority({manifest:a.manifest,plan:a.readPlan,primary,secondary,now:()=>NOW});
  assert.equal(snapshot.independent.status,'AGREE');
  await validateFreshAuthority(a.manifest,a.readPlan,snapshot,a.budget,NOW,200n);
  const replay=await collectFreshAuthority({manifest:a.manifest,plan:a.readPlan,primary,secondary,now:()=>NOW,pinnedBlock:{number:snapshot.block.number,hash:snapshot.block.hash}});
  assert.equal(await authorityObservationsDigest(replay),await authorityObservationsDigest(snapshot));
  await assert.rejects(collectFreshAuthority({manifest:a.manifest,plan:a.readPlan,primary,secondary,now:()=>NOW,pinnedBlock:{number:'200',hash:`0x${'ef'.repeat(32)}`}}),/PINNED_BLOCK_REORGED/);
  await assert.rejects(collectFreshAuthority({manifest:a.manifest,plan:a.readPlan,primary,secondary:{...secondary,client:collectorClient(f,{disagree:true})},now:()=>NOW}),/DISAGREEMENT/);
  await assert.rejects(collectFreshAuthority({manifest:a.manifest,plan:a.readPlan,primary,secondary:{...secondary,client:collectorClient(f,{chainId:1})},now:()=>NOW}),/CHAIN_MISMATCH/);
  const unavailable=await collectFreshAuthority({manifest:a.manifest,plan:a.readPlan,primary,secondary:{...secondary,client:collectorClient(f,{lag:true})},now:()=>NOW});
  assert.equal(unavailable.independent.status,'UNAVAILABLE');
  await assert.rejects(validateFreshAuthority(a.manifest,a.readPlan,unavailable,a.budget,NOW,200n),/CONFIRMATION_REQUIRED/);
  const corroboration=await seal({schemaVersion:'binrat.pons-fresh-corroboration/1' as const,observationsDigest:await authorityObservationsDigest(unavailable),blockHash:unavailable.block.hash,method:'REPRODUCIBLE_FORK_TRACE' as const,rawArtifactDigest:D,reproduction:'TEST ONLY independently reproducible exact state'});
  const withProof=await seal({...unavailable,independent:{...unavailable.independent,strongerArtifactDigest:corroboration.digest}});
  await validateFreshAuthority(a.manifest,a.readPlan,withProof,a.budget,NOW,200n,corroboration);
  await assert.rejects(validateFreshAuthority(a.manifest,a.readPlan,withProof,a.budget,NOW,200n),/ARTIFACT_REQUIRED/);
  const wrongBlock=await seal({...corroboration,blockHash:`0x${'ef'.repeat(32)}` as const});
  await assert.rejects(validateFreshAuthority(a.manifest,a.readPlan,withProof,a.budget,NOW,200n,wrongBlock),/WRONG_STATE/);
  for (const read of a.readPlan.reads) {
    const drift=await seal({...snapshot,results:{...snapshot.results,[read.key]:'0x01' as const}});
    await assert.rejects(validateFreshAuthority(a.manifest,a.readPlan,drift,a.budget,NOW,200n),/SEMANTIC_DRIFT/);
  }
  for (const key of Object.keys(snapshot.codes)) {
    const drift=await seal({...snapshot,codes:{...snapshot.codes,[key]:`0x${'cd'.repeat(32)}`}}) as any;
    await assert.rejects(validateFreshAuthority(a.manifest,a.readPlan,drift,a.budget,NOW,200n),/DRIFT/);
  }
  await assert.rejects(validateFreshAuthority(a.manifest,a.readPlan,snapshot,a.budget,NOW+a.budget.maxAgeMs+1,200n),/STALE/);
  const reorg=await seal({...snapshot,canonicalHash:`0x${'ef'.repeat(32)}`}) as any;
  await assert.rejects(validateFreshAuthority(a.manifest,a.readPlan,reorg,a.budget,NOW,200n),/BINDING/);
  const alteredBudget=await seal({...a.budget,maxAgeMs:30000});
  await assert.rejects(validateFreshAuthority(a.manifest,a.readPlan,snapshot,alteredBudget,NOW,200n),/NOT_DERIVED/);
  await assert.rejects(deriveFreshnessBudget({...a.budget.measurements,signingWorkflowMs:[]}),/INCOMPLETE/);
  for (const field of Object.keys(a.manifest.assets)) {
    const m=await seal({...a.manifest,assets:{...a.manifest.assets,[field]:{status:'UNKNOWN'}}}) as any;
    await assert.rejects(validatePonsLaunchManifest(m),/ASSET_UNKNOWN/);
  }
  for (const role of ['memeHook','feeEscrow','locker','graduationExecutor']) {
    const contracts={...a.manifest.contracts};delete contracts[role];
    await assert.rejects(validatePonsLaunchManifest(await seal({...a.manifest,contracts})),/CONTRACT_MISSING/);
  }
  const missingAssetCode=await seal({...a.manifest,assets:{...a.manifest.assets,claimAsset:{...a.manifest.assets.claimAsset,kind:'ERC20',address:'0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'}}}) as any;
  await assert.rejects(validatePonsLaunchManifest(missingAssetCode),/ASSET_CODE_AUTHORITY_MISSING/);
});

test('acceptance 3: semantic manifest versus envelope, exact pinned rehearsal and prediction proof', async () => {
  const f=await authorityFixture(),a=f.authority,e=a.envelope,m=a.manifest;
  for (const change of [{nonce:'8'},{valueWei:'0'},{gasLimit:'600001',approvedFeeCeilingWei:'1200002'},{maxFeePerGasWei:'3',approvedFeeCeilingWei:'1800000'},{calldata:`${e.calldata}00`},{from:'0x1111111111111111111111111111111111111111'}]) {
    const changed=await seal({...e,...change}) as any;
    await assert.rejects(armExecutionEnvelope({...a,envelope:changed}),/BINDING|INVALID|DRIFT|SCOPE/);
  }
  const changedMetadata=await seal({...m,metadata:{...m.metadata,name:'changed'}});
  await assert.rejects(armExecutionEnvelope({...a,manifest:changedMetadata}),/BINDING/);
  const zeroEconomics=await seal({...m,config:{...m.config,expectedEconomics:`0x${'0'.repeat(64)}`}}) as any;
  await assert.rejects(validatePonsLaunchManifest(zeroEconomics),/ECONOMICS/);
  const calls:any[]=[];
  const client={...f.simClient,call:async(params:any)=>{calls.push(params);return f.simClient.call(params);}};
  await rehearseExactEnvelope(client,{...a,trace:f.trace});
  assert.equal(calls[0].blockNumber,200n);assert.equal(calls[0].account,e.from);assert.equal(calls[0].value,BigInt(e.valueWei));assert.equal(calls[0].gas,BigInt(e.gasLimit));
  const override=await seal({...f.trace,stateOverridesUsed:true}) as any;
  await assert.rejects(rehearseExactEnvelope(client,{...a,trace:override}),/TRACE_BINDING/);
  const unstable=await seal({...a.behavior,predictionProofs:{...a.behavior.predictionProofs,token:{deterministic:false,artifactDigest:null}}});
  await assert.rejects(validateBehaviorEvidence({...m,behaviorEvidenceDigest:unstable.digest},unstable),/NOT_DETERMINISTIC/);
  const literal=await seal({...f.trace,vault:m.call.creatorFeeRecipient});
  await assert.rejects(rehearseExactEnvelope(client,{...a,trace:literal}),/LITERAL_VAULT_DEPENDENCY/);
  for (const change of [{minimumFeesBeforePayoutWei:'101'},{lock:{kind:'CONFIGURED',seconds:'10'}},{roles:{...f.trace.creation.roles,creatorFeeRecipient:m.wallet.address}},{assets:{...m.assets,claimAsset:{status:'UNKNOWN'}}}]) {
    const trace=await seal({...f.trace,creation:{...f.trace.creation,...change}}) as any;
    await assert.rejects(rehearseExactEnvelope(client,{...a,trace}),/CREATION|ASSET_UNKNOWN/);
  }
  const badConfig=await seal({...m,staking:{...m.staking,minimumFeesBeforePayoutWei:'101'}});
  await assert.rejects(validatePonsLaunchManifest(badConfig),/CONFIG_ABI_OR_PAYOUT/);
});

test('acceptance 4: launch-wallet quiescence, exact signed envelope and durable one-send reconciliation', async () => {
  const f=await authorityFixture(),a=f.authority;
  const fresh=await seal({...a.snapshot,observedAtMs:NOW+1,completedAtMs:NOW+2});
  for (const wallet of [{...fresh.wallet,nonce:'8',pendingNonce:'8'},{...fresh.wallet,pendingNonce:'8'},{...fresh.wallet,balanceWei:'1'},{...fresh.wallet,accountType:'OTHER' as const},{...fresh.wallet,codeHash:`0x${'cd'.repeat(32)}` as const}]) {
    const changed=await seal({...fresh,wallet});
    await assert.rejects(preSendRevalidation(a,f.armed,changed,NOW+3,200n),/ABORT|WALLET_INVALID/);
  }
  const fees=await seal({...a.envelope,maxFeePerGasWei:'3',approvedFeeCeilingWei:'1800000'});
  await assert.rejects(preSendRevalidation({...a,envelope:fees},f.armed,fresh,NOW+3,200n),/REARM/);
  const dir=await mkdtemp(join(tmpdir(),'binrat-test-only-journal-'));
  try {
    const journal=new PonsLaunchJournal(dir,()=>NOW+4);let invocations=0;
    const journalFresh=await seal({...fresh,observedAtMs:NOW+4,completedAtMs:NOW+4});
    const send={authority:a,armed:f.armed,signedTransaction:f.signed,revalidate:async()=>({snapshot:journalFresh,nowMs:NOW+4,headNumber:200n}),client:{...collectorClient(f),...f.simClient},transport:{retryCount:0 as const,sendRaw:async()=>{invocations++;throw new Error('uncertain timeout after send');}}};
    assert.equal((await journal.sendOnce(send)).state,'RECONCILE');
    assert.equal(invocations,1);
    assert.equal((await journal.read(a.envelope))?.localSignedTxHash,keccak256(f.signed));
    await assert.rejects(journal.sendOnce(send),/EEXIST/);assert.equal(invocations,1);
    assert.equal((await journal.reconcile(a.envelope,async()=>({state:'NOT_FOUND',envelopeMatches:false}))).state,'RECONCILE');
    assert.equal((await journal.reconcile(a.envelope,async()=>({state:'CONFIRMED',envelopeMatches:true}))).state,'CONFIRMED');
    assert.equal(invocations,1);
  } finally {await rm(dir,{recursive:true,force:true});}
  const mutation=await authorityFixture(),mutationDir=await mkdtemp(join(tmpdir(),'binrat-test-only-mutation-'));
  try {
    const snapshot=await seal({...mutation.authority.snapshot,observedAtMs:NOW+4,completedAtMs:NOW+4});let sent:string|null=null;
    const request:any={authority:mutation.authority,armed:mutation.armed,signedTransaction:mutation.signed,client:{...collectorClient(mutation),...mutation.simClient},transport:{retryCount:0,sendRaw:async(bytes:string)=>{sent=bytes;return keccak256(bytes as any);}},revalidate:async()=>{
      request.signedTransaction='0x02dead';request.authority.envelope.gasLimit='1';request.transport.sendRaw=async()=>{throw new Error('substituted sender');};
      request.authority.trust.legalSigner='0x1111111111111111111111111111111111111111';request.authority.trust.sourceState=async()=> 'AVAILABLE_UNMATCHED';
      return {snapshot,nowMs:NOW+4,headNumber:200n};
    }};
    await new PonsLaunchJournal(mutationDir,()=>NOW+4).sendOnce(request);
    assert.equal(sent,mutation.signed);
  } finally {await rm(mutationDir,{recursive:true,force:true});}
  for (const mode of ['REVERT','EXPIRE'] as const) {
    const guarded=await authorityFixture(),guardDir=await mkdtemp(join(tmpdir(),'binrat-test-only-pre-send-'));
    try {
      let clock=NOW+4,sends=0;
      const snapshot=await seal({...guarded.authority.snapshot,observedAtMs:NOW+4,completedAtMs:NOW+4});
      const client={...collectorClient(guarded),...guarded.simClient,call:async(args:any)=>{if(mode === 'REVERT')throw new Error('fresh exact call reverted');clock=NOW+60001;return guarded.simClient.call(args);}};
      await assert.rejects(new PonsLaunchJournal(guardDir,()=>clock).sendOnce({authority:guarded.authority,armed:guarded.armed,signedTransaction:guarded.signed,client,revalidate:async()=>({snapshot,nowMs:NOW+4,headNumber:200n}),transport:{retryCount:0,sendRaw:async()=>{sends++;return keccak256(guarded.signed);}}}),/reverted|EXPIRED_OR_STALE/);
      assert.equal(sends,0);
    } finally {await rm(guardDir,{recursive:true,force:true});}
  }
});

test('acceptance 5: factory nonce race, semantic mismatch/reorg rejection and canonical facts', async () => {
  const f=await authorityFixture();
  // Counterfactual executions model one intervening Staking-factory CREATE. Wallet nonce stays frozen.
  const first=await executionFixture(f),second=await executionFixture(f,SECOND_VAULT);
  const original=await verifyPonsExecution(first),advanced=await verifyPonsExecution(second);
  assert.equal(original.status,'VERIFIED');assert.equal(advanced.status,'VERIFIED');
  if (advanced.status !== 'VERIFIED') throw new Error('expected synthetic verification');
  assert.notEqual(advanced.vault,f.authority.rehearsal.provisionalVault);
  const facts=await generateLaunchFacts(f.authority.manifest,advanced);
  assert.equal(facts.vault,SECOND_VAULT);assert.equal(facts.workingRatStatus,'PLANNED');assert.equal(facts.productionEntitlementActive,false);assert.equal(facts.stakingConfiguration.required,true);
  assert.deepEqual(Object.keys(facts.assets).sort(),['claimAsset','feeAccountingAsset','pairQuoteAsset','rewardAccountingAsset','vaultQuoteAsset'].sort());
  assert.equal('verifiedRewardAsset' in facts,false);assert.equal('legalSigner' in facts,false);
  await validateLaunchFacts(facts,f.authority.manifest,advanced);
  await assert.rejects(generateLaunchFacts(f.authority.manifest,structuredClone(advanced)),/FRESH_VERIFIER_RESULT/);
  const postGates=await phaseBundle('POST-BROADCAST',f.authority.manifest.digest,f.authority.envelope.digest);
  const confirmation=await confirmPonsExecution(second.client,f.authority.manifest,f.authority.envelope,f.signed);
  assert.equal((await evaluateLaunchTransition('BROADCAST','CONFIRMED',postGates,{confirmation})).eligible,true);
  assert.equal((await evaluateLaunchTransition('CONFIRMED','VERIFIED',postGates,{verification:advanced})).eligible,true);
  const publicGates=await phaseBundle('PRE-PUBLIC',f.authority.manifest.digest,f.authority.envelope.digest);
  const legalPublication=await approve('LEGAL_PUBLICATION',f.authority.manifest.digest,null,{facts:facts.digest},['PUBLICATION']);
  const ownerPublication=await approve('OWNER_PUBLICATION',f.authority.manifest.digest,f.authority.envelope.digest,{facts:facts.digest,legal:legalPublication.digest},['PUBLICATION']);
  assert.equal((await evaluateLaunchTransition('VERIFIED','PUBLIC',publicGates,{authority:f.authority,verification:advanced,facts,legalPublication,ownerPublication,nowMs:NOW})).eligible,true);
  const dir=await mkdtemp(join(tmpdir(),'binrat-test-only-facts-'));
  try {
    const path=join(dir,'launch-facts.json');
    assert.equal((await persistLaunchFacts(path,f.authority.manifest,advanced)).digest,facts.digest);
    assert.equal((await persistLaunchFacts(path,f.authority.manifest,advanced)).digest,facts.digest);
    if (original.status === 'VERIFIED') await assert.rejects(persistLaunchFacts(path,f.authority.manifest,original),/ALREADY_FROZEN/);
  } finally {await rm(dir,{recursive:true,force:true});}
  for (const change of [{minimumFeesBeforePayoutWei:'101'},{vaultToken:'0x9999999999999999999999999999999999999999'},{vaultBeacon:'0x9999999999999999999999999999999999999999'},{lock:{kind:'CONFIGURED',seconds:'10'}},{roles:{...second.proof.roles,creatorFeeRecipient:f.authority.manifest.wallet.address}},{assets:{...second.proof.assets,claimAsset:{status:'UNKNOWN'}}}]) {
    const proof=await seal({...second.proof,...change}) as any;
    const review=await approve('BEHAVIOR_REVIEW',proof.manifestDigest,proof.envelopeDigest,{deploymentProof:proof.digest},['EXECUTION_POSTCONDITIONS']);
    assert.equal((await verifyPonsExecution({...second,proof,review})).status,'ABORT_RECONCILE');
  }
  const wrongSupply=await seal({...second.proof,totalSupplyRaw:'1000000001'});
  const supplyReview=await approve('BEHAVIOR_REVIEW',wrongSupply.manifestDigest,wrongSupply.envelopeDigest,{deploymentProof:wrongSupply.digest},['EXECUTION_POSTCONDITIONS']);
  const supplyClient={...second.client,readContract:async(args:any)=>args.functionName === 'totalSupply' ? 1000000001n : second.client.readContract(args)};
  const supplyResult=await verifyPonsExecution({...second,client:supplyClient,proof:wrongSupply,review:supplyReview});
  assert.equal(supplyResult.status,'ABORT_RECONCILE');if(supplyResult.status === 'ABORT_RECONCILE')assert.match(supplyResult.errors[0],/TOKEN_METADATA_SUPPLY/);
  const reorgClient={...second.client,getBlock:async()=>({number:200n,hash:`0x${'ef'.repeat(32)}`})};
  assert.equal((await verifyPonsExecution({...second,client:reorgClient})).status,'ABORT_RECONCILE');
  const unfinalized={...second.client,getBlock:async({blockTag}:any)=>({number:blockTag === 'finalized' ? 199n : 200n,hash:BLOCK_HASH})};
  assert.equal((await verifyPonsExecution({...second,client:unfinalized})).status,'ABORT_RECONCILE');
  // The launch block can match while an upstream upgrade/controller/graph changes before finality.
  const atFinality={...second.client,getBlock:async({blockTag}:any)=>({number:blockTag === 'finalized' ? 201n : 200n,hash:BLOCK_HASH})};
  assert.equal((await verifyPonsExecution({...second,client:atFinality})).status,'VERIFIED');
  for (const role of ['memeHook','feeEscrow','locker','graduationExecutor','stakingImplementation']) {
    const codeDrift={...atFinality,getCode:async(args:any)=>args.blockNumber === 201n && args.address.toLowerCase() === f.authority.manifest.contracts[role].address.toLowerCase() ? '0x6001' : second.client.getCode(args)};
    const result=await verifyPonsExecution({...second,client:codeDrift});
    assert.equal(result.status,'ABORT_RECONCILE');if(result.status === 'ABORT_RECONCILE')assert.match(result.errors[0],/UPSTREAM_CODE_DRIFT/);
  }
  const ownerDrift={...atFinality,readContract:async(args:any)=>args.blockNumber === 201n && args.functionName === 'owner' ? '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' : second.client.readContract(args)};
  assert.equal((await verifyPonsExecution({...second,client:ownerDrift})).status,'ABORT_RECONCILE');
  for (const key of ['launcherRegistry','registryStakingFactory','stakingBeaconImplementation','launchForwarder','memeHook','feeEscrow','locker','graduationExecutor']) {
    const read=f.authority.readPlan.reads.find(r=>r.key === key)!;
    const graphDrift={...atFinality,call:async(args:any)=>args.blockNumber === 201n && args.to.toLowerCase() === read.to.toLowerCase() && args.data === read.data ? {data:'0x01'} : second.client.call(args)};
    const result=await verifyPonsExecution({...second,client:graphDrift});
    assert.equal(result.status,'ABORT_RECONCILE');if(result.status === 'ABORT_RECONCILE')assert.match(result.errors[0],/GRAPH_DRIFT/);
  }
});
