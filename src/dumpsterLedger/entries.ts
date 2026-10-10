import type { Hex } from '../core/types.js';
import { sha256Hex } from '../evidence/canonical.js';
import type { CanonicalFundingConfig } from './config.js';

export const DUMPSTER_LEDGER_ENTRY_SCHEMA_VERSION = 'binrat.dumpster-ledger-entry/0.1' as const;

export type LedgerDirection = 'INFLOW' | 'OUTFLOW';
export type FundingRole = 'CREATOR_FEE' | 'TREASURY' | 'PROJECT_EXPENSE' | 'OTHER_DISCLOSED';
export type LedgerCategory =
  | 'CREATOR_FEE_RECEIPT'
  | 'TREASURY_FUNDING'
  | 'PROJECT_EXPENSE'
  | 'OTHER_DISCLOSED'
  | 'UNCATEGORIZED';
export type LedgerAssetType = 'NATIVE' | 'ERC20';

export interface DumpsterLedgerEntryInput {
  chainId: number;
  blockNumber: bigint;
  blockHash: Hex;
  transactionHash: Hex;
  logIndex: number;
  from: Hex;
  to: Hex;
  assetType: LedgerAssetType;
  tokenAddress: Hex | null;
  amountRaw: string;
  category: LedgerCategory;
  direction: LedgerDirection;
  fundingRole: FundingRole;
}

export interface DumpsterLedgerEntry {
  schemaVersion: typeof DUMPSTER_LEDGER_ENTRY_SCHEMA_VERSION;
  entryId: string;
  chainId: number;
  blockNumber: string;
  blockHash: Hex;
  transactionHash: Hex;
  logIndex: number;
  from: Hex;
  to: Hex;
  assetType: LedgerAssetType;
  tokenAddress: Hex | null;
  amountRaw: string;
  category: LedgerCategory;
  direction: LedgerDirection;
  fundingRole: FundingRole;
  configVersion: string;
  categoryPolicyVersion: string;
  evidenceDigest: string;
}

export async function buildDumpsterLedgerEntry(
  config: CanonicalFundingConfig,
  input: DumpsterLedgerEntryInput
): Promise<DumpsterLedgerEntry> {
  validateEntryInput(config, input);
  const identity = {
    schemaVersion: DUMPSTER_LEDGER_ENTRY_SCHEMA_VERSION,
    chainId: input.chainId,
    transactionHash: input.transactionHash.toLowerCase(),
    logIndex: input.logIndex
  };
  const normalized = {
    schemaVersion: DUMPSTER_LEDGER_ENTRY_SCHEMA_VERSION,
    entryId: `binrat-ledger:${await sha256Hex(identity)}`,
    chainId: input.chainId,
    blockNumber: input.blockNumber.toString(),
    blockHash: input.blockHash.toLowerCase() as Hex,
    transactionHash: input.transactionHash.toLowerCase() as Hex,
    logIndex: input.logIndex,
    from: input.from.toLowerCase() as Hex,
    to: input.to.toLowerCase() as Hex,
    assetType: input.assetType,
    tokenAddress: input.tokenAddress?.toLowerCase() as Hex | null,
    amountRaw: input.amountRaw,
    category: input.category,
    direction: input.direction,
    fundingRole: input.fundingRole,
    configVersion: config.configVersion,
    categoryPolicyVersion: config.categoryPolicyVersion
  };
  const entry = {
    ...normalized,
    evidenceDigest: await sha256Hex(normalized)
  };
  return Object.freeze(entry);
}

export async function normalizeDumpsterLedgerEntries(
  config: CanonicalFundingConfig,
  values: readonly DumpsterLedgerEntry[]
): Promise<DumpsterLedgerEntry[]> {
  const byId = new Map<string, DumpsterLedgerEntry>();
  for (const value of values) {
    const rebuilt = await buildDumpsterLedgerEntry(config, {
      chainId: value.chainId,
      blockNumber: BigInt(value.blockNumber),
      blockHash: value.blockHash,
      transactionHash: value.transactionHash,
      logIndex: value.logIndex,
      from: value.from,
      to: value.to,
      assetType: value.assetType,
      tokenAddress: value.tokenAddress,
      amountRaw: value.amountRaw,
      category: value.category,
      direction: value.direction,
      fundingRole: value.fundingRole
    });
    if (
      rebuilt.entryId !== value.entryId ||
      rebuilt.evidenceDigest !== value.evidenceDigest ||
      rebuilt.configVersion !== value.configVersion ||
      rebuilt.categoryPolicyVersion !== value.categoryPolicyVersion
    ) throw new Error(`DUMPSTER_LEDGER_ENTRY_INTEGRITY_MISMATCH:${value.entryId}`);
    const prior = byId.get(rebuilt.entryId);
    if (prior && prior.evidenceDigest !== rebuilt.evidenceDigest) {
      throw new Error(`DUMPSTER_LEDGER_ENTRY_CONFLICT:${value.entryId}`);
    }
    if (!prior) byId.set(rebuilt.entryId, rebuilt);
  }
  return [...byId.values()].sort((a, b) => (
    compareBigInt(a.blockNumber, b.blockNumber) ||
    a.logIndex - b.logIndex ||
    a.entryId.localeCompare(b.entryId)
  ));
}

function validateEntryInput(config: CanonicalFundingConfig, input: DumpsterLedgerEntryInput): void {
  if (input.chainId !== config.chainId) throw new Error('DUMPSTER_LEDGER_CHAIN_MISMATCH');
  if (input.blockNumber < BigInt(config.effectiveFromBlock)) {
    throw new Error('DUMPSTER_LEDGER_BEFORE_AUTHORITY');
  }
  if (
    !/^0x[0-9a-fA-F]{64}$/.test(input.blockHash) ||
    !/^0x[0-9a-fA-F]{64}$/.test(input.transactionHash) ||
    !/^0x[0-9a-fA-F]{40}$/.test(input.from) ||
    !/^0x[0-9a-fA-F]{40}$/.test(input.to) ||
    !Number.isSafeInteger(input.logIndex) ||
    input.logIndex < 0 ||
    !['NATIVE', 'ERC20'].includes(input.assetType) ||
    !/^(0|[1-9][0-9]*)$/.test(input.amountRaw)
  ) throw new Error('DUMPSTER_LEDGER_ENTRY_INVALID');
  if (
    (input.assetType === 'ERC20' && input.tokenAddress?.toLowerCase() !== config.tokenAddress) ||
    (input.assetType === 'NATIVE' && input.tokenAddress !== null)
  ) throw new Error('DUMPSTER_LEDGER_ASSET_AUTHORITY_MISMATCH');

  const from = input.from.toLowerCase();
  const to = input.to.toLowerCase();
  const feeRecipients = new Set(config.creatorFeeRecipients);
  const treasuries = new Set(config.treasuryAddresses);
  const fundingAuthorities = new Set([...feeRecipients, ...treasuries]);
  const authorityValid =
    (input.direction === 'INFLOW' && input.fundingRole === 'CREATOR_FEE' && feeRecipients.has(to as Hex)) ||
    (input.direction === 'INFLOW' && input.fundingRole === 'TREASURY' && treasuries.has(to as Hex)) ||
    (input.direction === 'OUTFLOW' &&
      (input.fundingRole === 'PROJECT_EXPENSE' || input.fundingRole === 'OTHER_DISCLOSED') &&
      treasuries.has(from as Hex));
  if (!authorityValid) throw new Error('DUMPSTER_LEDGER_FUNDING_AUTHORITY_MISMATCH');
  if (
    (input.direction === 'INFLOW' && fundingAuthorities.has(from as Hex)) ||
    (input.direction === 'OUTFLOW' && fundingAuthorities.has(to as Hex))
  ) {
    // Moving value between declared project wallets is neither money in nor money
    // out. V0 rejects it rather than booking both sides or guessing its purpose.
    throw new Error('DUMPSTER_LEDGER_INTERNAL_TRANSFER_UNCLASSIFIED');
  }

  const expectedCategory: Record<FundingRole, LedgerCategory> = {
    CREATOR_FEE: 'CREATOR_FEE_RECEIPT',
    TREASURY: 'TREASURY_FUNDING',
    PROJECT_EXPENSE: 'PROJECT_EXPENSE',
    OTHER_DISCLOSED: 'OTHER_DISCLOSED'
  };
  if (input.category !== 'UNCATEGORIZED' && input.category !== expectedCategory[input.fundingRole]) {
    throw new Error('DUMPSTER_LEDGER_CATEGORY_AUTHORITY_MISMATCH');
  }
}

function compareBigInt(left: string, right: string): number {
  const a = BigInt(left);
  const b = BigInt(right);
  return a === b ? 0 : a < b ? -1 : 1;
}
