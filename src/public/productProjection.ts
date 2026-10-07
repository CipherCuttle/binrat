import type { CapabilityManifest } from '../telegram/rat.js';
import type { PublishedPublicSnapshot } from '../cloudflare/publicSnapshot.js';
import { buildPublicSnapshot } from '../cloudflare/publicSnapshot.js';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { researchEvidence } from './generated/researchEvidence.js';
import { verifiedStatusContract } from './snapshotContract.js';

export const PUBLIC_PRODUCT_SCHEMA = 'binrat.public-product/1' as const;
export const PUBLIC_PRODUCT_MAPPING_REVISION = 'BINRAT_LAUNCH_PUBLIC_MAPPING_V1' as const;
export const PublicStage = Object.freeze({ LIVE:'LIVE', BUILDING:'BUILDING', PROVING:'PROVING', PLANNED:'PLANNED', LOCKED:'LOCKED', UNVERIFIED:'UNVERIFIED' } as const);
export type PublicProductStage = typeof PublicStage[keyof typeof PublicStage];
export const WORKING_RAT_SELECTION = Object.freeze({ workingRatStatus:PublicStage.PLANNED, productionEntitlementActive:false,
  phase:'POST_LAUNCH', source:'OWNER_CONFIRMED_CODEX_2_INPUT_CONTRACT',
  stakingBoundary:'PonsVault Staking is required at token launch. It does not activate Working Rat entitlement.' } as const);
const crewMapping = Object.freeze([
  {id:'rat-zero',name:'RAT ZERO',role:'SCOUT',description:'Fresh Pons discovery, supported Cases and retained receipts.'},
  {id:'tripwire',name:'TRIPWIRE',role:'WATCHER',description:'Current Watch infrastructure exists. Persistent Rat employment is not available.'},
  {id:'sniffer',name:'SNIFFER',role:'TRAIL HUNTER',description:'A real funding handoff has been captured. Later-launch usefulness is still being proven.'},
  {id:'working-rat',name:'WORKING RAT',role:'FUTURE LABOR',description:'Planned post-launch. STAKE BUYS LABOR. NOT TRUTH.'},
  {id:'den',name:'THE DEN',role:'ORGANIZE',description:'Planned post-launch. No production workforce or persistent job surface.'},
  {id:'locked-1',name:'?????',role:'LOCKED',description:'Undisclosed Rat. Unavailable.'},
  {id:'locked-2',name:'?????',role:'LOCKED',description:'Undisclosed Rat. Unavailable.'},
]);
export interface PublicProduct {
  schemaVersion:typeof PUBLIC_PRODUCT_SCHEMA; mappingRevision:string; manifestDigest:string;
  snapshotBinding:{chainId:number;checkpointBlock:string;checkpointBlockHash:string;feedDigest:string}|null;
  runtimeFreshness:string; crew:Array<{id:string;name:string;role:string;description:string;status:PublicProductStage;phase:string|null;actionAvailable:boolean}>;
  currentAuthority:{chainId:4663;status:string;treasuryAddress:string|null;launchWalletAddress:string|null;creatorFeeRecipientAddress:string|null};
  launchState:{status:string;tokenState:string;marketingAuthorized:boolean;launchAuthorized:boolean};
  currentWatch:{audience:string;subject:string;recurrence:string;employmentAvailable:false};
  workingRat:{workingRatStatus:PublicProductStage;productionEntitlementActive:false|null;phase:'POST_LAUNCH';source:string;stakingBoundary:string}; todayJourney:string[]; futureWorkforceLoop:string[]; roadmap:string[];
  evidence:{snifferAuditSha256:string|null;snifferHandoffDigest:string|null};
}

// Validate a transported projection against the same canonical mapping. This
// never accepts a second mutable crew, wallet or launch authority.
export async function validateTransportedProduct(manifest:CapabilityManifest):Promise<PublicProduct> {
  const {publicProduct,...canonical}=manifest;
  if(!publicProduct) throw new Error('PUBLIC_PRODUCT_UNAVAILABLE');
  const expected=await projectPublicProduct({manifest:canonical,snapshot:null,status:null});
  for(const key of ['schemaVersion','mappingRevision','manifestDigest','currentAuthority','launchState','workingRat','todayJourney','futureWorkforceLoop','roadmap','evidence'] as const) {
    if(canonicalJson(publicProduct[key])!==canonicalJson(expected[key])) throw new Error('PUBLIC_PRODUCT_CANONICAL_CONTRADICTION');
  }
  if(publicProduct.crew?.length!==expected.crew.length) throw new Error('PUBLIC_PRODUCT_CANONICAL_CONTRADICTION');
  for(let i=1;i<expected.crew.length;i++) if(canonicalJson(publicProduct.crew[i])!==canonicalJson(expected.crew[i])) throw new Error('PUBLIC_PRODUCT_CANONICAL_CONTRADICTION');
  const binding=publicProduct.snapshotBinding,zero=publicProduct.crew[0];
  const available=binding!==null;
  if(available&&(binding?.chainId!==4663||! /^(0|[1-9][0-9]*)$/.test(binding.checkpointBlock)||!/^0x[0-9a-f]{64}$/.test(binding.checkpointBlockHash)||! /^[0-9a-f]{64}$/.test(binding.feedDigest))) throw new Error('PUBLIC_PRODUCT_CANONICAL_CONTRADICTION');
  const expectedZero={...expected.crew[0]!,status:available?PublicStage.LIVE:PublicStage.UNVERIFIED,actionAvailable:available,
    description:available?crewMapping[0]!.description:expected.crew[0]!.description};
  if(canonicalJson(zero)!==canonicalJson(expectedZero)||!(available?['FRESH_VERIFIED','STALE_VERIFIED']:['UNVERIFIED']).includes(publicProduct.runtimeFreshness)) throw new Error('PUBLIC_PRODUCT_CANONICAL_CONTRADICTION');
  const watch=publicProduct.currentWatch;
  if(!watch||!['PRIVATE_TESTER','UNVERIFIED'].includes(watch.audience)||watch.subject!==expected.currentWatch.subject||
     watch.recurrence!==expected.currentWatch.recurrence||watch.employmentAvailable!==false) throw new Error('PUBLIC_PRODUCT_CANONICAL_CONTRADICTION');
  return publicProduct;
}
function obj(value:unknown):Record<string,unknown> { return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}; }
function wallet(value:unknown):string|null { return typeof value==='string'&&/^0x[0-9a-fA-F]{40}$/.test(value)?value:null; }
async function snifferProof(evidence:unknown):Promise<string|null> {
  const source=obj(evidence), audit=obj(source.audit), handoff=obj(audit.handoff), funding=obj(audit.funding);
  if(source.auditSha256!=='3f242a4e230fe911c57256768d273496956b5d0114040c5346e65338e838ba5b'||
     audit.captureId!=='prospective-confirmation-20261006-v1'||audit.phase!=='EXHAUSTED'||audit.reason!=='ORIGIN_RPC_BUDGET_EXHAUSTED'||
     audit.finding!==null||audit.caseDiff!==null||audit.notification!==null||handoff.fromRat!=='SNIFFER'||handoff.toRat!=='RAT_ZERO'||
     handoff.fundingTx!==funding.hash||handoff.recipient!==funding.to||!Array.isArray(handoff.evidenceSequences)||handoff.evidenceSequences.length===0) return null;
  const {digest,...material}=handoff;
  return typeof digest==='string'&&digest==='9858429dfac8fcc5420eaedf1bf16ca06be22d5b2c8b8565cb459b0ef3911946'&&await sha256Hex(material)===digest?digest:null;
}
export async function projectPublicProduct(input:{manifest:CapabilityManifest;snapshot:PublishedPublicSnapshot|null;status:Record<string,unknown>|null;
  watchRuntime?:{enabled:boolean;publicEnabled:boolean;allowedUserId?:string};research?:unknown;nowMs?:number}):Promise<PublicProduct> {
  const {manifest,snapshot,status}=input, root=obj(manifest), caps=manifest.capabilities;
  let snapshotBinding:PublicProduct['snapshotBinding']=null;
  if(snapshot&&status&&verifiedStatusContract(status)) {
    try {
      const canonical=await buildPublicSnapshot(snapshot);
      if(canonical.feedDigest===snapshot.feedDigest&&status.chainId===snapshot.chainId&&status.checkpointBlock===snapshot.sourceCheckpoint&&
         status.checkpointBlockHash===snapshot.checkpointBlockHash&&status.feedDigest===snapshot.feedDigest) {
        snapshotBinding={chainId:snapshot.chainId,checkpointBlock:snapshot.sourceCheckpoint,checkpointBlockHash:snapshot.checkpointBlockHash,feedDigest:snapshot.feedDigest};
      }
    } catch { /* Unsupported evidence remains unavailable. */ }
  }
  const current=obj(root.currentPonsLaunchConfiguration), plan=obj(root.currentLaunchPlan);
  const ponsAuthority=current.chainId===4663&&plan.chainId===4663&&current.authorityScope==='CURRENT_PONS_V1_PRELAUNCH';
  const holder=obj(caps.holderGateV0);
  const workingSupported=ponsAuthority&&current.stakingRequired===true&&current.workingRatStatus===WORKING_RAT_SELECTION.workingRatStatus&&
    current.productionEntitlementActive===false&&holder.productionHolderEligibilityActive===false&&holder.walletAuthStatus==='DISABLED_BY_DEFAULT'&&
    (root.productionEntitlementActive===undefined||root.productionEntitlementActive===false)&&(root.workingRatStatus===undefined||root.workingRatStatus===WORKING_RAT_SELECTION.workingRatStatus);
  const den=caps.ratDenV0, watch=caps.ratWatchV0;
  const handoff=await snifferProof(input.research===undefined?researchEvidence:input.research);
  const stages:Record<string,PublicProductStage>={
    'rat-zero':snapshotBinding?PublicStage.LIVE:PublicStage.UNVERIFIED,
    tripwire:watch?.engineeringStatus==='ENGINEERING_PASS'?PublicStage.BUILDING:PublicStage.UNVERIFIED,
    sniffer:handoff?PublicStage.PROVING:PublicStage.UNVERIFIED,
    'working-rat':workingSupported?PublicStage.PLANNED:PublicStage.UNVERIFIED,
    den:den?.engineeringStatus==='PLANNED'&&den.phase==='POST_LAUNCH'&&den.publicStatus==='NOT_PUBLIC_LIVE_AUTHORIZED'?PublicStage.PLANNED:PublicStage.UNVERIFIED,
    'locked-1':PublicStage.LOCKED,'locked-2':PublicStage.LOCKED,
  };
  const now=input.nowMs??Date.now();
  const runtimeFreshness=snapshotBinding ? status?.state==='FRESH_VERIFIED'&&Number(status.verifiedAtMs)<=now&&Number(status.runtimeUpdatedAtMs)<=now&&typeof status.freshnessValidUntilMs==='number'&&status.freshnessValidUntilMs>now
    ? 'FRESH_VERIFIED':'STALE_VERIFIED' : 'UNVERIFIED';
  return {schemaVersion:PUBLIC_PRODUCT_SCHEMA,mappingRevision:PUBLIC_PRODUCT_MAPPING_REVISION,manifestDigest:await sha256Hex(manifest),snapshotBinding,runtimeFreshness,
    crew:crewMapping.map(rat=>({...rat,description:stages[rat.id]===PublicStage.UNVERIFIED?'Canonical evidence is unavailable. No current capability is established.':rat.description,status:stages[rat.id]!,phase:['den','working-rat'].includes(rat.id)?'POST_LAUNCH':null,
      actionAvailable:rat.id==='rat-zero'&&snapshotBinding!==null})),
    currentAuthority:{chainId:4663,status:ponsAuthority?'CANONICAL_PONS_SCOPE':'UNVERIFIED',treasuryAddress:ponsAuthority?wallet(current.treasuryAddress):null,
      launchWalletAddress:ponsAuthority?wallet(current.launchWalletAddress):null,creatorFeeRecipientAddress:ponsAuthority?wallet(current.creatorFeeRecipientAddress):null},
    launchState:{status:ponsAuthority?manifest.launchAuthorization.status:'UNVERIFIED',tokenState:ponsAuthority?manifest.launchAuthorization.tokenState??'UNVERIFIED':'UNVERIFIED',
      marketingAuthorized:ponsAuthority&&manifest.launchAuthorization.marketingAuthorized,launchAuthorized:ponsAuthority&&manifest.launchAuthorization.launchAuthorized},
    currentWatch:{audience:input.watchRuntime?.enabled===true&&input.watchRuntime.publicEnabled===false&&/^[1-9][0-9]*$/.test(input.watchRuntime.allowedUserId??'')?'PRIVATE_TESTER':'UNVERIFIED',subject:'EXACT_INDEXED_PONS_REPORTED_DEPLOYER',
      recurrence:'FUTURE_INDEXED_LAUNCH_FROM_THE_SAME_REPORTED_DEPLOYER',employmentAvailable:false},
    workingRat:{...WORKING_RAT_SELECTION,workingRatStatus:stages['working-rat']!,productionEntitlementActive:workingSupported?false:null},
    todayJourney:['DISCOVER','OPEN CASE','CHECK RECEIPTS'],futureWorkforceLoop:['FIND','EMPLOY','LEAVE','RETURN'],
    roadmap:['SNIFF','REMEMBER','WATCH','HUNT','ORGANIZE','AUTONOMOUS RAT'],
    evidence:{snifferAuditSha256:handoff?'3f242a4e230fe911c57256768d273496956b5d0114040c5346e65338e838ba5b':null,snifferHandoffDigest:handoff} };
}
