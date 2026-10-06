// Isolated synthetic keys/providers. No real wallet, signing service or network transport.
import { encodeAbiParameters, encodeEventTopics, keccak256, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sha256Hex } from '../../src/evidence/canonical.js';
import { GATE_PHASES, REQUIRED_LAUNCH_GATE_IDS, type LaunchPhase } from '../../src/launchConfig/gateMatrix.js';
import { PONS_V2_FACTORY_V1, PONS_VAULT_LAUNCHER_V1, PONS_VAULT_REGISTRY_V1, PONS_STAKING_FACTORY_V1 } from '../../src/launchConfig/ponsPlan.js';
import { PONS_STAKING_BEACON_V1, PONS_STAKING_IMPLEMENTATION_V1, registryStakingFactoryCalldata, addressArgCalldata, PONS_PREFLIGHT_SELECTORS as S } from '../../src/launchConfig/ponsPreflight.js';
import { getFunctionSelector } from 'viem';
import { seal, CRITICAL_BEHAVIORS, CONTRACT_ROLES, semanticInputsDigest, economicsHash, type PonsLaunchManifest, type BehaviorEvidence, type UpstreamRiskDeclaration } from '../../src/launchConfig/ponsLaunchManifest.js';
import { deriveFreshnessBudget, type AuthorityReadPlan, type AuthoritySnapshot, authorityObservationsDigest } from '../../src/launchConfig/ponsFreshAuthority.js';
import { approvalMessage, calldataForManifest, armExecutionEnvelope, type ArmInputs, type ScopedApproval, type ApprovalKind, type FinalExecutionEnvelope } from '../../src/launchConfig/ponsExecutionEnvelope.js';
import { rehearseExactEnvelope, PONS_STAKING_TEMPLATE_ID } from '../../src/launchConfig/ponsLaunchRehearsal.js';
import { PONS_LAUNCH_WITH_VAULT_ABI } from '../../src/launchConfig/ponsVaultLaunchAbi.js';
import { ponsTokenLaunchedEvent } from '../../src/pons/ponsAbi.js';
import { PONS_STAKING_BEACON_SLOT } from '../../src/holder/ponsStakeReader.js';
import type { DeploymentProof } from '../../src/launchConfig/ponsLaunchVerifier.js';

export const D='ab'.repeat(32), CODE='0x6000' as Hex, CODE_HASH=keccak256(CODE);
export const NOW=1800000000000, BLOCK_HASH=`0x${'12'.repeat(32)}` as Hex;
export const TOKEN='0x1111111111111111111111111111111111111111' as Address;
export const CURVE='0x2222222222222222222222222222222222222222' as Address;
export const VAULT='0x3333333333333333333333333333333333333333' as Address;
export const SECOND_VAULT='0x4444444444444444444444444444444444444444' as Address;
const owner=privateKeyToAccount(`0x${'01'.padStart(64,'0')}`);
const legal=privateKeyToAccount(`0x${'02'.padStart(64,'0')}`);
const reviewer=privateKeyToAccount(`0x${'03'.padStart(64,'0')}`);
const scalarAddr=(v:Address)=>encodeAbiParameters([{type:'address'}],[v]);
const scalarBool=(v:boolean)=>encodeAbiParameters([{type:'bool'}],[v]);
export async function phaseBundle(phase:LaunchPhase,manifestDigest:string,envelopeDigest:string|null) {
  const receipts=await Promise.all(REQUIRED_LAUNCH_GATE_IDS.filter(id=>GATE_PHASES[id].includes(phase)).map(gateId=>seal({gateId,phase,manifestDigest,envelopeDigest,status:'SATISFIED' as const,artifactDigest:D})));
  return seal({schemaVersion:'binrat.pons-phase-gates/1' as const,phase,manifestDigest,envelopeDigest,receipts});
}
export async function approve(kind:ApprovalKind,m:string,e:string|null,references:Record<string,string>,scope:string[],account=kind === 'LEGAL_EXECUTION' || kind === 'LEGAL_PUBLICATION' ? legal : kind === 'BEHAVIOR_REVIEW' ? reviewer : owner):Promise<ScopedApproval> {
  const body={id:`TEST_ONLY_${kind}`,kind,manifestDigest:m,envelopeDigest:e,notBeforeMs:NOW-1000,expiresAtMs:NOW+60000,scope,conditionsDigest:D,references,walletQuiescence:kind === 'OWNER_ARM'};
  return seal({body,signer:account.address,signature:await account.signMessage({message:await approvalMessage(body)})});
}
export async function authorityFixture() {
  const asset={status:'VERIFIED' as const,kind:'NATIVE_ETH' as const,address:'0x0000000000000000000000000000000000000000' as Address,evidenceDigest:D};
  const contractAddresses=[PONS_V2_FACTORY_V1,PONS_VAULT_LAUNCHER_V1,PONS_VAULT_REGISTRY_V1,PONS_STAKING_FACTORY_V1,PONS_STAKING_BEACON_V1,PONS_STAKING_IMPLEMENTATION_V1,'0x5555555555555555555555555555555555555555','0x6666666666666666666666666666666666666666','0x7777777777777777777777777777777777777777','0x8888888888888888888888888888888888888888','0x9999999999999999999999999999999999999999'];
  const contracts=Object.fromEntries(CONTRACT_ROLES.map((r,i)=>[r,{address:contractAddresses[i],codeHash:CODE_HASH,owner:r === 'launcher' || r === 'stakingImplementation' ? null : r === 'stakingBeacon' ? PONS_STAKING_FACTORY_V1 : reviewer.address}])) as PonsLaunchManifest['contracts'];
  let m:PonsLaunchManifest={schemaVersion:'binrat.pons-semantic-manifest/1',chainId:4663,rail:'PONS_V2_NATIVE_ETH_PONSVault_STAKING',wallet:{address:owner.address,accountType:'EOA',codeHash:keccak256('0x')},contracts,bindings:{launcherPonsFactory:PONS_V2_FACTORY_V1,launcherRegistry:PONS_VAULT_REGISTRY_V1,registryStakingFactory:PONS_STAKING_FACTORY_V1,stakingFactoryBeacon:PONS_STAKING_BEACON_V1,stakingFactoryImplementation:PONS_STAKING_IMPLEMENTATION_V1,stakingBeaconImplementation:PONS_STAKING_IMPLEMENTATION_V1},authorityReadPlanDigest:D,controllerCodeHashes:{[reviewer.address.toLowerCase()]:keccak256('0x'),[PONS_STAKING_FACTORY_V1.toLowerCase()]:CODE_HASH},config:{id:'0',expectedEconomics:`0x${'ab'.repeat(32)}`,launchFeeWei:'500000000000000',economics:{supply:'1000000000',curveFeeBps:'100'},configuration:{enabled:'true',antiSnipe:'9900:3'}},metadata:{name:'TEST ONLY BINRAT',symbol:'TEST',logo:'ipfs://test-only',description:'Synthetic test, never launch inputs',socials:{twitter:'',telegram:'',discord:'',website:'',farcaster:''}},policy:{creatorTaxBps:0,buybackEnabled:false,openingBuyWei:'0',privatePresale:'NONE',discountedInsiderRound:'NONE',hiddenTeamAllocation:'NONE',laterFounderPurchase:'PUBLIC_MARKET_DISCLOSED'},staking:{required:true,template:'staking',configBytes:encodeAbiParameters([{type:'uint256'}],[100n]),minimumFeesBeforePayoutWei:'100',contractMinimumPayoutWei:'0',lock:{kind:'NO_SUPPORTED_LOCK',seconds:'0'},creationRuleEvidenceDigest:D,vaultPrediction:'PROVISIONAL'},roles:{creator:'LAUNCH_WALLET',deployer:PONS_VAULT_LAUNCHER_V1,creatorFeeRecipient:'ACTUAL_VAULT',vaultController:PONS_STAKING_FACTORY_V1},assets:{pairQuoteAsset:asset,vaultQuoteAsset:asset,feeAccountingAsset:asset,rewardAccountingAsset:asset,claimAsset:asset},call:{creatorFeeRecipient:owner.address,salt:`0x${'cd'.repeat(32)}`,selector:'0x969e6741'},predictions:{token:{classification:'IMMUTABLE',address:TOKEN,derivationEvidenceDigest:D},curve:{classification:'IMMUTABLE',address:CURVE,derivationEvidenceDigest:D}},postconditions:{principalSafety:'stake/withdraw/claim verified by TEST fixture only'},behaviorEvidenceDigest:D,upstreamRiskDeclarationDigest:D,workingRatStatus:'PLANNED',productionEntitlementActive:false,digest:D};
  m.config.economics={phantomQuote:'50',graduationThreshold:'100',supply:'1000000000',curveFeeBps:'100',poolFee:'3000',tickSpacing:'60',protocolFeeShareBps:'500',buybackBurnBps:'5000',hookFeeBps:'300',maxInternalPriceImpactBps:'500'};
  m.config.expectedEconomics=economicsHash(m.config.economics);
  m.config.configuration={enabled:'true',snipeTaxStartBps:'9900',snipeTaxSeconds:'3',launchEnabled:'true'};
  m.bindings.launchForwarder=contracts.launchDeployer.address;
  for (const role of ['launchDeployer','memeHook','feeEscrow','locker','graduationExecutor']) m.bindings[role]=contracts[role].address;
  const configBytes=encodeAbiParameters([{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint24'},{type:'int24'},{type:'bool'}],[1000000000n,100n,50n,100n,3000,60,true]);
  const configCall=`${getFunctionSelector('getLaunchConfig(uint256)')}${encodeAbiParameters([{type:'uint256'}],[0n]).slice(2)}` as Hex;
  const read=(key:string,to:Address,data:Hex,expected:Hex)=>({key,to,data,expected});
  const reads=[
    read('launcherPonsFactory',PONS_VAULT_LAUNCHER_V1,S.launcherPonsFactory,scalarAddr(PONS_V2_FACTORY_V1)),
    read('launcherRegistry',PONS_VAULT_LAUNCHER_V1,S.launcherRegistry,scalarAddr(PONS_VAULT_REGISTRY_V1)),
    read('registryStakingFactory',PONS_VAULT_REGISTRY_V1,registryStakingFactoryCalldata(),scalarAddr(PONS_STAKING_FACTORY_V1)),
    read('stakingFactoryBeacon',PONS_STAKING_FACTORY_V1,S.stakingFactoryBeacon,scalarAddr(PONS_STAKING_BEACON_V1)),
    read('stakingFactoryImplementation',PONS_STAKING_FACTORY_V1,S.stakingFactoryImplementation,scalarAddr(PONS_STAKING_IMPLEMENTATION_V1)),
    read('stakingBeaconImplementation',PONS_STAKING_BEACON_V1,S.beaconImplementation,scalarAddr(PONS_STAKING_IMPLEMENTATION_V1)),
    read('canLaunchWallet',PONS_V2_FACTORY_V1,addressArgCalldata(getFunctionSelector('canLaunch(address)'),owner.address),scalarBool(true)),
    read('canLaunchCaller',PONS_V2_FACTORY_V1,addressArgCalldata(getFunctionSelector('canLaunch(address)'),PONS_VAULT_LAUNCHER_V1),scalarBool(true)),
    read('launchFee',PONS_V2_FACTORY_V1,getFunctionSelector('launchFee()'),encodeAbiParameters([{type:'uint256'}],[500000000000000n])),
    read('previewLaunchEconomics',PONS_V2_FACTORY_V1,`${getFunctionSelector('previewLaunchEconomics(uint256,address)')}${encodeAbiParameters([{type:'uint256'},{type:'address'}],[0n,asset.address]).slice(2)}`,m.config.expectedEconomics),
    read('selectedConfig',PONS_V2_FACTORY_V1,configCall,configBytes),
    read('configEnabled',PONS_V2_FACTORY_V1,configCall,configBytes),read('launchForwarder',PONS_V2_FACTORY_V1,getFunctionSelector('launchForwarder()'),scalarAddr(contracts.launchDeployer.address)),read('launchDeployer',PONS_V2_FACTORY_V1,getFunctionSelector('launchDeployer()'),scalarAddr(contracts.launchDeployer.address)),read('antiSnipeStartBps',PONS_V2_FACTORY_V1,getFunctionSelector('snipeTaxStartBps()'),encodeAbiParameters([{type:'uint256'}],[9900n])),read('antiSnipeSeconds',PONS_V2_FACTORY_V1,getFunctionSelector('snipeTaxSeconds()'),encodeAbiParameters([{type:'uint256'}],[3n])),read('launchEnabled',PONS_V2_FACTORY_V1,getFunctionSelector('launchEnabled()'),scalarBool(true))
  ];
  for (const role of ['memeHook','feeEscrow','locker','graduationExecutor']) reads.push(read(role,PONS_V2_FACTORY_V1,getFunctionSelector(`${role}()`),scalarAddr(contracts[role].address)));
  for (const [role,c] of Object.entries(contracts)) if (c.owner !== null) reads.push(read(`owner:${role}`,c.address,S.registryOwner,scalarAddr(c.owner)));
  const readPlan:AuthorityReadPlan=await seal({schemaVersion:'binrat.pons-authority-reads/1',reads});
  m.authorityReadPlanDigest=readPlan.digest;
  const behavior:BehaviorEvidence=await seal({schemaVersion:'binrat.pons-behavior-evidence/1',contractsDigest:await sha256Hex(m.contracts),semanticInputsDigest:await semanticInputsDigest(m),source:'UNAVAILABLE',contractSources:Object.fromEntries(Object.entries(m.contracts).map(([r,c])=>[r,{status:'UNAVAILABLE',runtimeCodeHash:c.codeHash,artifactDigest:D}])),critical:Object.fromEntries(CRITICAL_BEHAVIORS.map(k=>[k,{status:'VERIFIED',method:'REPRODUCIBLE_FORK_TRACE',artifactDigest:D,reproduction:'TEST_ONLY: run acceptance fixtures; not deployed behavior evidence'}])) as BehaviorEvidence['critical'],predictionProofs:{token:{deterministic:true,artifactDigest:D},curve:{deterministic:true,artifactDigest:D}},noLiteralVaultDependency:true});
  const risk:UpstreamRiskDeclaration=await seal({schemaVersion:'binrat.pons-upstream-risk/1',risks:['PUBLIC_SOURCE_UNAVAILABLE','SHARED_BEACON_UPGRADES','DISCLOSED_OWNER_POWERS','NO_COMPLETED_THIRD_PARTY_AUDIT'],behaviorEvidenceDigest:behavior.digest,disclosures:['TEST ONLY residual risks, no live acceptance']});
  m=await seal({...m,behaviorEvidenceDigest:behavior.digest,upstreamRiskDeclarationDigest:risk.digest});
  const budget=await deriveFreshnessBudget({blockIntervalsMs:[500,600,700],rpcRoundTripsMs:[10,15,20],signingWorkflowMs:[20,30,40],criticalReadBatches:2,runtimeMaxAgeMs:10000,mutationNoticeMs:null,mutability:'UNTIMELOCKED',measurementEvidenceDigest:D});
  const envelope:FinalExecutionEnvelope=await seal({schemaVersion:'binrat.pons-execution-envelope/1',manifestDigest:m.digest,chainId:4663,from:owner.address,nonce:'7',to:PONS_VAULT_LAUNCHER_V1,calldata:calldataForManifest(m),calldataHash:keccak256(calldataForManifest(m)),valueWei:m.config.launchFeeWei,gasLimit:'600000',maxFeePerGasWei:'2',maxPriorityFeePerGasWei:'1',approvedFeeCeilingWei:'1200000',createdAtMs:NOW-100,expiresAtMs:NOW+60000});
  const codes=Object.fromEntries(Object.entries(contracts).map(([k,c])=>[k,c.codeHash]));
  for (const [controller,hash] of Object.entries(m.controllerCodeHashes)) codes[`controller:${controller}`]=hash;
  const snapshot:AuthoritySnapshot=await seal({schemaVersion:'binrat.pons-fresh-authority/1',manifestDigest:m.digest,readPlanDigest:readPlan.digest,chainId:4663,provider:{id:'TEST_PRIMARY',backingId:'TEST_A'},block:{number:'200',hash:BLOCK_HASH,timestampMs:NOW-100},observedAtMs:NOW-50,completedAtMs:NOW-10,canonicalHash:BLOCK_HASH,codes,results:Object.fromEntries(reads.map(r=>[r.key,r.expected])),wallet:{nonce:'7',pendingNonce:'7',balanceWei:'1000000000000000000',codeHash:keccak256('0x'),accountType:'EOA'},independent:{status:'AGREE',providerId:'TEST_SECONDARY',backingId:'TEST_B',strongerArtifactDigest:null}});
  const trace=await seal({schemaVersion:'binrat.pons-exact-trace/1' as const,manifestDigest:m.digest,envelopeDigest:envelope.digest,authorityObservationsDigest:await authorityObservationsDigest(snapshot),token:TOKEN,curve:CURVE,vault:VAULT,creation:{stakingFactory:m.contracts.stakingFactory.address,vaultToken:TOKEN,vaultBeacon:m.contracts.stakingBeacon.address,vaultImplementation:m.contracts.stakingImplementation.address,minimumFeesBeforePayoutWei:m.staking.minimumFeesBeforePayoutWei,lock:m.staking.lock,assets:m.assets,roles:{creator:m.wallet.address,deployer:m.contracts.launcher.address,creatorFeeRecipient:VAULT,vaultController:m.contracts.stakingFactory.address},economics:m.config.economics,configuration:m.config.configuration,metadata:m.metadata,postconditions:m.postconditions},stateOverridesUsed:false as const,noLiteralVaultDependency:true as const,reproduction:'TEST ONLY replay',rawTraceDigest:D});
  const simClient={getChainId:async()=>4663,getBlock:async()=>({number:200n,hash:BLOCK_HASH}),call:async()=>({data:encodeAbiParameters([{type:'address'},{type:'address'}],[TOKEN,VAULT])})} as any;
  const rehearsal=await rehearseExactEnvelope(simClient,{manifest:m,envelope,readPlan,snapshot,budget,behavior,trace,nowMs:NOW,headNumber:200n});
  const gates=await phaseBundle('PRE-ARM',m.digest,envelope.digest);
  const approvals={legal:await approve('LEGAL_EXECUTION',m.digest,null,{},['EXECUTION']),risk:await approve('UPSTREAM_ACCEPTANCE',m.digest,null,{riskDeclaration:risk.digest},['BOUNDED_UPSTREAM_RISK']),behavior:await approve('BEHAVIOR_REVIEW',m.digest,null,{behaviorEvidence:behavior.digest,exactTrace:trace.digest},['CRITICAL_BEHAVIOR_VERIFIED']),owner:null as unknown as ScopedApproval};
  approvals.owner=await approve('OWNER_ARM',m.digest,envelope.digest,{legal:approvals.legal.digest,risk:approvals.risk.digest,behavior:approvals.behavior.digest,budget:budget.digest,rehearsal:rehearsal.digest,gates:gates.digest},['ONE_SEND']);
  const trust={legalSigner:legal.address,behaviorReviewer:reviewer.address,approvalState:async()=> 'VALID' as const,sourceState:async()=> 'UNAVAILABLE' as const,activeEnvelope:async()=>envelope.digest};
  const authority:ArmInputs={manifest:m,envelope,behavior,risk,readPlan,snapshot,budget,rehearsal,approvals,trust,gates,nowMs:NOW,headNumber:200n};
  const armed=await armExecutionEnvelope(authority);
  const signed=await owner.signTransaction({type:'eip1559',chainId:4663,nonce:7,to:envelope.to,data:envelope.calldata,value:BigInt(envelope.valueWei),gas:BigInt(envelope.gasLimit),maxFeePerGas:2n,maxPriorityFeePerGas:1n});
  return {authority,armed,simClient,trace,signed,owner};
}
export function collectorClient(f:Awaited<ReturnType<typeof authorityFixture>>,options:{lag?:boolean;disagree?:boolean;nonce?:number;balance?:bigint;chainId?:number}={}) {
  const m=f.authority.manifest;
  return {getChainId:async()=>options.chainId ?? 4663,getBlock:async({blockTag}:any)=>{if(options.lag && !blockTag) throw new Error('cannot serve state');return {number:200n,hash:BLOCK_HASH,timestamp:BigInt(Math.floor(NOW/1000))};},getCode:async({address}:any)=>address.toLowerCase() === m.wallet.address.toLowerCase() || address.toLowerCase() === reviewer.address.toLowerCase() ? '0x' : CODE,call:async({to,data}:any)=>({data:options.disagree ? '0x01' : f.authority.readPlan.reads.find(r=>r.to.toLowerCase()===to.toLowerCase() && r.data===data)!.expected}),getTransactionCount:async()=>options.nonce ?? 7,getBalance:async()=>options.balance ?? 1000000000000000000n} as any;
}
export async function executionFixture(f:Awaited<ReturnType<typeof authorityFixture>>,vault=VAULT) {
  const m=f.authority.manifest,e=f.authority.envelope,hash=keccak256(f.signed);
  const proof:DeploymentProof=await seal({schemaVersion:'binrat.pons-deployment-proof/1',manifestDigest:m.digest,envelopeDigest:e.digest,transactionHash:hash,blockNumber:'200',blockHash:BLOCK_HASH,token:TOKEN,curve:CURVE,vault,stakingFactory:m.contracts.stakingFactory.address,creationRuleEvidenceDigest:m.staking.creationRuleEvidenceDigest,vaultToken:TOKEN,vaultBeacon:m.contracts.stakingBeacon.address,vaultImplementation:m.contracts.stakingImplementation.address,assets:m.assets,minimumFeesBeforePayoutWei:m.staking.minimumFeesBeforePayoutWei,lock:m.staking.lock,roles:{creator:m.wallet.address,deployer:m.contracts.launcher.address,creatorFeeRecipient:vault,vaultController:m.contracts.stakingFactory.address},economics:m.config.economics,configuration:m.config.configuration,metadata:m.metadata,postconditions:m.postconditions,totalSupplyRaw:'1000000000',rawTraceDigest:D,reproduction:'TEST ONLY synthetic deployment proof'});
  const review=await approve('BEHAVIOR_REVIEW',m.digest,e.digest,{deploymentProof:proof.digest},['EXECUTION_POSTCONDITIONS']);
  const logs=[
    {address:e.to,topics:encodeEventTopics({abi:PONS_LAUNCH_WITH_VAULT_ABI,eventName:'Launched',args:{token:TOKEN,vault,creator:m.wallet.address}}),data:encodeAbiParameters([{type:'address'},{type:'address'},{type:'bytes32'}],[CURVE,'0x0000000000000000000000000000000000000000',PONS_STAKING_TEMPLATE_ID])},
    {address:m.contracts.ponsFactory.address,topics:encodeEventTopics({abi:[ponsTokenLaunchedEvent],eventName:'TokenLaunched',args:{token:TOKEN,curve:CURVE,deployer:m.contracts.launcher.address}}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],['0x0000000000000000000000000000000000000000',0n,100n])},
    {address:TOKEN,topics:[keccak256(new TextEncoder().encode('Transfer(address,address,uint256)')),`0x${'0'.repeat(64)}`,scalarAddr(CURVE)],data:encodeAbiParameters([{type:'uint256'}],[1000000000n])}
  ];
  const client={getChainId:async()=>4663,getTransaction:async()=>({hash,blockHash:BLOCK_HASH,blockNumber:200n,from:e.from,to:e.to,input:e.calldata,value:BigInt(e.valueWei),nonce:7,gas:BigInt(e.gasLimit),maxFeePerGas:2n,maxPriorityFeePerGas:1n}),getTransactionReceipt:async()=>({status:'success',transactionHash:hash,blockHash:BLOCK_HASH,blockNumber:200n,logs}),getBlock:async()=>({number:200n,hash:BLOCK_HASH}),getCode:async({address}:any)=>address.toLowerCase() === m.wallet.address.toLowerCase() || address.toLowerCase() === reviewer.address.toLowerCase() ? '0x' : CODE,call:async({to,data}:any)=>({data:f.authority.readPlan.reads.find(r=>r.to.toLowerCase() === to.toLowerCase() && r.data === data)!.expected}),getStorageAt:async()=>`0x${'0'.repeat(24)}${m.contracts.stakingBeacon.address.slice(2).toLowerCase()}`,readContract:async({functionName,address}:any)=>{if(functionName === 'owner') return Object.values(m.contracts).find(c=>c.address.toLowerCase()===address.toLowerCase())?.owner;if(functionName === 'token') return TOKEN;if(functionName === 'pairToken' || functionName === 'quoteAsset') return '0x0000000000000000000000000000000000000000';if(functionName === 'implementation')return m.contracts.stakingImplementation.address;if(functionName === 'name')return m.metadata.name;if(functionName === 'symbol')return m.metadata.symbol;if(functionName === 'totalSupply')return 1000000000n;if(functionName === 'getLaunchedToken')return {exists:true,token:TOKEN,curve:CURVE,creatorTaxBps:0,buybackEnabled:false,pairToken:'0x0000000000000000000000000000000000000000',deployer:m.contracts.launcher.address,creatorFeeRecipient:vault};throw new Error('unsupported test getter');}} as any;
  return {client,manifest:m,envelope:e,signedTransaction:f.signed,proof,review,trust:f.authority.trust,nowMs:NOW,logs};
}
