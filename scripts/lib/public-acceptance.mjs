import { createHash } from 'node:crypto';
import { canonicalJson, canonicalSnapshotDigest } from '../../web/snapshot-contract.js';
import { validatePublicStatus } from '../../web/read-plane.js';
import { validatePublicProduct } from '../../web/product-contract.js';

const requireTruth = (condition, code) => { if (!condition) throw new Error(code); };
const hash = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
export function resolvedObservationCadence(semantics) {
  for (const key of ['publicationIntervalMs','statusCacheTtlMs','feedSharedCacheTtlMs','maxStatusAgeMs'])
    requireTruth(Number.isSafeInteger(semantics?.[key]) && semantics[key] > 0, 'RUNTIME_CADENCE_UNVERIFIED');
  const intervalMs=Math.max(semantics.publicationIntervalMs,semantics.statusCacheTtlMs,semantics.feedSharedCacheTtlMs)+1000;
  requireTruth(intervalMs<semantics.maxStatusAgeMs,'RUNTIME_CADENCE_EXCEEDS_FRESHNESS');
  return intervalMs;
}
export function assertDeploymentProvenance({reviewedSha,artifact,provider,health,marker,observedHeaders}) {
  requireTruth(/^[0-9a-f]{40}$/.test(reviewedSha),'REVIEWED_SOURCE_UNVERIFIED');
  const release=artifact?.release;
  requireTruth(release?.sourceClean===true && release.sourceSha===reviewedSha && /^[0-9a-f]{64}$/.test(artifact.workerSha256),'BUILT_ARTIFACT_UNVERIFIED');
  const {buildId,...material}=release;
  requireTruth(buildId===hash(material),'BUILD_ID_INVALID');
  requireTruth(hash(marker)===hash(release),'STATIC_RELEASE_MISMATCH');
  requireTruth(provider?.sourceSha===reviewedSha && provider.workerSha256===artifact.workerSha256 && provider.buildId===buildId && provider.assetsDigest===release.assetsDigest,
    'UPLOADED_ARTIFACT_UNVERIFIED');
  requireTruth(provider.readbackSource==='CLOUDFLARE_READ_ONLY' && typeof provider.workerName==='string' &&
    /^[0-9a-f-]{36}$/.test(provider.workerRevisionId) && provider.activeVersions?.length===1 &&
    provider.activeVersions[0].id===provider.workerRevisionId && provider.activeVersions[0].percentage===100,'DEPLOYED_REVISION_UNVERIFIED');
  requireTruth(health.release?.workerRevisionId===provider.workerRevisionId && health.release?.buildId===buildId &&
    health.release?.sourceBinding==='BOUND' && health.release?.observedManifestDigest===release.manifestDigest &&
    health.release?.effectiveMaxStatusAgeMs===provider.runtimeSemantics?.maxStatusAgeMs,'OBSERVED_RELEASE_UNVERIFIED');
  requireTruth(observedHeaders.every(headers=>headers['x-binrat-build-id']===buildId&&headers['x-binrat-source-sha']===reviewedSha),
    'PUBLIC_RESPONSE_RELEASE_MISMATCH');
  resolvedObservationCadence(provider.runtimeSemantics);
  return buildId;
}
export async function assertBoundPublication(status,feed,nowMs) {
  validatePublicStatus(status);
  requireTruth(status.state==='FRESH_VERIFIED' && status.verifiedAtMs<=nowMs && status.runtimeUpdatedAtMs<=nowMs &&
    status.freshnessValidUntilMs>nowMs,'PUBLICATION_NOT_FRESH');
  requireTruth(feed.schemaVersion==='binrat.latest-launches/0.1' && feed.chainId===4663 && status.chainId===feed.chainId &&
    status.checkpointBlock===feed.sourceCheckpoint && status.checkpointBlockHash===feed.checkpointBlockHash &&
    status.feedDigest===feed.feedDigest && feed.feedDigest===await canonicalSnapshotDigest(feed),'PUBLICATION_BINDING_INVALID');
}
export async function assertIndependentPublications(first,second,semantics) {
  await assertBoundPublication(first.status,first.feed,first.observedAtMs);
  await assertBoundPublication(second.status,second.feed,second.observedAtMs);
  requireTruth(second.observedAtMs-first.observedAtMs>=resolvedObservationCadence(semantics),'OBSERVATIONS_TOO_CLOSE');
  requireTruth(second.status.publicationVersion>first.status.publicationVersion && second.status.verifiedAtMs>first.status.verifiedAtMs,
    'CACHED_SUCCESS_IS_NOT_TWO_PUBLICATIONS');
  requireTruth(BigInt(second.status.checkpointBlock)>=BigInt(first.status.checkpointBlock),'PUBLICATION_CHECKPOINT_REGRESSION');
  if(second.status.checkpointBlock===first.status.checkpointBlock) requireTruth(second.status.checkpointBlockHash===first.status.checkpointBlockHash &&
    second.status.feedDigest===first.status.feedDigest,'PUBLICATION_CHECKPOINT_CONFLICT');
}
export function assertPublicTruth({capabilities,customerText,funding}) {
  const product=validatePublicProduct(capabilities.publicProduct);
  requireTruth(product.currentAuthority.chainId===4663 && !capabilities.launchConfiguration,'CURRENT_ARC_AUTHORITY_PRESENT');
  if(capabilities.historicalArcLaunchConfiguration) requireTruth(/HISTORICAL/.test(capabilities.historicalArcLaunchConfiguration.authorityScope),
    'HISTORICAL_ARC_UNLABELLED');
  const stages=Object.fromEntries(product.crew.map(rat=>[rat.id,rat.status]));
  requireTruth(stages['rat-zero']==='LIVE' && stages.tripwire==='BUILDING' && stages.sniffer==='PROVING' &&
    stages['working-rat']==='PLANNED' && stages.den==='PLANNED' && stages['locked-1']==='LOCKED' && stages['locked-2']==='LOCKED',
    'PUBLIC_CREW_UNVERIFIED');
  requireTruth(product.workingRat.productionEntitlementActive===false && product.currentWatch.employmentAvailable===false &&
    product.crew.filter(rat=>rat.actionAvailable).every(rat=>rat.id==='rat-zero'),'PUBLIC_EMPLOYMENT_PRESENT');
  requireTruth(funding.chainId===4663 && funding.authorityScope==='CURRENT_PONS' && funding.accountingActive===false &&
    funding.entries.length===0 && funding.totals===null,'CURRENT_FUNDING_PROJECTION_INVALID');
  requireTruth(hash(funding.configuredAuthorities)===hash(product.currentAuthority),'WALLET_PROJECTION_DRIFT');
  for(const old of ['0xab063a9b53a2ab832a941ae5890ea05c1672339d','0xba5ee49734b50cf62d0b538584fbac0effb79866'])
    requireTruth(!canonicalJson(product.currentAuthority).toLowerCase().includes(old),'HISTORICAL_WALLET_PROJECTED_CURRENT');
  for(const pattern of [/\b5042\b/i,/\bArcPad\b/i,/\bHOLDER\b/i,/\bPRO\b/,/Rat Credits/i,/Sniffer\s*(?:·\s*)?NEXT/i,
    /(?:THE\s+)?DEN\s*(?:·\s*)?BUILDING/i,/Intelligence V1/i,/Dumpster Ledger/i,/Rat Den V0/i,/Rat Watch V0/i,/START TRIPWIRE/i])
    requireTruth(!pattern.test(customerText),'PUBLIC_CUSTOMER_LANGUAGE_DRIFT:'+pattern.source);
  requireTruth(/Future workforce (?:direction|loop)/i.test(customerText)&&/DISCOVER\s*→\s*OPEN CASE\s*→\s*CHECK RECEIPTS/i.test(customerText),
    'PUBLIC_JOURNEY_BOUNDARY_MISSING');
}
