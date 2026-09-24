import { PONS_SELECTED_FACTORY, validatePonsSuccessorCandidate } from './ponsCutover.js';

export const PONS_DISCOVERY_SCHEMA = 'binrat.pons-discovery/1' as const;
export const PONS_DISCOVERY_SOURCE = 'docs/PONS_DISCOVERY_CANDIDATE_V1.json' as const;
export const VERIFIED_BINRAT_GITHUB = 'https://github.com/CipherCuttle/binrat' as const;
export const PONS_DISCOVERY_CANDIDATE_STATUS = 'DRAFT_NOT_PUBLISHABLE' as const;

function record(value: unknown, error: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(error);
  return value as Record<string, any>;
}
function exact(value: Record<string, any>, keys: readonly string[], error: string): void {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    throw new Error(error);
  }
}

const DESCRIPTION = "A dumpster-rat meme with a real launch-evidence research product. BINRAT's existing Creator Files, Replay, Radar and Watch examine Arc launches with public receipts. The intended token is a separate, not-yet-launched Pons V2 candidate on Robinhood Chain. No token-safety certification or investment promise.";
const CANDIDATE_TG = 'https://t.me/BinratBot' as const;

export interface PonsDiscoveryManifest {
  schemaVersion: typeof PONS_DISCOVERY_SCHEMA;
  status: typeof PONS_DISCOVERY_CANDIDATE_STATUS;
  source: typeof PONS_DISCOVERY_SOURCE;
  tokenChainId: 4663;
  researchChainId: 5042;
  officialWebsite: null;
  officialTelegram: null;
  officialX: null;
  verifiedGithub: typeof VERIFIED_BINRAT_GITHUB;
  tokenAddress: null;
  ponsListingUrl: null;
  metadataPublishAuthorized: false;
}

const MANIFEST_KEYS = [
  'schemaVersion','status','source','tokenChainId','researchChainId',
  'officialWebsite','officialTelegram','officialX','verifiedGithub',
  'tokenAddress','ponsListingUrl','metadataPublishAuthorized'
] as const;

export function validatePonsDiscoveryManifest(
  value: unknown,
  successor: unknown
): PonsDiscoveryManifest {
  const m=record(value,'PONS_DISCOVERY_MANIFEST_MISSING');
  exact(m,MANIFEST_KEYS,'PONS_DISCOVERY_MANIFEST_UNEXPECTED_FIELDS');
  const s=validatePonsSuccessorCandidate(successor);
  if (
    m.schemaVersion!==PONS_DISCOVERY_SCHEMA ||
    m.status!==PONS_DISCOVERY_CANDIDATE_STATUS ||
    m.source!==PONS_DISCOVERY_SOURCE ||
    m.tokenChainId!==s.tokenChainId ||
    m.researchChainId!==s.researchChainId ||
    m.officialWebsite!==null ||
    m.officialTelegram!==null ||
    m.officialX!==null ||
    m.verifiedGithub!==VERIFIED_BINRAT_GITHUB ||
    m.tokenAddress!==null ||
    m.ponsListingUrl!==null ||
    m.metadataPublishAuthorized!==false
  ) throw new Error('PONS_DISCOVERY_MANIFEST_AUTHORITY_ESCALATION');
  return m as PonsDiscoveryManifest;
}

export interface PonsDiscoveryDraft {
  schemaVersion: typeof PONS_DISCOVERY_SCHEMA;
  status: typeof PONS_DISCOVERY_CANDIDATE_STATUS;
  identity: {name:'BINRAT';symbol:'BINRAT';description:typeof DESCRIPTION;logoUrl:null};
  token: {chainId:4663;rail:'PONS_V2_DIRECT_FACTORY';factory:typeof PONS_SELECTED_FACTORY;
    tokenAddress:null;launchTransaction:null;ponsListingUrl:null};
  research: {chainId:5042;coverage:'ARC_RESEARCH_ONLY';ponsLaunchIndexingStatus:'NOT_VERIFIED'};
  destinations: {officialWebsite:null;officialTelegram:null;officialX:null;officialDiscord:null;
    officialFarcaster:null;verifiedGithub:typeof VERIFIED_BINRAT_GITHUB;
    telegramCandidate:typeof CANDIDATE_TG;
    telegramCandidateStatus:'USER_REPORTED_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED'};
  proof: {websiteControl:'NOT_VERIFIED';telegramControl:'NOT_VERIFIED';xControl:'NOT_VERIFIED';
    logoApproval:'NOT_APPROVED';ponsDeployerCustody:'NOT_VERIFIED';
    ponsFeeRecipientCustody:'NOT_VERIFIED';ponsTreasuryCustody:'NOT_VERIFIED';
    readOnlyPonsMechanics:{source:'docs/PONS_LAUNCH_READINESS_V0.md';observedOn:'2026-09-22';
      historicBlock:'69767635';freshReadRequired:true;currentStateVerified:false}};
  authority: {launchAuthorized:false;marketingAuthorized:false;metadataPublishAuthorized:false;
    contractPublished:false;holderEntitlementActive:false;fundingObserverActive:false};
}

export function validatePonsDiscoveryDraft(
  value: unknown,
  manifestDiscovery: unknown,
  successor: unknown
): PonsDiscoveryDraft {
  const d=record(value,'PONS_DISCOVERY_INVALID');
  exact(d,['schemaVersion','status','identity','token','research','destinations','proof','authority'],
    'PONS_DISCOVERY_UNEXPECTED_FIELDS');
  const manifest=validatePonsDiscoveryManifest(manifestDiscovery,successor);
  const i=record(d.identity,'PONS_DISCOVERY_IDENTITY_INVALID');
  const t=record(d.token,'PONS_DISCOVERY_TOKEN_INVALID');
  const r=record(d.research,'PONS_DISCOVERY_RESEARCH_INVALID');
  const links=record(d.destinations,'PONS_DISCOVERY_DESTINATIONS_INVALID');
  const proof=record(d.proof,'PONS_DISCOVERY_PROOF_INVALID');
  const receipt=record(proof.readOnlyPonsMechanics,'PONS_DISCOVERY_RECEIPT_INVALID');
  const auth=record(d.authority,'PONS_DISCOVERY_AUTHORITY_INVALID');
  exact(i,['name','symbol','description','logoUrl'],'PONS_DISCOVERY_IDENTITY_INVALID');
  exact(t,['chainId','rail','factory','tokenAddress','launchTransaction','ponsListingUrl'],
    'PONS_DISCOVERY_TOKEN_INVALID');
  exact(r,['chainId','coverage','ponsLaunchIndexingStatus'],'PONS_DISCOVERY_RESEARCH_INVALID');
  exact(links,['officialWebsite','officialTelegram','officialX','officialDiscord',
    'officialFarcaster','verifiedGithub','telegramCandidate','telegramCandidateStatus'],
  'PONS_DISCOVERY_DESTINATIONS_INVALID');
  exact(proof,['websiteControl','telegramControl','xControl','logoApproval','ponsDeployerCustody',
    'ponsFeeRecipientCustody','ponsTreasuryCustody','readOnlyPonsMechanics'],
  'PONS_DISCOVERY_PROOF_INVALID');
  exact(receipt,['source','observedOn','historicBlock','freshReadRequired','currentStateVerified'],
    'PONS_DISCOVERY_RECEIPT_INVALID');
  exact(auth,['launchAuthorized','marketingAuthorized','metadataPublishAuthorized',
    'contractPublished','holderEntitlementActive','fundingObserverActive'],
    'PONS_DISCOVERY_AUTHORITY_INVALID');
  if (
    d.schemaVersion!==manifest.schemaVersion ||
    d.status!==manifest.status ||
    i.name!=='BINRAT' || i.symbol!=='BINRAT' || i.description!==DESCRIPTION || i.logoUrl!==null ||
    t.chainId!==manifest.tokenChainId || t.rail!=='PONS_V2_DIRECT_FACTORY' ||
    t.factory!==PONS_SELECTED_FACTORY || t.tokenAddress!==manifest.tokenAddress ||
    t.launchTransaction!==null || t.ponsListingUrl!==manifest.ponsListingUrl ||
    r.chainId!==manifest.researchChainId || r.coverage!=='ARC_RESEARCH_ONLY' ||
    r.ponsLaunchIndexingStatus!=='NOT_VERIFIED' ||
    links.officialWebsite!==manifest.officialWebsite ||
    links.officialTelegram!==manifest.officialTelegram ||
    links.officialX!==manifest.officialX ||
    links.officialDiscord!==null || links.officialFarcaster!==null ||
    links.verifiedGithub!==manifest.verifiedGithub ||
    links.telegramCandidate!==CANDIDATE_TG ||
    links.telegramCandidateStatus!=='USER_REPORTED_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED' ||
    proof.websiteControl!=='NOT_VERIFIED' || proof.telegramControl!=='NOT_VERIFIED' ||
    proof.xControl!=='NOT_VERIFIED' || proof.logoApproval!=='NOT_APPROVED' ||
    proof.ponsDeployerCustody!=='NOT_VERIFIED' ||
    proof.ponsFeeRecipientCustody!=='NOT_VERIFIED' ||
    proof.ponsTreasuryCustody!=='NOT_VERIFIED' ||
    receipt.source!=='docs/PONS_LAUNCH_READINESS_V0.md' ||
    receipt.observedOn!=='2026-09-22' || receipt.historicBlock!=='69767635' ||
    receipt.freshReadRequired!==true || receipt.currentStateVerified!==false ||
    auth.launchAuthorized!==false || auth.marketingAuthorized!==false ||
    auth.metadataPublishAuthorized!==false || auth.contractPublished!==false ||
    auth.holderEntitlementActive!==false || auth.fundingObserverActive!==false
  ) throw new Error('PONS_DISCOVERY_FALSE_PUBLICATION_AUTHORITY');
  return d as PonsDiscoveryDraft;
}

/** Safe for internal editorial preview. Not a launchToken() parameter bundle. */
export function previewPonsListingMetadata(draft: PonsDiscoveryDraft) {
  return Object.freeze({
    name:draft.identity.name,
    symbol:draft.identity.symbol,
    description:draft.identity.description,
    logo:'',
    socials:Object.freeze({website:'',twitter:'',telegram:'',discord:'',farcaster:''}),
    publishable:false as const,
    launchAuthorized:false as const,
    blockers:Object.freeze([
      'TOKEN_NOT_LAUNCHED',
      'SITE_AND_SOCIAL_OWNERSHIP_NOT_VERIFIED',
      'LOGO_NOT_APPROVED',
      'FRESH_PONS_READ_ONLY_RECEIPT_REQUIRED',
      'PONS_WALLET_CUSTODY_UNVERIFIED',
      'LEGAL_AND_OWNER_MARKETING_AUTHORITY_REQUIRED'
    ])
  });
}
