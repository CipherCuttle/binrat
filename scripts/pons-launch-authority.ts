/** Read-only commands only. No signer, arm operation or send transport is installed here. */
import { readFile } from 'node:fs/promises';
import { createPublicClient, http } from 'viem';
import { validatePonsLaunchPlan } from '../src/launchConfig/ponsPlan.js';
import { validateLaunchGateMatrix } from '../src/launchConfig/gateMatrix.js';
import { collectFreshAuthority } from '../src/launchConfig/ponsFreshAuthority.js';
import { rehearseExactEnvelope } from '../src/launchConfig/ponsLaunchRehearsal.js';
import { verifyPonsExecution } from '../src/launchConfig/ponsLaunchVerifier.js';
import { generateLaunchFacts, persistLaunchFacts } from '../src/launchConfig/ponsLaunchFacts.js';
import { requireCondition } from '../src/launchConfig/ponsLaunchManifest.js';
const json=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const command=process.argv[2] ?? 'inspect';
requireCondition(['inspect','collect','rehearse','verify'].includes(command),'READ_ONLY_COMMAND_REQUIRED');
if (command === 'inspect') {
  const plan=await validatePonsLaunchPlan(await json('docs/BINRAT_PONS_LAUNCH_PLAN_V1.json'));
  const matrix=validateLaunchGateMatrix(await json('docs/LAUNCH_GATE_MATRIX_PONS_V1.json'));
  const inputs=plan.unresolvedImmutableInputs;
  process.stdout.write(`${JSON.stringify({schemaVersion:'binrat.pons-authority-inspection/1',status:'BLOCKED',state:'DRAFT',chainId:4663,planDigest:plan.planDigest,matrixDigest:matrix.matrixDigest,stakingRequired:true,workingRatStatus:'PLANNED',productionEntitlementActive:false,missingOwnerInputs:{launchWalletAddress:inputs.launchWalletAddress,tokenMetadata:inputs.tokenMetadata,minimumFeesBeforePayoutWei:inputs.minimumFeesBeforePayoutWei},missingFreshChainInputs:{launchConfigId:inputs.launchConfigId,expectedEconomics:inputs.expectedEconomics},deferredInputs:{workingRatMinStakeRaw:inputs.workingRatMinStakeRaw},conditionalInputs:{treasuryAddress:{value:inputs.treasuryAddress,requiredOnlyIf:'EXACT_VERIFIED_ROLE_USES_TREASURY'}},externalBlockers:['BLOCKED_LEGAL','CRITICAL_DEPLOYED_BEHAVIOR_NOT_FULLY_VERIFIED','FRESHNESS_POLICY_UNRESOLVED','EXACT_MANIFEST_AND_ENVELOPE_NOT_FROZEN','SCOPED_APPROVALS_NOT_GRANTED'],signing:false,broadcast:false,launchAuthorized:false},null,2)}\n`);
} else {
  requireCondition(process.argv[3],'INPUT_BUNDLE_REQUIRED');
  const bundle=await json(process.argv[3]);
  const url=process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL;
  requireCondition(url,'APPROVED_PRIMARY_ARCHIVE_RPC_REQUIRED');
  requireCondition(bundle.manifest && bundle.envelope && bundle.providerPolicy?.primary?.id && bundle.providerPolicy.primary.backingId,'EXACT_BUNDLE_INCOMPLETE');
  const client=createPublicClient({transport:http(url,{retryCount:0,timeout:10000})});
  if (command === 'verify') {
    requireCondition(bundle.signedTransaction && bundle.deploymentProof && bundle.executionReview && bundle.privateApprovalRegistryPath && bundle.approvalPolicy,'EXECUTION_EVIDENCE_REQUIRED');
    const trust={legalSigner:bundle.approvalPolicy.legalSigner,behaviorReviewer:bundle.approvalPolicy.behaviorReviewer,sourceState:async()=> 'UNKNOWN' as const,activeEnvelope:async()=>null,approvalState:async(id:string,digest:string)=>{
      const registry=await json(bundle.privateApprovalRegistryPath);const entry=registry.states?.[id];
      return entry?.artifactDigest === digest && entry?.status === 'VALID' ? 'VALID' as const : entry?.status === 'REVOKED' ? 'REVOKED' as const : 'UNKNOWN' as const;
    }};
    const verification=await verifyPonsExecution({client,manifest:bundle.manifest,envelope:bundle.envelope,signedTransaction:bundle.signedTransaction,proof:bundle.deploymentProof,review:bundle.executionReview,trust,nowMs:Date.now()});
    const facts=verification.status === 'VERIFIED' ? process.argv[4] ? await persistLaunchFacts(process.argv[4],bundle.manifest,verification) : await generateLaunchFacts(bundle.manifest,verification) : null;
    process.stdout.write(`${JSON.stringify({verification,launchFacts:facts,publicationAuthorized:false},null,2)}\n`);
    if (!facts) process.exitCode=2;
  } else {
    requireCondition(bundle.readPlan && bundle.budget,'READ_PLAN_AND_RESOLVED_BUDGET_REQUIRED');
    const secondUrl=process.env.BINRAT_ROBINHOOD_CONFIRMATION_RPC_URL;
    if (secondUrl) requireCondition(bundle.providerPolicy.secondary?.id && bundle.providerPolicy.secondary?.backingId,'SECONDARY_BACKING_ID_REQUIRED');
    const snapshot=await collectFreshAuthority({manifest:bundle.manifest,plan:bundle.readPlan,primary:{...bundle.providerPolicy.primary,client},secondary:secondUrl ? {...bundle.providerPolicy.secondary,client:createPublicClient({transport:http(secondUrl,{retryCount:0,timeout:10000})})} : undefined,strongerArtifactDigest:bundle.corroboration?.digest,pinnedBlock:bundle.pinnedBlock});
    if (command === 'collect') process.stdout.write(`${JSON.stringify({snapshot,authorityGranted:false},null,2)}\n`);
    else {
      requireCondition(bundle.behavior && bundle.trace,'VERIFIED_BEHAVIOR_AND_EXACT_TRACE_REQUIRED');
      const receipt=await rehearseExactEnvelope(client,{...bundle,snapshot,nowMs:Date.now(),headNumber:await client.getBlockNumber({cacheTime:0})});
      process.stdout.write(`${JSON.stringify(receipt,null,2)}\n`);
    }
  }
}
