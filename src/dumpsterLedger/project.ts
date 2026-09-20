import { sha256Hex } from '../evidence/canonical.js';
import type { CapabilityManifest, CapabilityState } from '../telegram/rat.js';
import type { FundingConfigResolution } from './config.js';
import {
  normalizeDumpsterLedgerEntries,
  type DumpsterLedgerEntry,
  type LedgerAssetType
} from './entries.js';

export const DUMPSTER_LEDGER_SCHEMA_VERSION = 'binrat.dumpster-ledger/0.1' as const;
export const DUMPSTER_LEDGER_PROJECTION_VERSION = 'BINRAT_DUMPSTER_LEDGER_V0' as const;

export interface PublicDumpsterLedger {
  schemaVersion: typeof DUMPSTER_LEDGER_SCHEMA_VERSION;
  projectionVersion: typeof DUMPSTER_LEDGER_PROJECTION_VERSION;
  accountingState: 'PRE_LAUNCH_NO_FUNDING_AUTHORITY' | 'FAIL_CLOSED' | 'TEST_FIXTURE';
  chainId: number;
  tokenState: string;
  launchAuthorization: string;
  marketingAuthorized: boolean;
  fundingAuthority: {
    status: FundingConfigResolution['status'];
    accountingEnabled: false;
    tokenAddress: string | null;
    creatorFeeRecipients: readonly string[];
    treasuryAddresses: readonly string[];
    effectiveFromBlock: string | null;
    configVersion: string | null;
    categoryPolicyVersion: string | null;
  };
  totals: {
    entryCount: number;
    inflowEntryCount: number;
    outflowEntryCount: number;
    tokenInflowsRaw: string;
    tokenOutflowsRaw: string;
    byAsset: Array<{
      assetType: LedgerAssetType;
      tokenAddress: string | null;
      entryCount: number;
      inflowRaw: string;
      outflowRaw: string;
    }>;
  };
  entries: Array<DumpsterLedgerEntry & {
    links: { transaction: null; from: null; to: null };
  }>;
  coverage: {
    status: 'NO_CANONICAL_FUNDING_AUTHORITY' | 'FAIL_CLOSED' | 'TEST_FIXTURE_ONLY';
    fromBlock: string | null;
    throughBlock: string | null;
  };
  utilityStatus: {
    source: 'CAPABILITY_MANIFEST';
    manifestSchemaVersion: string;
    shipped: UtilityStatus[];
    building: UtilityStatus[];
    planned: UtilityStatus[];
  };
  awaitingCanonicalAuthority: string[];
  explanation: string;
  evidenceBoundary: string;
  receipt: {
    manifestDigest: string;
    entryEvidenceDigests: string[];
    outputDigest: string;
    receiptId: string;
  };
}

interface UtilityStatus {
  capability: string;
  engineeringStatus: string;
  deploymentStatus: string;
  publicStatus: string;
}

export async function projectDumpsterLedger(
  manifest: CapabilityManifest,
  funding: FundingConfigResolution,
  values: readonly DumpsterLedgerEntry[],
  source: 'PRODUCTION' | 'TEST_FIXTURE' = 'PRODUCTION'
): Promise<PublicDumpsterLedger> {
  const config = funding.config;
  if (source === 'PRODUCTION' && values.length > 0) {
    throw new Error('DUMPSTER_LEDGER_FIXTURE_LEAK_BLOCKED');
  }
  if (source === 'TEST_FIXTURE' && (!config || !config.configVersion.startsWith('TEST_'))) {
    throw new Error('DUMPSTER_LEDGER_TEST_AUTHORITY_REQUIRED');
  }
  const entries = config ? await normalizeDumpsterLedgerEntries(config, values) : [];
  if (!config && values.length > 0) throw new Error('DUMPSTER_LEDGER_ENTRIES_WITHOUT_AUTHORITY');

  const utility = utilityStatuses(manifest.capabilities);
  const byAsset = aggregateByAsset(entries);
  const tokenKey = config ? `ERC20:${config.tokenAddress}` : null;
  const tokenTotals = tokenKey ? byAsset.find((item) => assetKey(item) === tokenKey) : undefined;
  const accountingState = source === 'TEST_FIXTURE'
    ? 'TEST_FIXTURE' as const
    : funding.status === 'TREASURY_AUTHORITY_NOT_CONFIGURED'
      ? 'PRE_LAUNCH_NO_FUNDING_AUTHORITY' as const
      : 'FAIL_CLOSED' as const;
  const coverageStatus = source === 'TEST_FIXTURE'
    ? 'TEST_FIXTURE_ONLY' as const
    : funding.status === 'TREASURY_AUTHORITY_NOT_CONFIGURED'
      ? 'NO_CANONICAL_FUNDING_AUTHORITY' as const
      : 'FAIL_CLOSED' as const;
  const manifestDigest = await sha256Hex(manifest);
  const output = {
    schemaVersion: DUMPSTER_LEDGER_SCHEMA_VERSION,
    projectionVersion: DUMPSTER_LEDGER_PROJECTION_VERSION,
    accountingState,
    chainId: config?.chainId ?? 5042,
    tokenState: manifest.launchAuthorization.tokenState ?? 'UNVERIFIED',
    launchAuthorization: manifest.launchAuthorization.status,
    marketingAuthorized: manifest.launchAuthorization.marketingAuthorized,
    fundingAuthority: {
      status: funding.status,
      accountingEnabled: false as const,
      tokenAddress: config?.tokenAddress ?? null,
      creatorFeeRecipients: config?.creatorFeeRecipients ?? [],
      treasuryAddresses: config?.treasuryAddresses ?? [],
      effectiveFromBlock: config?.effectiveFromBlock ?? null,
      configVersion: config?.configVersion ?? null,
      categoryPolicyVersion: config?.categoryPolicyVersion ?? null
    },
    totals: {
      entryCount: entries.length,
      inflowEntryCount: entries.filter((entry) => entry.direction === 'INFLOW').length,
      outflowEntryCount: entries.filter((entry) => entry.direction === 'OUTFLOW').length,
      tokenInflowsRaw: tokenTotals?.inflowRaw ?? '0',
      tokenOutflowsRaw: tokenTotals?.outflowRaw ?? '0',
      byAsset
    },
    entries: entries.map((entry) => ({
      ...entry,
      // No Arc explorer convention is frozen in this repository. Null is safer than
      // manufacturing a link contract; entry hashes and addresses remain copyable.
      links: { transaction: null, from: null, to: null }
    })),
    coverage: {
      status: coverageStatus,
      fromBlock: entries[0]?.blockNumber ?? null,
      throughBlock: entries.at(-1)?.blockNumber ?? null
    },
    utilityStatus: {
      source: 'CAPABILITY_MANIFEST' as const,
      manifestSchemaVersion: manifest.schemaVersion,
      ...utility
    },
    awaitingCanonicalAuthority: config ? [
      'REVIEWED_ON_CHAIN_FUNDING_OBSERVATION_SOURCE'
    ] : [
      'TOKEN_CONTRACT_ADDRESS',
      'CREATOR_OR_PROJECT_FEE_RECIPIENTS',
      'TREASURY_ADDRESSES',
      'EFFECTIVE_FROM_BLOCK',
      'CATEGORY_POLICY_VERSION',
      'REVIEWED_ON_CHAIN_FUNDING_OBSERVATION_SOURCE'
    ],
    explanation: source === 'TEST_FIXTURE'
      ? 'TEST fixture projection only. It is not production funding evidence.'
      : config
        ? 'BINRAT is not launched. Canonical funding configuration is present, but production accounting remains disabled until a reviewed on-chain observation source is implemented; totals remain zero.'
        : funding.status === 'TREASURY_AUTHORITY_INVALID'
          ? 'BINRAT is not launched. The supplied funding authority is invalid, so production accounting fails closed and no wallet or balance is presented as truth.'
          : 'BINRAT is not launched. No canonical token treasury or fee route is configured, so production token inflows and outflows are zero and no wallets are presented as treasury authority.',
    evidenceBoundary: 'Ledger entries must be immutable on-chain facts bound to canonical funding authority. Unknown intent remains UNCATEGORIZED; presentation cannot create accounting truth.'
  };
  const outputDigest = await sha256Hex(output);
  const receiptMaterial = {
    projectionVersion: DUMPSTER_LEDGER_PROJECTION_VERSION,
    manifestDigest,
    entryEvidenceDigests: entries.map((entry) => entry.evidenceDigest),
    outputDigest
  };
  return {
    ...output,
    receipt: {
      ...receiptMaterial,
      receiptId: `binrat-dumpster-ledger:${await sha256Hex(receiptMaterial)}`
    }
  };
}

function aggregateByAsset(entries: readonly DumpsterLedgerEntry[]) {
  const values = new Map<string, {
    assetType: LedgerAssetType;
    tokenAddress: string | null;
    entryCount: number;
    inflowRaw: bigint;
    outflowRaw: bigint;
  }>();
  for (const entry of entries) {
    const key = `${entry.assetType}:${entry.tokenAddress ?? 'NATIVE'}`;
    const total = values.get(key) ?? {
      assetType: entry.assetType,
      tokenAddress: entry.tokenAddress,
      entryCount: 0,
      inflowRaw: 0n,
      outflowRaw: 0n
    };
    total.entryCount += 1;
    if (entry.direction === 'INFLOW') total.inflowRaw += BigInt(entry.amountRaw);
    else total.outflowRaw += BigInt(entry.amountRaw);
    values.set(key, total);
  }
  return [...values.values()]
    .sort((a, b) => assetKey(a).localeCompare(assetKey(b)))
    .map((value) => ({
      assetType: value.assetType,
      tokenAddress: value.tokenAddress,
      entryCount: value.entryCount,
      inflowRaw: value.inflowRaw.toString(),
      outflowRaw: value.outflowRaw.toString()
    }));
}

function assetKey(value: { assetType: LedgerAssetType; tokenAddress: string | null }): string {
  return `${value.assetType}:${value.tokenAddress ?? 'NATIVE'}`;
}

function utilityStatuses(capabilities: Record<string, CapabilityState>) {
  const result = { shipped: [] as UtilityStatus[], building: [] as UtilityStatus[], planned: [] as UtilityStatus[] };
  for (const [capability, state] of Object.entries(capabilities).sort(([a], [b]) => a.localeCompare(b))) {
    const value = {
      capability,
      engineeringStatus: state.engineeringStatus ?? 'UNKNOWN',
      deploymentStatus: state.deploymentStatus ?? 'NOT_DEPLOYED',
      publicStatus: state.publicStatus ?? 'NOT_PUBLIC_LIVE_AUTHORIZED'
    };
    if (state.engineeringStatus === 'PLANNED' || state.engineeringStatus === 'EXPERIMENTAL') {
      result.planned.push(value);
    } else if (
      state.engineeringStatus === 'ENGINEERING_PASS' &&
      (state.publicStatus === 'PUBLIC_LIVE_BETA' ||
        state.publicStatus === 'PRE_LAUNCH_TRANSPARENCY_LIVE' ||
        state.deploymentStatus?.includes('LIVE_VERIFIED'))
    ) {
      result.shipped.push(value);
    } else {
      result.building.push(value);
    }
  }
  return result;
}
