import type { Address, Hex } from 'viem';
import { open, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { canonicalJson } from '../evidence/canonical.js';
import { assertDigest, requireCondition, seal, validatePonsLaunchManifest, type LaunchAssets, type PonsLaunchManifest } from './ponsLaunchManifest.js';
import { assertIssuedVerifiedReceipt, type VerifiedLaunchReceipt } from './ponsLaunchVerifier.js';

export interface PonsLaunchFacts {
  schemaVersion:'binrat.pons-launch-facts/1'; chainId:4663; verifiedLaunchState:'VERIFIED';
  manifestDigest:string; executionVerificationDigest:string; upstreamRiskDeclarationDigest:string;
  token:Address; curve:Address; vault:Address; transaction:Hex; blockNumber:string; blockHash:Hex;
  ponsFactory:Address; stakingFactory:Address; pair:'NATIVE_ETH'; assets:LaunchAssets;
  creatorTaxBps:0; buybackEnabled:false; openingBuyWei:'0'; roles:Record<string,Address>;
  economics:Record<string,string>; stakingConfiguration:PonsLaunchManifest['staking'];
  workingRatStatus:'PLANNED'; productionEntitlementActive:false; digest:string;
}
/** Artifact generation only. Codex 1 owns HTTP exposure and all public consumers. */
export async function generateLaunchFacts(manifest:PonsLaunchManifest,receipt:VerifiedLaunchReceipt):Promise<PonsLaunchFacts> {
  assertIssuedVerifiedReceipt(receipt);
  const m=await validatePonsLaunchManifest(manifest);
  await assertDigest(receipt);
  requireCondition(receipt.status === 'VERIFIED' && receipt.manifestDigest === m.digest && receipt.workingRatStatus === 'PLANNED' && receipt.productionEntitlementActive === false, 'FACTS_VERIFICATION_REQUIRED');
  return seal({schemaVersion:'binrat.pons-launch-facts/1' as const,chainId:4663 as const,verifiedLaunchState:'VERIFIED' as const,manifestDigest:m.digest,executionVerificationDigest:receipt.digest,upstreamRiskDeclarationDigest:m.upstreamRiskDeclarationDigest,token:receipt.token,curve:receipt.curve,vault:receipt.vault,transaction:receipt.transactionHash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,ponsFactory:m.contracts.ponsFactory.address,stakingFactory:m.contracts.stakingFactory.address,pair:'NATIVE_ETH' as const,assets:receipt.assets,creatorTaxBps:0 as const,buybackEnabled:false as const,openingBuyWei:'0' as const,roles:receipt.roles,economics:receipt.economics,stakingConfiguration:receipt.staking,workingRatStatus:'PLANNED' as const,productionEntitlementActive:false as const});
}
export async function validateLaunchFacts(facts:PonsLaunchFacts,manifest:PonsLaunchManifest,receipt:VerifiedLaunchReceipt):Promise<void> {
  await assertDigest(facts);
  const generated=await generateLaunchFacts(manifest,receipt);
  requireCondition(generated.digest === facts.digest, 'FACTS_MANIFEST_EXECUTION_MISMATCH');
}
/** Local write-once canonical artifact. It does not expose a route or publish anything. */
export async function persistLaunchFacts(path:string,manifest:PonsLaunchManifest,receipt:VerifiedLaunchReceipt):Promise<PonsLaunchFacts> {
  const facts=await generateLaunchFacts(manifest,receipt);
  let handle;
  try {handle=await open(path,'wx',0o600);}
  catch(error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const existing=JSON.parse(await readFile(path,'utf8')) as PonsLaunchFacts;
    await assertDigest(existing);
    requireCondition(existing.digest === facts.digest,'CANONICAL_FACTS_ALREADY_FROZEN');
    return existing;
  }
  try {await handle.writeFile(`${canonicalJson(facts)}\n`);await handle.sync();} finally {await handle.close();}
  const directory=await open(dirname(path),'r');try {await directory.sync();} finally {await directory.close();}
  return facts;
}
