import { decodeEventLog, encodeAbiParameters, getAddress, getFunctionSelector, keccak256, parseAbi, type Address, type Hex, type PublicClient } from 'viem';
import { ponsErc20Abi, ponsTokenLaunchedEvent, ponsV2BondingCurveReadAbi, ponsV2FactoryOutcomeReadAbi } from '../pons/ponsAbi.js';
import { PONS_STAKING_BEACON_SLOT } from '../holder/ponsStakeReader.js';
import { PONS_LAUNCH_WITH_VAULT_ABI } from './ponsVaultLaunchAbi.js';
import { verifySignedEnvelope } from './ponsLaunchJournal.js';
import { cloneApprovalTrust, validateScopedApproval, type ApprovalTrust, type FinalExecutionEnvelope, type ScopedApproval } from './ponsExecutionEnvelope.js';
import { assertAssets, assertCreationPostconditions, assertDigest, digestString, requireCondition, same, seal, validatePonsLaunchManifest, type LaunchAssets, type PonsLaunchManifest } from './ponsLaunchManifest.js';
import { registryStakingFactoryCalldata, PONS_PREFLIGHT_SELECTORS as S } from './ponsPreflight.js';

export interface DeploymentProof {
  schemaVersion: 'binrat.pons-deployment-proof/1'; manifestDigest: string; envelopeDigest: string;
  transactionHash: Hex; blockNumber: string; blockHash: Hex;
  token: Address; curve: Address; vault: Address; stakingFactory: Address;
  creationRuleEvidenceDigest: string; vaultToken: Address; vaultBeacon: Address; vaultImplementation: Address;
  assets: LaunchAssets; minimumFeesBeforePayoutWei: string; lock: PonsLaunchManifest['staking']['lock'];
  roles: Record<string, Address>; economics: Record<string,string>; configuration: Record<string,string>;
  metadata: PonsLaunchManifest['metadata']; postconditions: Record<string,string>;
  totalSupplyRaw: string; rawTraceDigest: string; reproduction: string; digest: string;
}
export interface VerifiedLaunchReceipt {
  schemaVersion: 'binrat.pons-execution-verification/1'; status: 'VERIFIED'; state: 'VERIFIED'; chainId:4663;
  manifestDigest: string; envelopeDigest: string; deploymentProofDigest: string; reviewApprovalDigest: string;
  transactionHash: Hex; blockNumber: string; blockHash: Hex; finalizedBlockNumber: string;
  token: Address; curve: Address; vault: Address; assets: LaunchAssets;
  roles: Record<string,Address>; economics: Record<string,string>; staking: PonsLaunchManifest['staking'];
  workingRatStatus:'PLANNED'; productionEntitlementActive:false; digest:string;
}
export interface ReconcileReceipt {schemaVersion:'binrat.pons-execution-verification/1';status:'ABORT_RECONCILE';state:'RECONCILE';manifestDigest:string;envelopeDigest:string;transactionHash:Hex;errors:string[];digest:string}
const issued = new WeakSet<object>();
const confirmedIssued=new WeakSet<object>();
export interface ConfirmedLaunchReceipt {schemaVersion:'binrat.pons-confirmation/1';state:'CONFIRMED';manifestDigest:string;envelopeDigest:string;transactionHash:Hex;blockNumber:string;blockHash:Hex;digest:string}
export function assertIssuedConfirmation(value:ConfirmedLaunchReceipt):void {requireCondition(confirmedIssued.has(value),'CONFIRMATION_REQUIRES_RPC_RESULT');}
function freeze<T>(value:T):T { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
export function assertIssuedVerifiedReceipt(value:VerifiedLaunchReceipt):void { requireCondition(issued.has(value), 'FACTS_REQUIRE_FRESH_VERIFIER_RESULT'); }
const TRANSFER = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);
const VAULT_TOKEN = parseAbi(['function token() view returns (address)','function quoteAsset() view returns (address)']);
const BEACON = parseAbi(['function implementation() view returns (address)']);

export async function confirmPonsExecution(client:PublicClient,manifest:PonsLaunchManifest,envelope:FinalExecutionEnvelope,signed:Hex):Promise<ConfirmedLaunchReceipt> {
  [manifest,envelope]=structuredClone([manifest,envelope]);
  const m=await validatePonsLaunchManifest(manifest),e=structuredClone(envelope),hash=await verifySignedEnvelope(m,e,signed);
  requireCondition(await client.getChainId() === 4663,'CONFIRMATION_CHAIN_MISMATCH');
  const [tx,r]=await Promise.all([client.getTransaction({hash}),client.getTransactionReceipt({hash})]);
  requireCondition(r.status === 'success' && r.transactionHash === hash && tx.hash === hash && r.blockHash === tx.blockHash && r.blockNumber === tx.blockNumber && tx.from.toLowerCase() === e.from.toLowerCase() && tx.to?.toLowerCase() === e.to.toLowerCase() && tx.input === e.calldata && tx.value === BigInt(e.valueWei) && tx.nonce === Number(e.nonce) && tx.gas === BigInt(e.gasLimit) && tx.maxFeePerGas === BigInt(e.maxFeePerGasWei) && tx.maxPriorityFeePerGas === BigInt(e.maxPriorityFeePerGasWei),'CONFIRMED_TRANSACTION_MISMATCH');
  requireCondition((await client.getBlock({blockNumber:r.blockNumber})).hash === r.blockHash,'CONFIRMATION_REORGED');
  const result=freeze(await seal({schemaVersion:'binrat.pons-confirmation/1' as const,state:'CONFIRMED' as const,manifestDigest:m.digest,envelopeDigest:e.digest,transactionHash:hash,blockNumber:String(r.blockNumber),blockHash:r.blockHash}));
  confirmedIssued.add(result);return result;
}

export async function verifyPonsExecution(input:{client:PublicClient;manifest:PonsLaunchManifest;envelope:FinalExecutionEnvelope;signedTransaction:Hex;proof:DeploymentProof;review:ScopedApproval;trust:ApprovalTrust;nowMs:number}):Promise<VerifiedLaunchReceipt | ReconcileReceipt> {
  const {client,trust,...material}=input;input={...structuredClone(material),client,trust:cloneApprovalTrust(trust)};
  const transactionHash = keccak256(input.signedTransaction);
  try {
    const m = await validatePonsLaunchManifest(input.manifest), e = input.envelope, p = structuredClone(input.proof);
    await Promise.all([assertDigest(e),assertDigest(p)]);
    requireCondition(await verifySignedEnvelope(m,e,input.signedTransaction) === transactionHash && await input.client.getChainId() === 4663, 'EXECUTION_ENVELOPE_OR_CHAIN_MISMATCH');
    const [tx,receipt] = await Promise.all([input.client.getTransaction({hash:transactionHash}),input.client.getTransactionReceipt({hash:transactionHash})]);
    requireCondition(receipt.status === 'success' && receipt.transactionHash === transactionHash && tx.hash === transactionHash && receipt.blockHash === tx.blockHash && receipt.blockNumber === tx.blockNumber && tx.from.toLowerCase() === e.from.toLowerCase() && tx.to?.toLowerCase() === e.to.toLowerCase() && tx.input === e.calldata && tx.value === BigInt(e.valueWei) && tx.nonce === Number(e.nonce) && tx.gas === BigInt(e.gasLimit) && tx.maxFeePerGas === BigInt(e.maxFeePerGasWei) && tx.maxPriorityFeePerGas === BigInt(e.maxPriorityFeePerGasWei), 'CONFIRMED_TRANSACTION_MISMATCH');
    requireCondition(p.schemaVersion === 'binrat.pons-deployment-proof/1' && p.manifestDigest === m.digest && p.envelopeDigest === e.digest && p.transactionHash === transactionHash && p.blockNumber === String(receipt.blockNumber) && p.blockHash === receipt.blockHash && digestString(p.rawTraceDigest) && p.reproduction.trim().length > 0, 'EXECUTION_PROOF_BINDING_MISMATCH');
    await validateScopedApproval(input.review,'BEHAVIOR_REVIEW',m.digest,e.digest,input.trust.behaviorReviewer,input.nowMs,input.trust);
    requireCondition(input.review.body.scope.includes('EXECUTION_POSTCONDITIONS') && input.review.body.references.deploymentProof === p.digest, 'EXECUTION_PROOF_NOT_REVIEWED');
    const canonical = await input.client.getBlock({blockNumber:receipt.blockNumber});
    const finalized = await input.client.getBlock({blockTag:'finalized'});
    requireCondition(canonical.hash === receipt.blockHash && finalized.number !== null && finalized.number >= receipt.blockNumber, 'EXECUTION_NOT_CANONICAL_FINALIZED');
    const launcherEvents = receipt.logs.filter(l => l.address.toLowerCase() === m.contracts.launcher.address.toLowerCase()).flatMap(l => {
      try { const event=decodeEventLog({abi:PONS_LAUNCH_WITH_VAULT_ABI,data:l.data,topics:l.topics}); return event.eventName === 'Launched' ? [event.args] : []; } catch { return []; }
    });
    const factoryEvents = receipt.logs.filter(l => l.address.toLowerCase() === m.contracts.ponsFactory.address.toLowerCase()).flatMap(l => {
      try {return [decodeEventLog({abi:[ponsTokenLaunchedEvent],data:l.data,topics:l.topics}).args];} catch {return [];}
    });
    requireCondition(launcherEvents.length === 1 && factoryEvents.length === 1, 'EXECUTION_EVENT_CARDINALITY');
    const launched=launcherEvents[0], factory=factoryEvents[0];
    requireCondition(getAddress(launched.token) === getAddress(p.token) && getAddress(launched.curve) === getAddress(p.curve) && getAddress(launched.vault) === getAddress(p.vault) && getAddress(launched.creator) === getAddress(m.wallet.address) && launched.pairToken === '0x0000000000000000000000000000000000000000' && launched.templateId.toLowerCase() === `0x${'7374616b696e67'.padEnd(64,'0')}`, 'EXECUTION_LAUNCHER_EVENT_MISMATCH');
    requireCondition(getAddress(factory.token) === getAddress(p.token) && getAddress(factory.curve) === getAddress(p.curve) && factory.launchConfigId === BigInt(m.config.id) && factory.pairToken === launched.pairToken, 'EXECUTION_FACTORY_EVENT_MISMATCH');
    requireCondition(new Set([p.token,p.curve,p.vault].map(v=>v.toLowerCase())).size === 3, 'EXECUTION_ADDRESSES_COLLIDE');
    for (const key of ['token','curve'] as const) if (m.predictions[key].classification === 'IMMUTABLE') requireCondition(p[key].toLowerCase() === m.predictions[key].address!.toLowerCase(), `EXECUTION_IMMUTABLE_PREDICTION_MISMATCH:${key}`);
    // No equality check against the rehearsal vault: its factory nonce may have advanced.
    requireCondition(p.stakingFactory.toLowerCase() === m.contracts.stakingFactory.address.toLowerCase() && p.creationRuleEvidenceDigest === m.staking.creationRuleEvidenceDigest && p.vaultToken.toLowerCase() === p.token.toLowerCase() && p.vaultBeacon.toLowerCase() === m.contracts.stakingBeacon.address.toLowerCase() && p.vaultImplementation.toLowerCase() === m.contracts.stakingImplementation.address.toLowerCase() && p.minimumFeesBeforePayoutWei === m.staking.minimumFeesBeforePayoutWei && same(p.lock,m.staking.lock), 'EXECUTION_STAKING_CREATION_MISMATCH');
    assertCreationPostconditions(m,p.token,p.vault,p);
    assertAssets(p.assets);
    requireCondition(same(p.assets,m.assets) && same(p.economics,m.config.economics) && same(p.configuration,m.config.configuration) && same(p.metadata,m.metadata) && same(p.postconditions,m.postconditions), 'EXECUTION_SEMANTIC_POSTCONDITION_MISMATCH');
    requireCondition(same(Object.keys(p.roles).sort(),Object.keys(m.roles).sort()), 'EXECUTION_ROLE_SET_MISMATCH');
    for (const [role,reference] of Object.entries(m.roles)) { const expected=reference === 'ACTUAL_VAULT' ? p.vault : reference === 'LAUNCH_WALLET' ? m.wallet.address : reference; requireCondition(p.roles[role].toLowerCase() === expected.toLowerCase(), `EXECUTION_ROLE_MISMATCH:${role}`); }
    requireCondition(factory.deployer.toLowerCase() === p.roles.deployer.toLowerCase(), 'EXECUTION_DEPLOYER_EVENT_MISMATCH');
    const blockNumber=receipt.blockNumber;
    const [curveToken,pair,vaultToken,vaultQuote,slot,impl,info,name,symbol,supply] = await Promise.all([
      input.client.readContract({address:p.curve,abi:ponsV2BondingCurveReadAbi,functionName:'token',blockNumber}),
      input.client.readContract({address:p.curve,abi:ponsV2BondingCurveReadAbi,functionName:'pairToken',blockNumber}),
      input.client.readContract({address:p.vault,abi:VAULT_TOKEN,functionName:'token',blockNumber}),
      input.client.readContract({address:p.vault,abi:VAULT_TOKEN,functionName:'quoteAsset',blockNumber}),
      input.client.getStorageAt({address:p.vault,slot:PONS_STAKING_BEACON_SLOT,blockNumber}),
      input.client.readContract({address:m.contracts.stakingBeacon.address,abi:BEACON,functionName:'implementation',blockNumber}),
      input.client.readContract({address:m.contracts.ponsFactory.address,abi:ponsV2FactoryOutcomeReadAbi,functionName:'getLaunchedToken',args:[p.token],blockNumber}),
      input.client.readContract({address:p.token,abi:ponsErc20Abi,functionName:'name',blockNumber}),
      input.client.readContract({address:p.token,abi:ponsErc20Abi,functionName:'symbol',blockNumber}),
      input.client.readContract({address:p.token,abi:ponsErc20Abi,functionName:'totalSupply',blockNumber})
    ]);
    requireCondition(curveToken.toLowerCase() === p.token.toLowerCase() && pair === launched.pairToken && vaultToken.toLowerCase() === p.token.toLowerCase() && p.assets.vaultQuoteAsset.status === 'VERIFIED' && vaultQuote.toLowerCase() === p.assets.vaultQuoteAsset.address.toLowerCase() && slot?.toLowerCase() === `0x${'0'.repeat(24)}${m.contracts.stakingBeacon.address.slice(2).toLowerCase()}` && impl.toLowerCase() === m.contracts.stakingImplementation.address.toLowerCase(), 'EXECUTION_VAULT_CURVE_BINDING_MISMATCH');
    requireCondition(info.exists && info.token.toLowerCase() === p.token.toLowerCase() && info.curve.toLowerCase() === p.curve.toLowerCase() && info.creatorTaxBps === 0 && info.buybackEnabled === false && info.pairToken === pair && info.deployer.toLowerCase() === p.roles.deployer.toLowerCase() && info.creatorFeeRecipient.toLowerCase() === p.roles.creatorFeeRecipient.toLowerCase(), 'EXECUTION_FACTORY_STATE_MISMATCH');
    requireCondition(name === m.metadata.name && symbol === m.metadata.symbol && supply > 0n && String(supply) === m.config.economics.supply && String(supply) === p.totalSupplyRaw, 'EXECUTION_TOKEN_METADATA_SUPPLY_MISMATCH');
    let mintedToCurve=0n;
    for (const log of receipt.logs.filter(l => l.address.toLowerCase() === p.token.toLowerCase())) {
      try { const event=decodeEventLog({abi:TRANSFER,data:log.data,topics:log.topics}); if (event.args.value > 0n) { requireCondition(event.args.from === '0x0000000000000000000000000000000000000000' && event.args.to.toLowerCase() === p.curve.toLowerCase(),'EXECUTION_PRIVILEGED_INVENTORY_OR_OPENING_BUY'); mintedToCurve += event.args.value; } }
      catch (error) { if (error instanceof Error && error.message === 'EXECUTION_PRIVILEGED_INVENTORY_OR_OPENING_BUY') throw error; }
    }
    requireCondition(mintedToCurve === supply, 'EXECUTION_ALLOCATION_NOT_PROVEN');
    const ownerAbi=parseAbi(['function owner() view returns (address)']);
    for (const authorityBlock of [...new Set([blockNumber,finalized.number])]) {
      for (const [role,c] of Object.entries(m.contracts)) {
        const code=await input.client.getCode({address:c.address,blockNumber:authorityBlock});requireCondition(code && keccak256(code) === c.codeHash,`EXECUTION_UPSTREAM_CODE_DRIFT:${role}`);
        if (c.owner !== null) { const owner=await input.client.readContract({address:c.address,abi:ownerAbi,functionName:'owner',blockNumber:authorityBlock}); requireCondition(owner.toLowerCase() === c.owner.toLowerCase(),`EXECUTION_CONTROLLER_DRIFT:${role}`); }
      }
      for (const [controller,expectedHash] of Object.entries(m.controllerCodeHashes)) {
        const code=await input.client.getCode({address:controller as Address,blockNumber:authorityBlock});requireCondition(code !== undefined && keccak256(code) === expectedHash,'EXECUTION_CONTROLLER_CODE_DRIFT');
      }
      const bindings:[string,Address,Hex][]=[['launcherPonsFactory',m.contracts.launcher.address,S.launcherPonsFactory],['launcherRegistry',m.contracts.launcher.address,S.launcherRegistry],['registryStakingFactory',m.contracts.registry.address,registryStakingFactoryCalldata()],['stakingFactoryBeacon',m.contracts.stakingFactory.address,S.stakingFactoryBeacon],['stakingFactoryImplementation',m.contracts.stakingFactory.address,S.stakingFactoryImplementation],['stakingBeaconImplementation',m.contracts.stakingBeacon.address,S.beaconImplementation],...['launchForwarder','launchDeployer','memeHook','feeEscrow','locker','graduationExecutor'].map(role=>[role,m.contracts.ponsFactory.address,getFunctionSelector(`${role}()`)] as [string,Address,Hex])];
      for (const [key,to,data] of bindings) {
        const result=await input.client.call({to,data,blockNumber:authorityBlock});
        requireCondition(result.data?.toLowerCase() === encodeAbiParameters([{type:'address'}],[m.bindings[key]]).toLowerCase(),`EXECUTION_GRAPH_DRIFT:${key}`);
      }
    }
    for (const a of [p.token,p.curve,p.vault]) requireCondition((await input.client.getCode({address:a,blockNumber}))?.length! > 2, 'EXECUTION_DEPLOYED_CODE_MISSING');
    requireCondition((await input.client.getBlock({blockNumber})).hash === receipt.blockHash, 'EXECUTION_REORGED');
    const result=freeze(await seal({schemaVersion:'binrat.pons-execution-verification/1' as const,status:'VERIFIED' as const,state:'VERIFIED' as const,chainId:4663 as const,manifestDigest:m.digest,envelopeDigest:e.digest,deploymentProofDigest:p.digest,reviewApprovalDigest:input.review.digest,transactionHash,blockNumber:String(blockNumber),blockHash:receipt.blockHash,finalizedBlockNumber:String(finalized.number),token:p.token,curve:p.curve,vault:p.vault,assets:p.assets,roles:p.roles,economics:p.economics,staking:m.staking,workingRatStatus:'PLANNED' as const,productionEntitlementActive:false as const}));
    issued.add(result);
    return result;
  } catch (error) { return seal({schemaVersion:'binrat.pons-execution-verification/1' as const,status:'ABORT_RECONCILE' as const,state:'RECONCILE' as const,manifestDigest:input.manifest.digest,envelopeDigest:input.envelope.digest,transactionHash,errors:[error instanceof Error ? error.message : 'EXECUTION_VERIFICATION_UNAVAILABLE']}); }
}
