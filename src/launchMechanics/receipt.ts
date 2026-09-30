import { getAddress, isAddress } from 'viem';
import { sha256Hex } from '../evidence/canonical.js';

export const LAUNCH_MECHANICS_SCHEMA_VERSION = 'binrat.launch-mechanics-verification/0.1' as const;
export const EVIDENCE_CLASSES = ['ON_CHAIN_VERIFIED', 'SOURCE_VERIFIED', 'PLATFORM_CLAIM'] as const;

export type LaunchMechanicsEvidenceClass = typeof EVIDENCE_CLASSES[number];

export interface LaunchMechanicsClaim {
  claimId: string;
  status: 'VERIFIED' | 'PARTIAL';
  evidenceClass: LaunchMechanicsEvidenceClass;
  value: unknown;
  evidenceRefs: readonly string[];
  qualification?: string;
}

export interface LaunchMechanicsReceipt {
  schemaVersion: typeof LAUNCH_MECHANICS_SCHEMA_VERSION;
  verifiedAt: string;
  chainId: number;
  receiptDigest: string;
  [key: string]: unknown;
}

export async function validateLaunchMechanicsReceipt(value: unknown): Promise<LaunchMechanicsReceipt> {
  if (!isRecord(value)) throw new Error('LAUNCH_MECHANICS_RECEIPT_INVALID');
  if (value.schemaVersion !== LAUNCH_MECHANICS_SCHEMA_VERSION) {
    throw new Error('LAUNCH_MECHANICS_SCHEMA_INVALID');
  }
  if (value.chainId !== 5042) throw new Error('LAUNCH_MECHANICS_CHAIN_INVALID');
  if (typeof value.verifiedAt !== 'string' || !isIsoInstant(value.verifiedAt)) {
    throw new Error('LAUNCH_MECHANICS_VERIFIED_AT_INVALID');
  }
  if (typeof value.receiptDigest !== 'string' || !/^[0-9a-f]{64}$/.test(value.receiptDigest)) {
    throw new Error('LAUNCH_MECHANICS_DIGEST_INVALID');
  }

  const sourceIds = validateSources(value.sources);
  validateNode(value, [], sourceIds);
  validateAuthorityUniqueness(value);
  validateLaunchAuthority(value.launchAuthority);

  const actualDigest = await deriveLaunchMechanicsReceiptDigest(value);
  if (actualDigest !== value.receiptDigest) throw new Error('LAUNCH_MECHANICS_DIGEST_MISMATCH');
  return value as LaunchMechanicsReceipt;
}

export async function deriveLaunchMechanicsReceiptDigest(value: unknown): Promise<string> {
  if (!isRecord(value)) throw new Error('LAUNCH_MECHANICS_RECEIPT_INVALID');
  const { receiptDigest: _receiptDigest, ...material } = value;
  return sha256Hex(material);
}

function validateSources(value: unknown): Set<string> {
  if (!Array.isArray(value) || value.length === 0) throw new Error('LAUNCH_MECHANICS_SOURCES_INVALID');
  const ids = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || !/^[a-z0-9_.-]{3,100}$/.test(item.id)) {
      throw new Error('LAUNCH_MECHANICS_SOURCE_INVALID');
    }
    if (ids.has(item.id)) throw new Error('LAUNCH_MECHANICS_SOURCE_DUPLICATE');
    if (typeof item.url !== 'string' || !/^https:\/\//.test(item.url)) {
      throw new Error('LAUNCH_MECHANICS_SOURCE_URL_INVALID');
    }
    if (typeof item.retrievedAt !== 'string' || !isIsoInstant(item.retrievedAt)) {
      throw new Error('LAUNCH_MECHANICS_SOURCE_TIME_INVALID');
    }
    ids.add(item.id);
  }
  return ids;
}

function validateNode(value: unknown, path: readonly string[], sourceIds: ReadonlySet<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNode(item, [...path, String(index)], sourceIds));
    return;
  }
  if (!isRecord(value)) return;

  if ('claimId' in value) validateClaim(value, sourceIds);
  if ('unresolvedId' in value) {
    if (value.status !== 'UNRESOLVED' || 'evidenceClass' in value || 'verified' in value) {
      throw new Error('LAUNCH_MECHANICS_UNRESOLVED_RENDERED_AS_VERIFIED');
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (/address$/i.test(key) && child !== null) validateAddress(child);
    if (/addresses$/i.test(key) && child !== null) {
      if (!Array.isArray(child)) throw new Error('LAUNCH_MECHANICS_ADDRESSES_INVALID');
      child.forEach(validateAddress);
    }
    validateNode(child, [...path, key], sourceIds);
  }
}

function validateClaim(value: Record<string, unknown>, sourceIds: ReadonlySet<string>): void {
  if (typeof value.claimId !== 'string' || !/^[a-z0-9_.-]{3,120}$/.test(value.claimId)) {
    throw new Error('LAUNCH_MECHANICS_CLAIM_ID_INVALID');
  }
  if (value.status !== 'VERIFIED' && value.status !== 'PARTIAL') {
    throw new Error('LAUNCH_MECHANICS_CLAIM_STATUS_INVALID');
  }
  if (!EVIDENCE_CLASSES.includes(value.evidenceClass as LaunchMechanicsEvidenceClass)) {
    throw new Error('LAUNCH_MECHANICS_EVIDENCE_CLASS_REQUIRED');
  }
  if (!Array.isArray(value.evidenceRefs) || value.evidenceRefs.length === 0) {
    throw new Error('LAUNCH_MECHANICS_EVIDENCE_REFS_REQUIRED');
  }
  for (const ref of value.evidenceRefs) {
    if (typeof ref !== 'string' || !sourceIds.has(ref)) {
      throw new Error('LAUNCH_MECHANICS_EVIDENCE_REF_UNKNOWN');
    }
  }
  if (value.value === undefined) throw new Error('LAUNCH_MECHANICS_CLAIM_VALUE_REQUIRED');
}

function validateAuthorityUniqueness(value: Record<string, unknown>): void {
  const rail = record(value.launchRail);
  const selected = record(rail.selectedVariant);
  const authority = record(selected.authority);
  const addresses = [authority.launcherAddress, authority.lockerAddress, authority.tokenFactoryAddress];
  const normalized = addresses.map(normalizedAddress);
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('LAUNCH_MECHANICS_AUTHORITY_ADDRESS_AMBIGUOUS');
  }

  const dumpster = record(value.dumpsterLedgerHandoff);
  const fee = nullableNormalizedAddress(dumpster.feeRecipientAddress);
  const treasury = nullableNormalizedAddress(dumpster.treasuryAddress);
  if (fee && treasury && fee === treasury) throw new Error('LAUNCH_MECHANICS_HANDOFF_AUTHORITY_AMBIGUOUS');
}

function validateLaunchAuthority(value: unknown): void {
  const authority = record(value);
  if (
    authority.launchAuthorization !== 'BLOCKED' ||
    authority.marketingAuthorized !== false ||
    authority.tokenState !== 'NOT_LAUNCHED' ||
    authority.receiptAuthorizesLaunch !== false
  ) throw new Error('LAUNCH_MECHANICS_AUTHORIZATION_ESCALATION');
}

function validateAddress(value: unknown): void {
  normalizedAddress(value);
}

function normalizedAddress(value: unknown): string {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) {
    throw new Error('LAUNCH_MECHANICS_ADDRESS_INVALID');
  }
  const normalized = getAddress(value).toLowerCase();
  if (normalized === '0x0000000000000000000000000000000000000000') {
    throw new Error('LAUNCH_MECHANICS_ADDRESS_INVALID');
  }
  return normalized;
}

function nullableNormalizedAddress(value: unknown): string | null {
  return value === null || value === undefined ? null : normalizedAddress(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('LAUNCH_MECHANICS_RECEIPT_INVALID');
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isIsoInstant(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && !Number.isNaN(Date.parse(value));
}
